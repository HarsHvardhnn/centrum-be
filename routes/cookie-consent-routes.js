const express = require("express");
const router = express.Router();
const cookieConsentController = require("../controllers/cookieConsentController");
const authorizeRoles = require("../middlewares/authenticateRole");
const { cookieConsentLimiter, deleteConsentLimiter } = require("../middlewares/rateLimiting");
const { validateConsentData, sanitizeInput } = require("../middlewares/cookieConsentValidation");

// All routes require authentication for any logged-in user
// Using authorizeRoles with all possible roles to ensure user is authenticated
const authenticateUser = authorizeRoles(["patient", "doctor", "receptionist", "admin"]);

// GET /api/cookie-consent - Get user's current cookie consent preferences
router.get("/", cookieConsentLimiter, authenticateUser, cookieConsentController.getConsent);

// POST /api/cookie-consent - Save or update user's cookie consent preferences
router.post("/", cookieConsentLimiter, authenticateUser, sanitizeInput, validateConsentData, cookieConsentController.saveConsent);

// DELETE /api/cookie-consent - Withdraw user's cookie consent (GDPR right to be forgotten)
router.delete("/", deleteConsentLimiter, authenticateUser, cookieConsentController.deleteConsent);

// GET /api/cookie-consent/status - Check if user has given consent (quick status check)
router.get("/status", cookieConsentLimiter, authenticateUser, cookieConsentController.getConsentStatus);

// GET /api/cookie-consent/history - Get user's consent history (for audit purposes)
router.get("/history", cookieConsentLimiter, authenticateUser, cookieConsentController.getConsentHistory);

// GET /api/cookie-consent/health - Health check endpoint (no authentication required)
router.get("/health", cookieConsentController.healthCheck);

module.exports = router; 