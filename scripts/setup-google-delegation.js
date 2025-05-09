const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function
async function setupGoogleDelegation() {
  console.log('Google Calendar Domain-Wide Delegation Setup\n');
  console.log('This script will help you set up domain-wide delegation for Google Calendar API.\n');
  console.log('Prerequisites:');
  console.log('1. You should have already created a service account using the setup-google-service-account.js script');
  console.log('2. You need access to a Google Workspace admin account\n');

  // Ask for the email address to impersonate
  rl.question('Enter the email address to impersonate (must be a Google Workspace user): ', (email) => {
    if (!email || !email.includes('@')) {
      console.error('Invalid email address. Please provide a valid email.');
      rl.close();
      return;
    }

    // Ask for the calendar ID (optional)
    rl.question('Enter the Calendar ID to use (or leave empty for primary calendar): ', (calendarId) => {
      // Update .env file with the email to impersonate
      updateEnvFile(email, calendarId);
      
      console.log('\nDomain-wide delegation setup is almost complete.');
      console.log('\nImportant: You must also complete these steps in Google Workspace:');
      console.log('1. Go to your Google Workspace Admin Console: https://admin.google.com');
      console.log('2. Navigate to: Security > API controls > Domain-wide Delegation');
      console.log('3. Click "Add new" and enter:');
      console.log('   - Client ID: (Your service account\'s client ID)');
      console.log('   - OAuth scopes: https://www.googleapis.com/auth/calendar');
      console.log('4. Click "Authorize"');
      
      console.log('\nSetup complete. The application will now use domain-wide delegation to access calendars.');
      rl.close();
    });
  });
}

function updateEnvFile(email, calendarId) {
  const envFilePath = path.join(__dirname, '..', '.env');
  
  try {
    let envContent = '';
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }
    
    // Update email to impersonate
    if (envContent.includes('GOOGLE_USER_EMAIL_TO_IMPERSONATE=')) {
      // Replace existing value
      envContent = envContent.replace(
        /GOOGLE_USER_EMAIL_TO_IMPERSONATE=.*/g, 
        `GOOGLE_USER_EMAIL_TO_IMPERSONATE="${email}"`
      );
    } else {
      // Add the variable
      envContent += `\n# Google User Email to Impersonate for Domain-Wide Delegation\nGOOGLE_USER_EMAIL_TO_IMPERSONATE="${email}"\n`;
    }
    
    // Update calendar ID if provided
    if (calendarId) {
      if (envContent.includes('GOOGLE_CALENDAR_ID=')) {
        // Replace existing value
        envContent = envContent.replace(
          /GOOGLE_CALENDAR_ID=.*/g, 
          `GOOGLE_CALENDAR_ID="${calendarId}"`
        );
      } else {
        // Add the variable
        envContent += `\n# Google Calendar ID\nGOOGLE_CALENDAR_ID="${calendarId}"\n`;
      }
    }
    
    fs.writeFileSync(envFilePath, envContent);
    console.log('.env file updated with delegation settings');
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    console.log('Please manually add the following to your .env file:');
    console.log(`GOOGLE_USER_EMAIL_TO_IMPERSONATE="${email}"`);
    if (calendarId) {
      console.log(`GOOGLE_CALENDAR_ID="${calendarId}"`);
    }
  }
}

// Run setup
setupGoogleDelegation(); 