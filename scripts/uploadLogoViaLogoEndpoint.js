const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Upload logo using the logo upload endpoint
 */
const uploadLogoViaLogoEndpoint = async () => {
  try {
    console.log('\n========================================');
    console.log('UPLOADING LOGO VIA LOGO ENDPOINT');
    console.log('========================================\n');

    const logoPath = path.join(__dirname, '../public/logo_new.png');
    
    // Check if file exists
    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo file not found at:', logoPath);
      process.exit(1);
    }

    console.log('📁 Logo file found:', logoPath);
    console.log('🌐 Uploading via /api/logo/upload endpoint...\n');

    // Create form data
    const formData = new FormData();
    formData.append('logo', fs.createReadStream(logoPath), {
      filename: 'logo_new.png',
      contentType: 'image/png'
    });

    // Upload via your logo endpoint
    const response = await axios.post('http://localhost:5000/api/logo/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Bearer YOUR_ADMIN_TOKEN_HERE' // You'll need to replace this
      },
      timeout: 30000
    });

    if (response.data.success) {
      console.log('✅ Upload successful!');
      console.log('\n📋 Upload Details:');
      console.log(`  URL: ${response.data.logo.url}`);
      console.log(`  Public ID: ${response.data.logo.public_id}`);
      console.log(`  Original Name: ${response.data.logo.originalName}`);
      console.log(`  MIME Type: ${response.data.logo.mimetype}`);
      console.log(`  Size: ${(response.data.logo.size / 1024).toFixed(2)} KB`);
      console.log(`  Upload Date: ${response.data.logo.uploadDate}`);

      const logoUrl = response.data.logo.url;
      console.log('\n🎯 Logo URL for Email:');
      console.log(`  ${logoUrl}`);

      console.log('\n========================================');
      console.log('COPY THIS URL TO UPDATE EMAIL TEMPLATE:');
      console.log('========================================');
      console.log(logoUrl);
      console.log('========================================\n');

      return logoUrl;
    } else {
      console.error('❌ Upload failed:', response.data.message);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Error uploading logo:');
    if (error.response) {
      console.error('  Status:', error.response.status);
      console.error('  Message:', error.response.data?.message || error.response.statusText);
    } else {
      console.error('  Error:', error.message);
    }
    console.log('\n💡 Make sure:');
    console.log('  1. Your server is running on localhost:5000');
    console.log('  2. You have a valid admin token');
    console.log('  3. The logo upload endpoint is accessible');
    process.exit(1);
  }
};

// Show manual curl command
const showCurlCommand = () => {
  const logoPath = path.join(__dirname, '../public/logo_new.png');
  console.log('\n========================================');
  console.log('MANUAL CURL COMMAND');
  console.log('========================================');
  console.log('You can upload manually using curl:');
  console.log('');
  console.log(`curl -X POST http://localhost:5000/api/logo/upload \\`);
  console.log(`  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\`);
  console.log(`  -F "logo=@${logoPath}"`);
  console.log('');
  console.log('Replace YOUR_ADMIN_TOKEN with an actual admin token');
  console.log('========================================\n');
};

// Check if we should show curl command instead
if (process.argv[2] === 'curl') {
  showCurlCommand();
} else {
  console.log('Note: This requires a valid admin token.');
  console.log('If you don\'t have one, run: node scripts/uploadLogoViaLogoEndpoint.js curl');
  console.log('to see the manual curl command.\n');
  
  uploadLogoViaLogoEndpoint();
}

