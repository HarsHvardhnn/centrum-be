const sendEmail = require("../utils/mailer");
const { formatDateForSMS, formatTimeForSMS } = require("../utils/dateUtils");

/**
 * Email Preview Controller
 * Sends all email templates to a specified email for preview
 */

// Sample data for email templates
const getSampleData = () => ({
  // Welcome email data
  welcomeData: {
    name: "Jan Kowalski",
    email: "jan.kowalski@example.com",
    password: "temp123456"
  },
  
  // Appointment confirmation data
  appointmentData: {
    patientName: "Jan Kowalski",
    doctorName: "Dr. Anna Nowak",
    date: "15.01.2025",
    time: "10:00 - 10:30",
    department: "Kardiologia",
    meetingLink: "https://meet.google.com/abc-defg-hij",
    notes: "Kontrolna wizyta",
    mode: "online",
    isNewUser: false,
    temporaryPassword: null
  },
  
  // Reschedule email data
  rescheduleData: {
    patientName: "Jan Kowalski",
    doctorName: "Dr. Anna Nowak",
    oldDate: "10.01.2025",
    oldTime: "10:00 - 10:30",
    newDate: "15.01.2025",
    newTime: "14:00 - 14:30",
    department: "Kardiologia",
    mode: "stacjonarna"
  },
  
  // Password reset data
  passwordResetData: {
    otp: "123456",
    userRole: "Lekarz"
  },
  
  // Cancellation email data
  cancellationData: {
    patientName: "Jan Kowalski",
    doctorName: "Dr. Anna Nowak",
    date: "15.01.2025",
    time: "10:00 - 10:30",
    mode: "stacjonarna"
  }
});

// Welcome Email Template (English)
const createWelcomeEmailEnglish = (userData) => {
  const { name, email, password } = userData;
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="Centrum Medical Center Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
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
        <p>© ${new Date().getFullYear()} Centrum Medyczne - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
};

// Welcome Email Template (Polish)
const createWelcomeEmailPolish = (userData) => {
  const { name, email, password } = userData;
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="Centrum Medyczne Logo" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
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
        <p>Możesz zalogować się na swoje konto na <a href="https://centrum-pl.netlify.app/user" style="color: #1976d2; text-decoration: none;">https://centrum-pl.netlify.app/user</a></p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Dziękujemy za wybór Centrum Medycznego.</p>
        <p>W razie pytań prosimy o kontakt z naszym zespołem wsparcia.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
};

