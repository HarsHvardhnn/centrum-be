const { google } = require('googleapis');
const GoogleToken = require('../models/googleToken');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Load environment variables for Google Auth
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const SERVICE_ACCOUNT_KEY_PATH = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const USER_EMAIL_TO_IMPERSONATE = process.env.GOOGLE_USER_EMAIL_TO_IMPERSONATE;

// Create OAuth2 client for user-based authentication (fallback option)
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID, 
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

/**
 * Gets a Calendar API client using the domain-wide delegation approach 
 * This works even when the service account doesn't have direct access to calendars
 * @returns {Object} - Calendar API client
 */
const getDelegatedCalendarClient = async () => {
  try {
    // If no user email to impersonate is provided, we can't use this method
    if (!USER_EMAIL_TO_IMPERSONATE) {
      throw new Error('No user email provided for domain-wide delegation');
    }
    
    // Try to get service account credentials
    let serviceAccountAuth;
    
    // 1. Try using key file
    if (SERVICE_ACCOUNT_KEY_PATH) {
      try {
        const keyPath = path.resolve(SERVICE_ACCOUNT_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          console.log(`Loading service account from file for delegation: ${keyPath}`);
          const keyFile = require(keyPath);
          
          serviceAccountAuth = new google.auth.JWT({
            email: keyFile.client_email,
            key: keyFile.private_key,
            scopes: ['https://www.googleapis.com/auth/calendar'],
            subject: USER_EMAIL_TO_IMPERSONATE // This is the important part for delegation
          });
        }
      } catch (error) {
        console.error('Error loading service account from file for delegation:', error);
      }
    }
    
    // 2. Try using environment variables
    if (!serviceAccountAuth && SERVICE_ACCOUNT_EMAIL && SERVICE_ACCOUNT_KEY) {
      console.log('Using service account email and key from environment for delegation');
      
      serviceAccountAuth = new google.auth.JWT({
        email: SERVICE_ACCOUNT_EMAIL,
        key: SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/calendar'],
        subject: USER_EMAIL_TO_IMPERSONATE
      });
    }
    
    // 3. Try using JSON environment variable
    if (!serviceAccountAuth && SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccountKey = JSON.parse(SERVICE_ACCOUNT_KEY);
        console.log('Using service account from JSON env var for delegation');
        
        serviceAccountAuth = new google.auth.JWT({
          email: serviceAccountKey.client_email,
          key: serviceAccountKey.private_key,
          scopes: ['https://www.googleapis.com/auth/calendar'],
          subject: USER_EMAIL_TO_IMPERSONATE
        });
      } catch (error) {
        console.log('Failed to parse SERVICE_ACCOUNT_KEY as JSON for delegation');
      }
    }
    
    if (!serviceAccountAuth) {
      throw new Error('Failed to create service account auth client for delegation');
    }
    
    // Create the calendar client with the delegated auth
    return google.calendar({ version: 'v3', auth: serviceAccountAuth });
  } catch (error) {
    console.error('Error setting up delegated calendar client:', error.message);
    throw error;
  }
};

/**
 * Creates a service account auth client directly
 * @returns {Object} - Google auth client
 */
const createServiceAccountAuth = () => {
  try {
    // Try different approaches to get service account credentials
    
    // 1. First try using SERVICE_ACCOUNT_KEY env var (JSON string)
    if (SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccountKey = JSON.parse(SERVICE_ACCOUNT_KEY);
        console.log('Using service account from environment variable JSON');
        
        return new google.auth.JWT(
          serviceAccountKey.client_email,
          null,
          serviceAccountKey.private_key,
          ['https://www.googleapis.com/auth/calendar'],
          null
        );
      } catch (error) {
        console.log('Failed to parse SERVICE_ACCOUNT_KEY as JSON, will try alternate methods');
      }
    }
    
    // 2. Try using explicit service account email + key
    if (SERVICE_ACCOUNT_EMAIL && SERVICE_ACCOUNT_KEY) {
      console.log('Using service account email and key from environment variables');
      return new google.auth.JWT(
        SERVICE_ACCOUNT_EMAIL,
        null,
        SERVICE_ACCOUNT_KEY.replace(/\\n/g, '\n'), // Fix newlines in private key
        ['https://www.googleapis.com/auth/calendar'],
        null
      );
    }
    
    // 3. Try loading from a file path
    if (SERVICE_ACCOUNT_KEY_PATH) {
      try {
        const keyPath = path.resolve(SERVICE_ACCOUNT_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          console.log(`Loading service account from file: ${keyPath}`);
          const keyFileContent = require(keyPath);
          
          return new google.auth.JWT(
            keyFileContent.client_email,
            null,
            keyFileContent.private_key,
            ['https://www.googleapis.com/auth/calendar'],
            null
          );
        }
      } catch (error) {
        console.error('Error loading service account from file:', error);
      }
    }
    
    // 4. Default service account credentials (works in Google Cloud environments)
    console.log('Attempting to use default service account credentials');
    return new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/calendar']
    });
  } catch (error) {
    console.error('Failed to create service account client:', error);
    return null;
  }
};

