const cron = require('node-cron');
const mongoose = require('mongoose');
const Appointment = require('../models/appointment');
const User = require('../models/user-entity/user');
const { sendSMS } = require('../utils/smsapi');
const MessageReceipt = require('../models/smsData');
const CronJobLog = require('../models/cronJobLog');
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

// Send appointment reminder SMS with logging
const sendAppointmentReminder = async (appointment, patient, doctor, logEntry) => {
  const startTime = Date.now();
  
  try {
    const appointmentDate = new Date(appointment.date);
    const formattedDate = formatDate(appointmentDate);
    const formattedTime = formatTime(appointment.startTime);
    
    // Create reminder message in Polish
    const message = `Przypominamy o wizycie u dr ${doctor.name.last} ${formattedDate} godz. ${formattedTime} w CM7. Lokalizacja: https://maps.app.goo.gl/pb48tQmCCGgwocWy6`;
    
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

    // Send SMS
    const result = await sendSMS(patient.phone, message);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (result.success) {
      console.log(`Reminder sent successfully to ${patient.name.first} ${patient.name.last} (${patient.phone}) for appointment at ${formattedDate} ${formattedTime}`);
      
      // Log success result
      if (logEntry) {
        await logEntry.addResult({
          recordId: appointment._id.toString(),
          recordType: 'appointment_reminder',
          status: 'success',
          details: {
            patientName: `${patient.name.first} ${patient.name.last}`,
            patientPhone: patient.phone,
            doctorName: `${doctor.name.first} ${doctor.name.last}`,
            appointmentDate: formattedDate,
            appointmentTime: formattedTime,
            messageId: result.messageId,
            batchId: batchId,
            smsRecordId: smsRecord._id.toString(),
            duration: duration
          }
        });
      }
      
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`Failed to send reminder to ${patient.name.first} ${patient.name.last}:`, result.error);
      
      // Log failure result
      if (logEntry) {
        await logEntry.addResult({
          recordId: appointment._id.toString(),
          recordType: 'appointment_reminder',
          status: 'failed',
          errorMessage: result.error,
          details: {
            patientName: `${patient.name.first} ${patient.name.last}`,
            patientPhone: patient.phone,
            doctorName: `${doctor.name.first} ${doctor.name.last}`,
            appointmentDate: formattedDate,
            appointmentTime: formattedTime,
            batchId: batchId,
            smsRecordId: smsRecord._id.toString(),
            duration: duration,
            smsApiError: result.error
          }
        });
      }
      
      return { success: false, error: result.error };
    }
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('Error sending appointment reminder:', error);
    
    // Log error result
    if (logEntry) {
      await logEntry.addResult({
        recordId: appointment._id.toString(),
        recordType: 'appointment_reminder',
        status: 'failed',
        errorMessage: error.message,
        details: {
          patientName: `${patient?.name?.first || 'Unknown'} ${patient?.name?.last || 'Unknown'}`,
          patientPhone: patient?.phone || 'Unknown',
          doctorName: `${doctor?.name?.first || 'Unknown'} ${doctor?.name?.last || 'Unknown'}`,
          duration: duration,
          errorStack: error.stack
        }
      });
    }
    
    return { success: false, error: error.message };
  }
};

