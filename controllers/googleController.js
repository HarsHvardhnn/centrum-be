const googleToken = require("../models/googleToken");
const User = require("../models/user-entity/user");
const { google } = require("googleapis");
const { storeInitialTokens } = require("../utils/serverGoogleAuth");

// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate OAuth URL for admin to authenticate with Google
exports.getGoogleAuthUrl = (req, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent", // Force to get refresh_token every time
  });

  res.json({ authUrl: url });
};

// Handle OAuth callback from Google
exports.handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const userId = req.user._id; // Get from your authentication middleware

    // Use our new utility to store the tokens
    await storeInitialTokens(userId, code);
    
    // Send success response
    res.redirect("/admin/google-setup-success?status=success"); // Redirect to success page
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    res.redirect(`/admin/google-setup-error?error=${encodeURIComponent(error.message)}`); // Redirect to error page
  }
};

// Server-side token initialization API (for admin use only)
exports.initializeGoogleAuth = async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required"
      });
    }
    
    const userId = req.user._id;
    
    // Only admins can use this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only administrators can initialize Google Calendar"
      });
    }
    
    // Store tokens using our utility
    await storeInitialTokens(userId, code);
    
    return res.status(200).json({
      success: true,
      message: "Google Calendar authorization successful"
    });
  } catch (error) {
    console.error("Google auth initialization error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to initialize Google Calendar",
      error: error.message
    });
  }
};

// Check Google auth status API
exports.checkGoogleAuthStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Only admins can use this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only administrators can check Google Calendar status"
      });
    }
    
    // Check if token exists for the user
    const tokenDoc = await googleToken.findOne({ userId });
    
    if (!tokenDoc) {
      // No token found, need to authorize
      const scopes = [
        "https://www.googleapis.com/auth/calendar",
        "https://www.googleapis.com/auth/calendar.events",
      ];
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
      });
      
      return res.status(200).json({
        success: true,
        isAuthorized: false,
        authUrl
      });
    }
    
    // Check if token is expired
    const isExpired = new Date(tokenDoc.expiryDate) < new Date();
    
    return res.status(200).json({
      success: true,
      isAuthorized: true,
      isExpired,
      lastUpdated: tokenDoc.updatedAt
    });
  } catch (error) {
    console.error("Error checking Google auth status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check Google authorization status",
      error: error.message
    });
  }
};
