const mongoose = require("mongoose");

const userServiceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userType: {
      type: String,
      enum: ["patient", "doctor"],
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
        price: {
          type: Number,
          default: 0,
        },
        isCustomPrice: {
          type: Boolean,
          default: false,
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

// Ensure that there's only one document per user by creating a compound unique index
userServiceSchema.index({ user: 1, userType: 1 }, { unique: true });

module.exports = mongoose.model("UserService", userServiceSchema); 