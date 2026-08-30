const express = require("express");

const {
    getPatientCategories,
    addPatientCategory,
    editPatientCategory,
} = require("./patientCategoryController");
const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/", requireRole("RECEPTION", "ADMIN"), getPatientCategories);
router.post("/", requireRole("ADMIN"), addPatientCategory);
router.patch("/:id", requireRole("ADMIN"), editPatientCategory);

module.exports = router;
