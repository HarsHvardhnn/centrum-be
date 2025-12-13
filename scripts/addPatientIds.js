const mongoose = require('mongoose');
const User = require('../models/user-entity/user');
require('dotenv').config();

/**
 * Migration script to add unique patient IDs to all patients that don't have one
 */
async function addPatientIds() {
  try {
    console.log('🔄 Starting patient ID generation for existing patients...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to database');
    
    // Find all patients without patientId
    const patients = await User.find({ 
      role: 'patient',
      $or: [
        { patientId: { $exists: false } },
        { patientId: null },
        { patientId: '' }
      ]
    });
    
    console.log(`📋 Found ${patients.length} patients without patientId`);
    
    if (patients.length === 0) {
      console.log('🎉 All patients already have patientIds!');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    const usedIds = new Set();
    
    // Get all existing patientIds to avoid duplicates
    const existingPatients = await User.find({ 
      role: 'patient',
      patientId: { $exists: true, $ne: null, $ne: '' }
    }).select('patientId');
    
    existingPatients.forEach(p => {
      if (p.patientId) {
        usedIds.add(p.patientId);
      }
    });
    
    console.log(`📊 Found ${usedIds.size} existing patientIds`);
    
    // Process each patient
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      try {
        // Generate unique patientId
        let patientId;
        let attempts = 0;
        const maxAttempts = 10;
        
        do {
          // Use timestamp + index + random component for uniqueness
          const timestamp = Date.now();
          const random = Math.floor(Math.random() * 1000);
          patientId = `P-${timestamp}-${i}-${random}`;
          attempts++;
        } while (usedIds.has(patientId) && attempts < maxAttempts);
        
        if (usedIds.has(patientId)) {
          throw new Error('Failed to generate unique patientId after multiple attempts');
        }
        
        // Add to used set
        usedIds.add(patientId);
        
        // Update patient with patientId (bypass pre-save middleware)
        await User.findByIdAndUpdate(patient._id, { patientId }, { 
          runValidators: false, // Skip validation to avoid issues
          timestamps: false // Don't update timestamps
        });
        
        const patientName = `${patient.name?.first || ''} ${patient.name?.last || ''}`.trim() || 'Unknown';
        console.log(`✅ Generated patientId for ${patientName} (${patient.phone || 'no phone'}): ${patientId}`);
        successCount++;
        
        // Small delay to ensure unique timestamps
        await new Promise(resolve => setTimeout(resolve, 1));
        
      } catch (error) {
        const patientName = `${patient.name?.first || ''} ${patient.name?.last || ''}`.trim() || 'Unknown';
        console.error(`❌ Error generating patientId for ${patientName} (${patient.phone || 'no phone'}):`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully processed: ${successCount} patients`);
    console.log(`❌ Failed to process: ${errorCount} patients`);
    console.log('🎉 Patient ID generation completed!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

/**
 * Verify all patients have unique patientIds
 */
async function verifyUniquePatientIds() {
  try {
    console.log('\n🔍 Verifying patientId uniqueness...');
    
    // Connect to database if not already connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    
    const duplicateIds = await User.aggregate([
      { $match: { role: 'patient', patientId: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$patientId', count: { $sum: 1 }, patients: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    
    if (duplicateIds.length === 0) {
      console.log('✅ All patientIds are unique!');
    } else {
      console.log(`⚠️  Found ${duplicateIds.length} duplicate patientIds:`);
      duplicateIds.forEach(dup => {
        console.log(`  - patientId "${dup._id}" used by ${dup.count} patients`);
      });
    }
    
    // Count patients without patientId
    const patientsWithoutId = await User.countDocuments({
      role: 'patient',
      $or: [
        { patientId: { $exists: false } },
        { patientId: null },
        { patientId: '' }
      ]
    });
    
    if (patientsWithoutId === 0) {
      console.log('✅ All patients have patientIds!');
    } else {
      console.log(`⚠️  Found ${patientsWithoutId} patients without patientIds`);
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await addPatientIds();
      await verifyUniquePatientIds();
      process.exit(0);
    } catch (error) {
      console.error('❌ Script failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = {
  addPatientIds,
  verifyUniquePatientIds
};


