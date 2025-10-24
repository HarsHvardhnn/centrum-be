const sendEmail = require("./mailer");

/**
 * Email templates for welcome emails
 * @param {Object} userData - User data
 * @returns {Object} Email content in different languages
 */
const getEmailTemplates = (userData) => {
  const { name, email, password } = userData;

  // English template
  const englishSubject = "Welcome to Centrum Medical Center";
  const englishHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png" alt="Centrum Medical Center Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
        <h2 style="color: #3f51b5; margin-top: 10px;">Welcome to Centrum Medical Center</h2>
        <p style="color: #666;">Your account has been created successfully</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #3f51b5;">Your Account Information</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1976d2;">Important Information</h3>
        <p>For security reasons, we recommend changing your password after your first login.</p>
        <p>You can log in to your account at <a href="https://centrum-pl.netlify.app/user" style="color: #1976d2; text-decoration: none;">https://centrum-pl.netlify.app/user</a></p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Thank you for choosing Centrum Medical Center.</p>
        <p>If you have any questions, please contact our support team.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne -  Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
  const englishText = `
Welcome to Centrum Medical Center!

Your account has been created successfully.

Your Account Information:
Name: ${name}
Email: ${email}
Temporary Password: ${password}

Important Information:
For security reasons, we recommend changing your password after your first login.
You can log in to your account at centrum.med.io

Thank you for choosing Centrum Medical Center.
If you have any questions, please contact our support team.

© ${new Date().getFullYear()} Centrum Medyczne -  Wszelkie prawa zastrzeżone
  `;

  // Polish template
  const polishSubject = "Konto pacjenta zostało pomyślnie utworzone – Centrum Medyczne 7";
  const polishHtml = `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Konto pacjenta zostało pomyślnie utworzone – Centrum Medyczne 7</title>
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
            .header p {
                margin: 10px 0 0;
                font-size: 16px;
                opacity: 0.9;
                color: white;
            }
            .content {
                padding: 40px 30px;
            }
            .welcome-title {
                font-size: 28px;
                color: #2c3e50;
                margin-bottom: 10px;
                font-weight: 600;
                text-align: center;
            }
            .welcome-subtitle {
                font-size: 18px;
                color: #555;
                margin-bottom: 30px;
                text-align: center;
            }
            .account-info {
                background-color: #f8f9fa;
                border-radius: 10px;
                padding: 25px;
                margin: 30px 0;
                border-left: 4px solid #3498db;
            }
            .account-info h3 {
                color: #2c3e50;
                margin-top: 0;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .account-info p {
                margin: 10px 0;
                color: #555;
                font-size: 16px;
            }
            .account-info strong {
                color: #2c3e50;
            }
            .important-info {
                background-color: #e8f4fd;
                border-radius: 10px;
                padding: 25px;
                margin: 30px 0;
                border-left: 4px solid #3498db;
            }
            .important-info h3 {
                color: #2c3e50;
                margin-top: 0;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .important-info p {
                margin: 15px 0;
                color: #555;
                font-size: 16px;
                line-height: 1.6;
            }
            .login-link {
                background-color: #3498db;
                color: white;
                padding: 12px 24px;
                border-radius: 8px;
                text-decoration: none;
                display: inline-block;
                margin: 15px 0;
                font-weight: 500;
            }
            .login-link:hover {
                background-color: #2980b9;
            }
            .contact-info {
                background-color: #e8f5e8;
                border-radius: 10px;
                padding: 25px;
                margin: 30px 0;
                border-left: 4px solid #27ae60;
            }
            .contact-info p {
                margin: 10px 0;
                color: #2c3e50;
                font-size: 16px;
                line-height: 1.6;
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
                    <img src="https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png" alt="Centrum Medyczne 7 Logo" class="logo" />
                </div>
                <h1>Centrum Medyczne 7</h1>
                <p>Konto pacjenta zostało pomyślnie utworzone</p>
            </div>
            
            <div class="content">
                <div class="welcome-title">Witamy w Centrum Medycznym 7</div>
                <div class="welcome-subtitle">Konto pacjenta zostało pomyślnie utworzone.<br>Poniżej znajdują się informacje niezbędne do zalogowania się do Panelu Pacjenta.</div>
                
                <div class="account-info">
                    <h3>Informacje o Twoim koncie</h3>
                    <p><strong>Imię i nazwisko:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Tymczasowe hasło:</strong> ${password}</p>
                </div>
                
                <div class="important-info">
                    <h3>Ważne informacje</h3>
                    <p>Ze względów bezpieczeństwa zalecamy zmianę hasła przy pierwszym logowaniu.</p>
                    <p>Jeśli konto nie zostało utworzone przez Państwa, prosimy o niezwłoczny kontakt z rejestracją w celu weryfikacji.</p>
                    <p>Link umożliwiający logowanie do Panelu Pacjenta znajduje się poniżej:</p>
                    <a href="https://centrum-pl.netlify.app/user" class="login-link">Zaloguj się do Panelu Pacjenta</a>
                </div>
                
                <div class="contact-info">
                    <p>Dziękujemy za wybór Centrum Medycznego 7.</p>
                    <p>W przypadku pytań lub wątpliwości pozostajemy do Państwa dyspozycji.</p>
                    <p>W sprawach dotyczących Konta Pacjenta, logowania lub problemów technicznych prosimy o kontakt z administratorem systemu: admin@cm7med.pl lub rejestracją.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Niniejsza wiadomość została wygenerowana automatycznie — prosimy na nią nie odpowiadać.</p>
                <p>© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone</p>
            </div>
        </div>
    </body>
    </html>
  `;
  const polishText = `
Witamy w Centrum Medycznym 7!

Konto pacjenta zostało pomyślnie utworzone.
Poniżej znajdują się informacje niezbędne do zalogowania się do Panelu Pacjenta.

Informacje o Twoim koncie:
Imię i nazwisko: ${name}
Email: ${email}
Tymczasowe hasło: ${password}

Ważne informacje:
Ze względów bezpieczeństwa zalecamy zmianę hasła przy pierwszym logowaniu.
Jeśli konto nie zostało utworzone przez Państwa, prosimy o niezwłoczny kontakt z rejestracją w celu weryfikacji.

Link umożliwiający logowanie do Panelu Pacjenta:
https://centrum-pl.netlify.app/user

Dziękujemy za wybór Centrum Medycznego 7.
W przypadku pytań lub wątpliwości pozostajemy do Państwa dyspozycji.
W sprawach dotyczących Konta Pacjenta, logowania lub problemów technicznych prosimy o kontakt z administratorem systemu: admin@cm7med.pl lub rejestracją.

Niniejsza wiadomość została wygenerowana automatycznie — prosimy na nią nie odpowiadać.
© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone
  `;

  return {
    english: { subject: englishSubject, html: englishHtml, text: englishText },
    polish: { subject: polishSubject, html: polishHtml, text: polishText },
  };
};

/**
 * Send welcome email to a new user with their password information
 * @param {Object} userData - User data containing name, email, and password
 * @param {string} language - Language preference ('english' or 'polish')
 * @returns {Promise} Email sending result
 */
const sendWelcomeEmail = async (userData, language = "polish") => {
  try {
    // Validate required user data
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!emailRegex.test(userData.email)) {
      return;
    }

    // Prepare user data with defaults
    const user = {
      name:
        userData.name?.first && userData.name?.last
          ? `${userData.name.first} ${userData.name.last}`
          : userData.name || "Patient",
      email: userData.email,
      password: userData.password,
    };

    // Get email templates
    const templates = getEmailTemplates(user);

    // Select language template (default to English if invalid language provided)
    const emailContent =
      language.toLowerCase() === "polish"
        ? templates.polish
        : templates.english;

    // Send email
    const result = await sendEmail({
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    console.log(
      `Welcome email sent successfully to ${user.email} in ${language}`
    );
    return result;
  } catch (error) {
    console.error("Failed to send welcome email:", error);
    throw error;
  }
};

module.exports = sendWelcomeEmail;
