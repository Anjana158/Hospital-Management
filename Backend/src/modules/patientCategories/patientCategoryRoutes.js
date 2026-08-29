const express = require("express");

const { getPatientCategories } = require("./patientCategoryController");
const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticateToken,
    requireRole("RECEPTION")
);

router.get("/", getPatientCategories);

module.exports = router;
