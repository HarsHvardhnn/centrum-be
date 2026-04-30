// models/Appointment.js

const mongoose = require("mongoose");

// Define the consultation schema
const consultationSchema = new mongoose.Schema({
  consultationType: {
    type: String,
    // Do not hard-restrict values: FE can send dynamic visit reason types.
    // Visit reasons are validated/controlled via the visit-reasons dictionary flow.
    // Any string is accepted here to avoid blocking updates like "Iniekcja".
  },
  /** Visit type display name (Polish), e.g. "Konsultacja pierwszorazowa". Primary field for Rodzaj wizyty. */
  visitType: { type: String, default: null },
  /** True after doctor has confirmed or changed the visit type; required before completing the visit. */
  visitTypeVerified: { type: Boolean, default: true },
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
      enum: ["receptionist", "online", "doctor", "admin"],
      default: "online"
    },
    // Role of the user who created the appointment (from token); null when no token (e.g. public /book)
    createdByRole: { type: String, default: null },
    registrationType: {
      type: String,
      enum: ["online registration", "receptionist registration", "admin registration", "offline registration"],
      default: "online registration",
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
    // PESEL entered during online booking but patient not yet created; used for complete-registration flow
    tempPesel: { type: String, default: null },
    metadata: {
      visitType: String,
      isInternational: Boolean,
      isInternationalPatient: Boolean,
      toBeCompleted: Boolean, // true when online booking created visit only (no patient linked); complete at reception
      isWalkin: Boolean,
      needsAttention: Boolean,
      enableRepeats: Boolean,
      isNewPatient: Boolean,
      documentCountry: String,
      documentType: String,
      documentNumber: String,
      internationalPatientDocumentKey: String,
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
      },
      // Reservation lifecycle history (reschedules/time changes) for FE summary.
      rescheduleHistory: [
        {
          action: { type: String, default: "rescheduled" }, // rescheduled | time_updated
          byRole: { type: String, default: null }, // admin | receptionist | doctor | patient | online
          byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          changedAt: { type: Date, default: Date.now },
          previousDate: { type: Date, default: null },
          previousStartTime: { type: String, default: null },
          previousEndTime: { type: String, default: null },
          newDate: { type: Date, default: null },
          newStartTime: { type: String, default: null },
          newEndTime: { type: String, default: null },
          previousDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
          newDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        },
      ],
    }
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Appointment", appointmentSchema);