/**
 * Gets a Calendar API client without any OAuth flow by directly using service account
 * @returns {Object} - Calendar API client
 */
const getDirectCalendarClient = async () => {
  // First try using domain-wide delegation which gives the most reliable results
  try {
    console.log('Attempting to use delegated authentication (most reliable)...');
    return await getDelegatedCalendarClient();
  } catch (delegationError) {
    console.log('Delegated authentication not available, falling back to direct service account:', delegationError.message);
  }
  
  // Create service account auth client
  const authClient = createServiceAccountAuth();
  
  if (!authClient) {
    throw new Error('Failed to create service account authentication client');
  }
  
  // Create and return the calendar client
  return google.calendar({ version: 'v3', auth: authClient });
};

/**
 * Attempt to refresh a token
 * @param {Object} tokenDoc - GoogleToken document from database
 * @returns {Object} - Refreshed token object or null if refresh failed
 */
const refreshUserToken = async (tokenDoc) => {
  try {
    oauth2Client.setCredentials({
      refresh_token: tokenDoc.refreshToken,
      access_token: tokenDoc.accessToken,
      expiry_date: new Date(tokenDoc.expiryDate).getTime()
    });

    const { token } = await oauth2Client.getAccessToken();
    const tokenInfo = await oauth2Client.getTokenInfo(token);
    
    tokenDoc.accessToken = token;
    tokenDoc.expiryDate = new Date(Date.now() + tokenInfo.expires_in * 1000);
    await tokenDoc.save();
    
    console.log('Successfully refreshed Google token');
    return token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
};

/**
 * Generates a server-managed token for an admin user
 * @param {String} adminId - Admin user ID
 * @returns {Object} - Calendar API client
 */
const getServerManagedCalendarClient = async (adminId) => {
  try {
    // First try to use direct service account authentication
    try {
      return await getDirectCalendarClient();
    } catch (serviceError) {
      console.warn('Service account authentication failed, falling back to OAuth:', serviceError.message);
    }
    
    // If service account fails, fall back to tokens
    console.log('Falling back to OAuth2 authentication for Google Calendar');
    let tokenDoc = await GoogleToken.findOne({ userId: adminId });
    
    // If a token exists, check if it's expired and refresh if needed
    if (tokenDoc) {
      const tokenExpiry = new Date(tokenDoc.expiryDate);
      // If token is expired or will expire in the next minute
      if (tokenExpiry <= new Date(Date.now() + 60000)) {
        console.log('Token expired, attempting to refresh...');
        const refreshedToken = await refreshUserToken(tokenDoc);
        
        if (!refreshedToken) {
          throw new Error('Failed to refresh token and no service account available');
        }
      }
      
      // Set credentials and return calendar client
      oauth2Client.setCredentials({
        access_token: tokenDoc.accessToken,
        refresh_token: tokenDoc.refreshToken,
        expiry_date: new Date(tokenDoc.expiryDate).getTime()
      });
      
      return google.calendar({ version: 'v3', auth: oauth2Client });
    } 
    
    // No token exists, get auth URL for first-time setup
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent'
    });
    
    const error = new Error('Google Calendar authorization required');
    error.authUrl = authUrl;
    throw error;
  } catch (error) {
    console.error('Error getting Google Calendar client:', error.message);
    throw error;
  }
};

/**
 * Store initial tokens from authorization code (first-time setup)
 * @param {String} userId - User ID
 * @param {String} code - Authorization code from OAuth flow
 */
const storeInitialTokens = async (userId, code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Create or update token record
    let tokenDoc = await GoogleToken.findOne({ userId });
    if (tokenDoc) {
      tokenDoc.accessToken = tokens.access_token;
      tokenDoc.refreshToken = tokens.refresh_token || tokenDoc.refreshToken;
      tokenDoc.expiryDate = new Date(tokens.expiry_date);
    } else {
      tokenDoc = new GoogleToken({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date)
      });
    }
    
    await tokenDoc.save();
    return true;
  } catch (error) {
    console.error('Error storing initial tokens:', error);
    throw new Error(`Failed to initialize Google Calendar: ${error.message}`);
  }
};

module.exports = {
  getServerManagedCalendarClient,
  storeInitialTokens,
  getDirectCalendarClient,
  GOOGLE_CALENDAR_ID
}; 