const express = require("express");

const {
    registerPatient,
    searchPatients,
    getTodayPatients,
    getPatientDetails,
    updatePatient,
} = require("./patientController");
const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.use(authenticateToken, requireRole("RECEPTION"));

router.get("/search", searchPatients);
router.get("/today",getTodayPatients);
router.get("/uhid/:uhid", getPatientDetails);
router.get("/:id", getPatientDetails);
router.patch("/:id", updatePatient);
router.post("/", registerPatient);

module.exports = router;