const { getAuthUrl } = require("../utils/google");
const { initializeGoogleCalendar } = require("../utils/googleCalendar");
const User = require("../models/user-entity/user");

/**
 * Get Google OAuth authorization URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getGoogleAuthUrl = async (req, res) => {
  try {
    // Only allow admins to set up Google Calendar
    const userId = req.user._id; // Assuming you have authentication middleware
    const user = await User.findById(userId);

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can set up Google Calendar integration",
      });
    }

    const authUrl = getAuthUrl();

    return res.status(200).json({
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error("Error generating Google auth URL:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate Google authorization URL",
      error: error.message,
    });
  }
};

/**
 * Handle Google OAuth callback and store tokens
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const userId = req.user._id; // Assuming you have authentication middleware

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is missing",
      });
    }

    // Store tokens
    await initializeGoogleCalendar(userId, code);

    return res.status(200).json({
      success: true,
      message: "Google Calendar integration successfully set up",
    });
  } catch (error) {
    console.error("Error handling Google callback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete Google Calendar integration",
      error: error.message,
    });
  }
};
