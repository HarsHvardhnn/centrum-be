const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      first: String,
      last: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    sex: {
      type: String,
      enum:["Male","Female","Others"]
    },
    phone: String,
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
      enum: ["google", "email", "apple", "fb"],
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
