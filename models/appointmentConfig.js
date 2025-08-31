const mongoose = require("mongoose");

/**
 * Schema for storing appointment configuration settings
 * These settings can be modified through the API
 */
const appointmentConfigSchema = new mongoose.Schema(
  {
    // Configuration key (e.g., DEFAULT_DURATION, DEFAULT_SLOT_DURATION)
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    
    // Configuration value (can be string, number, boolean)
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    
    // Value type for validation and UI rendering
    valueType: {
      type: String,
      enum: ["string", "number", "boolean"],
      required: true
    },
    
    // Description of the configuration setting
    description: {
      type: String,
      required: true
    },
    
    // Optional validation rules
    validation: {
      min: Number,
      max: Number,
      pattern: String,
      options: [mongoose.Schema.Types.Mixed]
    },
    
    // Display name for UI
    displayName: {
      type: String,
      required: true
    },
    
    // Category for grouping in UI
    category: {
      type: String,
      default: "general"
    },
    
    // Is this setting editable through the API?
    editable: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Middleware to validate values based on valueType
appointmentConfigSchema.pre("save", function(next) {
  const config = this;
  
  // Validate value based on valueType
  if (config.valueType === "number" && typeof config.value !== "number") {
    try {
      config.value = Number(config.value);
      if (isNaN(config.value)) {
        return next(new Error(`Value for ${config.key} must be a number`));
      }
    } catch (error) {
      return next(new Error(`Value for ${config.key} must be a number`));
    }
  } else if (config.valueType === "boolean" && typeof config.value !== "boolean") {
    if (config.value === "true" || config.value === "false") {
      config.value = config.value === "true";
    } else {
      return next(new Error(`Value for ${config.key} must be a boolean`));
    }
  } else if (config.valueType === "string" && typeof config.value !== "string") {
    config.value = String(config.value);
  }
  
  // Validate against min/max if they exist
  if (config.valueType === "number") {
    if (config.validation && config.validation.min !== undefined && config.value < config.validation.min) {
      return next(new Error(`Value for ${config.key} must be at least ${config.validation.min}`));
    }
    if (config.validation && config.validation.max !== undefined && config.value > config.validation.max) {
      return next(new Error(`Value for ${config.key} must be at most ${config.validation.max}`));
    }
  }
  
  next();
});

// Static method to get a configuration value by key
appointmentConfigSchema.statics.getConfigValue = async function(key) {
  const config = await this.findOne({ key: key.toUpperCase() });
  return config ? config.value : null;
};

// Static method to set a configuration value by key
appointmentConfigSchema.statics.setConfigValue = async function(key, value) {
  const config = await this.findOne({ key: key.toUpperCase() });
  if (!config) {
    throw new Error(`Configuration key ${key} not found`);
  }
  
  config.value = value;
  await config.save();
  return config;
};

// Static method to get all configuration values as an object
appointmentConfigSchema.statics.getAllConfigValues = async function() {
  const configs = await this.find({});
  const configObject = {};
  
  configs.forEach(config => {
    configObject[config.key] = config.value;
  });
  
  return configObject;
};

const AppointmentConfig = mongoose.model("AppointmentConfig", appointmentConfigSchema);

module.exports = AppointmentConfig;
