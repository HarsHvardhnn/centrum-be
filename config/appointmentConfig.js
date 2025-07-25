// config/appointmentConfig.js

// Centralized appointment configuration
const APPOINTMENT_CONFIG = {
  // Default appointment duration in minutes
  DEFAULT_DURATION: 15,
  
  // Default slot duration in minutes (for available slots generation)
  DEFAULT_SLOT_DURATION: 15,
  
  // Default temporary password for new patients
  DEFAULT_TEMPORARY_PASSWORD: "centrum123",
  
  // Default consultation type
  DEFAULT_CONSULTATION_TYPE: "offline",
  
  // Appointment statuses
  STATUSES: {
    BOOKED: "booked",
    CANCELLED: "cancelled", 
    COMPLETED: "completed",
    CHECKED_IN: "checkedIn"
  },
  
  // Consultation modes
  MODES: {
    ONLINE: "online",
    OFFLINE: "offline"
  }
};

module.exports = APPOINTMENT_CONFIG; 