/**
 * Script to set up test SMS consent for testing appointment reminders
 */

const mongoose = require('mongoose');
require('dotenv').config();

const setupTestSmsConsent = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('Connected to database');
    
    const User = require('../models/user-entity/user');
    
    // Find a patient with a phone number
    const patient = await User.findOne({ 
      role: 'patient', 
      phone: { $exists: true, $ne: '' }
    });
    
    if (!patient) {
      console.log('No patients found with phone numbers');
      return;
    }
    
    console.log(`Found patient: ${patient.name?.first || 'N/A'} ${patient.name?.last || 'N/A'} (${patient.phone})`);
    
    // Set SMS consent to true
    patient.smsConsentAgreed = true;
    await patient.save();
    
    console.log('SMS consent set to true for patient');
    console.log(`Updated patient: ${patient.name?.first} ${patient.name?.last}`);
    console.log(`Phone: ${patient.phone}`);
    console.log(`SMS Consent: ${patient.smsConsentAgreed}`);
    
  } catch (error) {
    console.error('Error setting up SMS consent:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

setupTestSmsConsent();
