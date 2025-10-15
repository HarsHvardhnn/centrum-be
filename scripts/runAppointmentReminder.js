const mongoose = require('mongoose');
const Appointment = require('../models/appointment');
const User = require('../models/user-entity/user');
const { sendSMS } = require('../utils/smsapi');
const MessageReceipt = require('../models/smsData');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/centrum-v3');
    console.log('MongoDB connected for appointment reminders');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

// Format date to DD.MM.YYYY
const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Format time to HH:MM (keep colon)
const formatTime = (timeString) => {
  return timeString;
};

// Send appointment reminder SMS (simplified version)
const sendAppointmentReminder = async (appointment, patient, doctor) => {
  const startTime = Date.now();
  
  try {
    const appointmentDate = new Date(appointment.date);
    const formattedDate = formatDate(appointmentDate);
    const formattedTime = formatTime(appointment.startTime);
    
    // Create reminder message in Polish
    const message = `Przypominamy o wizycie u dr ${doctor.name.last} ${formattedDate} godz. ${formattedTime} w CM7. Lokalizacja: https://maps.app.goo.gl/pb48tQmCCGgwocWy6`;
    
    console.log(`📱 SMS Message: ${message}`);
    console.log(`📞 Sending to: ${patient.phone}`);
    
    // Create SMS record
    const batchId = uuidv4();
    const smsRecord = await MessageReceipt.create({
      content: message,
      batchId,
      recipient: {
        userId: patient._id.toString(),
        phone: patient.phone,
      },
      status: "PENDING",
    });

    console.log(`📝 SMS Record created: ${smsRecord._id}`);

    // Send SMS
    const result = await sendSMS(patient.phone, message);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (result.success) {
      console.log(`✅ Reminder sent successfully to ${patient.name.first} ${patient.name.last} (${patient.phone})`);
      console.log(`   Message ID: ${result.messageId}`);
      console.log(`   Duration: ${duration}ms`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`❌ Failed to send reminder to ${patient.name.first} ${patient.name.last}:`, result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('❌ Error sending appointment reminder:', error.message);
    console.log(`   Duration: ${duration}ms`);
    return { success: false, error: error.message };
  }
};

// Main function to process appointment reminders (simplified)
const processAppointmentReminders = async () => {
  try {
    console.log('\n========================================');
    console.log('APPOINTMENT REMINDER PROCESS');
    console.log('========================================\n');
    
    // Get today's date in Europe/Warsaw timezone
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    today.setHours(0, 0, 0, 0); // Start of day
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // End of day
    tomorrow.setHours(0, 0, 0, 0);
    
    console.log(`🕐 Current Server Time: ${now.toISOString()}`);
    console.log(`📅 Today (Warsaw Time): ${today.toISOString()}`);
    console.log(`📅 Tomorrow (Warsaw Time): ${tomorrow.toISOString()}`);
    console.log(`🌍 Timezone Offset: ${now.getTimezoneOffset()} minutes\n`);
    
    // Find appointments for today with 'booked' status
    const appointments = await Appointment.find({
      date: {
        $gte: today,
        $lte: tomorrow
      },
      status: 'booked'
    })
    .populate('patient', 'name phone smsConsentAgreed')
    .populate('doctor', 'name');

    console.log(`🔍 Query Range: ${today.toISOString()} to ${tomorrow.toISOString()}`);
    console.log(`📊 Found ${appointments.length} appointments for today\n`);
    
    // Show all appointments found
    if (appointments.length > 0) {
      console.log('📋 Appointments Found:');
      appointments.forEach((apt, idx) => {
        const patient = apt.patient;
        const doctor = apt.doctor;
        const aptDate = new Date(apt.date);
        const localDate = aptDate.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
        
        console.log(`\n${idx + 1}. 📅 ${localDate} at ${apt.startTime} - ${apt.endTime}`);
        console.log(`   👤 Patient: ${patient?.name?.first || 'N/A'} ${patient?.name?.last || 'N/A'}`);
        console.log(`   📞 Phone: ${patient?.phone || 'N/A'}`);
        console.log(`   ✅ SMS Consent: ${patient?.smsConsentAgreed === true ? 'YES' : 'NO'}`);
        console.log(`   👨‍⚕️ Doctor: Dr. ${doctor?.name?.first || 'N/A'} ${doctor?.name?.last || 'N/A'}`);
        console.log(`   📊 Status: ${apt.status}`);
      });
    } else {
      console.log('❌ No appointments found for today.');
      
      // Show total booked appointments
      const totalBooked = await Appointment.countDocuments({ status: 'booked' });
      console.log(`📊 Total booked appointments in database: ${totalBooked}`);
      
      if (totalBooked > 0) {
        console.log('\n📋 Sample booked appointments:');
        const sampleBooked = await Appointment.find({ status: 'booked' })
          .limit(5)
          .select('date startTime status')
          .populate('patient', 'name')
          .populate('doctor', 'name');
        
        sampleBooked.forEach((apt, idx) => {
          const aptDate = new Date(apt.date);
          const localDate = aptDate.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
          console.log(`  ${idx + 1}. ${localDate} at ${apt.startTime} - ${apt.patient?.name?.first || 'N/A'} ${apt.patient?.name?.last || 'N/A'}`);
        });
      }
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    console.log('\n========================================');
    console.log('PROCESSING APPOINTMENTS');
    console.log('========================================\n');

    // Process each appointment
    for (const appointment of appointments) {
      const patient = appointment.patient;
      const doctor = appointment.doctor;

        console.log("patient is ",patient);
        console.log("patient.smsConsentAgreed type:", typeof patient.smsConsentAgreed);
        console.log("patient.smsConsentAgreed value:", patient.smsConsentAgreed);
        console.log("patient.smsConsentAgreed === true:", patient.smsConsentAgreed === true);
        console.log("patient.smsConsentAgreed == true:", patient.smsConsentAgreed == true);
        console.log("Boolean(patient.smsConsentAgreed):", Boolean(patient.smsConsentAgreed));
      // Check if patient has SMS consent
      if (patient && patient.smsConsentAgreed === true && patient.phone) {
        console.log(`✅ Patient has SMS consent and phone number`);
        
        const result = await sendAppointmentReminder(appointment, patient, doctor);
        
        if (result.success) {
          successCount++;
          console.log(`✅ SMS sent successfully`);
        } else {
          errorCount++;
          console.log(`❌ SMS failed: ${result.error}`);
        }
        
        // Add a small delay between SMS sends to avoid rate limiting
        console.log(`⏳ Waiting 1 second before next SMS...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`⏭️ Skipping - Reason:`);
        if (!patient) {
          console.log(`   - No patient data`);
        } else if (!patient.smsConsentAgreed) {
          console.log(`   - No SMS consent (consent: ${patient.smsConsentAgreed})`);
        } else if (!patient.phone) {
          console.log(`   - No phone number`);
        }
        skippedCount++;
      }
    }

    console.log('\n========================================');
    console.log('FINAL RESULTS');
    console.log('========================================');
    console.log(`📊 Total appointments found: ${appointments.length}`);
    console.log(`✅ SMS sent successfully: ${successCount}`);
    console.log(`❌ SMS failed: ${errorCount}`);
    console.log(`⏭️ Skipped: ${skippedCount}`);
    console.log('========================================\n');
    
    return {
      success: true,
      totalRecords: appointments.length,
      successfulRecords: successCount,
      failedRecords: errorCount,
      skippedRecords: skippedCount
    };
    
  } catch (error) {
    console.error('\n❌ Error in appointment reminder process:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Main execution
const runAppointmentReminder = async () => {
  try {
    await connectDB();
    const result = await processAppointmentReminders();
    
    console.log('\n🎯 Process completed!');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  runAppointmentReminder();
}

module.exports = {
  processAppointmentReminders,
  sendAppointmentReminder
};
