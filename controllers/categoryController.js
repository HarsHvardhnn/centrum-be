const Category = require("../models/category");
const news = require("../models/news");

// Create category
exports.createCategory = async (req, res) => {
  try {
    const category = await Category.create({ name: req.body.name });
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isDeleted: false });
    res.status(200).json(categories);
  } catch (err) {
    console.log("err", err);
    res.status(500).json({ message: err.message });
  }
};

// Soft delete
exports.deleteCategory = async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.status(200).json({ message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


exports.getCategoriesWithNewsCount = async (req, res) => {
  try {
    const result = await news.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: "$category",
          newsCount: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories", // must match the actual collection name
          localField: "_id",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: "$categoryInfo" },
      {
        $project: {
          _id: 0,
          categoryId: "$categoryInfo._id",
          name: "$categoryInfo.name",
          newsCount: 1,
        },
      },
    ]);

    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
