const express = require("express");
const router = express.Router();
const emailPreviewController = require("../controllers/emailPreviewController");
const authorizeRoles = require("../middlewares/authenticateRole");

// @route   POST /api/email-preview/send-all
// @desc    Send all email templates to preview email
// @access  Private (admin only)
router.post(
  "/send-all",
  authorizeRoles(["admin"]),
  emailPreviewController.sendAllEmailTemplates
);

// @route   GET /api/email-preview/templates
// @desc    Get list of all available email templates
// @access  Private (admin only)
router.get(
  "/templates",
  authorizeRoles(["admin"]),
  emailPreviewController.getEmailTemplatesList
);

module.exports = router;
