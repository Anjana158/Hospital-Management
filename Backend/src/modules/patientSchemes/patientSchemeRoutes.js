const express = require("express");

const {
    getPatientSchemes,
    addPatientScheme,
    editPatientScheme,
} = require("./patientSchemeController");

const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken);

router.get("/",requireRole("RECEPTION", "ADMIN"),getPatientSchemes);
router.post("/", requireRole("ADMIN"),addPatientScheme);
router.patch("/:id",requireRole("ADMIN"),editPatientScheme);

module.exports = router;