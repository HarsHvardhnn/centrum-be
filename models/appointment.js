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

// Define the reports schema
const reportSchema = new mongoose.Schema({
  name: String,
  type: String, // e.g., "Lab", "Imaging", "Procedure"
  fileUrl: String,
  fileType: String, // e.g., "pdf", "jpg", "png"
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
      required: true,
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
      enum: ["booked", "cancelled", "completed"],
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
    metadata: {
      patientSource: String,
      visitType: String,
      isInternational: Boolean,
      isWalkin: Boolean,
      needsAttention: Boolean,
      enableRepeats: Boolean,
      isNewPatient: Boolean,
      consultationFee: {
        type: Number,
        default: 0
      }
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
