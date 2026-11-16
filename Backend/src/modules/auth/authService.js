const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { prisma } = require("../../config/prisma");

const MAX_FAILED_ATTEMPTS = 5;
const ACCESS_TOKEN_TTL = "15m";
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const assignedRoleSelect = {
    userRoles: {
        orderBy: {
            roleId: "asc",
        },
        select: {
            role: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                },
            },
        },
    },
};

function assignedRoles(user) {
    return (user?.userRoles || []).map((entry) => entry.role);
}

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user, roleName) {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            role: roleName,
            type: "access",
        },
        process.env.JWT_SECRET,
        {
            expiresIn: ACCESS_TOKEN_TTL,
        }
    );
}

async function issueRefreshToken(userId, roleName) {
    const refreshToken = crypto.randomBytes(48).toString("base64url");

    await prisma.refreshToken.create({
        data: {
            userId,
            tokenHash: hashRefreshToken(refreshToken),
            roleName,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
    });

    return refreshToken;
}

async function getRolesForUsername(username) {
    const user = await prisma.user.findUnique({
        where: {
            username,
        },
        select: assignedRoleSelect,
    });

    if (!user) {
        return [];
    }

    return assignedRoles(user);
}

async function loginUser(username, password, selectedRole) {
    const user = await prisma.user.findUnique({
        where: {
            username,
        },
        include: assignedRoleSelect,
    });

    if (!user) {
        throw new Error("Invalid Username or Password");
    }

    if (user.status === "LOCKED") {
        throw new Error("Your account is locked. Please contact the administrator.");
    }

    if (user.status === "INACTIVE") {
        throw new Error("Your account is inactive. Please contact the administrator.");
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
        const newFailedAttempts = user.failedAttempts + 1;

        if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    failedAttempts: newFailedAttempts,
                    status: "LOCKED",
                },
            });
            throw new Error("Too many failed login attempts. Your account has been locked. Please contact the administrator.");
        }

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                failedAttempts: newFailedAttempts,
            },
        });

        const remainingAttempts = MAX_FAILED_ATTEMPTS - newFailedAttempts;
        throw new Error(`Invalid Username or Password. ${remainingAttempts} login attempts remaining.`);
    }

    const normalizedRole = String(selectedRole || "").trim().toUpperCase();
    const userRoles = assignedRoles(user);
    const matchedRole = normalizedRole
        ? userRoles.find((role) => role.name.toUpperCase() === normalizedRole)
        : userRoles.find((role) => role.name.toUpperCase() === "ADMIN");

    if (!matchedRole) {
        throw new Error(
            normalizedRole
                ? "Selected role is not assigned to this account"
                : "Role is required for this account"
        );
    }

    const token = signAccessToken(user, matchedRole.name);
    const refreshToken = await issueRefreshToken(user.id, matchedRole.name);

    await prisma.user.update({
        where: {
            id: user.id,
        },
        data: {
            lastLogin: new Date(),
            failedAttempts: 0,
        },
    });

    return {
        token,
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        user: {
            id: user.id,
            employeeId: user.employeeId,
            fullName: user.fullName,
            username: user.username,
            role: matchedRole,
            status: user.status,
        },
    };
}

async function refreshSession(rawRefreshToken) {
    if (!rawRefreshToken) {
        throw new Error("Refresh token is required");
    }

    const existing = await prisma.refreshToken.findUnique({
        where: {
            tokenHash: hashRefreshToken(rawRefreshToken),
        },
        include: {
            user: {
                include: assignedRoleSelect,
            },
        },
    });

    if (!existing) {
        throw new Error("Refresh token is invalid");
    }

    if (existing.revokedAt) {
        await prisma.refreshToken.updateMany({
            where: {
                userId: existing.userId,
                revokedAt: null,
            },
            data: {
                revokedAt: new Date(),
            },
        });
        throw new Error("Refresh token is invalid");
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
        throw new Error("Refresh token is expired");
    }

    const user = existing.user;

    if (user.status !== "ACTIVE") {
        throw new Error("Your account is not active");
    }

    const roleStillAssigned = assignedRoles(user).some(
        (role) => role.name.toUpperCase() === existing.roleName.toUpperCase()
    );

    if (!roleStillAssigned) {
        throw new Error("Selected role is no longer assigned");
    }

    const revoked = await prisma.refreshToken.updateMany({
        where: {
            id: existing.id,
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });

    if (revoked.count !== 1) {
        throw new Error("Refresh token is invalid");
    }

    const refreshToken = await issueRefreshToken(user.id, existing.roleName);

    return {
        token: signAccessToken(user, existing.roleName),
        refreshToken,
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    };
}

async function revokeRefreshToken(rawRefreshToken) {
    if (!rawRefreshToken) {
        return;
    }

    await prisma.refreshToken.updateMany({
        where: {
            tokenHash: hashRefreshToken(rawRefreshToken),
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });
}

module.exports = {
    loginUser,
    getRolesForUsername,
    refreshSession,
    revokeRefreshToken,
};
