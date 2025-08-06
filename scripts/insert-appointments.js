const mongoose = require('mongoose');
const Appointment = require('../models/appointment');
const User = require('../models/user-entity/user');

// Connect to MongoDB (update with your connection string)
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-database');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Appointment data
const appointmentData = [
  { patientId: 'P-1753699288598', date: '7/1/2025', timeSlot: '16:00-16:30' },
  { patientId: 'P-1753699399150', date: '7/1/2025', timeSlot: '16:30-17:00' },
  { patientId: 'P-1753829002409', date: '7/1/2025', timeSlot: '17:00-17:30' },
  { patientId: 'P-1753700571302', date: '7/3/2025', timeSlot: '16:00-16:30' },
  { patientId: 'P-1753700290799', date: '7/3/2025', timeSlot: '16:30-17:00' },
  { patientId: 'P-1753699534728', date: '7/3/2025', timeSlot: '17:00-17:30' },
  { patientId: 'P-1753830036903', date: '7/3/2025', timeSlot: '17:30-18:00' },
  { patientId: 'P-1753699288598', date: '7/7/2025', timeSlot: '16:00-16:30' },
  { patientId: 'P-1753698586715', date: '7/7/2025', timeSlot: '17:00-17:30' },
  { patientId: 'P-1753702208132', date: '7/7/2025', timeSlot: '17:30-18:00' },
  { patientId: 'P-1753701325926', date: '7/7/2025', timeSlot: '19:30-20:00' },
  { patientId: 'P-1753702016246', date: '7/7/2025', timeSlot: '20:00-20:30' },
  { patientId: 'P-1753699985252', date: '7/23/2025', timeSlot: '19:30-19:45' },
  { patientId: 'P-1753701086982', date: '7/23/2025', timeSlot: '19:45-20:00' },
  { patientId: 'P-1753699687929', date: '7/23/2025', timeSlot: '20:00-20:15' },
  { patientId: 'P-1753698820842', date: '7/23/2025', timeSlot: '20:30-20:45' },
  { patientId: 'P-1753699784726', date: '7/23/2025', timeSlot: '20:45-21:15' },
  { patientId: 'P-1753698951033', date: '7/23/2025', timeSlot: '21:15-21:30' }
];

// Doctor ID
const DOCTOR_ID = '6877dbf8635211ff3ec6322d';

// Helper function to parse time slot and calculate duration
const parseTimeSlot = (timeSlot) => {
  const [startTime, endTime] = timeSlot.split('-');
  
  // Calculate duration in minutes
  const start = new Date(`2000-01-01T${startTime}:00`);
  const end = new Date(`2000-01-01T${endTime}:00`);
  const duration = Math.round((end - start) / (1000 * 60));
  
  return { startTime, endTime, duration };
};

// Helper function to parse date
const parseDate = (dateStr) => {
  const [month, day, year] = dateStr.split('/');
  return new Date(year, month - 1, day); // month is 0-indexed in JavaScript
};

// Main function to insert appointments
const insertAppointments = async () => {
  try {
    await connectDB();
    
    console.log('Starting appointment insertion...');
    
    for (const appointment of appointmentData) {
      // Find patient by patientId
      const patient = await User.findOne({ 
        role: 'patient', 
        patientId: appointment.patientId 
      });
      
      if (!patient) {
        console.log(`Patient not found with ID: ${appointment.patientId}`);
        continue;
      }
      
      // Parse date and time
      const appointmentDate = parseDate(appointment.date);
      const { startTime, endTime, duration } = parseTimeSlot(appointment.timeSlot);
      
      // Create appointment object
      const newAppointment = new Appointment({
        doctor: DOCTOR_ID,
        patient: patient._id,
        bookedBy: DOCTOR_ID, // Assuming doctor is booking for themselves
        date: appointmentDate,
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        mode: 'offline', // Default to offline
        status: 'booked',
        notes: `Appointment for ${patient.name.first} ${patient.name.last}`,
        metadata: {
          patientSource: 'direct',
          visitType: 'consultation',
          isInternational: false,
          isWalkin: false,
          needsAttention: false,
          enableRepeats: false,
          isNewPatient: false,
          consultationFee: 0
        }
      });
      
      // Save appointment
      const savedAppointment = await newAppointment.save();
      console.log(`Created appointment for ${patient.name.first} ${patient.name.last} on ${appointment.date} at ${appointment.timeSlot}`);
    }
    
    console.log('All appointments inserted successfully!');
    
  } catch (error) {
    console.error('Error inserting appointments:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
insertAppointments(); 