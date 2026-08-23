const { prisma } = require("../../config/prisma");


// ========================================
// GET LOGGED-IN USER DASHBOARD
// ========================================

async function getMyDashboard(userId) {

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

            role: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                },
            },
        },
    });

    if (!user) {
        throw new Error("User not found");
    }

    return user;
}

module.exports = {
    getMyDashboard,
};