const express = require("express");

const {
    getUsers,
    getRoles,
    addUser,
    editUser,
    updateUserStatus,
} = require("./userController");

const {authenticateToken,} = require("../../middleware/authMiddleware");
const {requireRole,} = require("../../middleware/roleMiddleware");
const router = express.Router();


// ========================================
// ALL USER MANAGEMENT ROUTES
// ADMIN ONLY
// ========================================

router.use(
    authenticateToken,
    requireRole("ADMIN")
);


// Get users
router.get("/", getUsers);

// Get roles
router.get("/roles", getRoles);

// Create user
router.post("/", addUser);


// Update user
router.put("/:id", editUser);


// change status
router.patch("/:id/status",updateUserStatus);


module.exports = router;