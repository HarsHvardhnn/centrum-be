// scripts/seedAppointmentConfig.js
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const AppointmentConfig = require("../models/appointmentConfig");

// Load environment variables
dotenv.config();

// Initial configuration values
const initialConfigs = [
  {
    key: "DEFAULT_DURATION",
    value: 15,
    valueType: "number",
    description: "Default appointment duration in minutes",
    displayName: "Default Appointment Duration",
    category: "appointment",
    validation: {
      min: 1,
      max: 120
    },
    editable: true
  },
  {
    key: "DEFAULT_SLOT_DURATION",
    value: 15,
    valueType: "number",
    description: "Default slot duration in minutes for available slots generation",
    displayName: "Default Slot Duration",
    category: "appointment",
    validation: {
      min: 1,
      max: 60
    },
    editable: true
  },
  {
    key: "BOOKING_BUFFER_MINUTES",
    value: 15,
    valueType: "number",
    description: "Buffer time in minutes for booking (prevents booking slots too close to current time)",
    displayName: "Booking Buffer Time",
    category: "appointment",
    validation: {
      min: 0,
      max: 120
    },
    editable: true
  },
  {
    key: "DEFAULT_TEMPORARY_PASSWORD",
    value: "centrum123",
    valueType: "string",
    description: "Default temporary password for new patients",
    displayName: "Default Temporary Password",
    category: "security",
    editable: true
  }
];

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Seed the database with initial configuration
const seedDatabase = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Check if configs already exist
    for (const config of initialConfigs) {
      const existingConfig = await AppointmentConfig.findOne({ key: config.key });
      
      if (existingConfig) {
        console.log(`Configuration ${config.key} already exists, skipping...`);
      } else {
        // Create new config
        await AppointmentConfig.create(config);
        console.log(`Configuration ${config.key} created successfully`);
      }
    }
    
    console.log("Appointment configuration seeding completed");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding appointment configuration:", error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();
