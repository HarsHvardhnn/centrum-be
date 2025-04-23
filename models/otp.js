const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ["signup", "password-reset", "login-verification"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  maxAttempts: {
    type: Number,
    default: 3,
  },
});

otpSchema.methods.hasExpired = function () {
  const now = new Date();
  const tenMinutesInMs = 10 * 60 * 1000;
  return now - this.createdAt > tenMinutesInMs;
};

otpSchema.methods.attemptsExceeded = function () {
  return this.attempts >= this.maxAttempts;
};

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model("OTP", otpSchema);
