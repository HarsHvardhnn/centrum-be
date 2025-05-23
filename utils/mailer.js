const nodemailer = require("nodemailer");
require("dotenv").config();

// For debugging purposes only - remove in production
console.log("SMTP Config:", {
  host: "smtp.zoho.eu", // Using Zoho EU server for Poland
  port: 465,
  user: process.env.ZOHO_USER ? "***@" + process.env.ZOHO_USER.split('@')[1] : undefined, // Hide full email 
  pass: process.env.ZOHO_PASS ? "********" : undefined, // Hide password
  secure: true
});

// Create transporter with SSL configuration
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.eu", // Using Zoho EU server for Poland
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: process.env.ZOHO_USER,
    pass: process.env.ZOHO_PASS,
  },
  debug: true // Enable debug mode to see detailed logs
});

// Test the connection before using it
transporter.verify(function(error, success) {
  if (error) {
    console.error("SMTP Connection Error:", error);
  } else {
    console.log("SMTP Server is ready to send emails");
  }
});

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: `"Centrum Medyczne" <${process.env.ZOHO_USER}>`,
      to,
      subject,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
};

module.exports = sendEmail;
