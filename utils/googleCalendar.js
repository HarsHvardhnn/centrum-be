// googleCalendar.js

const { google } = require("googleapis");
const { oauth2Client, getTokens, getAuthUrl } = require("../config/google");
const GoogleToken = require("../models/googleToken");

/**
 * Initialize Google Calendar integration by exchanging authorization code for tokens
 * @param {string} userId - User ID
 * @param {string} code - Authorization code from Google OAuth flow
 */
async function initializeGoogleCalendar(userId, code) {
  try {
    const tokens = await getTokens(code);
    const expiryDate = new Date(tokens.expiry_date);

    let tokenDoc = await GoogleToken.findOne({ userId });

    if (tokenDoc) {
      tokenDoc.accessToken = tokens.access_token;
      tokenDoc.refreshToken = tokens.refresh_token || tokenDoc.refreshToken;
      tokenDoc.expiryDate = expiryDate;
    } else {
      tokenDoc = new GoogleToken({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate,
      });
    }

    await tokenDoc.save();
    return true;
  } catch (error) {
    console.error("Error initializing Google Calendar:", error);
    throw new Error(`Failed to initialize Google Calendar: ${error.message}`);
  }
}

/**
 * Get Google Calendar client for a user
 * @param {string} userId - User ID
 * @returns {Object} Google Calendar client
 */
async function getCalendarClient(userId) {
  console.log("Fetching Google Calendar tokens for user:", userId);
  const tokenDoc = await GoogleToken.findOne({ userId });

  if (!tokenDoc) {
    console.log(
      "No Google Calendar tokens found. Initiating authorization flow."
    );
    const authUrl = getAuthUrl();
    const error = new Error("Google Calendar authorization required");
    error.authUrl = authUrl;
    throw error;
  }

  // Create a fresh OAuth2 client with saved refresh token
  const refreshClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  refreshClient.setCredentials({
    access_token: tokenDoc.accessToken,
    refresh_token: tokenDoc.refreshToken,
    expiry_date: new Date(tokenDoc.expiryDate).getTime(),
  });

  try {
    // This triggers token refresh if expired
    await refreshClient.getAccessToken();

    const refreshedCreds = refreshClient.credentials;
    console.log("Access token refreshed successfully",refreshedCreds);

    // Update stored tokens
    tokenDoc.accessToken = refreshedCreds.access_token;
    tokenDoc.expiryDate = new Date(refreshedCreds.expiry_date);

    if (refreshedCreds.refresh_token) {
      tokenDoc.refreshToken = refreshedCreds.refresh_token;
    }

    await tokenDoc.save();
    console.log("Updated token saved to database");
  } catch (error) {
    console.error("Failed to refresh token:", error.message);

    if (error.message.includes("invalid_grant")) {
      const authUrl = getAuthUrl();
      const reAuthError = new Error(
        "Google Calendar authorization has expired. Reauthorization needed."
      );
      reAuthError.authUrl = authUrl;
      throw reAuthError;
    } else {
      throw new Error(
        "Failed to refresh Google Calendar access: " + error.message
      );
    }
  }

  // Return Calendar API client with updated credentials
  return google.calendar({ version: "v3", auth: refreshClient });
}

module.exports = {
  initializeGoogleCalendar,
  getCalendarClient,
};
