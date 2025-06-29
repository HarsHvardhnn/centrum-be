const mongoose = require('mongoose');
const Doctor = require('../models/user-entity/doctor');
const { generateUniqueSlug } = require('../utils/slugUtils');
require('dotenv').config();

/**
 * Migration script to add slugs to existing doctors
 */
async function addSlugsToExistingDoctors() {
  try {
    console.log('🔄 Starting slug generation for existing doctors...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');
    
    // Find all doctors without slugs (using User model to bypass slug requirement)
    const User = require('../models/user-entity/user');
    const doctors = await User.find({ 
      role: 'doctor',
      $or: [
        { slug: { $exists: false } },
        { slug: null },
        { slug: '' }
      ]
    });
    
    console.log(`📋 Found ${doctors.length} doctors without slugs`);
    
    if (doctors.length === 0) {
      console.log('🎉 All doctors already have slugs!');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each doctor
    for (const doctor of doctors) {
      try {
        // Generate unique slug
        const slug = await generateUniqueSlug(doctor, Doctor);
        
        // Update doctor with slug (bypass pre-save middleware)
        await User.findByIdAndUpdate(doctor._id, { slug }, { 
          runValidators: false, // Skip validation to avoid issues
          timestamps: false // Don't update timestamps
        });
        
        const doctorName = `${doctor.name?.first || ''} ${doctor.name?.last || ''}`.trim() || 'Unknown';
        console.log(`✅ Generated slug for ${doctorName}: ${slug}`);
        successCount++;
        
      } catch (error) {
        const doctorName = `${doctor.name?.first || ''} ${doctor.name?.last || ''}`.trim() || 'Unknown';
        console.error(`❌ Error generating slug for ${doctorName}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully processed: ${successCount} doctors`);
    console.log(`❌ Failed to process: ${errorCount} doctors`);
    console.log('🎉 Slug generation completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

/**
 * Verify all doctors have unique slugs
 */
async function verifyUniqueSlugs() {
  try {
    console.log('\n🔍 Verifying slug uniqueness...');
    
    // Connect to database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    
    const duplicateSlugs = await Doctor.aggregate([
      { $group: { _id: '$slug', count: { $sum: 1 }, doctors: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicateSlugs.length === 0) {
      console.log('✅ All slugs are unique!');
    } else {
      console.log(`⚠️  Found ${duplicateSlugs.length} duplicate slugs:`);
      duplicateSlugs.forEach(dup => {
        console.log(`  - Slug "${dup._id}" used by ${dup.count} doctors`);
      });
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  (async () => {
    await addSlugsToExistingDoctors();
    await verifyUniqueSlugs();
    process.exit(0);
  })();
}

module.exports = {
  addSlugsToExistingDoctors,
  verifyUniqueSlugs
}; 