const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  icon: { type: String, required: true }, // Store icon name or class (e.g., "FaStethoscope")
  shortDescription: { type: String, required: true },
  description: { type: String, required: true },
  images: [{ type: String }], // Array of image URLs
  bulletPoints: [{ type: String }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

module.exports = mongoose.model("Service", serviceSchema);
