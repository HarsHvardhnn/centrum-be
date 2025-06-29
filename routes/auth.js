const express = require("express");
const router = express.Router();
const {
  signup,
  verifyOTP,
  login,
  googleLogin,
  requestPasswordReset,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  toggleSingleSessionMode,
  resendOtp,
  getUserPublicInfo,
  getProfile,
  updateProfile,
  // 2FA functions
  verify2FA,
  resend2FACode,
  requestEmailFallback,
  toggle2FA,
  get2FAStatus,
} = require("../controllers/authController");
const authorizeRoles = require("../middlewares/authenticateRole");
const {upload} = require("../middlewares/cloudinaryUpload");
const { 
  getGoogleAuthUrl, 
  handleGoogleCallback, 
  initializeGoogleAuth, 
  checkGoogleAuthStatus 
} = require("../controllers/googleController");

router.post("/signup", signup);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);
router.post("/logout-all", authorizeRoles, logoutAll);
router.post("/toggle-single-session", authorizeRoles, toggleSingleSessionMode);

router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

router.post("/resend-otp", resendOtp);
router.get("/profile", authorizeRoles([]), getUserPublicInfo);

router.get("/profile/user",authorizeRoles(["admin","doctor","receptionist","patient"]), getProfile);
router.put(
  "/profile",
  upload.single("file"),
  authorizeRoles(["admin", "doctor", "receptionist","patient"]),
  updateProfile
);


// Google Calendar auth routes
router.get("/google/auth-url", authorizeRoles(["admin"]), getGoogleAuthUrl);

// OAuth callback route
router.get(
  "/oauth2callback",
  authorizeRoles(["admin"]),
  handleGoogleCallback
);

// New server-side Google token management APIs
router.post(
  "/google/initialize",
  authorizeRoles(["admin"]),
  initializeGoogleAuth
);

router.get(
  "/google/status",
  authorizeRoles(["admin"]),
  checkGoogleAuthStatus
);

// 2FA routes (SMS, Email, and Backup Codes)
router.post("/2fa/verify", verify2FA);
router.post("/2fa/resend", resend2FACode);
router.post("/2fa/email-fallback", requestEmailFallback);
router.post("/2fa/toggle", authorizeRoles(["admin", "doctor", "receptionist", "patient"]), toggle2FA);
router.get("/2fa/status", authorizeRoles(["admin", "doctor", "receptionist", "patient"]), get2FAStatus);

module.exports = router;
