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

module.exports = router;
