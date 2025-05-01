const express = require("express");
const router = express.Router();
const googleAuthController = require("../controllers/googleAuthController");
const authMiddleware = require("../middleware/authMiddleware"); // Assuming you have auth middleware

// Route to get Google OAuth URL
router.get("/auth-url", authMiddleware, googleAuthController.getGoogleAuthUrl);

// Route to handle Google OAuth callback
router.get(
  "/oaut2callback",
  authMiddleware,
  googleAuthController.handleGoogleCallback
);

module.exports = router;
