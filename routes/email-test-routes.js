const express = require("express");
const router = express.Router();
const sendEmail = require("../utils/mailer");

// Test email endpoint
router.post("/test", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;

    // Validate required fields
    if (!to || !subject) {
      return res.status(400).json({
        success: false,
        message: "Please provide 'to' and 'subject' fields"
      });
    }

    // Send email
    const info = await sendEmail({
      to,
      subject,
      text: text || "This is a test email",
      html: html || "<p>This is a test email</p>"
    });

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      messageId: info.messageId
    });
  } catch (error) {
    console.error("Email test error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message
    });
  }
});

module.exports = router; 