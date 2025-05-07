const mongoose = require("mongoose");

const patientServiceSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Ensure that there's only one document per patient by creating a unique index
patientServiceSchema.index({ patient: 1 }, { unique: true });

module.exports = mongoose.model("PatientService", patientServiceSchema); 