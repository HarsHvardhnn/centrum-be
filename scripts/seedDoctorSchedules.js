// scripts/seedDoctorSchedules.js
// Script to seed doctor schedules and test data for week availability API testing

const mongoose = require("mongoose");
const DoctorSchedule = require("../models/doctorSchedule");
const ScheduleException = require("../models/scheduleException");
const Appointment = require("../models/appointment");
const User = require("../models/user-entity/user");

// MongoDB connection string
const MONGODB_URI = "mongodb+srv://HarshVardhan:aYUX2Fe7JfIKX5zo@cluster0.5xxpzqs.mongodb.net/centrum-v4?retryWrites=true&w=majority&appName=Cluster0";

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

// Helper function to add days to a date
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Helper function to format date as YYYY-MM-DD
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Generate schedules for a doctor
const generateSchedulesForDoctor = async (doctorId, startDate, daysCount = 14) => {
  const schedules = [];
  const today = new Date(startDate);
  today.setHours(0, 0, 0, 0);

  // Different schedule patterns for variety
  const schedulePatterns = [
    // Pattern 1: Full day 9-17
    {
      timeBlocks: [
        { startTime: "09:00", endTime: "17:00", isActive: true }
      ]
    },
    // Pattern 2: Morning and afternoon (9-13, 14-18)
    {
      timeBlocks: [
        { startTime: "09:00", endTime: "13:00", isActive: true },
        { startTime: "14:00", endTime: "18:00", isActive: true }
      ]
    },
    // Pattern 3: Morning only (9-13)
    {
      timeBlocks: [
        { startTime: "09:00", endTime: "13:00", isActive: true }
      ]
    },
    // Pattern 4: Afternoon only (14-18)
    {
      timeBlocks: [
        { startTime: "14:00", endTime: "18:00", isActive: true }
      ]
    },
    // Pattern 5: Split day (9-12, 15-19)
    {
      timeBlocks: [
        { startTime: "09:00", endTime: "12:00", isActive: true },
        { startTime: "15:00", endTime: "19:00", isActive: true }
      ]
    }
  ];

  for (let i = 0; i < daysCount; i++) {
    const currentDate = addDays(today, i);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday

    // Skip weekends for some doctors, include for others
    // Let's make it random - some doctors work weekends
    const worksWeekends = Math.random() > 0.5;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (!worksWeekends) {
        continue; // Skip weekends
      }
    }

    // Randomly select a schedule pattern
    const pattern = schedulePatterns[Math.floor(Math.random() * schedulePatterns.length)];

    try {
      // Create date objects for query (don't modify original)
      const dateStart = new Date(currentDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(currentDate);
      dateEnd.setHours(23, 59, 59, 999);

      // Check if schedule already exists
      const existingSchedule = await DoctorSchedule.findOne({
        doctorId: doctorId,
        date: {
          $gte: dateStart,
          $lte: dateEnd
        }
      });

      if (!existingSchedule) {
        // Create schedule date (set to start of day)
        const scheduleDate = new Date(currentDate);
        scheduleDate.setHours(0, 0, 0, 0);

        const schedule = new DoctorSchedule({
          doctorId: doctorId,
          date: scheduleDate,
          timeBlocks: pattern.timeBlocks,
          isActive: true,
          createdBy: doctorId,
        });

        await schedule.save();
        schedules.push(schedule);
        console.log(`  ✓ Created schedule for ${formatDate(currentDate)}`);
      } else {
        console.log(`  - Schedule already exists for ${formatDate(currentDate)}`);
      }
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error
        console.log(`  - Schedule already exists for ${formatDate(currentDate)}`);
      } else {
        console.error(`  ✗ Error creating schedule for ${formatDate(currentDate)}:`, error.message);
      }
    }
  }

  return schedules;
};

// Create some appointments for testing
const createTestAppointments = async (doctorId, startDate) => {
  try {
    // Find a patient to book appointments for
    const patient = await User.findOne({ role: "patient" });
    
    if (!patient) {
      console.log("  ⚠ No patients found, skipping appointment creation");
      return;
    }

    const appointments = [];
    const today = new Date(startDate);
    today.setHours(0, 0, 0, 0);

    // Create appointments on different days
    const appointmentDays = [0, 2, 4, 6, 9]; // Days from start date
    const timeSlots = [
      { start: "10:00", end: "10:15" },
      { start: "11:30", end: "11:45" },
      { start: "14:00", end: "14:15" },
      { start: "15:30", end: "15:45" },
      { start: "16:00", end: "16:15" },
    ];

    for (const dayOffset of appointmentDays) {
      const appointmentDate = addDays(today, dayOffset);
      const timeSlot = timeSlots[Math.floor(Math.random() * timeSlots.length)];

      try {
        const appointment = new Appointment({
          doctor: doctorId,
          patient: patient._id,
          bookedBy: doctorId,
          date: appointmentDate,
          startTime: timeSlot.start,
          endTime: timeSlot.end,
          duration: 15,
          mode: "offline",
          status: "booked",
          createdBy: "receptionist",
          notes: `Test appointment for availability testing`,
        });

        await appointment.save();
        appointments.push(appointment);
        console.log(`  ✓ Created appointment for ${formatDate(appointmentDate)} at ${timeSlot.start}`);
      } catch (error) {
        console.error(`  ✗ Error creating appointment:`, error.message);
      }
    }

    return appointments;
  } catch (error) {
    console.error("  ✗ Error creating test appointments:", error.message);
  }
};

