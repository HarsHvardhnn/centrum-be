const nodemailer = require("nodemailer");
require("dotenv").config();

console.log("sdd", process.env.GMAIL_USER, process.env.GMAIL_PASS);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com", // This should be smtp.gmail.com, not just "gmail"
  port: 587, // You need to specify the port
  secure: false, // true for 465, false for other ports like 587
  auth: {
    user: process.env.GMAIL_USER, // your Gmail address
    pass: process.env.GMAIL_PASS, // your Gmail app password
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
