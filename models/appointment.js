// models/Appointment.js

const mongoose = require("mongoose");

// Define the consultation schema
const consultationSchema = new mongoose.Schema({
  consultationType: {
    type: String,
    enum: ["Clinic Consulting", "Online Consultation", "Home Visit", "Konsultacja w przychodni",
      "Konsultacja online", "Wizyta domowa"],
  },
  consultationDate: Date,
  consultationNotes: String,
  description: String,
  treatmentCategory: String,
  roomNumber: Number,
  consultationStatus: {
    type: String,
    enum: ["Scheduled", "In Progress", "Completed", "Cancelled"],
    default: "Scheduled",
  },
  isRisky: Boolean,
  isOnline: Boolean,
  interview: String,          // Wywiad z pacjentem
  physicalExamination: String, // Badanie przedmiotowe
  treatment: String,          // Zastosowane leczenie
  recommendations: String     // Zalecenia
});

// Define the test schema
const testSchema = new mongoose.Schema({
  name: String,
  date: Date,
  results: mongoose.Schema.Types.Mixed,
  status: String,
});

// Define the medication schema
const medicationSchema = new mongoose.Schema({
  name: String,
  dosage: String,
  frequency: String,
  startDate: Date,
  endDate: Date,
  status: String,
});

// Define the health data schema
const healthDataSchema = new mongoose.Schema({
  bloodPressure: {
    value: String,
    percentage: Number,
    temperature: Number,
  },
  bodyHeight: {
    value: String,
    percentage: Number,
  },
  bodyWeight: {
    value: Number,
    percentage: Number,
  },
  notes: String,
  recordedAt: {
    type: Date,
    default: Date.now
  }
});

// Define the reports schema with standardized document structure
const reportSchema = new mongoose.Schema({
  // Standardized document fields
  _id: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString()
  },
  documentId: {
    type: String,
    default: function() { return this._id; }
  },
  fileName: String,
  originalName: String,
  path: String,
  preview: String,
  url: String,
  downloadUrl: String,
  mimeType: String,
  fileType: String,
  fileExtension: String,
  isPdf: {
    type: Boolean,
    default: false
  },
  documentType: {
    type: String,
    enum: ['medical_record', 'report', 'prescription', 'lab_result', 'imaging', 'consent_form', 'insurance', 'visit-card', 'other'],
    default: 'report'
  },
  size: Number,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Appointment-specific fields (for backward compatibility)
  name: String,
  type: String, // e.g., "Lab", "Imaging", "Procedure"
  fileUrl: String, // For backward compatibility
  description: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  metadata: mongoose.Schema.Types.Mixed
});

const appointmentSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    // ONLINE = registered by patient online; RECEPTION = by reception staff
    booking_source: {
      type: String,
      enum: ["ONLINE", "RECEPTION"],
      default: null,
    },
    date: {
      type: Date,
      required: true,
    },
    startTime: {
      type: String, // "10:00"
      required: true,
    },
    endTime: {
      type: String, // "10:30"
      required: true,
    },
    duration: {
      type: Number, 
      required: true,
    },
    customDuration: {
      type: Number,
      default: null
    },
    isBackdated: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: String,
      enum: ["receptionist", "online", "doctor"],
      default: "online"
    },
    checkedIn:{
      type:Boolean,
      default:false
    },
    checkInDate:{
      type:Date,
      default:null
    },
    mode: {
      type: String, 
      enum: ["online", "offline"],
      default:"offline"
    },
    status: {
      type: String,
      enum: ["booked", "cancelled", "completed", "checkedIn", "no-show"],
      default: "booked",
    },
    joining_link: {
      type: String,
      required: false
    },
    notes: String,
    // New fields for consultation, tests, and medications
    consultation: consultationSchema,
    tests: [testSchema],
    medications: [medicationSchema],
    // New fields for health data and reports
    healthData: healthDataSchema,
    reports: [reportSchema],
    // Registration data when visit created without patient (online / reception first visit)
    registrationData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      visitType: String,
      isInternational: Boolean,
      isWalkin: Boolean,
      needsAttention: Boolean,
      enableRepeats: Boolean,
      isNewPatient: Boolean,
      consultationFee: {
        type: Number,
        default: 0
      },
      // Reminder tracking fields
      reminderSent: {
        type: Boolean,
        default: false
      },
      reminderSentAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
