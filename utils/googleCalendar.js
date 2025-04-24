const { google } = require("googleapis");
const googleToken = require("../models/googleToken");

// Get authenticated Google Calendar API client
async function getCalendarClient(adminUserId) {
  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  // Fetch tokens from database
  const tokenDoc = await googleToken.findOne({ userId: adminUserId });

  if (!tokenDoc) {
    throw new Error(
      "Google Calendar not configured. Admin needs to authorize access."
    );
  }

  // Set credentials
  oauth2Client.setCredentials({
    access_token: tokenDoc.accessToken,
    refresh_token: tokenDoc.refreshToken,
    expiry_date: tokenDoc.expiryDate.getTime(),
  });

  // Set up token refresh handler
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      // Update stored refresh token
      tokenDoc.refreshToken = tokens.refresh_token;
    }

    // Update access token and expiry
    tokenDoc.accessToken = tokens.access_token;
    tokenDoc.expiryDate = new Date(tokens.expiry_date);

    await tokenDoc.save();
  });

  // Return Calendar API client
  return google.calendar({ version: "v3", auth: oauth2Client });
}

module.exports = { getCalendarClient };