// Create some schedule exceptions for testing
const createTestExceptions = async (doctorId, startDate) => {
  try {
    const exceptions = [];
    const today = new Date(startDate);
    today.setHours(0, 0, 0, 0);

    // Create a full-day exception (day 5)
    const exceptionDate1 = addDays(today, 5);
    try {
      const exception1 = new ScheduleException({
        doctorId: doctorId,
        date: exceptionDate1,
        type: "vacation",
        title: "Vacation Day",
        description: "Doctor on vacation",
        isFullDay: true,
        isActive: true,
        createdBy: doctorId,
      });

      await exception1.save();
      exceptions.push(exception1);
      console.log(`  ✓ Created full-day exception for ${formatDate(exceptionDate1)}`);
    } catch (error) {
      if (error.code === 11000) {
        console.log(`  - Exception already exists for ${formatDate(exceptionDate1)}`);
      } else {
        console.error(`  ✗ Error creating exception:`, error.message);
      }
    }

    // Create a partial-day exception (day 7) - lunch break
    const exceptionDate2 = addDays(today, 7);
    try {
      const exception2 = new ScheduleException({
        doctorId: doctorId,
        date: exceptionDate2,
        type: "lunch_break",
        title: "Extended Lunch Break",
        description: "Extended lunch break on this day",
        isFullDay: false,
        timeRanges: [
          { startTime: "12:00", endTime: "14:00" }
        ],
        isActive: true,
        createdBy: doctorId,
      });

      await exception2.save();
      exceptions.push(exception2);
      console.log(`  ✓ Created partial-day exception for ${formatDate(exceptionDate2)}`);
    } catch (error) {
      if (error.code === 11000) {
        console.log(`  - Exception already exists for ${formatDate(exceptionDate2)}`);
      } else {
        console.error(`  ✗ Error creating exception:`, error.message);
      }
    }

    return exceptions;
  } catch (error) {
    console.error("  ✗ Error creating test exceptions:", error.message);
  }
};

// Main function
const seedDoctorSchedules = async () => {
  try {
    await connectDB();

    console.log("\n🔍 Fetching doctors from database...");
    const doctors = await User.find({ role: "doctor", deleted: false }).limit(10);

    if (doctors.length === 0) {
      console.log("❌ No doctors found in the database");
      process.exit(1);
    }

    console.log(`✅ Found ${doctors.length} doctor(s)\n`);

    // Calculate start date (today or tomorrow)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1); // Start from tomorrow
    startDate.setHours(0, 0, 0, 0);

    console.log(`📅 Generating schedules starting from: ${formatDate(startDate)}`);
    console.log(`📅 Generating schedules for 14 days\n`);

    let totalSchedules = 0;
    let totalAppointments = 0;
    let totalExceptions = 0;

    for (const doctor of doctors) {
      console.log(`\n👨‍⚕️ Processing Doctor: ${doctor.name?.first || ""} ${doctor.name?.last || ""} (${doctor._id})`);
      
      // Generate schedules
      console.log("  📋 Creating schedules...");
      const schedules = await generateSchedulesForDoctor(doctor._id, startDate, 14);
      totalSchedules += schedules.length;

      // Create test appointments (only for first doctor to avoid too many)
      if (doctors.indexOf(doctor) === 0) {
        console.log("  📅 Creating test appointments...");
        const appointments = await createTestAppointments(doctor._id, startDate);
        if (appointments) {
          totalAppointments += appointments.length;
        }
      }

      // Create test exceptions (only for first doctor)
      if (doctors.indexOf(doctor) === 0) {
        console.log("  🚫 Creating test exceptions...");
        const exceptions = await createTestExceptions(doctor._id, startDate);
        if (exceptions) {
          totalExceptions += exceptions.length;
        }
      }
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ SEEDING COMPLETE!");
    console.log("=".repeat(60));
    console.log(`📋 Total schedules created: ${totalSchedules}`);
    console.log(`📅 Total appointments created: ${totalAppointments}`);
    console.log(`🚫 Total exceptions created: ${totalExceptions}`);
    console.log(`\n💡 You can now test the week availability API with:`);
    console.log(`   GET /docs/schedule/week-availability/${doctors[0]._id}?startDate=${formatDate(startDate)}`);
    console.log("\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error seeding doctor schedules:", error);
    process.exit(1);
  }
};

// Run the script
seedDoctorSchedules();

