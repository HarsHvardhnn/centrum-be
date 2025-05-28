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
        message: "Proszę podać pola 'do' i 'temat'"
      });
    }

    // Send email
    const info = await sendEmail({
      to,
      subject,
      text: text || "To jest testowy email",
      html: html || "<p>To jest testowy email</p>"
    });

    res.status(200).json({
      success: true,
      message: "Email wysłany pomyślnie",
      messageId: info.messageId
    });
  } catch (error) {
    console.error("Email test error:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się wysłać emaila",
      error: error.message
    });
  }
});

module.exports = router; 