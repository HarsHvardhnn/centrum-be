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
} = require("../controllers/authController");
const authorizeRoles = require("../middlewares/authenticateRole");

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

module.exports = router;
