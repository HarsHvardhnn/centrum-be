// user.js - Keep this as is

// patient.js - Combine both patient schemas
const mongoose = require("mongoose");
const User = require("./user");

// Define the health data schema
const patientHealthDataSchema = new mongoose.Schema({
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
});

// Define the consultation schema
const consultationSchema = new mongoose.Schema({
  consultationType: {
    type: String,
    enum: ["Clinic Consulting", "Online Consultation", "Home Visit"],
  },
  consultationNotes: String,
  consultationTime: String,
  description: String,
  treatmentCategory:String,
  consultationDate: Date,
  roomNumber: Number,
  consultationStatus: {
    type: String,
    enum: ["Scheduled", "In Progress", "Completed", "Cancelled"],
    default: "Scheduled",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isRisky: Boolean,
  isOnline: Boolean,
  // New fields
  interview: String,
  physicalExamination: String,
  treatment: String,
  recommendations: String,
});
// Combine all patient fields into a single schema
const patientSchema = new mongoose.Schema({
  // Basic patient info
  fatherName: String,
  motherName: String,
  spouseName: String,
  dateOfBirth: Date,
  username: {
    type: String,
    unique: true,
  },
  age: Number,
  birthWeight: String,
  bloodGroup: String,
  maritalStatus: String,
  motherTongue: String,
  religion: String,
  ethnicity: String,
  education: String,
  occupation: String,
  patientId: String,

  // Contact and address
  address: String,
  city: String,
  district: String,
  state: String,
  country: String,
  pinCode: String,
  alternateContact: String,
  phoneFormatted: String,
  checkedIn: {
    type: Boolean,
    default: false,
  },

  checkedInDate: {
    type: Date,
  },

  // IDs and references
  govtId: String,
  hospId: {
    type: String,
    default: () => `HOSP-${Date.now()}`,
  },
  otherHospitalIds: String,

  // Medical info
  isInternationalPatient: Boolean,
  ivrLanguage: String,
  mainComplaint: String,
  reviewNotes: String,
  consultingDepartment: String,
  consultingDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  attendingPhysician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  status: {
    type: String,
    enum: ["completed", "in-treatment"],
    default: "in-treatment",
  },

  // Enhanced fields
  currentStatus: {
    roomNumber: Number,
    isRisky: Boolean,
    treatmentStatus: {
      type: String,
      enum: ["Under Treatment", "Completed", "Pending", "Scheduled"],
    },
  },
  chronicConditions: [String],
  specialty: {
    type: String,
    enum: [
      "Cardiology",
      "Neurology",
      "Orthopedics",
      "Pediatrics",
      "General Medicine",
      "Other",
    ],
  },
  consultations: consultationSchema,
  healthData: patientHealthDataSchema,
  goals: [String],
  monitoringPlan: {
    type: mongoose.Schema.Types.Mixed,
  },

  // Tests and medications
  tests: [
    {
      name: String,
      date: Date,
      results: mongoose.Schema.Types.Mixed,
      status: String,
    },
  ],
  medications: [
    {
      name: String,
      dosage: String,
      frequency: String,
      startDate: Date,
      endDate: Date,
      status: String,
    },
  ],

  // Additional data
  photo: String,
  referrerName: String,
  referrerEmail: String,
  referrerNumber: String,
  referrerType: String,
  medicalHistory: [String],
  emergencyContact: {
    name: String,
    phone: String,
    relation: String,
  },
  consents: [
    {
      type: mongoose.Schema.Types.Mixed,
    },
  ],
  documents: [
    {
      type: mongoose.Schema.Types.Mixed,
    },
  ],
});

// Add the pre-save hook for username generation
patientSchema.pre("save", async function (next) {
  if (!this.username) {
    let unique = false;
    while (!unique) {
      const generatedUsername = `${this.name.first.substring(
        0.5
      )}_${Math.random().toString(36).substring(2, 3)}_${Date.now()
        .toString()
        .slice(-4)}`;
      const existingUser = await mongoose
        .model("User")
        .findOne({ username: generatedUsername });
      if (!existingUser) {
        this.username = generatedUsername;
        unique = true;
      }
    }
  }
  next();
});

// Create a single discriminator
module.exports = User.discriminator("patient", patientSchema);
