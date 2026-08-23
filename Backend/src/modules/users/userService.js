const bcrypt = require("bcrypt");
const { prisma } = require("../../config/prisma");


// ========================================
// GET ALL USERS
// ========================================

async function getAllUsers(roleId) {
    const where = {};

    if (roleId) {
        where.roleId = Number(roleId);
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

            role: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                },
            },
        },

        orderBy: {
            createdAt: "desc",
        },
    });

    return users;
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
    const {
        employeeId,
        fullName,
        username,
        password,
        roleId,
        status,
    } = data;

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

    const role = await prisma.role.findUnique({
        where: {
            id: Number(roleId),
        },
    });

    if (!role) {
        throw new Error("Selected role does not exist");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
        data: {
            employeeId,
            fullName,
            username,
            password: hashedPassword,
            roleId: Number(roleId),
            status: status || "ACTIVE",
            createdBy: adminId,
        },

        select: {
            id: true,
            employeeId: true,
            fullName: true,
            username: true,
            status: true,
            role: true,
            createdAt: true,
        },
    });

    return user;
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

    const {
        employeeId,
        fullName,
        username,
        password,
        roleId,
        status,
    } = data;


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


    // Check role
    if (roleId) {
        const role = await prisma.role.findUnique({
            where: {
                id: Number(roleId),
            },
        });

        if (!role) {
            throw new Error("Selected role does not exist");
        }
    }


    const updateData = {
        employeeId,
        fullName,
        username,
        status,
        roleId: roleId ? Number(roleId) : undefined,
    };

    // reset failed attempts when activated
    if(status === "ACTIVE"){
        updateData.failedAttempts = 0;
    }

    // Password only changes when admin provides one
    if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(
            password,
            10
        );
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
            role: true,
            createdAt: true,
            updatedAt: true,
        },
    });

    return updatedUser;
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
        throw new Error(
            "Invalid user status"
        );
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
                role: true,
                lastLogin: true,
                updatedAt: true,
            },
        });


    return updatedUser;

}


module.exports = {
    getAllUsers,
    getAllRoles,
    createUser,
    updateUser,
    changeUserStatus,
};