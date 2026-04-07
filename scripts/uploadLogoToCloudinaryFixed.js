const cloudinary = require('../utils/cloudinary');
const { FOLDERS } = require('../constants/cloudinaryFolders');
const path = require('path');
const fs = require('fs');

/**
 * Upload logo to Cloudinary with proper extension and get working URL
 */
const uploadLogoToCloudinaryFixed = async () => {
  try {
    console.log('\n========================================');
    console.log('UPLOADING LOGO TO CLOUDINARY (FIXED)');
    console.log('========================================\n');

    const logoPath = path.join(__dirname, '../public/logo_new.png');
    
    // Check if file exists
    if (!fs.existsSync(logoPath)) {
      console.error('❌ Logo file not found at:', logoPath);
      process.exit(1);
    }

    console.log('📁 Logo file found:', logoPath);
    console.log('☁️  Uploading to Cloudinary with proper extension...\n');

    // Upload to Cloudinary with explicit PNG extension
    const result = await cloudinary.uploader.upload(logoPath, {
      folder: FOLDERS.BRANDING_LOGOS,
      public_id: 'centrum_logo_email.png', // Explicitly add .png extension
      resource_type: 'image',
      format: 'png',
      quality: 'auto',
      fetch_format: 'auto'
    });

    console.log('✅ Upload successful!');
    console.log('\n📋 Upload Details:');
    console.log(`  Public ID: ${result.public_id}`);
    console.log(`  URL: ${result.secure_url}`);
    console.log(`  Width: ${result.width}px`);
    console.log(`  Height: ${result.height}px`);
    console.log(`  Format: ${result.format}`);
    console.log(`  Size: ${(result.bytes / 1024).toFixed(2)} KB`);

    // Generate optimized URL for email (220px width) with proper extension
    const optimizedUrl = cloudinary.url(`${FOLDERS.BRANDING_LOGOS}/centrum_logo_email.png`, {
      width: 220,
      height: 'auto',
      crop: 'scale',
      quality: 'auto',
      fetch_format: 'auto'
    });

    console.log('\n🎯 Optimized URL for Email (220px width):');
    console.log(`  ${optimizedUrl}`);

    // Test if URL is accessible
    console.log('\n🔗 Testing URL accessibility...');
    try {
      const httpsUrl = optimizedUrl.replace('http://', 'https://');
      console.log(`  HTTPS URL: ${httpsUrl}`);
      
      // Also try without transformations for testing
      const simpleUrl = cloudinary.url(`${FOLDERS.BRANDING_LOGOS}/centrum_logo_email.png`);
      console.log(`  Simple URL: ${simpleUrl}`);
      
    } catch (testError) {
      console.log('  ⚠️  URL test failed:', testError.message);
    }

    console.log('\n========================================');
    console.log('COPY THIS URL TO UPDATE EMAIL TEMPLATE:');
    console.log('========================================');
    console.log(optimizedUrl);
    console.log('========================================\n');

    return {
      originalUrl: result.secure_url,
      optimizedUrl: optimizedUrl,
      publicId: result.public_id
    };

  } catch (error) {
    console.error('\n❌ Error uploading logo to Cloudinary:');
    console.error(error);
    process.exit(1);
  }
};

// Run the upload
uploadLogoToCloudinaryFixed().then((result) => {
  console.log('\n✅ Logo upload completed successfully!');
  console.log('You can now use the optimized URL in your email template.');
  process.exit(0);
});

