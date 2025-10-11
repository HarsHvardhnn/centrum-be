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
        <img src="https://centrum-pl.netlify.app/logo_new.png" alt="Centrum Medical Center Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
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
  const polishSubject = "Witamy w Centrum Medycznym";
  const polishHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="https://centrum-pl.netlify.app/logo_new.png" alt="Centrum Medyczne Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
        <h2 style="color: #3f51b5; margin-top: 10px;">Witamy w Centrum Medycznym</h2>
        <p style="color: #666;">Twoje konto zostało pomyślnie utworzone</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #3f51b5;">Informacje o Twoim koncie</h3>
        <p><strong>Imię i nazwisko:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Tymczasowe hasło:</strong> ${password}</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1976d2;">Ważne informacje</h3>
        <p>Ze względów bezpieczeństwa zalecamy zmianę hasła po pierwszym logowaniu.</p>
        <p>Możesz zalogować się na swoje konto na <a href="https://centrum-pl.netlify.app/user" style="color: #1976d2; text-decoration: none;">centrum 7</a></p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Dziękujemy za wybór Centrum Medycznego.</p>
        <p>W razie pytań prosimy o kontakt z naszym zespołem wsparcia.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
  const polishText = `
Witamy w Centrum Medycznym!

Twoje konto zostało pomyślnie utworzone.

Informacje o Twoim koncie:
Imię i nazwisko: ${name}
Email: ${email}
Tymczasowe hasło: ${password}

Ważne informacje:
Ze względów bezpieczeństwa zalecamy zmianę hasła po pierwszym logowaniu.
Możesz zalogować się na swoje konto na centrum.med.io

Dziękujemy za wybór Centrum Medycznego.
W razie pytań prosimy o kontakt z naszym zespołem wsparcia.

© ${new Date().getFullYear()} Centrum Medyczne - Wszelkie prawa zastrzeżone
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
