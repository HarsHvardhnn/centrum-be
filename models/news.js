const mongoose = require("mongoose");

const newsArticleSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: false,
    },
    date: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      required: false,
    },
    author: {
      type: String,
      required: false,
      default:'Centrum Medyczne'
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      // ✅ New Field
      type: String,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    isNews: {
      type: Boolean,
      default: true,
    },
    category: {
      // ✅ New Reference
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("NewsArticle", newsArticleSchema);
