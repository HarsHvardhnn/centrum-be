const axios = require('axios');
const { ZOHO_CONFIG, refreshAccessToken, getTokens, getAuthUrl } = require('../config/zoho');
const ZohoToken = require('../models/zohoToken');

/**
 * Initialize Zoho Meetings integration by exchanging authorization code for tokens
 * @param {string} userId - User ID
 * @param {string} code - Authorization code from Zoho OAuth flow
 */
async function initializeZohoMeetings(userId, code) {
  try {
    const tokens = await getTokens(code);
    const expiryDate = new Date(tokens.expiry_date);

    let tokenDoc = await ZohoToken.findOne({ userId });

    if (tokenDoc) {
      tokenDoc.accessToken = tokens.access_token;
      tokenDoc.refreshToken = tokens.refresh_token || tokenDoc.refreshToken;
      tokenDoc.expiryDate = expiryDate;
    } else {
      tokenDoc = new ZohoToken({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate,
      });
    }

    await tokenDoc.save();
    return true;
  } catch (error) {
    console.error("Error initializing Zoho Meetings:", error);
    throw new Error(`Failed to initialize Zoho Meetings: ${error.message}`);
  }
}

/**
 * Get Zoho Meetings client for a user
 * @param {string} userId - User ID
 * @returns {Object} Zoho Meetings client
 */
async function getMeetingsClient(userId) {
  console.log("Fetching Zoho Meetings tokens for user:", userId);
  const tokenDoc = await ZohoToken.findOne({ userId: '68306e50aef3773ad8447fb6' });

  if (!tokenDoc) {
    console.log("No Zoho Meetings tokens found. Initiating authorization flow.");
    const authUrl = getAuthUrl();
    const error = new Error("Zoho Meetings authorization required");
    error.authUrl = authUrl;
    throw error;
  }

  try {
    // Check if token needs refresh
    if (Date.now() >= tokenDoc.expiryDate.getTime()) {
      const refreshedTokens = await refreshAccessToken(tokenDoc.refreshToken);
      
      tokenDoc.accessToken = refreshedTokens.access_token;
      tokenDoc.expiryDate = new Date(refreshedTokens.expiry_date);
      await tokenDoc.save();
    }

    return {
      createMeeting: async (meetingDetails) => {
        try {
            console.log("meetingDetails",meetingDetails);
          const response = await axios.post(
            `${ZOHO_CONFIG.apiBaseUrl}/20106395831/sessions.json`,
            meetingDetails,
            {
              headers: {
                'Authorization': `Zoho-oauthtoken ${tokenDoc.accessToken}`,
                'Content-Type': 'application/json'
              }
            }
          );
          return response.data;
        } catch (error) {
          console.error('Error creating Zoho meeting:', error.response?.data || error.message);
          throw new Error('Failed to create Zoho meeting');
        }
      }
    };
  } catch (error) {
    console.error("Failed to refresh token:", error.message);
    throw new Error("Failed to refresh Zoho Meetings access: " + error.message);
  }
}

module.exports = {
  initializeZohoMeetings,
  getMeetingsClient
}; 