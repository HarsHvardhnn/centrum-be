const express = require("express");
const router = express.Router();
const sendEmail = require("../utils/mailer");

// Test email endpoint (fire-and-forget: request completes immediately, email may fail in background)
router.post("/test", (req, res) => {
  const { to, subject, text, html } = req.body;

  if (!to || !subject) {
    return res.status(400).json({
      success: false,
      message: "Proszę podać pola 'do' i 'temat'"
    });
  }

  // Respond immediately
  res.status(200).json({
    success: true,
    message: "Request accepted, email sending in background"
  });

  // Fire-and-forget: send in background, log errors only
  sendEmail({
    to,
    subject,
    text: text || "To jest testowy email",
    html: html || "<p>To jest testowy email</p>"
  }).catch((err) => console.error("Email test (background) error:", err));
});

module.exports = router; 