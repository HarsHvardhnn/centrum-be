// config/jwtConfig.js
const AppointmentConfigModel = require("../models/appointmentConfig");

// Default JWT configuration values
const DEFAULT_CONFIG = {
  // JWT Access Token Expiry Time
  // Format: string like "1h", "30m", "2d", etc.
  // See: https://github.com/vercel/ms for format details
  JWT_EXPIRY_TIME: "1h",
  
  // Refresh Token Expiry (in days)
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  
  // Inactivity Timeout (in minutes)
  // Time of inactivity before user should be logged out
  INACTIVITY_TIMEOUT: 30
};

// Create a mutable copy of the default config that will be updated with DB values
let JWT_CONFIG = { ...DEFAULT_CONFIG };

// Function to seed initial JWT configuration if it doesn't exist
const seedInitialConfig = async () => {
  try {
    // Check if JWT config exists
    const jwtExpiryConfig = await AppointmentConfigModel.findOne({ key: "JWT_EXPIRY_TIME" });
    const refreshExpiryConfig = await AppointmentConfigModel.findOne({ key: "REFRESH_TOKEN_EXPIRY_DAYS" });
    const inactivityTimeoutConfig = await AppointmentConfigModel.findOne({ key: "INACTIVITY_TIMEOUT" });
    
    if (!jwtExpiryConfig) {
      console.log("No JWT_EXPIRY_TIME configuration found in database. Creating initial configuration...");
      
      await AppointmentConfigModel.create({
        key: "JWT_EXPIRY_TIME",
        value: DEFAULT_CONFIG.JWT_EXPIRY_TIME,
        valueType: "string",
        description: "JWT access token expiry time (e.g., '1h', '30m', '2d'). See https://github.com/vercel/ms for format",
        displayName: "JWT Access Token Expiry Time",
        category: "authentication",
        validation: {
          pattern: "^\\d+[smhd]$" // Matches patterns like 1h, 30m, 2d, etc.
        },
        editable: true
      });
      
      console.log("Created initial configuration: JWT_EXPIRY_TIME");
    }
    
    if (!refreshExpiryConfig) {
      console.log("No REFRESH_TOKEN_EXPIRY_DAYS configuration found in database. Creating initial configuration...");
      
      await AppointmentConfigModel.create({
        key: "REFRESH_TOKEN_EXPIRY_DAYS",
        value: DEFAULT_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS,
        valueType: "number",
        description: "Refresh token expiry time in days",
        displayName: "Refresh Token Expiry (Days)",
        category: "authentication",
        validation: {
          min: 1,
          max: 365
        },
        editable: true
      });
      
      console.log("Created initial configuration: REFRESH_TOKEN_EXPIRY_DAYS");
    }
    
    if (!inactivityTimeoutConfig) {
      console.log("No INACTIVITY_TIMEOUT configuration found in database. Creating initial configuration...");
      
      await AppointmentConfigModel.create({
        key: "INACTIVITY_TIMEOUT",
        value: DEFAULT_CONFIG.INACTIVITY_TIMEOUT,
        valueType: "number",
        description: "Inactivity timeout in minutes. User will be logged out after this period of inactivity",
        displayName: "Inactivity Timeout (Minutes)",
        category: "authentication",
        validation: {
          min: 1,
          max: 1440 // 24 hours in minutes
        },
        editable: true
      });
      
      console.log("Created initial configuration: INACTIVITY_TIMEOUT");
    }
    
    if (!jwtExpiryConfig || !refreshExpiryConfig || !inactivityTimeoutConfig) {
      console.log("Initial JWT configuration created successfully");
    }
  } catch (error) {
    console.error("Error seeding initial JWT configuration:", error);
  }
};

