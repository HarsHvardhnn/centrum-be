// config/appointmentConfig.js
const AppointmentConfigModel = require("../models/appointmentConfig");
const axios = require("axios");

// Default configuration values
const DEFAULT_CONFIG = {
  // Dynamic settings (can be changed via API)
  DEFAULT_DURATION: 15,
  DEFAULT_SLOT_DURATION: 15,
  BOOKING_BUFFER_MINUTES: 15,
  DEFAULT_TEMPORARY_PASSWORD: "centrum123",
  
  // Static settings (hardcoded)
  DEFAULT_CONSULTATION_TYPE: "offline",
  
  // Receptionist Override Settings
  OVERRIDE: {
    MIN_DURATION: 1,
    MAX_DURATION: 480,
    ALLOW_BACKDATING: true,
    ALLOW_CONFLICT_OVERRIDE: true,
    ALLOW_MULTIPLE_PATIENTS: true,
    ALLOW_CUSTOM_TIMES: true,
  },
  
  // Appointment statuses
  STATUSES: {
    BOOKED: "booked",
    CANCELLED: "cancelled",
    COMPLETED: "completed",
    CHECKED_IN: "checkedIn",
    NO_SHOW: "no-show"
  },
  
  // Consultation modes
  MODES: {
    ONLINE: "online",
    OFFLINE: "offline"
  },
  
  // User roles that can create appointments
  APPOINTMENT_CREATORS: {
    RECEPTIONIST: "receptionist",
    DOCTOR: "doctor",
    ONLINE: "online",
    ADMIN: "admin"
  }
};

// Create a mutable copy of the default config that will be updated with DB values
let APPOINTMENT_CONFIG = { ...DEFAULT_CONFIG };

// Function to seed initial configuration if it doesn't exist
const seedInitialConfig = async () => {
  try {
    // Check if any config exists
    const count = await AppointmentConfigModel.countDocuments();
    
    if (count === 0) {
      console.log("No appointment configuration found in database. Creating initial configuration...");
      
      // Initial configuration values
      const initialConfigs = [
        {
          key: "DEFAULT_DURATION",
          value: DEFAULT_CONFIG.DEFAULT_DURATION,
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
          value: DEFAULT_CONFIG.DEFAULT_SLOT_DURATION,
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
          value: DEFAULT_CONFIG.BOOKING_BUFFER_MINUTES,
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
          value: DEFAULT_CONFIG.DEFAULT_TEMPORARY_PASSWORD,
          valueType: "string",
          description: "Default temporary password for new patients",
          displayName: "Default Temporary Password",
          category: "security",
          editable: true
        }
      ];
      
      // Create each config
      for (const config of initialConfigs) {
        await AppointmentConfigModel.create(config);
        console.log(`Created initial configuration: ${config.key}`);
      }
      
      console.log("Initial appointment configuration created successfully");
    }
  } catch (error) {
    console.error("Error seeding initial appointment configuration:", error);
  }
};

