/**
 * Test script for appointment reminder functionality
 * This script can be used to test the appointment reminder logic without waiting for the cron job
 */

const { processAppointmentReminders, sendAppointmentReminder } = require('./appointmentReminderCron');
const mongoose = require('mongoose');
require('dotenv').config();

// Test data for creating a test appointment
const createTestAppointment = async () => {
  try {
    const Appointment = require('../models/appointment');
    const User = require('../models/user-entity/user');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('Connected to database for testing');
    
    // Find a patient with SMS consent
    const patient = await User.findOne({ 
      role: 'patient', 
      smsConsentAgreed: true,
      phone: { $exists: true, $ne: '' }
    });
    
    // Find a doctor
    const doctor = await User.findOne({ role: 'doctor' });
    
    if (!patient || !doctor) {
      console.log('Could not find suitable patient or doctor for testing');
      return null;
    }
    
    console.log(`Found patient: ${patient.name.first} ${patient.name.last} (${patient.phone})`);
    console.log(`Found doctor: Dr. ${doctor.name.first} ${doctor.name.last}`);
    
    // Create a test appointment for today
    const today = new Date();
    today.setHours(10, 0, 0, 0); // 10:00 AM today
    
    const testAppointment = new Appointment({
      doctor: doctor._id,
      patient: patient._id,
      bookedBy: doctor._id, // Assuming doctor booked it
      date: today,
      startTime: '10:00',
      endTime: '10:30',
      duration: 30,
      status: 'booked',
      mode: 'offline',
      createdBy: 'doctor'
    });
    
    await testAppointment.save();
    console.log(`Created test appointment for today at ${today.toISOString()}`);
    
    return testAppointment;
    
  } catch (error) {
    console.error('Error creating test appointment:', error);
    return null;
  }
};

// Test the reminder process
const testReminderProcess = async () => {
  try {
    console.log('=== Testing Appointment Reminder Process ===\n');
    
    // Create a test appointment
    const testAppointment = await createTestAppointment();
    
    if (!testAppointment) {
      console.log('No test appointment created, testing with existing appointments...');
    }
    
    // Run the reminder process
    console.log('\nRunning appointment reminder process...');
    const result = await processAppointmentReminders('test');
    console.log('Process result:', result);
    
    console.log('\n=== Test completed ===');
    
  } catch (error) {
    console.error('Error in test process:', error);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Test individual reminder sending
const testIndividualReminder = async () => {
  try {
    console.log('=== Testing Individual Reminder ===\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    
    // Find an appointment for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const Appointment = require('../models/appointment');
    const appointment = await Appointment.findOne({
      date: { $gte: today, $lt: tomorrow },
      status: 'booked'
    })
    .populate('patient', 'name phone smsConsentAgreed')
    .populate('doctor', 'name');
    
    if (!appointment) {
      console.log('No appointments found for today');
      return;
    }
    
    console.log(`Testing reminder for appointment: ${appointment.patient.name.first} ${appointment.patient.name.last} with Dr. ${appointment.doctor.name.last}`);
    
    // Test sending reminder
    const result = await sendAppointmentReminder(appointment, appointment.patient, appointment.doctor, null);
    console.log('Reminder result:', result);
    
  } catch (error) {
    console.error('Error in individual reminder test:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Main test function
const runTests = async () => {
  const args = process.argv.slice(2);
  
  if (args.includes('--individual')) {
    await testIndividualReminder();
  } else {
    await testReminderProcess();
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testReminderProcess,
  testIndividualReminder,
  createTestAppointment
};
