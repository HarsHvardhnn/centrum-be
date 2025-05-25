const axios = require('axios');

// These values should be moved to environment variables
const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  redirectUri: 'http://localhost:5000/zoho/oauth2callback',
  authUrl: 'https://accounts.zoho.eu/oauth/v2/auth',
  tokenUrl: 'https://accounts.zoho.eu/oauth/v2/token',
  apiBaseUrl: 'https://meeting.zoho.eu/api/v2'
  };

function getAuthUrl() {
  const params = new URLSearchParams({
    client_id: ZOHO_CONFIG.clientId,
    redirect_uri: ZOHO_CONFIG.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    scope: 'ZohoMeeting.meeting.ALL'
  });

  return `${ZOHO_CONFIG.authUrl}?${params.toString()}`;
}

async function getTokens(code) {
  try {
    console.log("zoho config",ZOHO_CONFIG);
    const params = new URLSearchParams({
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      redirect_uri: ZOHO_CONFIG.redirectUri,
      code: code,
      grant_type: 'authorization_code'
    });

    const response = await axios.post(ZOHO_CONFIG.tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log("response",response.data);

    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expiry_date: Date.now() + (response.data.expires_in * 1000)
    };
  } catch (error) {
    console.error('Error getting Zoho tokens:', error.response?.data || error.message);
    throw new Error('Failed to get Zoho tokens');
  }
}

async function refreshAccessToken(refreshToken) {
  try {
    const params = new URLSearchParams({
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await axios.post(ZOHO_CONFIG.tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log("response",response.data);
    return {
      access_token: response.data.access_token,
      expiry_date: Date.now() + (response.data.expires_in * 1000)
    };
  } catch (error) {
    console.error('Error refreshing Zoho token:', error.response?.data || error.message);
    throw new Error('Failed to refresh Zoho token');
  }
}

module.exports = {
  ZOHO_CONFIG,
  getAuthUrl,
  getTokens,
  refreshAccessToken
}; 