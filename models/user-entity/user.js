const mongoose = require("mongoose");

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
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["patient", "doctor", "receptionist", "admin"],
      required: true,
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
