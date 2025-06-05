const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  icon: { type: String, required: false }, 
  shortDescription: { type: String, required: false },
  description: { type: String, required: false },
  images: [{ type: String }],
  bulletPoints: [{ type: String }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  price:{
    type: String,
    default:0
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

module.exports = mongoose.model("Service", serviceSchema);
