/**
 * Script to check SMS consent status of patients
 */

const mongoose = require('mongoose');
require('dotenv').config();

const checkSmsConsent = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('Connected to database');
    
    const User = require('../models/user-entity/user');
    
    // Find all patients
    const patients = await User.find({ role: 'patient' });
    console.log(`Found ${patients.length} patients`);
    
    // Check SMS consent status
    let withSmsConsent = 0;
    let withPhone = 0;
    let withBoth = 0;
    
    patients.forEach(patient => {
      const hasSmsConsent = patient.smsConsentAgreed === true;
      const hasPhone = patient.phone && patient.phone.trim() !== '';
      
      if (hasSmsConsent) withSmsConsent++;
      if (hasPhone) withPhone++;
      if (hasSmsConsent && hasPhone) withBoth++;
      
      console.log(`Patient: ${patient.name?.first || 'N/A'} ${patient.name?.last || 'N/A'}`);
      console.log(`  Phone: ${patient.phone || 'N/A'}`);
      console.log(`  SMS Consent: ${patient.smsConsentAgreed}`);
      console.log(`  Has both: ${hasSmsConsent && hasPhone}`);
      console.log('---');
    });
    
    console.log(`\nSummary:`);
    console.log(`Total patients: ${patients.length}`);
    console.log(`With SMS consent: ${withSmsConsent}`);
    console.log(`With phone number: ${withPhone}`);
    console.log(`With both SMS consent and phone: ${withBoth}`);
    
  } catch (error) {
    console.error('Error checking SMS consent:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

checkSmsConsent();
