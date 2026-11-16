const express = require("express");
const { login, getAssignedRoles, refresh, logout, getCurrentUser } = require("../auth/authController");
const {authenticateToken} = require("../../middleware/authMiddleware");
const router = express.Router();

// public routes
router.get("/roles", getAssignedRoles);
router.post("/login",login);
router.post("/refresh", refresh);
router.post("/logout", logout);
// protected route
router.get("/me",authenticateToken,getCurrentUser);
module.exports = router;
