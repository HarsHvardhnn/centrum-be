// models/Appointment.js

const mongoose = require("mongoose");

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
