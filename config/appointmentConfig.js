// config/appointmentConfig.js

// Centralized appointment configuration
const APPOINTMENT_CONFIG = {
  // Default appointment duration in minutes
  DEFAULT_DURATION: 15,
  
  // Default slot duration in minutes (for available slots generation)
  DEFAULT_SLOT_DURATION: 15,
  
  // Buffer time in minutes for booking (prevents booking slots too close to current time)
  BOOKING_BUFFER_MINUTES: 15,
  
  // Default temporary password for new patients
  DEFAULT_TEMPORARY_PASSWORD: "centrum123",
  
  // Default consultation type
  DEFAULT_CONSULTATION_TYPE: "offline",
  
  // Receptionist Override Settings
  OVERRIDE: {
    // Minimum appointment duration in minutes
    MIN_DURATION: 1,
    
    // Maximum appointment duration in minutes (8 hours)
    MAX_DURATION: 480,
    
    // Allow backdating appointments (for record keeping)
    ALLOW_BACKDATING: true,
    
    // Allow overriding time conflicts
    ALLOW_CONFLICT_OVERRIDE: true,
    
    // Allow multiple patients at same time
    ALLOW_MULTIPLE_PATIENTS: true,
    
    // Allow custom time slots outside published hours
    ALLOW_CUSTOM_TIMES: true,
  },
  
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
  },
  
  // User roles that can create appointments
  APPOINTMENT_CREATORS: {
    RECEPTIONIST: "receptionist",
    DOCTOR: "doctor",
    ONLINE: "online",
    ADMIN: "admin"
  }
};

module.exports = APPOINTMENT_CONFIG; 