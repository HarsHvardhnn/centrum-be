const sendEmail = require('../utils/mailer');
require('dotenv').config();

/**
 * Test script to send appointment confirmation email
 * Usage: node scripts/testAppointmentEmail.js [mode]
 * Mode options: online (default), offline
 */

// Import the createAppointmentEmailHtml function from appointmentController
// We need to extract it since it's not exported
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

  // Use the Cloudinary logo URL
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${logoUrl}" alt="Centrum Medyczne 7" style="width: 220px; max-width: 100%; height: auto; margin-bottom: 20px;" />
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 5px;"> Potwierdzenie Wizyty</h2>
        <p style="color: #666; font-size: 16px; margin-top: 0;">Twoja wizyta została umówiona pomyślnie.</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #333; margin-top: 0;">Szczegóły Wizyty:</h3>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${time}</p>
          <p style="margin: 5px 0;"><strong>Typ konsultacji:</strong> ${
            mode === "online" ? "Online" : "Stacjonarna"
          }</p>
          ${
            notes
              ? `<p style="margin: 5px 0;"><strong>Uwagi pacjenta:</strong> ${notes}</p>`
              : ""
          }
        </div>
      </div>
      
      ${
        mode === "online"
          ? `
      <div style="background-color: #e3f2fd; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #1976d2; margin-top: 0;">Wizyta Online</h3>
        <p style="margin: 5px 0;">Twoja wizyta będzie przeprowadzona online.</p>
        ${
          meetingLink
            ? `<p style="margin: 5px 0;"><strong>Link do spotkania:</strong> <a href="${meetingLink}" style="color: #1976d2;">${meetingLink}</a></p>`
            : "<p style='margin: 5px 0; color: #666;'>Link do spotkania zostanie przesłany w osobnym e-mailu.</p>"
        }
        <p style="margin: 5px 0; font-size: 14px; color: #666;">Prosimy o przygotowanie się do wizyty online w wyznaczonym czasie.</p>
      </div>
      `
          : `
      <div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #2e7d32; margin-top: 0;">Wizyta Stacjonarna</h3>
        <p style="margin: 5px 0;">Twoja wizyta będzie przeprowadzona w naszej placówce.</p>
        <p style="margin: 5px 0;"><strong>Adres:</strong> Centrum Medyczne 7</p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">Prosimy o przybycie 10 minut przed wyznaczonym czasem.</p>
      </div>
      `
      }
      
      ${
        isNewUser && temporaryPassword
          ? `
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="color: #856404; margin-top: 0;">Dane Logowania</h3>
        <p style="margin: 5px 0;">Twoje konto zostało utworzone automatycznie.</p>
        <p style="margin: 5px 0;"><strong>Tymczasowe hasło:</strong> ${temporaryPassword}</p>
        <p style="margin: 5px 0; font-size: 14px; color: #856404;">Zalecamy zmianę hasła po pierwszym logowaniu.</p>
      </div>
      `
          : ""
      }
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Dziękujemy za wybór Centrum Medycznego 7.</p>
        <p>W razie pytań prosimy o kontakt z naszym zespołem wsparcia.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne 7 - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
};

const testAppointmentEmail = async () => {
  try {
    console.log('\n========================================');
    console.log('TESTING APPOINTMENT CONFIRMATION EMAIL');
    console.log('========================================\n');

    // Get mode from command line argument (default: online)
    const mode = process.argv[2] || 'online';
    
    console.log(`Mode: ${mode}`);
    console.log(`Recipient: harshvchawla997@gmail.com\n`);

    // Test appointment data
    const appointmentData = {
      patientName: 'Harsh Chawla',
      doctorName: 'Dr. Jan Kowalski',
      date: '15.01.2025',
      time: '14:30 - 15:00',
      department: 'Kardiologia',
      meetingLink: mode === 'online' ? 'https://meet.google.com/abc-defg-hij' : null,
      notes: 'Pierwsza wizyta kontrolna',
      mode: mode,
      isNewUser: true,
      temporaryPassword: 'TempPass123!'
    };

    console.log('Sending appointment confirmation email...\n');
    console.log('Appointment Data:');
    console.log(`  Patient: ${appointmentData.patientName}`);
    console.log(`  Doctor: ${appointmentData.doctorName}`);
    console.log(`  Date: ${appointmentData.date}`);
    console.log(`  Time: ${appointmentData.time}`);
    console.log(`  Mode: ${appointmentData.mode}`);
    console.log(`  Department: ${appointmentData.department}`);
    console.log(`  Notes: ${appointmentData.notes}`);
    console.log(`  Is New User: ${appointmentData.isNewUser}`);
    console.log(`  Temporary Password: ${appointmentData.temporaryPassword}`);
    console.log('');

    // Generate HTML content
    const htmlContent = createAppointmentEmailHtml(appointmentData);

    // Send the email
    const result = await sendEmail({
      to: 'harshvchawla997@gmail.com',
      subject: 'Potwierdzenie Wizyty',
      html: htmlContent,
      text: `Twoja wizyta u ${appointmentData.doctorName} została zaplanowana na ${appointmentData.date} o godz ${appointmentData.time}.`
    });

    if (result) {
      console.log('✓ Email sent successfully!');
      console.log(`  Message ID: ${result.messageId}`);
      console.log(`  Response: ${result.response}`);
    } else {
      console.log('✗ Email sending failed or was skipped');
    }

    console.log('\n========================================');
    console.log('TEST COMPLETED');
    console.log('========================================\n');
    console.log('Check your inbox at harshvchawla997@gmail.com');
    console.log('The email should contain:');
    console.log('  - Centrum Medyczne logo (220px width)');
    console.log('  - Appointment confirmation details');
    console.log('  - Doctor and patient information');
    console.log('  - Appointment time and date');
    console.log('  - Consultation type (online/offline)');
    console.log('  - Login credentials (if new user)');
    console.log('  - Meeting link (if online)');
    console.log('  - Contact information\n');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error sending appointment email:');
    console.error(error);
    process.exit(1);
  }
};

// Show template preview
const showTemplatePreview = () => {
  console.log('\n========================================');
  console.log('APPOINTMENT EMAIL TEMPLATE PREVIEW');
  console.log('========================================\n');

  const testData = {
    patientName: 'Harsh Chawla',
    doctorName: 'Dr. Jan Kowalski',
    date: '15.01.2025',
    time: '14:30 - 15:00',
    department: 'Kardiologia',
    meetingLink: 'https://meet.google.com/abc-defg-hij',
    notes: 'Pierwsza wizyta kontrolna',
    mode: 'online',
    isNewUser: true,
    temporaryPassword: 'TempPass123!'
  };

  console.log('Template includes:');
  console.log('  • Logo: https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png (220px width)');
  console.log('  • Appointment confirmation header');
  console.log('  • Patient and doctor details');
  console.log('  • Date, time, and department');
  console.log('  • Consultation type (online/offline)');
  console.log('  • Meeting link (for online appointments)');
  console.log('  • Login credentials (for new users)');
  console.log('  • Contact information and footer\n');
};

// Check if user wants to see template preview or send email
const mode = process.argv[2];

if (mode === 'preview' || mode === '--preview' || mode === '-p') {
  showTemplatePreview();
} else {
  console.log('\nNote: This will send a REAL email to harshvchawla997@gmail.com');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  setTimeout(() => {
    testAppointmentEmail();
  }, 3000);
}

