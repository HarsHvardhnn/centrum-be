/**
 * Script to upload CM7MED logo to Cloudinary
 * Usage: node scripts/upload-logo.js [path-to-logo-file]
 */

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? process.env.BACKEND_URL 
  : 'http://localhost:3000';

const LOGO_UPLOAD_ENDPOINT = `${BASE_URL}/api/logo/upload`;

// Admin credentials (you'll need to provide these)
const ADMIN_EMAIL = 'admin@example.com'; // Replace with actual admin email
const ADMIN_PASSWORD = 'adminPassword123'; // Replace with actual admin password

let authToken = null;

// Helper function to login and get auth token
const loginAdmin = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });

    if (response.data.success && response.data.token) {
      authToken = response.data.token;
      console.log('✅ Admin login successful');
      return true;
    } else {
      console.log('❌ Admin login failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.log('❌ Admin login error:', error.response?.data?.message || error.message);
    return false;
  }
};

// Upload logo to Cloudinary
const uploadLogo = async (logoPath) => {
  try {
    if (!fs.existsSync(logoPath)) {
      console.log(`❌ Logo file not found: ${logoPath}`);
      return false;
    }

    console.log(`📤 Uploading logo: ${logoPath}`);

    // Create form data
    const formData = new FormData();
    formData.append('logo', fs.createReadStream(logoPath));

    // Upload logo
    const response = await axios.post(LOGO_UPLOAD_ENDPOINT, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${authToken}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    if (response.data.success) {
      console.log('✅ Logo uploaded successfully!');
      console.log('📊 Upload details:');
      console.log(`   URL: ${response.data.logo.url}`);
      console.log(`   Public ID: ${response.data.logo.public_id}`);
      console.log(`   Size: ${(response.data.logo.size / 1024).toFixed(2)} KB`);
      console.log(`   Type: ${response.data.logo.mimetype}`);
      
      console.log('\n🔧 Environment Variable:');
      console.log(`Add this to your .env file:`);
      console.log(`CM7MED_LOGO_URL=${response.data.logo.url}`);
      
      return response.data.logo.url;
    } else {
      console.log('❌ Logo upload failed:', response.data.message);
      return false;
    }

  } catch (error) {
    console.log('❌ Logo upload error:', error.response?.data?.message || error.message);
    if (error.response?.status === 401) {
      console.log('💡 Make sure you have valid admin credentials');
    }
    return false;
  }
};

// Get current logo URL
const getCurrentLogo = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/api/logo/current`);
    
    if (response.data.success) {
      console.log('📋 Current logo:');
      console.log(`   URL: ${response.data.logo.url}`);
      console.log(`   Source: ${response.data.logo.source}`);
      return response.data.logo.url;
    } else {
      console.log('❌ Failed to get current logo:', response.data.message);
      return null;
    }
  } catch (error) {
    console.log('❌ Get logo error:', error.response?.data?.message || error.message);
    return null;
  }
};

// Main function
const main = async () => {
  console.log('🚀 CM7MED Logo Upload Script');
  console.log(`📍 Target: ${LOGO_UPLOAD_ENDPOINT}\n`);

  // Get logo file path from command line arguments
  const logoPath = process.argv[2];

  if (!logoPath) {
    console.log('❌ Please provide the path to the logo file');
    console.log('Usage: node scripts/upload-logo.js [path-to-logo-file]');
    console.log('Example: node scripts/upload-logo.js ./public/CM7MED_logo.png');
    process.exit(1);
  }

  // Check if file exists
  if (!fs.existsSync(logoPath)) {
    console.log(`❌ Logo file not found: ${logoPath}`);
    console.log('Make sure the file path is correct and the file exists.');
    process.exit(1);
  }

  // Check file extension
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const fileExtension = path.extname(logoPath).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    console.log(`❌ Invalid file type: ${fileExtension}`);
    console.log(`Allowed types: ${allowedExtensions.join(', ')}`);
    process.exit(1);
  }

  // Login as admin
  console.log('🔐 Logging in as admin...');
  const loginSuccess = await loginAdmin();
  
  if (!loginSuccess) {
    console.log('❌ Cannot proceed without admin authentication');
    console.log('💡 Update ADMIN_EMAIL and ADMIN_PASSWORD in this script');
    process.exit(1);
  }

  // Show current logo
  console.log('\n📋 Current logo status:');
  await getCurrentLogo();

  // Upload new logo
  console.log('\n📤 Uploading new logo...');
  const uploadedUrl = await uploadLogo(logoPath);

  if (uploadedUrl) {
    console.log('\n🎉 Logo upload completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Add CM7MED_LOGO_URL to your .env file');
    console.log('2. Restart your server');
    console.log('3. Test email functionality');
  } else {
    console.log('\n❌ Logo upload failed');
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  uploadLogo,
  getCurrentLogo,
  loginAdmin
};
