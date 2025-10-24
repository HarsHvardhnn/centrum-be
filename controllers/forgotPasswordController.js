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
const createPasswordResetEmailHtml = (otp, userRole, userName = '') => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Hasła - Centrum Medyczne 7</title>
        <style>
            body {
                font-family: 'Helvetica Neue', Arial, sans-serif;
                margin: 0;
                padding: 0;
                background-color: #f8f9fa;
                color: #333333;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: white;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: white;
                padding: 40px 20px;
                text-align: center;
            }
            .logo-container {
                margin-bottom: 20px;
            }
            .logo {
                width: 80px;
                height: 80px;
                border-radius: 10px;
                margin: 0 auto 20px;
                display: block;
                background-color: white;
                padding: 10px;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                color: white;
            }
            .header h2 {
                margin: 10px 0 0;
                font-size: 16px;
                font-weight: 400;
                opacity: 0.9;
                color: white;
            }
            .content {
                padding: 40px 30px;
            }
            .greeting {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 20px;
                font-weight: 500;
            }
            .message {
                font-size: 16px;
                color: #555;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .otp-container {
                text-align: center;
                margin: 40px 0;
            }
            .otp-label {
                font-size: 16px;
                color: #2c3e50;
                margin-bottom: 20px;
                font-weight: 500;
            }
            .otp-code {
                display: inline-block;
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: white;
                font-size: 36px;
                font-weight: bold;
                padding: 25px 50px;
                border-radius: 10px;
                letter-spacing: 10px;
                box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
                margin: 10px 0;
            }
            .warning-box {
                background-color: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 10px;
                padding: 25px;
                margin: 30px 0;
            }
            .warning-title {
                color: #856404;
                font-weight: bold;
                margin-bottom: 15px;
                font-size: 16px;
            }
            .warning-list {
                color: #856404;
                margin: 0;
                padding-left: 20px;
            }
            .warning-list li {
                margin-bottom: 10px;
                line-height: 1.5;
            }
            .contact-info {
                background-color: #e8f4fd;
                border-radius: 10px;
                padding: 20px;
                margin: 30px 0;
                border-left: 4px solid #3498db;
            }
            .contact-info p {
                margin: 0;
                color: #2c3e50;
                font-size: 14px;
                line-height: 1.5;
            }
            .signature {
                margin-top: 30px;
                color: #555;
            }
            .signature p {
                margin: 5px 0;
            }
            .security-clause {
                background-color: #e8f5e8;
                border-radius: 10px;
                padding: 25px;
                margin: 25px 0;
                border-left: 4px solid #27ae60;
            }
            .security-clause h3 {
                color: #27ae60;
                margin-top: 0;
                font-size: 16px;
                font-weight: 600;
            }
            .security-clause p {
                color: #2c3e50;
                margin: 10px 0;
                font-size: 14px;
                line-height: 1.5;
            }
            .confidentiality-clause {
                background-color: #f0e6ff;
                border-radius: 10px;
                padding: 25px;
                margin: 25px 0;
                border-left: 4px solid #9b59b6;
            }
            .confidentiality-clause h3 {
                color: #9b59b6;
                margin-top: 0;
                font-size: 16px;
                font-weight: 600;
            }
            .confidentiality-clause p {
                color: #2c3e50;
                margin: 10px 0;
                font-size: 14px;
                line-height: 1.5;
            }
            .footer {
                background-color: #f8f9fa;
                padding: 20px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #e9ecef;
            }
            .footer p {
                margin: 5px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-container">
                    <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" class="logo" />
                </div>
                <h1>Centrum Medyczne 7</h1>
                <h2>Reset Hasła</h2>
            </div>
            
            <div class="content">
                <div class="greeting">
                    Witaj, ${userName || 'Użytkowniku'}
                </div>
                
                <div class="message">
                    Otrzymano zgłoszenie dotyczące resetu hasła do Twojego konta pacjenta.<br>
                    Aby zweryfikować to żądanie, użyj poniższego kodu weryfikacyjnego:
                </div>
                
                <div class="otp-container">
                    <div class="otp-label">Twój kod weryfikacyjny:</div>
                    <div class="otp-code">${otp}</div>
                </div>
                
                <div class="warning-box">
                    <div class="warning-title">Ważne informacje</div>
                    <ul class="warning-list">
                        <li>Kod jest ważny przez 10 minut.</li>
                        <li>Nie udostępniaj tego kodu osobom trzecim.</li>
                        <li>Jeśli nie zgłaszałeś(aś) resetu hasła, zignoruj tę wiadomość.</li>
                        <li>Kod może być użyty tylko jeden raz.</li>
                    </ul>
                </div>
                
                <div class="contact-info">
                    <p>Jeśli masz problem z dostępem do konta, skontaktuj się z administratorem systemu: admin@cm7med.pl lub rejestracją.</p>
                </div>
                
                <div class="signature">
                    <p>Z poważaniem,</p>
                    <p><strong>Zespół CM7</strong></p>
                </div>
                
                <div class="security-clause">
                    <h3>Klauzula bezpieczeństwa:</h3>
                    <p>Informacje zawarte w niniejszej wiadomości, w tym kod weryfikacyjny, mają charakter poufny.</p>
                    <p>Centrum Medyczne 7 nigdy nie prosi o podawanie kodów ani haseł drogą mailową lub telefoniczną.</p>
                    <p>Prosimy o zachowanie poufności i nieprzekazywanie tych danych osobom trzecim.</p>
                </div>
                
                <div class="confidentiality-clause">
                    <h3>Klauzula poufności:</h3>
                    <p>Niniejsza wiadomość oraz wszelkie załączone informacje są przeznaczone wyłącznie dla adresata i mogą zawierać dane osobowe lub informacje medyczne objęte tajemnicą zawodową.</p>
                    <p>Jeśli wiadomość trafiła do Państwa omyłkowo, prosimy o niezwłoczne usunięcie jej treści i poinformowanie nadawcy.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Ten e-mail został wygenerowany automatycznie — prosimy na niego nie odpowiadać.</p>
                <p>© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone</p>
            </div>
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
      subject: "Reset hasła – Centrum Medyczne 7",
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
