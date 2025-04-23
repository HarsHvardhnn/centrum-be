const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  message: {
    type: String,
    default: "",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  fileUrl: {
    type: String,
    default: null,
  },
  fileType: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
});

const chatRoomSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Update lastUpdated timestamp whenever a new message is added
chatRoomSchema.pre("save", function (next) {
  if (this.isModified("messages")) {
    this.lastUpdated = Date.now();
  }
  next();
});

module.exports = mongoose.model("ChatRoom", chatRoomSchema);
