const AppointmentConfig = require("../models/appointmentConfig");
const mongoose = require("mongoose");

/**
 * Get all appointment configuration settings
 */
exports.getAllConfigs = async (req, res) => {
  try {
    const configs = await AppointmentConfig.find({});
    
    return res.status(200).json({
      success: true,
      data: configs
    });
  } catch (error) {
    console.error("Error fetching appointment configs:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointment configurations",
      error: error.message
    });
  }
};

/**
 * Get a specific configuration by key
 */
exports.getConfigByKey = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Configuration key is required"
      });
    }
    
    const config = await AppointmentConfig.findOne({ key: key.toUpperCase() });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Configuration with key ${key} not found`
      });
    }
    
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error("Error fetching appointment config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointment configuration",
      error: error.message
    });
  }
};

/**
 * Update a configuration value
 */
exports.updateConfig = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Configuration key is required"
      });
    }
    
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: "Configuration value is required"
      });
    }
    
    const config = await AppointmentConfig.findOne({ key: key.toUpperCase() });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Configuration with key ${key} not found`
      });
    }
    
    // Check if the config is editable
    if (!config.editable) {
      return res.status(403).json({
        success: false,
        message: `Configuration ${key} is not editable`
      });
    }
    
    // Update the value
    config.value = value;
    
    // Save and validate
    await config.save();
    
    // Immediately refresh the in-memory configuration
    const appointmentConfig = require("../config/appointmentConfig");
    await appointmentConfig.reloadConfig();
    
    // Also reload JWT config if JWT-related configs are updated
    const upperKey = key.toUpperCase();
    if (upperKey === "JWT_EXPIRY_TIME" || upperKey === "REFRESH_TOKEN_EXPIRY_DAYS" || upperKey === "INACTIVITY_TIMEOUT") {
      const jwtConfig = require("../config/jwtConfig");
      await jwtConfig.reloadConfig();
      console.log(`JWT configuration reloaded after ${key} update`);
    }
    
    console.log(`Configuration ${key} updated and in-memory config refreshed`);
    
    return res.status(200).json({
      success: true,
      message: `Configuration ${key} updated successfully`,
      data: config
    });
  } catch (error) {
    console.error("Error updating appointment config:", error);
    return res.status(400).json({
      success: false,
      message: "Failed to update appointment configuration",
      error: error.message
    });
  }
};

/**
 * Get all configuration values as a single object
 * This is used by the appointmentConfig.js to load settings
 */
exports.getConfigObject = async (req, res) => {
  try {
    const configObject = await AppointmentConfig.getAllConfigValues();
    
    return res.status(200).json({
      success: true,
      data: configObject
    });
  } catch (error) {
    console.error("Error fetching appointment config object:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointment configuration object",
      error: error.message
    });
  }
};

/**
 * Reset a configuration to its default value
 */
exports.resetConfig = async (req, res) => {
  try {
    const { key } = req.params;
    
    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Configuration key is required"
      });
    }
    
    // Get the default values from the appointmentConfig module
    const appointmentConfig = require("../config/appointmentConfig");
    const defaultValues = appointmentConfig.DEFAULT_CONFIG;
    
    const upperKey = key.toUpperCase();
    if (!defaultValues[upperKey]) {
      return res.status(404).json({
        success: false,
        message: `No default value found for ${key}`
      });
    }
    
    const config = await AppointmentConfig.findOne({ key: upperKey });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: `Configuration with key ${key} not found`
      });
    }
    
    // Reset to default value
    config.value = defaultValues[upperKey];
    await config.save();
    
    // Immediately refresh the in-memory configuration
    await appointmentConfig.reloadConfig();
    
    // Also reload JWT config if JWT-related configs are reset
    if (upperKey === "JWT_EXPIRY_TIME" || upperKey === "REFRESH_TOKEN_EXPIRY_DAYS" || upperKey === "INACTIVITY_TIMEOUT") {
      const jwtConfig = require("../config/jwtConfig");
      await jwtConfig.reloadConfig();
      console.log(`JWT configuration reloaded after ${key} reset`);
    }
    
    console.log(`Configuration ${key} reset to default value and in-memory config refreshed`);
    
    return res.status(200).json({
      success: true,
      message: `Configuration ${key} reset to default value`,
      data: config
    });
  } catch (error) {
    console.error("Error resetting appointment config:", error);
    return res.status(400).json({
      success: false,
      message: "Failed to reset appointment configuration",
      error: error.message
    });
  }
};
