const { getAuthUrl } = require("../config/zoho");
const { initializeZohoMeetings } = require("../utils/zohoMeetings");
const User = require("../models/user-entity/user");

/**
 * Get Zoho OAuth authorization URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getZohoAuthUrl = async (req, res) => {
  try {
    // Only allow admins to set up Zoho Meetings
    // const userId = req.user._id;
    const admin = await User.findOne({role: "admin"});
    const user = await User.findById(admin._id);

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Tylko użytkownicy administracyjni mogą skonfigurować integrację Zoho Meetings",
      });
    }

    const authUrl = getAuthUrl();

    return res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error("Error generating Zoho auth URL:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się wygenerować URL autoryzacji Zoho",
      error: error.message,
    });
  }
};

/**
 * Handle Zoho OAuth callback and store tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleZohoCallback = async (req, res) => {
  try {
    const { code } = req.query;
    // const userId = req.user._id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Brak kodu autoryzacji",
      });
    }

    const admin = await User.findOne({role: "admin"});
    // Store tokens
    await initializeZohoMeetings(admin._id, code);

    return res.status(200).json({
      success: true,
      message: "Integracja Zoho Meetings pomyślnie skonfigurowana",
    });
  } catch (error) {
    console.error("Error handling Zoho callback:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się ukończyć integracji Zoho Meetings",
      error: error.message,
    });
  }
}; 