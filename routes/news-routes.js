// routes/newsRoutes.js
const express = require("express");
const router = express.Router();
const newsController = require("../controllers/newsController");
const {upload} = require("../middlewares/cloudinaryUpload");
const authorizeRoles = require("../middlewares/authenticateRole");
const { createCategory, getAllCategories, deleteCategory, getCategoriesWithNewsCount } = require("../controllers/categoryController");

// Auth middleware if needed
// const { protect } = require('../middleware/authMiddleware');

// Create with image upload
router.post(
  "/",
  upload.single("file"),
  authorizeRoles(["admin"]),
 newsController.createNews
);

router.get("/", newsController.getAllNews);
// New slug-based route for SEO-friendly URLs
router.get("/slug/:slug", newsController.getNewsBySlug);
// Keep ID route for backward compatibility
router.get("/:id", newsController.getNewsById);
router.put(
  "/:id",
  upload.single("file")
,  authorizeRoles(["admin"]),
  newsController.updateNews
);
router.delete("/:id",   authorizeRoles(["admin"]),
  newsController.deleteNews);

  router.post("/category/", createCategory);
  router.get("/category/list", getAllCategories);
router.delete("/category/:id", deleteCategory);
  router.get("/category/news-count", getCategoriesWithNewsCount);

module.exports = router;
