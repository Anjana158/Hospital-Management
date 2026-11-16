const bcrypt = require("bcrypt");
const { prisma } = require("../../config/prisma");

// ========================================
// GET ALL USERS
// ========================================

const roleSelect = {
    id: true,
    name: true,
    description: true,
};

const userRoleSelect = {
    userRoles: {
        orderBy: {
            roleId: "asc",
        },
        select: {
            role: {
                select: roleSelect,
            },
        },
    },
};

function withRoles(user) {
    const roles = (user.userRoles || []).map((entry) => entry.role);
    const { userRoles, ...profile } = user;
    return {
        ...profile,
        roles,
    };
}

function normalizeRoleIds(roleIds, roleId) {
    const source = Array.isArray(roleIds)
        ? roleIds
        : roleId !== undefined && roleId !== null && roleId !== ""
            ? [roleId]
            : [];

    const ids = [...new Set(
        source
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];

    if (!ids.length) {
        throw new Error("At least one role is required");
    }

    return ids;
}

async function assertRolesExist(roleIds) {
    const roles = await prisma.role.findMany({
        where: {
            id: {
                in: roleIds,
            },
        },
        select: {
            id: true,
        },
    });

    if (roles.length !== roleIds.length) {
        throw new Error("One or more selected roles do not exist");
    }
}

async function getAllUsers(roleId) {
    const where = {};
    if (roleId) {
        where.userRoles = {
            some: {
                roleId: Number(roleId),
            },
        };
    }
    const users = await prisma.user.findMany({
        where,
        select: {
            id: true,
            employeeId: true,
            fullName: true,
            username: true,
            status: true,
            lastLogin: true,
            failedAttempts: true,
            createdBy: true,
            createdAt: true,
            updatedAt: true,
            ...userRoleSelect,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return users.map(withRoles);
}

// ========================================
// GET ALL ROLES
// ========================================

async function getAllRoles() {
    return await prisma.role.findMany({
        orderBy: {
            id: "asc",
        },
    });
}

// ========================================
// CREATE USER
// ========================================

async function createUser(data, adminId) {
    const {employeeId,fullName,username,password,roleIds,roleId,status,} = data;
    const normalizedRoleIds = normalizeRoleIds(roleIds, roleId);
    const existingEmployee = await prisma.user.findUnique({
        where: {
            employeeId,
        },
    });

    if (existingEmployee) {
        throw new Error("Employee ID already exists");
    }

    const existingUsername = await prisma.user.findUnique({
        where: {
            username,
        },
    });

    if (existingUsername) {
        throw new Error("Username already exists");
    }

    await assertRolesExist(normalizedRoleIds);

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            employeeId,
            fullName,
            username,
            password: hashedPassword,
            status: status || "ACTIVE",
            createdBy: adminId,
            userRoles: {
                create: normalizedRoleIds.map((id) => ({
                    roleId: id,
                })),
            },
        },

        select: {
            id: true,
            employeeId: true,
            fullName: true,
            username: true,
            status: true,
            createdAt: true,
            ...userRoleSelect,
        },
    });

    return withRoles(user);
}


// ========================================
// UPDATE USER
// ========================================

async function updateUser(id, data) {
    const userId = Number(id);
    const existingUser = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    const {employeeId,fullName,username,password,roleIds,roleId,status,} = data;

    // Check employee ID
    if (employeeId && employeeId !== existingUser.employeeId) {
        const employeeExists = await prisma.user.findUnique({
            where: {
                employeeId,
            },
        });

        if (employeeExists) {
            throw new Error("Employee ID already exists");
        }
    }

    // Check username
    if (username && username !== existingUser.username) {
        const usernameExists = await prisma.user.findUnique({
            where: {
                username,
            },
        });
        if (usernameExists) {
            throw new Error("Username already exists");
        }
    }

    const updateData = {
        employeeId,
        fullName,
        username,
        status,
    };

    if (roleIds !== undefined || (roleId !== undefined && roleId !== null && roleId !== "")) {
        const normalizedRoleIds = normalizeRoleIds(roleIds, roleId);
        await assertRolesExist(normalizedRoleIds);
        updateData.userRoles = {
            deleteMany: {},
            create: normalizedRoleIds.map((id) => ({
                roleId: id,
            })),
        };
    }

    // reset failed attempts when activated
    if(status === "ACTIVE"){
        updateData.failedAttempts = 0;
    }

    // Password only changes when admin provides one
    if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password,10);
    }

    const updatedUser = await prisma.user.update({
        where: {
            id: userId,
        },
        data: updateData,
        select: {
            id: true,
            employeeId: true,
            fullName: true,
            username: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            ...userRoleSelect,
        },
    });

    return withRoles(updatedUser);
}

// ========================================
// CHANGE USER STATUS
// ========================================

async function changeUserStatus(id, status, adminId) {
    const userId = Number(id);

    if (userId === Number(adminId)) {
        throw new Error("You cannot delete your own account");
    }

    const user = await prisma.user.findUnique({
        where: {
            id: userId,
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    // Validate status
    const allowedStatuses = [
        "ACTIVE",
        "INACTIVE",
        "LOCKED",
    ];

    if (!allowedStatuses.includes(status)) {
        throw new Error("Invalid user status");
    }

    const updatedUser = await prisma.user.update({
            where: {
                id: userId,
            },
            data: {
                status,
            },
            select: {
                id: true,
                employeeId: true,
                fullName: true,
                username: true,
                status: true,
                lastLogin: true,
                updatedAt: true,
                ...userRoleSelect,
            },
        });
    return withRoles(updatedUser);
}

module.exports = {
    getAllUsers,
    getAllRoles,
    createUser,
    updateUser,
    changeUserStatus,
};