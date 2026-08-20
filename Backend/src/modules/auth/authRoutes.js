const express = require("express");
const { login,getCurrentUser } = require("../auth/authController");
const {authenticateToken} = require("../../middleware/authMiddleware");
const router = express.Router();

// public route
router.post("/login",login);
// protected route
router.get("/me",authenticateToken,getCurrentUser);
module.exports = router;
