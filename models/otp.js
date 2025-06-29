const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: false,
    index: true,
  },
  phone: {
    type: String,
    required: false,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  purpose: {
    type: String,
    enum: ["signup", "password-reset", "login-verification", "sms-2fa", "email-2fa"],
    required: true,
  },
  deliveryMethod: {
    type: String,
    enum: ["sms", "email"],
    required: false,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // 5 minutes for SMS codes
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
    default: 5, // Increased for SMS 2FA as per requirements
  },
  blockedUntil: {
    type: Date,
    required: false,
  },
  lastResendAt: {
    type: Date,
    required: false,
  },
});

// Add validation to ensure either email or phone is provided
otpSchema.pre('save', function(next) {
  if (!this.email && !this.phone) {
    return next(new Error('Either email or phone must be provided'));
  }
  next();
});

otpSchema.methods.hasExpired = function () {
  const now = new Date();
  // For SMS 2FA, use 5 minutes (300 seconds)
  const expirationTime = this.purpose === 'sms-2fa' ? 5 * 60 * 1000 : 10 * 60 * 1000;
  return now - this.createdAt > expirationTime;
};

otpSchema.methods.attemptsExceeded = function () {
  return this.attempts >= this.maxAttempts;
};

otpSchema.methods.isBlocked = function () {
  if (!this.blockedUntil) return false;
  return new Date() < this.blockedUntil;
};

otpSchema.methods.canResend = function () {
  if (!this.lastResendAt) return true;
  const now = new Date();
  const oneMinuteInMs = 60 * 1000;
  return now - this.lastResendAt > oneMinuteInMs;
};

otpSchema.methods.blockUser = function (blockDuration = 15 * 60 * 1000) { // 15 minutes default
  this.blockedUntil = new Date(Date.now() + blockDuration);
  return this.save();
};

otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 }); // 5 minutes for SMS codes
otpSchema.index({ phone: 1, purpose: 1 });
otpSchema.index({ userId: 1, purpose: 1 });

module.exports = mongoose.model("OTP", otpSchema);
