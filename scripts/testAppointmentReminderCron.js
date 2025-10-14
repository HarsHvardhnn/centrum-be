const mongoose = require('mongoose');
const Appointment = require('../models/appointment');
const User = require('../models/user-entity/user');
const { processAppointmentReminders } = require('./appointmentReminderCron');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('MongoDB connected for testing');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Test function to check appointments
const testAppointmentQuery = async () => {
  try {
    console.log('\n========================================');
    console.log('TESTING APPOINTMENT REMINDER CRON JOB');
    console.log('========================================\n');

    // Get today's date in Europe/Warsaw timezone
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    console.log('Current Server Time:', now.toISOString());
    console.log('Today (Warsaw Time):', today.toISOString());
    console.log('Tomorrow (Warsaw Time):', tomorrow.toISOString());
    console.log('Timezone Offset:', now.getTimezoneOffset(), 'minutes\n');

    // 1. Check total appointments
    const totalAppointments = await Appointment.countDocuments();
    console.log('Total Appointments in DB:', totalAppointments);

    // 2. Check total booked appointments
    const totalBooked = await Appointment.countDocuments({ status: 'booked' });
    console.log('Total Booked Appointments:', totalBooked);

    // 3. Get all booked appointments with their dates
    const allBooked = await Appointment.find({ status: 'booked' })
      .select('date startTime endTime status')
      .populate('patient', 'name phone smsConsentAgreed')
      .populate('doctor', 'name')
      .sort({ date: 1 });

    console.log('\n--- All Booked Appointments ---');
    allBooked.forEach((apt, idx) => {
      const aptDate = new Date(apt.date);
      const localDate = aptDate.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
      console.log(`${idx + 1}. ${localDate} at ${apt.startTime} - ${apt.endTime}`);
      console.log(`   ISO: ${aptDate.toISOString()}`);
      console.log(`   Patient: ${apt.patient?.name?.first || 'N/A'} ${apt.patient?.name?.last || 'N/A'}`);
      console.log(`   Phone: ${apt.patient?.phone || 'N/A'}, SMS Consent: ${apt.patient?.smsConsentAgreed || false}`);
      console.log(`   Doctor: Dr. ${apt.doctor?.name?.last || 'N/A'}`);
      console.log('');
    });

    // 4. Check appointments for today
    const todaysAppointments = await Appointment.find({
      date: {
        $gte: today,
        $lt: tomorrow
      },
      status: 'booked'
    })
    .populate('patient', 'name phone smsConsentAgreed')
    .populate('doctor', 'name');

    console.log(`\n--- Appointments for Today (${today.toISOString().split('T')[0]}) ---`);
    console.log(`Found: ${todaysAppointments.length} appointments`);
    
    todaysAppointments.forEach((apt, idx) => {
      console.log(`\n${idx + 1}. Time: ${apt.startTime} - ${apt.endTime}`);
      console.log(`   Date (ISO): ${apt.date.toISOString()}`);
      console.log(`   Patient: ${apt.patient?.name?.first || 'N/A'} ${apt.patient?.name?.last || 'N/A'}`);
      console.log(`   Phone: ${apt.patient?.phone || 'N/A'}`);
      console.log(`   SMS Consent: ${apt.patient?.smsConsentAgreed === true ? 'YES' : 'NO'}`);
      console.log(`   Doctor: Dr. ${apt.doctor?.name?.first || 'N/A'} ${apt.doctor?.name?.last || 'N/A'}`);
      console.log(`   Status: ${apt.status}`);
    });

    // 5. Check if there are appointments with SMS consent
    const withConsent = todaysAppointments.filter(apt => 
      apt.patient && apt.patient.smsConsentAgreed === true && apt.patient.phone
    );
    
    console.log(`\n--- Summary ---`);
    console.log(`Total today's appointments: ${todaysAppointments.length}`);
    console.log(`With SMS consent & phone: ${withConsent.length}`);
    console.log(`Without consent/phone: ${todaysAppointments.length - withConsent.length}`);

    // 6. Show date comparison details
    console.log('\n--- Date Comparison Details ---');
    console.log('Query Range:');
    console.log(`  Start: ${today.toISOString()}`);
    console.log(`  End:   ${tomorrow.toISOString()}`);
    
    if (allBooked.length > 0) {
      console.log('\nSample appointment dates (first 5):');
      allBooked.slice(0, 5).forEach((apt, idx) => {
        const aptDate = new Date(apt.date);
        const isInRange = aptDate >= today && aptDate < tomorrow;
        console.log(`  ${idx + 1}. ${aptDate.toISOString()} - In range: ${isInRange}`);
      });
    }

    console.log('\n========================================');
    console.log('Do you want to run the actual cron job? (y/n)');
    console.log('This will send SMS to patients with consent.');
    console.log('========================================\n');

    // Wait for user input
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async (key) => {
      if (key.toString() === 'y' || key.toString() === 'Y') {
        console.log('\nRunning appointment reminder process...\n');
        const result = await processAppointmentReminders('manual_test');
        console.log('\n--- Execution Result ---');
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      } else {
        console.log('\nTest completed without running cron job.');
        process.exit(0);
      }
    });

  } catch (error) {
    console.error('Error testing appointment query:', error);
    process.exit(1);
  }
};

// Run the test
connectDB().then(() => {
  testAppointmentQuery();
});