// Function to load JWT config from database
const loadConfigFromDatabase = async () => {
  try {
    // First, ensure configuration exists
    await seedInitialConfig();
    
    // Get JWT configuration values from database
    const jwtExpiry = await AppointmentConfigModel.getConfigValue("JWT_EXPIRY_TIME");
    const refreshExpiryDays = await AppointmentConfigModel.getConfigValue("REFRESH_TOKEN_EXPIRY_DAYS");
    const inactivityTimeout = await AppointmentConfigModel.getConfigValue("INACTIVITY_TIMEOUT");
    
    // Create a fresh copy of default config
    const freshConfig = { ...DEFAULT_CONFIG };
    
    // Override with database values if they exist
    if (jwtExpiry !== null) {
      freshConfig.JWT_EXPIRY_TIME = jwtExpiry;
    }
    
    if (refreshExpiryDays !== null) {
      freshConfig.REFRESH_TOKEN_EXPIRY_DAYS = refreshExpiryDays;
    }
    
    if (inactivityTimeout !== null) {
      freshConfig.INACTIVITY_TIMEOUT = inactivityTimeout;
    }
    
    // Replace the entire config object with our updated version
    JWT_CONFIG = { ...freshConfig };
    
    console.log("Updated JWT configuration:", {
      JWT_EXPIRY_TIME: JWT_CONFIG.JWT_EXPIRY_TIME,
      REFRESH_TOKEN_EXPIRY_DAYS: JWT_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS,
      INACTIVITY_TIMEOUT: JWT_CONFIG.INACTIVITY_TIMEOUT
    });
    
    console.log("JWT configuration loaded from database");
  } catch (error) {
    console.error("Error loading JWT configuration from database:", error);
    console.log("Using default JWT configuration");
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
    console.error(`Error getting JWT config value for ${key}:`, error);
    return DEFAULT_CONFIG[key];
  }
};

// Initialize config on startup and ensure the module.exports is updated
(async () => {
  try {
    await loadConfigFromDatabase();
    
    // Update the exported object with the loaded values
    Object.keys(JWT_CONFIG).forEach(key => {
      module.exports[key] = JWT_CONFIG[key];
    });
    
    console.log("Initial JWT configuration loaded and exported:", {
      JWT_EXPIRY_TIME: module.exports.JWT_EXPIRY_TIME,
      REFRESH_TOKEN_EXPIRY_DAYS: module.exports.REFRESH_TOKEN_EXPIRY_DAYS,
      INACTIVITY_TIMEOUT: module.exports.INACTIVITY_TIMEOUT
    });
  } catch (err) {
    console.error("Failed to load JWT configuration:", err);
  }
})();

// Reload config every hour and update the exported object
setInterval(async () => {
  try {
    await loadConfigFromDatabase();
    
    // Update the exported object with the loaded values
    Object.keys(JWT_CONFIG).forEach(key => {
      module.exports[key] = JWT_CONFIG[key];
    });
    
    console.log("JWT configuration reloaded and exported");
  } catch (err) {
    console.error("Failed to reload JWT configuration:", err);
  }
}, 60 * 60 * 1000); // 1 hour

// Export the configuration directly
module.exports = JWT_CONFIG;

// Helper function to get current JWT expiry time (always returns latest value)
const getJwtExpiryTime = () => {
  return JWT_CONFIG.JWT_EXPIRY_TIME || DEFAULT_CONFIG.JWT_EXPIRY_TIME;
};

// Helper function to get current refresh token expiry days (always returns latest value)
const getRefreshTokenExpiryDays = () => {
  return JWT_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS || DEFAULT_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS;
};

// Helper function to get current inactivity timeout (always returns latest value)
const getInactivityTimeout = () => {
  return JWT_CONFIG.INACTIVITY_TIMEOUT || DEFAULT_CONFIG.INACTIVITY_TIMEOUT;
};

// Add helper methods to the exported object
module.exports.getConfigValue = getConfigValue;
module.exports.loadConfigFromDatabase = loadConfigFromDatabase;
module.exports.seedInitialConfig = seedInitialConfig;
module.exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
module.exports.getJwtExpiryTime = getJwtExpiryTime;
module.exports.getRefreshTokenExpiryDays = getRefreshTokenExpiryDays;
module.exports.getInactivityTimeout = getInactivityTimeout;

// Add a method to force reload configuration
module.exports.reloadConfig = async () => {
  await loadConfigFromDatabase();
  
  // Update the exported object directly with new values
  Object.keys(JWT_CONFIG).forEach(key => {
    module.exports[key] = JWT_CONFIG[key];
  });
  
  return { ...JWT_CONFIG };
};
