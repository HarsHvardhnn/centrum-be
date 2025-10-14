const sendWelcomeEmail = require('../utils/welcomeEmail');
require('dotenv').config();

/**
 * Test script to send welcome email
 * Usage: node scripts/testWelcomeEmail.js [language]
 * Language options: polish (default), english
 */

const testWelcomeEmail = async () => {
  try {
    console.log('\n========================================');
    console.log('TESTING WELCOME EMAIL');
    console.log('========================================\n');

    // Get language from command line argument (default: polish)
    const language = process.argv[2] || 'polish';
    
    console.log(`Language: ${language}`);
    console.log(`Recipient: harshvchawla997@gmail.com\n`);

    // Test user data
    const testUserData = {
      name: {
        first: 'Harsh',
        last: 'Chawla'
      },
      email: 'harshvchawla997@gmail.com',
      password: 'TestPassword123!' // This is just for testing
    };

    console.log('Sending welcome email...\n');
    console.log('User Data:');
    console.log(`  Name: ${testUserData.name.first} ${testUserData.name.last}`);
    console.log(`  Email: ${testUserData.email}`);
    console.log(`  Password: ${testUserData.password}`);
    console.log('');

    // Send the email
    const result = await sendWelcomeEmail(testUserData, language);

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
    console.log('  - Centrum Medical Center logo (220px width)');
    console.log('  - Welcome message');
    console.log('  - Account information');
    console.log('  - Temporary password');
    console.log('  - Login link\n');

    process.exit(0);
  } catch (error) {
    console.error('\n✗ Error sending welcome email:');
    console.error(error);
    process.exit(1);
  }
};

// Additional test: Show both email templates without sending
const showEmailTemplates = () => {
  console.log('\n========================================');
  console.log('EMAIL TEMPLATE PREVIEW');
  console.log('========================================\n');

  const testUser = {
    name: 'Harsh Chawla',
    email: 'harshvchawla997@gmail.com',
    password: 'TestPassword123!'
  };

  // We need to access the internal function, so let's create a simple preview
  console.log('To see the actual HTML template, check:');
  console.log('  File: utils/welcomeEmail.js');
  console.log('  Function: getEmailTemplates()');
  console.log('\nThe email includes:');
  console.log('  • Logo: https://centrum-pl.netlify.app/logo_new.png (220px width)');
  console.log('  • Two language versions: English and Polish');
  console.log('  • User account information');
  console.log('  • Temporary password');
  console.log('  • Login link');
  console.log('  • Security recommendations\n');
};

// Check if user wants to see template preview or send email
const mode = process.argv[2];

if (mode === 'preview' || mode === '--preview' || mode === '-p') {
  showEmailTemplates();
} else {
  console.log('\nNote: This will send a REAL email to harshvchawla997@gmail.com');
  console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');
  
  setTimeout(() => {
    testWelcomeEmail();
  }, 3000);
}

