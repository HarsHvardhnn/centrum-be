// models/MessageReceipt.js
const mongoose = require("mongoose");

const messageReceiptSchema = new mongoose.Schema(
  {
    // Message details
    content: {
      type: String,
      required: true,
    },
    batchId: {
      type: String,
      required: true,
      index: true,
    },

    // Recipient details
    recipient: {
      userId: {
        type: String,
        required: false,
      },
      phone: {
        type: String,
        required: true,
      },
    },

    // Status tracking
    status: {
      type: String,
      enum: ["PENDING", "DELIVERED", "FAILED"],
      default: "PENDING",
      index: true,
    },

    // Error information if applicable
    error: {
      code: String,
      message: String,
    },

    // Provider details
    messageId: String, // ID returned from SMS provider
    providerResponse: mongoose.Schema.Types.Mixed,

    // Timestamps
    sentAt: Date,
    deliveredAt: Date,
    failedAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient querying
messageReceiptSchema.index({ "recipient.userId": 1, status: 1 });
messageReceiptSchema.index({ "recipient.phone": 1, status: 1 });
messageReceiptSchema.index({ createdAt: 1 });

const MessageReceipt = mongoose.model("MessageReceipt", messageReceiptSchema);

module.exports = MessageReceipt;