// Appointment Confirmation Email Template
const createAppointmentEmailHtml = (appointmentDetails) => {
  const {
    patientName,
    doctorName,
    date,
    time,
    department,
    meetingLink,
    notes,
    mode,
    isNewUser,
    temporaryPassword,
  } = appointmentDetails;

  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Potwierdzenie wizyty – Centrum Medyczne 7</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background-color: #ffffff;
          color: #333333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
        }
        .logo {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo img {
          width: 110px;
          height: auto;
        }
        h1 {
          font-size: 20px;
          color: #222222;
          text-align: left;
        }
        p {
          font-size: 15px;
          line-height: 1.5;
          color: #444444;
        }
        .details {
          background-color: #f8f9fa;
          padding: 18px 20px;
          border-radius: 10px;
          margin: 25px 0;
        }
        .details b {
          color: #000000;
        }
        .footer {
          font-size: 12px;
          color: #777777;
          text-align: center;
          margin-top: 30px;
        }
        .confidential {
          font-size: 11.5px;
          color: #777777;
          margin-top: 25px;
          line-height: 1.5;
          text-align: justify;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="${logoUrl}" alt="Centrum Medyczne 7" />
        </div>
        
        <h1>Potwierdzenie wizyty</h1>
        <p>Twoja wizyta została pomyślnie umówiona. Poniżej znajdziesz szczegóły rezerwacji:</p>
        
        <div class="details">
          <p><b>Pacjent:</b> ${patientName}<br>
          <b>Lekarz prowadzący:</b> ${doctorName}<br>
          <b>Data:</b> ${date}<br>
          <b>Godzina:</b> ${time}<br>
          <b>Forma konsultacji:</b> ${mode === "online" ? "online" : "stacjonarna"}<br>
          <b>Adres:</b> ul. Powstańców Warszawy 7/1.5, 26-110 Skarżysko-Kamienna</p>
        </div>
        
        <p>W przypadku potrzeby zmiany terminu lub odwołania wizyty prosimy o kontakt telefoniczny 
        <b>najpóźniej na 24 godziny przed planowaną wizytą</b>.<br>
        Odwołania dokonane w krótszym czasie <b>nie będą uwzględniane</b>.</p>
        
        <p>Dziękujemy za zrozumienie i poszanowanie czasu naszych specjalistów.</p>
        
        <div class="footer">
          © 2025 <b>Centrum Medyczne 7</b> – Wszelkie prawa zastrzeżone
        </div>
        
        <div class="confidential">
          <b>Klauzula poufności:</b><br>
          Niniejsza wiadomość oraz wszelkie załączone informacje są przeznaczone wyłącznie dla adresata i mogą zawierać dane
          osobowe lub informacje medyczne objęte tajemnicą zawodową.
          Jeśli wiadomość trafiła do Ciebie omyłkowo, prosimy o niezwłoczne usunięcie jej treści i poinformowanie nadawcy.
        </div>
      </div>
    </body>
    </html>
  `;
};

// Reschedule Email Template
const createRescheduleEmailHtml = (rescheduleDetails) => {
  const {
    patientName,
    doctorName,
    oldDate,
    oldTime,
    newDate,
    newTime,
    department,
    mode,
  } = rescheduleDetails;

  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: left; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="Centrum Medyczne 7" style="height: 50px;" />
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 5px;">Zmiana Terminu Wizyty</h2>
        <p style="color: #666; font-size: 16px; margin-top: 0;">Twoja wizyta została przełożona.</p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="color: #856404; margin-top: 0;">Stary Termin:</h3>
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${oldDate}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${oldTime}</p>
        </div>
      </div>
      
      <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h3 style="color: #155724; margin-top: 0;">Nowy Termin:</h3>
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${newDate}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${newTime}</p>
          <p style="margin: 5px 0;"><strong>Typ konsultacji:</strong> ${
            mode === "online" ? "Online" : "Stacjonarna"
          }</p>
        </div>
      </div>
      
      ${
        mode === "online"
          ? `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0;">Link do spotkania zostanie przesłany w osobnej wiadomości e-mail. Jeśli nie otrzymasz wiadomości najpóźniej godzinę przed planowanym spotkaniem, skontaktuj się z Recepcją – nasz zespół udzieli Ci niezbędnych instrukcji i pomoże w dostępie do konsultacji.</p>
        </div>
      `
          : ``
      }
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #666; margin-bottom: 10px;">W przypadku potrzeby zmiany terminu lub odwołania wizyty prosimy o kontakt telefoniczny co najmniej 24 godziny przed planowaną wizytą.</p>
        <p style="color: #666; margin-bottom: 10px;">Dziękujemy za zaufanie!</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Centrum Medyczne 7 - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
};

// Appointment Cancellation Email Template
const createCancellationEmailHtml = (cancellationDetails) => {
  const {
    patientName,
    doctorName,
    date,
    time,
    mode,
  } = cancellationDetails;

  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Odwołanie wizyty – Centrum Medyczne 7</title>
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
            .content {
                padding: 40px 30px;
            }
            .title {
                font-size: 28px;
                color: #2c3e50;
                margin-bottom: 20px;
                font-weight: 600;
                text-align: center;
            }
            .intro-text {
                font-size: 16px;
                color: #555;
                line-height: 1.6;
                margin-bottom: 30px;
            }
            .cancellation-details {
                background-color: #e8f5e8;
                border-radius: 10px;
                padding: 25px;
                margin: 30px 0;
                border-left: 4px solid #dc3545;
                position: relative;
            }
            .cancellation-details h3 {
                color: #dc3545;
                margin-top: 0;
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .cancellation-details p {
                margin: 10px 0;
                color: #2c3e50;
                font-size: 16px;
            }
            .cancellation-details strong {
                color: #2c3e50;
            }
            .red-indicator {
                position: absolute;
                top: 20px;
                right: 20px;
                background-color: #dc3545;
                color: white;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                border: 2px solid white;
            }
            .warning-info {
                background-color: #fff3cd;
                border-radius: 10px;
                padding: 25px;
                margin: 30px 0;
                border-left: 4px solid #ffc107;
            }
            .warning-info p {
                margin: 15px 0;
                color: #856404;
                font-size: 16px;
                line-height: 1.6;
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
            </div>
            
            <div class="content">
                <div class="title">Odwołanie Wizyty</div>
                
                <div class="intro-text">
                    Wizyta została odwołana z przyczyn organizacyjnych lub na prośbę pacjenta.<br>
                    Poniżej znajdują się szczegóły dotyczące odwołanego terminu:
                </div>
                
                <div class="cancellation-details">
                    <div class="red-indicator">RED</div>
                    <h3>Szczegóły Odwołanej Wizyty:</h3>
                    <p><strong>Pacjent:</strong> ${patientName}</p>
                    <p><strong>Lekarz prowadzący:</strong> ${doctorName}</p>
                    <p><strong>Data:</strong> ${date}</p>
                    <p><strong>Godzina:</strong> ${time}</p>
                    <p><strong>Forma konsultacji:</strong> ${mode === "online" ? "Online" : "Stacjonarna"}</p>
                    <p><strong>Adres:</strong> ul. Powstańców Warszawy 7/1.5, 26-110 Skarżysko-Kamienna</p>
                </div>
                
                <div class="warning-info">
                    <p>W przypadku gdy wizyta nie została odwołana z Państwa inicjatywy ani nie przekazano wcześniej takiej informacji telefonicznie, prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia statusu wizyty.</p>
                    <p>Informacja o odwołaniu mogła zostać wygenerowana automatycznie w wyniku błędu systemowego lub nieprawidłowej synchronizacji danych.</p>
                </div>
                
                <div class="confidentiality-clause">
                    <h3>Klauzula poufności:</h3>
                    <p>Niniejsza wiadomość oraz wszelkie załączone informacje są przeznaczone wyłącznie dla adresata i mogą zawierać dane osobowe lub informacje medyczne objęte tajemnicą zawodową.</p>
                    <p>Jeśli wiadomość trafiła do Państwa omyłkowo, prosimy o niezwłoczne usunięcie jej treści i poinformowanie nadawcy.</p>
                </div>
            </div>
            
            <div class="footer">
                <p>© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Password Reset Email Template
const createPasswordResetEmailHtml = (otp, userRole) => {
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
                filter: brightness(1) contrast(1);
                display: block;
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
            <p>Witaj ${userRole},</p>
            
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

/**
 * Send all email templates to preview email
 * @route POST /api/email-preview/send-all
 * @access Private (admin only)
 */
exports.sendAllEmailTemplates = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email address is required"
      });
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    const sampleData = getSampleData();
    const results = [];

    // 1. Welcome Email (English)
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Welcome to Centrum Medical Center (English)",
        html: createWelcomeEmailEnglish(sampleData.welcomeData),
        text: `Welcome to Centrum Medical Center!\n\nYour account has been created successfully.\n\nName: ${sampleData.welcomeData.name}\nEmail: ${sampleData.welcomeData.email}\nTemporary Password: ${sampleData.welcomeData.password}\n\nThank you for choosing Centrum Medical Center.`
      });
      results.push({ template: "Welcome Email (English)", status: "sent" });
    } catch (error) {
      results.push({ template: "Welcome Email (English)", status: "failed", error: error.message });
    }

    // 2. Welcome Email (Polish)
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Witamy w Centrum Medycznym (Polish)",
        html: createWelcomeEmailPolish(sampleData.welcomeData),
        text: `Witamy w Centrum Medycznym!\n\nTwoje konto zostało pomyślnie utworzone.\n\nImię i nazwisko: ${sampleData.welcomeData.name}\nEmail: ${sampleData.welcomeData.email}\nTymczasowe hasło: ${sampleData.welcomeData.password}\n\nDziękujemy za wybór Centrum Medycznego.`
      });
      results.push({ template: "Welcome Email (Polish)", status: "sent" });
    } catch (error) {
      results.push({ template: "Welcome Email (Polish)", status: "failed", error: error.message });
    }

    // 3. Appointment Confirmation Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Potwierdzenie Wizyty (Appointment Confirmation)",
        html: createAppointmentEmailHtml(sampleData.appointmentData),
        text: `Potwierdzenie Wizyty\n\nTwoja wizyta została pomyślnie umówiona.\n\nPacjent: ${sampleData.appointmentData.patientName}\nLekarz: ${sampleData.appointmentData.doctorName}\nData: ${sampleData.appointmentData.date}\nGodzina: ${sampleData.appointmentData.time}\nForma konsultacji: ${sampleData.appointmentData.mode}`
      });
      results.push({ template: "Appointment Confirmation", status: "sent" });
    } catch (error) {
      results.push({ template: "Appointment Confirmation", status: "failed", error: error.message });
    }

    // 4. Reschedule Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Zmiana Terminu Wizyty (Reschedule)",
        html: createRescheduleEmailHtml(sampleData.rescheduleData),
        text: `Zmiana Terminu Wizyty\n\nTwoja wizyta została przełożona.\n\nStary termin: ${sampleData.rescheduleData.oldDate} ${sampleData.rescheduleData.oldTime}\nNowy termin: ${sampleData.rescheduleData.newDate} ${sampleData.rescheduleData.newTime}`
      });
      results.push({ template: "Reschedule Email", status: "sent" });
    } catch (error) {
      results.push({ template: "Reschedule Email", status: "failed", error: error.message });
    }

    // 5. Password Reset Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Reset Hasła (Password Reset)",
        html: createPasswordResetEmailHtml(sampleData.passwordResetData.otp, sampleData.passwordResetData.userRole),
        text: `Reset Hasła\n\nTwój kod weryfikacyjny: ${sampleData.passwordResetData.otp}\n\nKod jest ważny przez 10 minut.`
      });
      results.push({ template: "Password Reset", status: "sent" });
    } catch (error) {
      results.push({ template: "Password Reset", status: "failed", error: error.message });
    }

    // 6. Appointment Cancellation Email
    try {
      await sendEmail({
        to: email,
        subject: "[PREVIEW] Odwołanie wizyty – Centrum Medyczne 7 (Cancellation)",
        html: createCancellationEmailHtml(sampleData.cancellationData),
        text: `Odwołanie Wizyty\n\nWizyta została odwołana z przyczyn organizacyjnych lub na prośbę pacjenta.\n\nSzczegóły Odwołanej Wizyty:\nPacjent: ${sampleData.cancellationData.patientName}\nLekarz prowadzący: ${sampleData.cancellationData.doctorName}\nData: ${sampleData.cancellationData.date}\nGodzina: ${sampleData.cancellationData.time}\nForma konsultacji: ${sampleData.cancellationData.mode}\nAdres: ul. Powstańców Warszawy 7/1.5, 26-110 Skarżysko-Kamienna\n\nW przypadku gdy wizyta nie została odwołana z Państwa inicjatywy ani nie przekazano wcześniej takiej informacji telefonicznie, prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia statusu wizyty.\n\n© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone`
      });
      results.push({ template: "Appointment Cancellation", status: "sent" });
    } catch (error) {
      results.push({ template: "Appointment Cancellation", status: "failed", error: error.message });
    }

    res.status(200).json({
      success: true,
      message: "Email templates sent for preview",
      data: {
        previewEmail: email,
        templatesSent: results.length,
        results: results
      }
    });

  } catch (error) {
    console.error("Error sending email previews:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send email previews",
      error: error.message
    });
  }
};

/**
 * Get list of all available email templates
 * @route GET /api/email-preview/templates
 * @access Private (admin only)
 */
exports.getEmailTemplatesList = async (req, res) => {
  try {
    const templates = [
      {
        id: "welcome-english",
        name: "Welcome Email (English)",
        description: "Sent to new users when account is created",
        subject: "Welcome to Centrum Medical Center",
        usage: "User registration, account creation"
      },
      {
        id: "welcome-polish",
        name: "Welcome Email (Polish)",
        description: "Sent to new users when account is created (Polish version)",
        subject: "Witamy w Centrum Medycznym",
        usage: "User registration, account creation"
      },
      {
        id: "appointment-confirmation",
        name: "Appointment Confirmation",
        description: "Sent when appointment is successfully booked",
        subject: "Potwierdzenie Wizyty",
        usage: "Appointment booking confirmation"
      },
      {
        id: "appointment-reschedule",
        name: "Appointment Reschedule",
        description: "Sent when appointment is rescheduled",
        subject: "Zmiana Terminu Wizyty",
        usage: "Appointment rescheduling"
      },
      {
        id: "password-reset",
        name: "Password Reset",
        description: "Sent when user requests password reset",
        subject: "Reset Hasła",
        usage: "Password reset with OTP"
      },
      {
        id: "appointment-cancellation",
        name: "Appointment Cancellation",
        description: "Sent when appointment is cancelled",
        subject: "Odwołanie wizyty – Centrum Medyczne 7",
        usage: "Appointment cancellation notification"
      }
    ];

    res.status(200).json({
      success: true,
      data: {
        totalTemplates: templates.length,
        templates: templates
      }
    });

  } catch (error) {
    console.error("Error getting email templates list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get email templates list",
      error: error.message
    });
  }
};


