// routes/auth.js
const express = require('express');
const { google } = require('googleapis');
const GoogleTokenManager = require('./refreshToken');

const router = express.Router();

// Replace with your credentials
const CLIENT_ID = '422044579125-diqkc9lkptvcdi3ansie05b6rmehclhd.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:5000/oauth2callback';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Endpoint to get the auth URL
router.get('/get-auth-url', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent' // Always prompt to ensure getting refresh token
  });
  
  console.log('Auth URL:', authUrl);
  res.json({ authUrl });
});

// OAuth2 callback to exchange code for tokens
router.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens received:', {
      access_token: tokens.access_token ? 'received' : 'missing',
      refresh_token: tokens.refresh_token ? 'received' : 'missing',
      expiry_date: tokens.expiry_date
    });
    
    // Store tokens securely in your database/session here
    
    res.send(`
      <h1>Authentication Successful!</h1>
      <p>Access Token: ${tokens.access_token.substring(0, 10)}...</p>
      <p>Refresh Token: ${tokens.refresh_token ? tokens.refresh_token.substring(0, 5) + '...' : 'None'}</p>
      <p>Expiry: ${new Date(tokens.expiry_date).toLocaleString()}</p>
      <pre>${JSON.stringify(tokens, null, 2)}</pre>
    `);
  } catch (err) {
    console.error('Error exchanging code for tokens:', err);
    res.status(500).send('Token exchange failed: ' + err.message);
  }
});

// Endpoint to refresh tokens
router.post('/refresh-token', async (req, res) => {
  const { refresh_token } = req.body;
  
  if (!refresh_token) {
    return res.status(400).json({ error: 'Missing refresh_token in body' });
  }
  
  try {
    oauth2Client.setCredentials({ refresh_token });
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    res.json({
      success: true,
      tokens: {
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      }
    });
  } catch (err) {
    console.error('Error refreshing token:', err);
    res.status(500).json({ error: 'Failed to refresh token', details: err.message });
  }
});




const tokenManager = new GoogleTokenManager({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    tokenFilePath: './google-tokens.json'
  });
  
  // Endpoint to generate access token from refresh token
  router.post('/api/token', async (req, res) => {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing refresh_token in request body' 
        });
      }
      
      // Set the refresh token in our token manager
      tokenManager.setRefreshToken(refresh_token);
      
      
      // Get a fresh access token (will be automatically refreshed if needed)
      const accessToken = await tokenManager.getAccessToken();
      
      // Return the token and expiry details
      res.json({
        success: true,
        access_token: accessToken,
        expires_at: tokenManager.tokens.expiry_date,
        token_type: 'Bearer'
      });
    } catch (error) {
      console.error('Error generating access token:', error);
      
      res.status(500).json({
        success: false,
        error: 'Failed to generate access token',
        message: error.message
      });
    }
  });

module.exports = router;