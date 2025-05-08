const mongoose = require("mongoose");

const patientServiceSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      // Making it optional for backward compatibility
    },
    services: [
      {
        service: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
          required: true,
        },
        status: {
          type: String,
          enum: ["active", "completed", "cancelled"],
          default: "active",
        },
        notes: {
          type: String,
          default: "",
        },
        assignedDate: {
          type: Date,
          default: Date.now,
        },
        completedDate: {
          type: Date,
        },
      },
    ],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Update index to include appointment, remove unique constraint to allow multiple records per patient
patientServiceSchema.index({ patient: 1, appointment: 1 });

module.exports = mongoose.model("PatientService", patientServiceSchema); 