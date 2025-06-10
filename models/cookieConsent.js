const mongoose = require('mongoose');

const cookieConsentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  consent: {
    necessary: { 
      type: Boolean, 
      default: true,
      required: true 
    },
    analytics: { 
      type: Boolean, 
      default: false,
      required: true 
    },
    marketing: { 
      type: Boolean, 
      default: false,
      required: true 
    },
    preferences: { 
      type: Boolean, 
      default: false,
      required: true 
    },
    timestamp: { 
      type: Date, 
      default: Date.now,
      required: true 
    },
    version: { 
      type: String, 
      default: '1.0',
      required: true 
    }
  },
  ipAddress: { 
    type: String,
    required: false 
  },
  userAgent: { 
    type: String,
    required: false 
  }
}, {
  timestamps: true
});

// Indexes for performance
cookieConsentSchema.index({ userId: 1 });
cookieConsentSchema.index({ 'consent.timestamp': -1 });
cookieConsentSchema.index({ createdAt: -1 });

// Method to update consent timestamp when consent is modified
cookieConsentSchema.pre('save', function(next) {
  if (this.isModified('consent') && !this.isNew) {
    this.consent.timestamp = new Date();
  }
  next();
});

module.exports = mongoose.model('CookieConsent', cookieConsentSchema); 