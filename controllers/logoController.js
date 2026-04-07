const { upload } = require("../middlewares/cloudinaryUpload");
const cloudinary = require("../utils/cloudinary");

/**
 * Upload CM7MED logo to Cloudinary
 * @route POST /api/logo/upload
 * @access Admin only
 */
exports.uploadLogo = async (req, res) => {
  try {
    req.cloudinaryCategory = "branding_logo";
    // Use the existing upload middleware
    upload.single("logo")(req, res, async (err) => {
      if (err) {
        console.error("Logo upload error:", err);
        return res.status(400).json({
          success: false,
          message: "Błąd podczas przesyłania logo",
          error: err.message
        });
      }

      const file = req.file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: "Brak pliku logo do przesłania"
        });
      }

      // Check if file is an image
      const isImage = file.mimetype && file.mimetype.startsWith('image/');
      if (!isImage) {
        return res.status(400).json({
          success: false,
          message: "Przesłany plik nie jest obrazem"
        });
      }

      // Check file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: "Rozmiar pliku przekracza 5MB"
        });
      }

      // Ensure HTTPS URL
      const secureUrl = file.path.replace('http://', 'https://');

      const logoInfo = {
        success: true,
        message: "Logo zostało pomyślnie przesłane",
        logo: {
          url: secureUrl,
          public_id: file.filename || file.public_id,
          originalName: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          uploadDate: new Date().toISOString()
        }
      };

      console.log("Logo uploaded successfully:", logoInfo.logo.url);
      res.status(200).json(logoInfo);
    });

  } catch (error) {
    console.error("Logo upload controller error:", error);
    res.status(500).json({
      success: false,
      message: "Błąd serwera podczas przesyłania logo",
      error: error.message
    });
  }
};

/**
 * Get current logo URL (stored in environment or default)
 * @route GET /api/logo/current
 * @access Public
 */
exports.getCurrentLogo = async (req, res) => {
  try {
    const logoUrl = process.env.CM7MED_LOGO_URL || 
                   `${process.env.FRONTEND_URL || 'https://your-domain.com'}/CM7MED_logo.png`;

    res.status(200).json({
      success: true,
      logo: {
        url: logoUrl,
        source: process.env.CM7MED_LOGO_URL ? 'cloudinary' : 'default'
      }
    });
  } catch (error) {
    console.error("Get logo error:", error);
    res.status(500).json({
      success: false,
      message: "Błąd podczas pobierania logo",
      error: error.message
    });
  }
};

/**
 * Delete logo from Cloudinary
 * @route DELETE /api/logo/delete/:publicId
 * @access Admin only
 */
exports.deleteLogo = async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Brak ID publicznego logo"
      });
    }

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: "Logo zostało pomyślnie usunięte"
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Nie udało się usunąć logo",
        result: result
      });
    }

  } catch (error) {
    console.error("Delete logo error:", error);
    res.status(500).json({
      success: false,
      message: "Błąd podczas usuwania logo",
      error: error.message
    });
  }
};

module.exports = {
  uploadLogo: exports.uploadLogo,
  getCurrentLogo: exports.getCurrentLogo,
  deleteLogo: exports.deleteLogo
};
