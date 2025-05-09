const sendEmail = require('../utils/mailer');
require('dotenv').config();

async function testZohoEmail() {
  try {
    console.log('Testing Zoho SMTP configuration...');
    
    if (!process.env.ZOHO_USER || !process.env.ZOHO_PASS) {
      console.error('Error: ZOHO_USER or ZOHO_PASS environment variables are missing.');
      console.log('Please add them to your .env file:');
      console.log('ZOHO_USER=your_email@yourdomain.com');
      console.log('ZOHO_PASS=your_zoho_password_or_app_password');
      return;
    }
    
    const testEmail = process.argv[2];
    
    if (!testEmail) {
      console.error('Error: Please provide a test email address as an argument.');
      console.log('Example: node scripts/test-zoho-email.js test@example.com');
      return;
    }
    
    console.log(`Sending test email to: ${testEmail}...`);
    
    await sendEmail({
      to: testEmail,
      subject: 'Test Email from Zoho SMTP',
      text: 'This is a test email sent from your application using Zoho SMTP.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #3f51b5;">Test Email</h2>
          <p>This is a test email sent from your application using Zoho SMTP.</p>
          <p>If you're receiving this email, your Zoho SMTP configuration is working correctly!</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
            Sent from Hospital App at ${new Date().toLocaleString()}
          </p>
        </div>
      `
    });
    
    console.log('Test email sent successfully!');
    
  } catch (error) {
    console.error('Error sending test email:', error.message);
    console.error('Full error:', error);
  }
}

testZohoEmail(); 