const bcrypt = require("bcrypt");
const crypto = require("crypto");
const OTP = require("../models/otp");
const user = require("../models/user-entity/user");
const { sendSMS } = require("../utils/smsapi");
const sendEmail = require("../utils/mailer");
const { validationResult } = require("express-validator");

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Create HTML email template for password reset OTP
const createPasswordResetEmailHtml = (otp, userRole) => {
  const roleDisplay = userRole === 'doctor' ? 'Lekarz' : 'Recepcjonista';
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Hasła - Centrum Medyczne</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }
            .header {
                background-color: #000000;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 8px 8px 0 0;
            }
            .logo-container {
                display: inline-block;
                background-color: rgba(255, 255, 255, 0.95);
                border-radius: 12px;
                padding: 12px;
                margin-bottom: 15px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .logo {
                max-width: 150px;
                height: auto;
                margin-bottom: 0;
                background-color: transparent !important;
                border-radius: 8px;
                padding: 0;
                /* Ensure logo is visible in both light and dark themes */
                filter: brightness(1) contrast(1);
                display: block;
            }
            /* Dark theme compatibility */
            @media (prefers-color-scheme: dark) {
                .logo {
                    background-color: rgba(255, 255, 255, 0.1) !important;
                    filter: brightness(1.2) contrast(1.1);
                }
            }
            .content {
                background-color: #f9f9f9;
                padding: 30px;
                border-radius: 0 0 8px 8px;
                border: 1px solid #ddd;
            }
            .otp-code {
                background-color: #20B2AA;
                color: white;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                padding: 20px;
                margin: 20px 0;
                border-radius: 8px;
                letter-spacing: 5px;
            }
            .warning {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .footer {
                text-align: center;
                margin-top: 30px;
                font-size: 12px;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo-container">
                <img src="${logoUrl}" alt="CM7MED Logo" class="logo" />
            </div>
            <h1>Centrum Medyczne</h1>
            <h2>Reset Hasła</h2>
        </div>
        
        <div class="content">
            <p>Witaj ${roleDisplay},</p>
            
            <p>Otrzymałeś ten email, ponieważ zostało zgłoszone żądanie resetu hasła dla Twojego konta.</p>
            
            <p><strong>Twój kod weryfikacyjny to:</strong></p>
            
            <div class="otp-code">${otp}</div>
            
            <div class="warning">
                <strong>⚠️ Ważne informacje:</strong>
                <ul>
                    <li>Kod jest ważny przez <strong>10 minut</strong></li>
                    <li>Nie udostępniaj tego kodu nikomu</li>
                    <li>Jeśli nie zgłaszałeś resetu hasła, zignoruj ten email</li>
                    <li>Kod może być użyty tylko raz</li>
                </ul>
            </div>
            
            <p>Jeśli masz problemy z dostępem do konta, skontaktuj się z administratorem systemu.</p>
            
            <p>Z poważaniem,<br>
            <strong>Zespół Centrum Medycznego</strong></p>
        </div>
        
        <div class="footer">
            <p>Ten email został wygenerowany automatycznie. Prosimy nie odpowiadać na tę wiadomość.</p>
        </div>
    </body>
    </html>
  `;
};

// Send password reset OTP via email
const sendPasswordResetOTPEmail = async (email, otp, userRole) => {
  try {
    const html = createPasswordResetEmailHtml(otp, userRole);
    const text = `Twój kod weryfikacyjny do resetu hasła: ${otp}. Kod jest ważny przez 10 minut. Nie udostępniaj go nikomu.`;
    
    await sendEmail({
      to: email,
      subject: "Reset Hasła - Kod Weryfikacyjny",
      html: html,
      text: text
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error.message };
  }
};

// Send password reset OTP via SMS
const sendPasswordResetOTPSMS = async (phone, otp) => {
  try {
    const message = `CM7Med- Kod weryfikacyjny do resetu hasla: ${otp}. Kod jest wazny przez 10 minut. Nie udostepniaj go nikomu!`;
    
    const result = await sendSMS(phone, message, "CM7Med");
    
    if (result.success) {
      return { success: true, messageId: result.messageId };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("Error sending password reset SMS:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Request password reset - Send OTP to email (preferred) or SMS (fallback)
 * @route POST /api/auth/forgot-password
 * @access Public
 */
exports.requestPasswordReset = async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: errors.array()
      });
    }

    const { email, phone } = req.body;

    // Validate that at least one contact method is provided
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Adres email lub numer telefonu jest wymagany"
      });
    }

    // Find user by email or phone (only doctors and receptionists)
    let userFound = null;
    const searchCriteria = { 
      role: { $in: ["doctor", "receptionist"] },
      deleted: false 
    };

    if (email) {
      userFound = await user.findOne({ ...searchCriteria, email: email });
    } else if (phone) {
      userFound = await user.findOne({ ...searchCriteria, phone: phone });
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono użytkownika o podanych danych. Sprawdź poprawność adresu email lub numeru telefonu."
      });
    }

    // Generate OTP
    const otpCode = generateOTP();

    // Clean up any existing OTPs for this user and purpose
    await OTP.deleteMany({
      userId: userFound._id,
      purpose: "password-reset"
    });

    let deliveryMethod = null;
    let deliveryResult = null;
    let deliveryAddress = null;

    // Try email first (preferred method)
    if (userFound.email && email) {
      try {
        const emailResult = await sendPasswordResetOTPEmail(otpCode, userFound.role, userFound.email);
        
        if (emailResult.success) {
          deliveryMethod = "email";
          deliveryResult = emailResult;
          deliveryAddress = userFound.email;
        } else {
          console.log("Email delivery failed, will try SMS:", emailResult.error);
        }
      } catch (emailError) {
        console.log("Email delivery error, will try SMS:", emailError.message);
      }
    }

    // If email failed or not available, try SMS
    if (!deliveryMethod && userFound.phone) {
      try {
        const smsResult = await sendPasswordResetOTPSMS(userFound.phone, otpCode);
        
        if (smsResult.success) {
          deliveryMethod = "sms";
          deliveryResult = smsResult;
          deliveryAddress = userFound.phone;
        } else {
          console.log("SMS delivery failed:", smsResult.error);
        }
      } catch (smsError) {
        console.log("SMS delivery error:", smsError.message);
      }
    }

    // If both methods failed
    if (!deliveryMethod) {
      return res.status(500).json({
        success: false,
        message: "Nie udało się wysłać kodu weryfikacyjnego. Spróbuj ponownie później lub skontaktuj się z administratorem."
      });
    }

    // Save OTP to database
    const otpRecord = new OTP({
      userId: userFound._id,
      otp: otpCode,
      purpose: "password-reset",
      deliveryMethod: deliveryMethod,
      email: deliveryMethod === "email" ? deliveryAddress : null,
      phone: deliveryMethod === "sms" ? deliveryAddress : null,
      maxAttempts: 5,
      createdAt: new Date()
    });

    await otpRecord.save();

    // Prepare response (don't reveal which method was used for security)
    const maskedAddress = deliveryMethod === "email" 
      ? `${deliveryAddress.substring(0, 3)}***@${deliveryAddress.split('@')[1]}`
      : `${deliveryAddress.substring(0, 3)}***${deliveryAddress.substring(deliveryAddress.length - 3)}`;

    return res.status(200).json({
      success: true,
      message: `Kod weryfikacyjny został wysłany na ${deliveryMethod === "email" ? "adres email" : "numer telefonu"}`,
      data: {
        deliveryMethod: deliveryMethod,
        maskedAddress: maskedAddress,
        expiresIn: "10 minut"
      }
    });

  } catch (error) {
    console.error("Error in requestPasswordReset:", error);
    return res.status(500).json({
      success: false,
      message: "Wystąpił błąd podczas przetwarzania żądania",
      error: error.message
    });
  }
};

/**
 * Verify OTP and reset password
 * @route POST /api/auth/reset-password
 * @access Public
 */
exports.resetPassword = async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: errors.array()
      });
    }

    const { email, phone, otp, newPassword } = req.body;

    // Validate required fields
    if (!otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Kod weryfikacyjny i nowe hasło są wymagane"
      });
    }

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Adres email lub numer telefonu jest wymagany"
      });
    }

    // Find user
    let userFound = null;
    const searchCriteria = { 
      role: { $in: ["doctor", "receptionist"] },
      deleted: false 
    };

    if (email) {
      userFound = await user.findOne({ ...searchCriteria, email: email });
    } else if (phone) {
      userFound = await user.findOne({ ...searchCriteria, phone: phone });
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono użytkownika"
      });
    }

    // Find OTP record
    const otpRecord = await OTP.findOne({
      userId: userFound._id,
      purpose: "password-reset",
      otp: otp
    });

    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy kod weryfikacyjny"
      });
    }

    // Check if OTP has expired
    if (otpRecord.hasExpired()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: "Kod weryfikacyjny wygasł. Wygeneruj nowy kod."
      });
    }

    // Check if OTP is blocked
    if (otpRecord.isBlocked()) {
      return res.status(400).json({
        success: false,
        message: "Zbyt wiele nieudanych prób. Spróbuj ponownie później."
      });
    }

    // Check if max attempts exceeded
    if (otpRecord.attemptsExceeded()) {
      await otpRecord.blockUser();
      return res.status(400).json({
        success: false,
        message: "Przekroczono maksymalną liczbę prób. Konto zostało zablokowane na 15 minut."
      });
    }

    // Increment attempt counter
    otpRecord.attempts += 1;
    await otpRecord.save();

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Hasło musi mieć co najmniej 6 znaków"
      });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update user password
    userFound.password = hashedPassword;
    await userFound.save();

    // Mark OTP as verified and delete it
    await OTP.deleteOne({ _id: otpRecord._id });

    // Clean up any other password reset OTPs for this user
    await OTP.deleteMany({
      userId: userFound._id,
      purpose: "password-reset"
    });

    return res.status(200).json({
      success: true,
      message: "Hasło zostało pomyślnie zresetowane",
      data: {
        userId: userFound._id,
        role: userFound.role,
        email: userFound.email,
        phone: userFound.phone
      }
    });

  } catch (error) {
    console.error("Error in resetPassword:", error);
    return res.status(500).json({
      success: false,
      message: "Wystąpił błąd podczas resetowania hasła",
      error: error.message
    });
  }
};

/**
 * Resend OTP for password reset
 * @route POST /api/auth/resend-password-reset-otp
 * @access Public
 */
exports.resendPasswordResetOTP = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        message: "Adres email lub numer telefonu jest wymagany"
      });
    }

    // Find user
    let userFound = null;
    const searchCriteria = { 
      role: { $in: ["doctor", "receptionist"] },
      deleted: false 
    };

    if (email) {
      userFound = await user.findOne({ ...searchCriteria, email: email });
    } else if (phone) {
      userFound = await user.findOne({ ...searchCriteria, phone: phone });
    }

    if (!userFound) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono użytkownika"
      });
    }

    // Find existing OTP
    const existingOTP = await OTP.findOne({
      userId: userFound._id,
      purpose: "password-reset"
    });

    if (!existingOTP) {
      return res.status(400).json({
        success: false,
        message: "Brak aktywnego żądania resetu hasła. Wygeneruj nowy kod."
      });
    }

    // Check if can resend (rate limiting)
    if (!existingOTP.canResend()) {
      return res.status(400).json({
        success: false,
        message: "Możesz wysłać nowy kod za 1 minutę"
      });
    }

    // Generate new OTP
    const newOtpCode = generateOTP();

    // Update OTP record
    existingOTP.otp = newOtpCode;
    existingOTP.lastResendAt = new Date();
    await existingOTP.save();

    // Send OTP using the same delivery method as before
    let deliveryResult = null;

    if (existingOTP.deliveryMethod === "email") {
      deliveryResult = await sendPasswordResetOTPEmail(userFound.email, newOtpCode, userFound.role);
    } else if (existingOTP.deliveryMethod === "sms") {
      deliveryResult = await sendPasswordResetOTPSMS(userFound.phone, newOtpCode);
    }

    if (!deliveryResult || !deliveryResult.success) {
      return res.status(500).json({
        success: false,
        message: "Nie udało się wysłać nowego kodu weryfikacyjnego"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Nowy kod weryfikacyjny został wysłany",
      data: {
        expiresIn: "10 minut"
      }
    });

  } catch (error) {
    console.error("Error in resendPasswordResetOTP:", error);
    return res.status(500).json({
      success: false,
      message: "Wystąpił błąd podczas wysyłania nowego kodu",
      error: error.message
    });
  }
};

module.exports = {
  requestPasswordReset: exports.requestPasswordReset,
  resetPassword: exports.resetPassword,
  resendPasswordResetOTP: exports.resendPasswordResetOTP
};
