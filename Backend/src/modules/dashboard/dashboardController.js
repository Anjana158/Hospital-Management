const {getMyDashboard,} = require("./dashboardService");


// ========================================
// GET MY DASHBOARD
// ========================================

async function getMyDashboardData(req, res) {

    try {

        const user =
            await getMyDashboard(
                req.user.userId
            );

        return res.status(200).json({
            success: true,
            data: user,
        });

    } catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to load dashboard",
        });
    }
}

module.exports = {
    getMyDashboardData,
};