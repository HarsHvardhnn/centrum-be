// controllers/newsController.js

const NewsArticle = require("../models/news");
const { generateSlug, ensureUniqueSlug } = require("../utils/slugUtils");

// Create article
// controllers/newsController.js (create only)
exports.createNews = async (req, res) => {
  try {
    let imagePath = null;
    if (req.file) {
      imagePath = req.file.path;
    }
    
    // Generate unique slug from title
    const baseSlug = generateSlug(req.body.title);
    const uniqueSlug = await ensureUniqueSlug(NewsArticle, baseSlug);
    
    // Create news article with explicitly generated slug
    const news = await NewsArticle.create({
      ...req.body,
      image: imagePath,
      createdBy: req.user.id, 
      slug: uniqueSlug
    });

    // Populate category for complete response
    await news.populate("category");

    res.status(201).json(news);
  } catch (error) {
    console.error('Error creating news:', error);
    
    // Handle specific errors
    if (error.code === 11000) {
      // Duplicate key error (likely slug conflict)
      if (error.keyPattern && error.keyPattern.slug) {
        return res.status(400).json({ 
          message: "A news article with similar title already exists. Please use a different title." 
        });
      }
    }
    
    res.status(500).json({ message: error.message });
  }
};


// Get all non-deleted news
exports.getAllNews = async (req, res) => {
  try {
    const { latest, isNews ,category} = req.query;

    // Build base query
    const filter = { isDeleted: false };

    // If isNews is explicitly provided, convert to boolean and include in filter
    if (isNews !== undefined) {
      filter.isNews = isNews === "true";
    }
    if(category){
      filter.category=category;
    }

    let query = NewsArticle.find(filter)
      .populate("category")
      .select('title slug description shortDescription image date author isNews category views likes createdAt updatedAt')
      .sort({ createdAt: -1 });

    // If `latest` is provided, limit the results
    if (latest) {
      query = query.limit(Number(latest));
    }

    const newsList = await query.exec();

    res.status(200).json(newsList);
  } catch (error) {
    console.log('error',error);
    res.status(500).json({ message: error.message });
  }
};

// Get one news item by slug
exports.getNewsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const news = await NewsArticle.findOne({ slug, isDeleted: false })
      .populate("category");
    
    if (!news) {
      return res.status(404).json({ message: "News article not found" });
    }
    
    res.status(200).json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get one news item by ID (keeping for backward compatibility)
exports.getNewsById = async (req, res) => {
  try {
    const news = await NewsArticle.findById(req.params.id).populate("category");
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
     
     // If title is being updated, regenerate slug
     if (req.body.title) {
       const baseSlug = generateSlug(req.body.title);
       req.body.slug = await ensureUniqueSlug(NewsArticle, baseSlug, req.params.id);
     }
     
    const updated = await NewsArticle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate("category");
    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating news:', error);
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
