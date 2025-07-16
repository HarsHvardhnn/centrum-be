const express = require("express");
const router = express.Router();
const { upload } = require("../middlewares/cloudinaryUpload");
const authorizeRoles = require("../middlewares/authenticateRole");

/**
 * @route POST /api/images/upload
 * @desc Upload a single image and return its URL
 * @access Public (no authentication required for testing)
 */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ 
        success: false,
        message: "No image file uploaded" 
      });
    }

    // Check if file is an image
    const isImage = file.mimetype && file.mimetype.startsWith('image/');
    if (!isImage) {
      return res.status(400).json({ 
        success: false,
        message: "Uploaded file is not an image" 
      });
    }

    const imageInfo = {
      success: true,
      image: {
        url: file.path, // Cloudinary URL
        public_id: file.filename || file.public_id,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        uploadDate: new Date().toISOString(),
        secure_url: file.path.replace('http://', 'https://') // Ensure HTTPS URL
      }
    };

    res.status(200).json(imageInfo);
  } catch (error) {
    console.error("Image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
});

/**
 * @route POST /api/images/upload-multiple
 * @desc Upload multiple images and return their URLs
 * @access Public (no authentication required for testing)
 */
router.post("/upload-multiple", upload.array("images", 10), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: "No image files uploaded" 
      });
    }

    // Check if all files are images
    const invalidFiles = files.filter(file => !file.mimetype || !file.mimetype.startsWith('image/'));
    if (invalidFiles.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Some uploaded files are not images" 
      });
    }

    const images = files.map(file => ({
      url: file.path, // Cloudinary URL
      public_id: file.filename || file.public_id,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadDate: new Date().toISOString(),
      secure_url: file.path.replace('http://', 'https://') // Ensure HTTPS URL
    }));

    res.status(200).json({
      success: true,
      images: images,
      count: images.length
    });
  } catch (error) {
    console.error("Multiple image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload images",
      error: error.message,
    });
  }
});

/**
 * @route GET /api/images/health
 * @desc Health check endpoint for image upload service
 * @access Public
 */
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Image upload service is running",
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 