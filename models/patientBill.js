const mongoose = require("mongoose");

const patientBillSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
    },
    services: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Service",
          required: true,
        },
        title: {
          type: String,
          required: true,
        },
        price: {
          type: String,
          required: true,
        },
        status: {
          type: String,
          enum: ["active", "completed", "cancelled"],
          default: "active",
        }
      },
    ],
    subtotal: {
      type: Number,
      required: true,
    },
    taxPercentage: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    additionalCharges: {
      type: Number,
      default: 0,
    },
    additionalChargeNote: {
      type: String,
      default: "",
    },
    totalAmount: {
      type: String,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "partial", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "online", "insurance", "other"],
      default: "cash",
    },
    billedAt: {
      type: Date,
      default: Date.now,
    },
    billedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    notes: {
      type: String,
      default: "",
    },
    invoiceUrl: {
      type: String,
      default: null,
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

// Indexes for efficient querying
patientBillSchema.index({ patient: 1 });
patientBillSchema.index({ appointment: 1 }, { unique: true });
patientBillSchema.index({ billedAt: -1 });
patientBillSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model("PatientBill", patientBillSchema); 