const { google } = require('googleapis');
const dotenv = require('dotenv');
const GoogleToken = require('../models/googleToken');

// Load environment variables if not already loaded
if (process.env.GOOGLE_CLIENT_ID === undefined) {
  dotenv.config();
}

// Create OAuth2 client with env variables
const CLIENT_ID = '422044579125-diqkc9lkptvcdi3ansie05b6rmehclhd.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:5000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

async function refreshGoogleAccessToken(oauth2Client, refresh_token) {
  if (!refresh_token) {
    throw new Error('Missing refresh_token');
  }

  oauth2Client.setCredentials({ refresh_token });

  const { credentials } = await oauth2Client.refreshAccessToken();

  return {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date
  };
}

// Function to get calendar client with latest tokens
async function getCalendarClient() {
  try {
    // Get the latest tokens from database
    const tokens = await GoogleToken.findOne().sort({ createdAt: -1 });

     
    
    if (!tokens) {
      throw new Error('No Google tokens found in database');
    }
    const new_tokens = await refreshGoogleAccessToken(oauth2Client, tokens.refreshToken);

    // Set credentials from database
    oauth2Client.setCredentials(new_tokens);

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