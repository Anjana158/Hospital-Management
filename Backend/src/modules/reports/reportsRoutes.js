const express = require("express");

const { getReceptionistReport, getAdminReceptionReport } = require("./reportController");
const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.get("/receptionist", authenticateToken, requireRole("RECEPTION"), getReceptionistReport);
router.get("/admin", authenticateToken, requireRole("ADMIN"), getAdminReceptionReport);

module.exports = router;
