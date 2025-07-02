const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      first: String,
      last: String,
    },
    email: {
      type: String,
      unique: false,
      sparse: true,
      default: "",
    },
    sex: {
      type: String,
      enum:["Male","Female","Others"]
    },
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    encryptedPhone: {
      type: String,
      required: false, // Will be populated when 2FA is enabled
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["patient", "doctor", "receptionist", "admin"],
      required: true,
    },
    slug: {
      type: String,
      sparse: true, // Allow null values and only enforce uniqueness on non-null values
      index: true
    },
    signupMethod: {
      type: String,
      enum: ["google", "email", "apple", "fb","phone"],
      required: true,
    },
    profilePicture: String,
    singleSessionMode: {
      type: Boolean,
      default: false,
    },
    // 2FA Settings
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorBackupCodes: [{
      code: String,
      used: { type: Boolean, default: false },
      usedAt: Date
    }],
    // Login attempt tracking for 2FA
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,

    deleted: {
      type: Boolean,
      required: true,
      default: false,
    },
    refreshTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        expiresAt: {
          type: Date,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        device: String,
        ipAddress: String,
      },
    ],
  },
  {
    timestamps: true,
    discriminatorKey: "role",
  }
);

// Encryption/Decryption methods for phone numbers
userSchema.methods.encryptPhone = function() {
  if (!this.phone) return;
  
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.PHONE_ENCRYPTION_KEY || 'your-32-character-secret-key-here', 'salt', 32);
  const iv = crypto.randomBytes(16);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(this.phone, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  this.encryptedPhone = iv.toString('hex') + ':' + encrypted;
};

userSchema.methods.decryptPhone = function() {
  if (!this.encryptedPhone) return this.phone;
  
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.PHONE_ENCRYPTION_KEY || 'your-32-character-secret-key-here', 'salt', 32);
  
  const textParts = this.encryptedPhone.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = textParts.join(':');
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Check if user is locked out
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // After 5 failed attempts, lock for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Add pre-save hook to clean phone numbers
userSchema.pre("save", function (next) {
  // Clean phone number - remove +48 if present
  if (this.phone && typeof this.phone === 'string') {
    // Remove +48 prefix if it exists (with or without spaces)
    this.phone = this.phone.replace(/^\+48\s?/, '');
    // Also clean any other common formats
    this.phone = this.phone.replace(/^48\s?/, ''); // Remove 48 without + 
    this.phone = this.phone.trim(); // Remove leading/trailing spaces
  }
  next();
});

userSchema.methods.hasRefreshToken = function (token) {
  return this.refreshTokens.some((t) => t.token === token);
};

userSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter((t) => t.token !== token);
  return this.save();
};

userSchema.methods.removeAllRefreshTokens = function () {
  this.refreshTokens = [];
  return this.save();
};

userSchema.methods.cleanExpiredTokens = function () {
  const now = new Date();
  this.refreshTokens = this.refreshTokens.filter((t) => t.expiresAt > now);
  return this.save();
};

module.exports = mongoose.model("User", userSchema);
