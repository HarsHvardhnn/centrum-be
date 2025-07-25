const mongoose = require("mongoose");

const smsTemplateSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
smsTemplateSchema.index({ title: 1 });
smsTemplateSchema.index({ isActive: 1 });
smsTemplateSchema.index({ createdAt: -1 });

module.exports = mongoose.model("SmsTemplate", smsTemplateSchema); 