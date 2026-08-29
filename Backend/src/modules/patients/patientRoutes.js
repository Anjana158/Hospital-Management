const express = require("express");

const {
    registerPatient,
    searchPatients,
    getPatientDetails,
    updatePatient,
} = require("./patientController");
const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.use(
    authenticateToken,
    requireRole("RECEPTION")
);

router.get("/search", searchPatients);
router.get("/uhid/:uhid", getPatientDetails);
router.get("/:id", getPatientDetails);
router.patch("/:id", updatePatient);
router.post("/", registerPatient);

module.exports = router;