const express = require("express");

const { getMyDashboardData, } = require("./dashboardController");

const { authenticateToken, } = require("../../middleware/authMiddleware");

const { requireRole, } = require("../../middleware/roleMiddleware");

const router = express.Router();


// ========================================
// MY DASHBOARD
// RECEPTION + BILLING
// ========================================

router.get(
    "/me",
    authenticateToken,
    requireRole("RECEPTION", "BILLING"),
    getMyDashboardData
);


module.exports = router;