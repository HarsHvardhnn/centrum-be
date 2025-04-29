// controllers/newsController.js

const NewsArticle = require("../models/news");

// Create article
// controllers/newsController.js (create only)
exports.createNews = async (req, res) => {
  try {
    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path;
    }
    

    const news = await NewsArticle.create({
      ...req.body,
      image: imagePath,
      createdBy: req.user.id, // or req.body.createdBy if no auth
    });

    res.status(201).json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Get all non-deleted news
exports.getAllNews = async (req, res) => {
  try {
    const { latest, isNews } = req.query;

    // Build base query
    const filter = { isDeleted: false };

    // If isNews is explicitly provided, convert to boolean and include in filter
    if (isNews !== undefined) {
      filter.isNews = isNews === "true";
    }

    let query = NewsArticle.find(filter)
      .populate("category")
      .sort({ createdAt: -1 });

    // If `latest` is provided, limit the results
    if (latest) {
      query = query.limit(Number(latest));
    }

    const newsList = await query.exec();

    res.status(200).json(newsList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



// Get one news item
exports.getNewsById = async (req, res) => {
  try {
    const news = await NewsArticle.findById(req.params.id);
    if (!news || news.isDeleted) {
      return res.status(404).json({ message: "News article not found" });
    }
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update news article
exports.updateNews = async (req, res) => {
  try {
     if (req.file) {
       req.body.image = req.file.path;
     }
    const updated = await NewsArticle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Soft delete news
exports.deleteNews = async (req, res) => {
  try {
    await NewsArticle.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.status(200).json({ message: "News article deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
