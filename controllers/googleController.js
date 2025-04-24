const googleToken = require("../models/googleToken");
const User = require("../models/user-entity/user");
const { google } = require("googleapis");

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
    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens for the admin user (assuming admin is logged in)
    const userId = req.user._id; // Get from your authentication middleware

    // Check if tokens already exist for this user
    let tokenDoc = await googleToken.findOne({ userId });

    if (tokenDoc) {
      // Update existing tokens
      tokenDoc.accessToken = tokens.access_token;
      tokenDoc.refreshToken = tokens.refresh_token || tokenDoc.refreshToken; // Keep old refresh token if new one not provided
      tokenDoc.expiryDate = new Date(tokens.expiry_date);
    } else {
      // Create new token document
      tokenDoc = new googleToken({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date),
      });
    }

    await tokenDoc.save();

    res.redirect("/admin/google-setup-success"); // Redirect to success page
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    res.redirect("/admin/google-setup-error"); // Redirect to error page
  }
};