// Main function to process appointment reminders with comprehensive logging
const processAppointmentReminders = async (triggeredBy = 'cron') => {
  const executionId = uuidv4();
  let logEntry = null;
  
  try {
    console.log(`Starting appointment reminder process (Execution ID: ${executionId})...`);
    
    // Create log entry
    logEntry = await CronJobLog.create({
      jobName: 'appointment_reminder',
      executionId: executionId,
      status: 'running',
      metadata: {
        triggeredBy: triggeredBy,
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0'
      }
    });
    
    // Get current time in Europe/Warsaw timezone
    const now = new Date();
    const currentTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
    
    // Calculate 4 hours from now
    const fourHoursFromNow = new Date(currentTime.getTime() + (4 * 60 * 60 * 1000));
    
    // Create a time window (4 hours ± 1 minute to catch appointments)
    const timeWindowStart = new Date(fourHoursFromNow.getTime() - (1 * 60 * 1000)); // 4 hours - 1 minute
    const timeWindowEnd = new Date(fourHoursFromNow.getTime() + (1 * 60 * 1000));   // 4 hours + 1 minute
    
    console.log(`Current time (Warsaw): ${currentTime.toISOString()}`);
    console.log(`Looking for appointments 4 hours from now: ${fourHoursFromNow.toISOString()}`);
    console.log(`Time window: ${timeWindowStart.toISOString()} to ${timeWindowEnd.toISOString()}`);
    
    // Find appointments that are 4 hours away (±1 minute) and haven't been reminded yet
    const appointments = await Appointment.find({
      date: {
        $gte: timeWindowStart,
        $lte: timeWindowEnd
      },
      status: 'booked',
      // Add a field to track if reminder was sent
      reminderSent: { $ne: true }
    })
    .populate('patient', 'name phone smsConsentAgreed')
    .populate('doctor', 'name');
    
    console.log(`Query used - Start: ${timeWindowStart.toISOString()}, End: ${timeWindowEnd.toISOString()}`);
    console.log(`Found ${appointments.length} appointments needing reminders`);
    
    // Log first few appointments for debugging
    if (appointments.length > 0) {
      console.log('Sample appointments found:');
      appointments.slice(0, 3).forEach((apt, idx) => {
        console.log(`  ${idx + 1}. Date: ${apt.date.toISOString()}, Time: ${apt.startTime}, Status: ${apt.status}, Patient: ${apt.patient?.name?.first || 'N/A'} ${apt.patient?.name?.last || 'N/A'}`);
      });
    } else {
      console.log('No appointments found needing reminders.');
    }
    
    // Update log with total records found
    logEntry.totalRecords = appointments.length;
    await logEntry.save();

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // Process each appointment
    for (const appointment of appointments) {
      const patient = appointment.patient;
      const doctor = appointment.doctor;

      // Check if patient has SMS consent
      if (patient && patient.smsConsentAgreed === true && patient.phone) {
        console.log(`Processing appointment for ${patient.name.first} ${patient.name.last} with Dr. ${doctor.name.last}`);
        
        const result = await sendAppointmentReminder(appointment, patient, doctor, logEntry);
        
        if (result.success) {
          // Mark appointment as reminder sent
          appointment.reminderSent = true;
          appointment.reminderSentAt = new Date();
          await appointment.save();
          
          successCount++;
        } else {
          errorCount++;
        }
        
        // Add a small delay between SMS sends to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`Skipping appointment for ${patient?.name?.first || 'Unknown'} ${patient?.name?.last || 'Unknown'} - no SMS consent or phone number`);
        
        // Log skipped appointment
        if (logEntry) {
          await logEntry.addResult({
            recordId: appointment._id.toString(),
            recordType: 'appointment_reminder',
            status: 'skipped',
            details: {
              patientName: `${patient?.name?.first || 'Unknown'} ${patient?.name?.last || 'Unknown'}`,
              patientPhone: patient?.phone || 'N/A',
              doctorName: `${doctor?.name?.first || 'Unknown'} ${doctor?.name?.last || 'Unknown'}`,
              skipReason: !patient ? 'No patient data' : 
                         !patient.smsConsentAgreed ? 'No SMS consent' : 
                         !patient.phone ? 'No phone number' : 'Unknown reason'
            }
          });
        }
        
        skippedCount++;
      }
    }

    // Update final status
    logEntry.successfulRecords = successCount;
    logEntry.failedRecords = errorCount;
    logEntry.skippedRecords = skippedCount;
    
    // Mark as completed or partial based on results
    if (errorCount === 0) {
      logEntry.status = 'completed';
    } else if (successCount > 0) {
      logEntry.status = 'partial';
    } else {
      logEntry.status = 'failed';
      logEntry.errorMessage = 'All reminders failed to send';
    }
    
    await logEntry.markCompleted();

    console.log(`Appointment reminder process completed (Execution ID: ${executionId}). Success: ${successCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
    
    return {
      success: true,
      executionId: executionId,
      totalRecords: appointments.length,
      successfulRecords: successCount,
      failedRecords: errorCount,
      skippedRecords: skippedCount
    };
    
  } catch (error) {
    console.error(`Error in appointment reminder process (Execution ID: ${executionId}):`, error);
    
    // Log the error
    if (logEntry) {
      await logEntry.markFailed(error);
    }
    
    return {
      success: false,
      executionId: executionId,
      error: error.message,
      stack: error.stack
    };
  }
};

// Clean up old log entries (keep only last 30 days)
const cleanupOldLogs = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await CronJobLog.deleteMany({
      startTime: { $lt: thirtyDaysAgo }
    });
    
    console.log(`Cleaned up ${result.deletedCount} old cron job log entries`);
    return result.deletedCount;
  } catch (error) {
    console.error('Error cleaning up old cron job logs:', error);
    return 0;
  }
};

// Schedule the cron job to run every minute to check for appointments 4 hours away
const startAppointmentReminderCron = () => {
  console.log('Starting appointment reminder cron job...');
  
  // Cron expression: '* * * * *' means every minute
  cron.schedule('* * * * *', async () => {
    console.log('Appointment reminder cron job triggered at:', new Date().toISOString());
    const result = await processAppointmentReminders('cron');
    console.log('Cron job execution result:', result);
  }, {
    scheduled: true,
    timezone: "Europe/Warsaw" // Adjust timezone as needed
  });
  
  // Schedule log cleanup to run weekly (every Sunday at 2 AM)
  cron.schedule('0 2 * * 0', async () => {
    console.log('Starting cron job log cleanup at:', new Date().toISOString());
    const deletedCount = await cleanupOldLogs();
    console.log(`Cron job log cleanup completed. Deleted ${deletedCount} old entries.`);
  }, {
    scheduled: true,
    timezone: "Europe/Warsaw"
  });
  
  console.log('Appointment reminder cron job scheduled to run every minute');
  console.log('Log cleanup scheduled to run weekly on Sundays at 2:00 AM');
};

// Initialize database connection and start cron job
const initializeAppointmentReminders = async () => {
  await connectDB();
  startAppointmentReminderCron();
};

// Export functions for testing
module.exports = {
  processAppointmentReminders,
  sendAppointmentReminder,
  initializeAppointmentReminders,
  startAppointmentReminderCron,
  cleanupOldLogs
};

// If this file is run directly, initialize the cron job
if (require.main === module) {
  initializeAppointmentReminders().catch(console.error);
}
