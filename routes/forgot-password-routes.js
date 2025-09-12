const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const forgotPasswordController = require("../controllers/forgotPasswordController");

// Validation middleware for request password reset
const validateRequestPasswordReset = [
  body("email")
    .optional()
    .isEmail()
    .withMessage("Podaj prawidłowy adres email"),
  body("phone")
    .optional()
    .isMobilePhone("pl-PL")
    .withMessage("Podaj prawidłowy numer telefonu"),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Podaj adres email lub numer telefonu");
    }
    return true;
  })
];

// Validation middleware for reset password
const validateResetPassword = [
  body("otp")
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage("Kod weryfikacyjny musi składać się z 6 cyfr"),
  body("newPassword")
    .isLength({ min: 6 })
    .withMessage("Hasło musi mieć co najmniej 6 znaków"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Podaj prawidłowy adres email"),
  body("phone")
    .optional()
    .isMobilePhone("pl-PL")
    .withMessage("Podaj prawidłowy numer telefonu"),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Podaj adres email lub numer telefonu");
    }
    return true;
  })
];

// Validation middleware for resend OTP
const validateResendOTP = [
  body("email")
    .optional()
    .isEmail()
    .withMessage("Podaj prawidłowy adres email"),
  body("phone")
    .optional()
    .isMobilePhone("pl-PL")
    .withMessage("Podaj prawidłowy numer telefonu"),
  body().custom((value, { req }) => {
    if (!req.body.email && !req.body.phone) {
      throw new Error("Podaj adres email lub numer telefonu");
    }
    return true;
  })
];

/**
 * @route POST /api/auth/forgot-password
 * @desc Request password reset - sends OTP to email (preferred) or SMS (fallback)
 * @access Public
 * @body {string} email - User's email address (optional)
 * @body {string} phone - User's phone number (optional)
 * @note Either email or phone must be provided
 */
router.post(
  "/forgot-password",
  validateRequestPasswordReset,
  forgotPasswordController.requestPasswordReset
);

/**
 * @route POST /api/auth/reset-password
 * @desc Reset password using OTP verification
 * @access Public
 * @body {string} email - User's email address (optional)
 * @body {string} phone - User's phone number (optional)
 * @body {string} otp - 6-digit verification code
 * @body {string} newPassword - New password (min 6 characters)
 * @note Either email or phone must be provided
 */
router.post(
  "/reset-password",
  validateResetPassword,
  forgotPasswordController.resetPassword
);

/**
 * @route POST /api/auth/resend-password-reset-otp
 * @desc Resend OTP for password reset
 * @access Public
 * @body {string} email - User's email address (optional)
 * @body {string} phone - User's phone number (optional)
 * @note Either email or phone must be provided
 * @note Rate limited to 1 request per minute
 */
router.post(
  "/resend-password-reset-otp",
  validateResendOTP,
  forgotPasswordController.resendPasswordResetOTP
);

module.exports = router;
