const { prisma } = require("../../config/prisma");

// ========================================
// GET LOGGED-IN USER DASHBOARD
// ========================================

async function getMyDashboard(userId, selectedRole) {

    const user = await prisma.user.findUnique({
        where: {
            id: Number(userId),
        },

        select: {
            id: true,
            employeeId: true,
            fullName: true,
            username: true,
            status: true,
            lastLogin: true,
            failedAttempts: true,
            createdAt: true,

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
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    const roles = user.userRoles.map((entry) => entry.role);
    const normalizedRole = String(selectedRole || "").toUpperCase();
    const role = roles.find((item) => item.name.toUpperCase() === normalizedRole) || null;
    const { userRoles, ...profile } = user;

    return {
        ...profile,
        role,
    };
}

module.exports = {getMyDashboard,};