const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');

// Directory to store service account
const configDir = path.join(__dirname, '..', 'config');
const serviceAccountFilePath = path.join(configDir, 'google-service-account.json');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Generate a mock private key
function generateMockPrivateKey() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  }).privateKey;
}

// Main function
async function setupServiceAccount() {
  console.log('Google Service Account Setup\n');
  
  // Check if service account file already exists
  if (fs.existsSync(serviceAccountFilePath)) {
    console.log('Service account file already exists at:', serviceAccountFilePath);
    rl.question('Do you want to override it? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        createServiceAccountFile();
      } else {
        console.log('Setup cancelled. Using existing service account.');
        rl.close();
      }
    });
  } else {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    createServiceAccountFile();
  }
}

function createServiceAccountFile() {
  rl.question('Do you have an existing Google service account key? (y/n): ', (hasKey) => {
    if (hasKey.toLowerCase() === 'y' || hasKey.toLowerCase() === 'yes') {
      rl.question('Enter the path to your service account key JSON file: ', (keyPath) => {
        try {
          // Copy the file
          const keyData = fs.readFileSync(path.resolve(keyPath));
          fs.writeFileSync(serviceAccountFilePath, keyData);
          console.log('Service account key file copied successfully to:', serviceAccountFilePath);
          updateEnvFile(serviceAccountFilePath);
          rl.close();
        } catch (error) {
          console.error('Error copying service account file:', error.message);
          rl.close();
        }
      });
    } else {
      // Generate a mock service account for development
      generateMockServiceAccount();
    }
  });
}

function generateMockServiceAccount() {
  rl.question('Enter a project ID for your mock service account: ', (projectId) => {
    const privateKey = generateMockPrivateKey();
    const clientEmail = `mock-service-account@${projectId || 'mock-project'}.iam.gserviceaccount.com`;
    
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId || 'mock-project',
      private_key_id: crypto.randomBytes(16).toString('hex'),
      private_key: privateKey,
      client_email: clientEmail,
      client_id: crypto.randomBytes(16).toString('hex'),
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`
    };
    
    // Write to file
    fs.writeFileSync(serviceAccountFilePath, JSON.stringify(serviceAccount, null, 2));
    console.log('Mock service account created at:', serviceAccountFilePath);
    console.log('\nWARNING: This is a mock service account for development only.');
    console.log('For production, you need to use a real service account from Google Cloud Console.');
    
    updateEnvFile(serviceAccountFilePath);
    rl.close();
  });
}

function updateEnvFile(keyFilePath) {
  const envFilePath = path.join(__dirname, '..', '.env');
  
  try {
    let envContent = '';
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }
    
    // Check if the variable already exists
    if (envContent.includes('GOOGLE_SERVICE_ACCOUNT_KEY_PATH=')) {
      // Replace existing value
      envContent = envContent.replace(
        /GOOGLE_SERVICE_ACCOUNT_KEY_PATH=.*/g, 
        `GOOGLE_SERVICE_ACCOUNT_KEY_PATH="${keyFilePath.replace(/\\/g, '\\\\')}"`
      );
    } else {
      // Add the variable
      envContent += `\n# Google Service Account\nGOOGLE_SERVICE_ACCOUNT_KEY_PATH="${keyFilePath.replace(/\\/g, '\\\\')}"\n`;
    }
    
    fs.writeFileSync(envFilePath, envContent);
    console.log('.env file updated with service account key path');
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    console.log('Please manually add the following to your .env file:');
    console.log(`GOOGLE_SERVICE_ACCOUNT_KEY_PATH="${keyFilePath.replace(/\\/g, '\\\\')}""`);
  }
}

// Run setup
setupServiceAccount(); 