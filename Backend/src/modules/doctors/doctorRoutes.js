const express = require("express");

const {
    getDoctors,
    createDoctor,
    updateDoctor,
} = require("./doctorController");

const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.get("/",authenticateToken,requireRole("ADMIN", "RECEPTION"),getDoctors);
router.post("/",authenticateToken,requireRole("ADMIN"),createDoctor);
router.put("/:id",authenticateToken,requireRole("ADMIN"),updateDoctor);

module.exports = router;