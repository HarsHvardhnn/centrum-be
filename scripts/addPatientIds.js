const mongoose = require('mongoose');
const User = require('../models/user-entity/user');
const Patient = require('../models/user-entity/patient');
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
    
    // Find all patients without patientId using Patient model (discriminator)
    const patients = await Patient.find({ 
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
    const existingPatients = await Patient.find({ 
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
        
        // Update patient with patientId using direct MongoDB update
        // This bypasses Mongoose validation and hooks to avoid constraint issues
        const updateResult = await Patient.updateOne(
          { _id: patient._id },
          { $set: { patientId: patientId } }
        );
        
        if (updateResult.modifiedCount !== 1 && updateResult.matchedCount !== 1) {
          throw new Error(`Update failed: matchedCount=${updateResult.matchedCount}, modifiedCount=${updateResult.modifiedCount}`);
        }
        
        // Verify by reading back the document
        const verifyPatient = await Patient.findById(patient._id).select('patientId');
        if (!verifyPatient || verifyPatient.patientId !== patientId) {
          throw new Error('Update did not persist correctly - verification failed');
        }
        
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
    
    const duplicateIds = await Patient.aggregate([
      { $match: { patientId: { $exists: true, $ne: null, $ne: '' } } },
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
    const patientsWithoutId = await Patient.countDocuments({
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


