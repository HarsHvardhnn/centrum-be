const nodemailer = require('nodemailer');
require('dotenv').config();

async function testZohoSMTP() {
  console.log('\n------ Zoho SMTP Connection Test ------\n');
  
  // Check for environment variables
  if (!process.env.ZOHO_USER || !process.env.ZOHO_PASS) {
    console.error('ERROR: Missing environment variables ZOHO_USER or ZOHO_PASS');
    console.log('Make sure to add these to your .env file:');
    console.log('ZOHO_USER=your_email@yourdomain.com');
    console.log('ZOHO_PASS=your_password_or_app_password');
    return;
  }
  
  // Log credentials (partially masked)
  console.log('Using credentials:');
  console.log(`- Email: ${maskEmail(process.env.ZOHO_USER)}`);
  console.log(`- Password: ${maskPassword(process.env.ZOHO_PASS)}`);
  console.log('');
  
  // Get recipient email
  const testEmail = process.argv[2];
  if (!testEmail) {
    console.error('ERROR: Please provide a test recipient email as an argument');
    console.log('Example: node scripts/debug-zoho-smtp.js test@example.com');
    return;
  }
  
  // Try multiple configurations
  await tryConfiguration('SSL (Port 465)', {
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
  });
  
  await tryConfiguration('TLS (Port 587)', {
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
  });
  
  await tryConfiguration('TLS with explicit ciphers (Port 587)', {
    host: 'smtp.zoho.com',
    port: 587,
    secure: false,
    tls: {
      rejectUnauthorized: false,
      ciphers: 'SSLv3'
    }
  });
  
  await tryConfiguration('Zoho EU Server (Port 465)', {
    host: 'smtp.zoho.eu',
    port: 465,
    secure: true,
  });
  
  console.log('\n------ End of Tests ------\n');
}

async function tryConfiguration(name, config) {
  console.log(`\nTrying ${name}...`);
  
  const transporter = nodemailer.createTransport({
    ...config,
    auth: {
      user: process.env.ZOHO_USER,
      pass: process.env.ZOHO_PASS
    },
    debug: true
  });
  
  try {
    // Test connection
    console.log('Verifying connection...');
    await transporter.verify();
    console.log('✅ Connection successful!');
    
    // Try sending a test email
    const testEmail = process.argv[2];
    console.log(`Sending test email to ${testEmail}...`);
    
    const info = await transporter.sendMail({
      from: `"Hospital App Test" <${process.env.ZOHO_USER}>`,
      to: testEmail,
      subject: `Zoho SMTP Test (${name})`,
      text: `This is a test email from your Node.js app using Zoho SMTP with ${name} configuration.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #3f51b5;">Zoho SMTP Test Successful</h2>
          <p>This is a test email sent from your Node.js application using:</p>
          <ul>
            <li><strong>Configuration:</strong> ${name}</li>
            <li><strong>Host:</strong> ${config.host}</li>
            <li><strong>Port:</strong> ${config.port}</li>
            <li><strong>Secure:</strong> ${config.secure ? 'Yes (SSL)' : 'No (TLS)'}</li>
          </ul>
          <p>If you're receiving this email, your Zoho SMTP configuration is working correctly with these settings!</p>
        </div>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log(`Message ID: ${info.messageId}`);
    
    // Recommend this configuration
    console.log('\n✨ RECOMMENDED CONFIGURATION:');
    console.log(JSON.stringify(config, null, 2));
    
  } catch (error) {
    console.error(`❌ Error with ${name}:`, error.message);
  }
}

function maskEmail(email) {
  if (!email) return 'undefined';
  const [username, domain] = email.split('@');
  return `${username.substring(0, 2)}${'*'.repeat(username.length - 2)}@${domain}`;
}

function maskPassword(password) {
  if (!password) return 'undefined';
  return '*'.repeat(password.length);
}

testZohoSMTP(); 