const { google } = require('googleapis');
const dotenv = require('dotenv');
const GoogleToken = require('../models/googleToken');

// Load environment variables if not already loaded
if (process.env.GOOGLE_CLIENT_ID === undefined) {
  dotenv.config();
}

// Create OAuth2 client with env variables
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/auth/google/callback'
);

// Function to get calendar client with latest tokens
async function getCalendarClient() {
  try {
    // Get the latest tokens from database
    const tokens = await GoogleToken.findOne().sort({ createdAt: -1 });
    
    if (!tokens) {
      throw new Error('No Google tokens found in database');
    }

    // Set credentials from database
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate.getTime()
    });

    return google.calendar({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    console.error('Error getting calendar client:', error);
    throw error;
  }
}

module.exports = {
  oauth2Client,
  getCalendarClient
}; 