// Function to load dynamic config from database
const loadConfigFromDatabase = async () => {
  try {
    // First, ensure configuration exists
    await seedInitialConfig();
    
    // Get all configuration values from database
    const configValues = await AppointmentConfigModel.getAllConfigValues();

    console.log("Database configuration values:", configValues);
    
    // Create a fresh copy of default config
    const freshConfig = { ...DEFAULT_CONFIG };
    
    // Override with database values
    if (configValues.DEFAULT_DURATION !== undefined) {
      freshConfig.DEFAULT_DURATION = configValues.DEFAULT_DURATION;
    }
    
    if (configValues.DEFAULT_SLOT_DURATION !== undefined) {
      freshConfig.DEFAULT_SLOT_DURATION = configValues.DEFAULT_SLOT_DURATION;
    }
    
    if (configValues.BOOKING_BUFFER_MINUTES !== undefined) {
      freshConfig.BOOKING_BUFFER_MINUTES = configValues.BOOKING_BUFFER_MINUTES;
    }
    
    if (configValues.DEFAULT_TEMPORARY_PASSWORD !== undefined) {
      freshConfig.DEFAULT_TEMPORARY_PASSWORD = configValues.DEFAULT_TEMPORARY_PASSWORD;
    }
    
    // Replace the entire config object with our updated version
    APPOINTMENT_CONFIG = {
      ...freshConfig,
      // Keep the static parts
      OVERRIDE: freshConfig.OVERRIDE,
      STATUSES: freshConfig.STATUSES,
      MODES: freshConfig.MODES,
      APPOINTMENT_CREATORS: freshConfig.APPOINTMENT_CREATORS,
      DEFAULT_CONSULTATION_TYPE: freshConfig.DEFAULT_CONSULTATION_TYPE
    };
    
    console.log("Updated configuration:", {
      DEFAULT_DURATION: APPOINTMENT_CONFIG.DEFAULT_DURATION,
      DEFAULT_SLOT_DURATION: APPOINTMENT_CONFIG.DEFAULT_SLOT_DURATION,
      BOOKING_BUFFER_MINUTES: APPOINTMENT_CONFIG.BOOKING_BUFFER_MINUTES,
      DEFAULT_TEMPORARY_PASSWORD: APPOINTMENT_CONFIG.DEFAULT_TEMPORARY_PASSWORD
    });
    
    console.log("Appointment configuration loaded from database");
  } catch (error) {
    console.error("Error loading appointment configuration from database:", error);
    console.log("Using default appointment configuration");
  }
};

// Function to get a specific config value
const getConfigValue = async (key) => {
  try {
    // Try to get from database first
    const value = await AppointmentConfigModel.getConfigValue(key);
    if (value !== null) {
      return value;
    }
    
    // Fall back to default value
    return DEFAULT_CONFIG[key];
  } catch (error) {
    console.error(`Error getting config value for ${key}:`, error);
    return DEFAULT_CONFIG[key];
  }
};

// Initialize config on startup and ensure the module.exports is updated
(async () => {
  try {
    await loadConfigFromDatabase();
    
    // Update the exported object with the loaded values
    Object.keys(APPOINTMENT_CONFIG).forEach(key => {
      module.exports[key] = APPOINTMENT_CONFIG[key];
    });
    
    console.log("Initial appointment configuration loaded and exported:", {
      DEFAULT_DURATION: module.exports.DEFAULT_DURATION,
      DEFAULT_SLOT_DURATION: module.exports.DEFAULT_SLOT_DURATION,
      BOOKING_BUFFER_MINUTES: module.exports.BOOKING_BUFFER_MINUTES,
      DEFAULT_TEMPORARY_PASSWORD: module.exports.DEFAULT_TEMPORARY_PASSWORD
    });
  } catch (err) {
    console.error("Failed to load appointment configuration:", err);
  }
})();

// Reload config every hour and update the exported object
setInterval(async () => {
  try {
    await loadConfigFromDatabase();
    
    // Update the exported object with the loaded values
    Object.keys(APPOINTMENT_CONFIG).forEach(key => {
      module.exports[key] = APPOINTMENT_CONFIG[key];
    });
    
    console.log("Appointment configuration reloaded and exported");
  } catch (err) {
    console.error("Failed to reload appointment configuration:", err);
  }
}, 60 * 60 * 1000); // 1 hour

// Export the configuration directly
module.exports = APPOINTMENT_CONFIG;

// Add helper methods to the exported object
module.exports.getConfigValue = getConfigValue;
module.exports.loadConfigFromDatabase = loadConfigFromDatabase;
module.exports.seedInitialConfig = seedInitialConfig;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;

// Add a method to force reload configuration
module.exports.reloadConfig = async () => {
  await loadConfigFromDatabase();
  
  // Update the exported object directly with new values
  Object.keys(APPOINTMENT_CONFIG).forEach(key => {
    module.exports[key] = APPOINTMENT_CONFIG[key];
  });
  
  return { ...APPOINTMENT_CONFIG };
};