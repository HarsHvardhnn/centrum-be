const nodemailer = require("nodemailer");
require("dotenv").config();

console.log("sdd", process.env.GMAIL_USER, process.env.GMAIL_PASS);

const transporter = nodemailer.createTransport({
  name: "example",
  host: "smtp.zoho.com",
  port: 587,
  secure: false, // true for port 465, false for 587
  auth: {
    user: process.env.GMAIL_USER, // your Zoho email
    pass: process.env.GMAIL_PASS, // use app password if 2FA is enabled
  },
});

const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: `"Hospital App" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
