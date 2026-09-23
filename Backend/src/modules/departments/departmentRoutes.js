const express = require("express");

const {
    getDepartments,
    createDepartment,
    updateDepartment,
} = require("./departmentController");

const { authenticateToken } = require("../../middleware/authMiddleware");
const { requireRole } = require("../../middleware/roleMiddleware");

const router = express.Router();

router.get("/",authenticateToken,requireRole("ADMIN", "RECEPTION"),getDepartments);
router.post("/",authenticateToken,requireRole("ADMIN"),createDepartment);
router.put("/:id",authenticateToken,requireRole("ADMIN"),updateDepartment);

module.exports = router;