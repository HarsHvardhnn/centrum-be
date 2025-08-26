// user.js - Keep this as is

// patient.js - Combine both patient schemas
const mongoose = require("mongoose");
const User = require("./user");

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

  // New fields
  isAdult: {
    type: Boolean,
    default: true
  },
  contactPerson: {
    name: String,
    phone: String,
    relation: String
  },
  fatherPhone: String,
  motherPhone: String,
  relationToPatient: String,
  allergies: String,
  nationality: String,
  preferredLanguage: String,
  
  // Additional contact person fields
  contactPerson1Name: String,
  contactPerson1PhonePrefix: String,
  contactPerson1Phone: String,
  contactPerson1Address: String,
  contactPerson1Pesel: String,
  contactPerson1Relationship: String,
  contactPerson2Name: String,
  contactPerson2PhonePrefix: String,
  contactPerson2Phone: String,
  contactPerson2Address: String,
  contactPerson2Pesel: String,
  contactPerson2Relationship: String,

  // Contact and address
  address: String,
  city: String,
  district: String,
  state: String,
  country: String,
  pinCode: String,
  alternateContact: String,
  phoneFormatted: String,
  phoneCode: String, // New field for phone country code (e.g., "+48")
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
  consultingSpecialization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Specialization",
  },
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
    enum: ["completed", "in-treatment","billed"],
    default: "in-treatment",
  },
  smsConsentAgreed: {
    type: Boolean,
    default: false,
  },

  // Health Data - Simplified
  bloodPressure: String,
  temperature: Number,
  weight: Number,
  height: Number,
  roomNumber: Number,
  isRisky: Boolean,
  treatmentStatus: {
    type: String
  },

  // Additional fields
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
  goals: [String],
  monitoringPlan: {
    type: mongoose.Schema.Types.Mixed,
  },

  // Additional data
  photo: String,
  referrerName: String,
  referrerEmail: String,
  referrerNumber: String,
  riskStatus: String,
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
      _id: {
        type: String,
        default: () => new mongoose.Types.ObjectId().toString()
      },
      documentId: {
        type: String,
        default: function() { return this._id; }
      },
      fileName: {
        type: String,
        required: true
      },
      originalName: String,
      path: {
        type: String,
        required: true
      },
      preview: String,
      url: String,
      downloadUrl: String, // Explicit download URL for PDFs
      mimeType: String,
      fileType: String,
      fileExtension: String, // Store file extension separately
      isPdf: {
        type: Boolean,
        default: false
      },
      documentType: {
        type: String,
        enum: ['medical_record', 'report', 'prescription', 'lab_result', 'imaging', 'consent_form', 'insurance', 'visit-card', 'other'],
        default: 'medical_record'
      },
      uploadDate: {
        type: Date,
        default: Date.now
      },
      size: Number,
      createdAt: {
        type: Date,
        default: Date.now
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
});

// Add the pre-save hook for username generation and phone cleaning
patientSchema.pre("save", async function (next) {
  // Clean phone number - remove +48 if present
  if (this.phone && typeof this.phone === 'string') {
    // Remove +48 prefix if it exists (with or without spaces)
    this.phone = this.phone.replace(/^\+48\s?/, '');
    // Also clean any other common formats
    this.phone = this.phone.replace(/^48\s?/, ''); // Remove 48 without + 
    this.phone = this.phone.trim(); // Remove leading/trailing spaces
  }

  // Also clean phoneFormatted if it exists
  if (this.phoneFormatted && typeof this.phoneFormatted === 'string') {
    this.phoneFormatted = this.phoneFormatted.replace(/^\+48\s?/, '');
    this.phoneFormatted = this.phoneFormatted.replace(/^48\s?/, '');
    this.phoneFormatted = this.phoneFormatted.trim();
  }

  // Username generation logic
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
