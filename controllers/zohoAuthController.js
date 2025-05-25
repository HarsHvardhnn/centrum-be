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
    const user = await User.findById('68306e50aef3773ad8447fb6');

    if (!user || user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin users can set up Zoho Meetings integration",
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
      message: "Failed to generate Zoho authorization URL",
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
        message: "Authorization code is missing",
      });
    }

    // Store tokens
    await initializeZohoMeetings('68306e50aef3773ad8447fb6', code);

    return res.status(200).json({
      success: true,
      message: "Zoho Meetings integration successfully set up",
    });
  } catch (error) {
    console.error("Error handling Zoho callback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to complete Zoho Meetings integration",
      error: error.message,
    });
  }
}; 