// tokenManager.js
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

class GoogleTokenManager {
  constructor(options) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.tokenFilePath = options.tokenFilePath || path.join(__dirname, 'tokens.json');
    this.scopeList = options.scopes || ['https://www.googleapis.com/auth/calendar'];
    
    // Create OAuth2 client
    this.oAuth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    
    // Load tokens if they exist
    this.tokens = this.loadTokens();
    
    // Set credentials if we have tokens
    if (this.tokens && this.tokens.refresh_token) {
      this.oAuth2Client.setCredentials(this.tokens);
    }
  }
  
  /**
   * Load tokens from storage
   */
  loadTokens() {
    try {
      if (fs.existsSync(this.tokenFilePath)) {
        const tokensData = fs.readFileSync(this.tokenFilePath, 'utf8');
        return JSON.parse(tokensData);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
    return null;
  }
  
  /**
   * Save tokens to storage
   */
  saveTokens(tokens) {
    try {
      fs.writeFileSync(this.tokenFilePath, JSON.stringify(tokens, null, 2));
      console.log('Tokens saved successfully');
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }
  
  /**
   * Generate URL for initial authorization (one-time setup)
   * This is only needed once to get the initial refresh token
   */
  getAuthUrl() {
    return this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: this.scopeList,
      prompt: 'consent' // Force to show consent screen to get refresh token
    });
  }
  
  /**
   * Exchange authorization code for tokens (one-time setup)
   * @param {string} code - The authorization code from redirect
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oAuth2Client.getToken(code);
      this.oAuth2Client.setCredentials(tokens);
      this.tokens = tokens;
      this.saveTokens(tokens);
      return tokens;
    } catch (error) {
      console.error('Error getting tokens from code:', error);
      throw error;
    }
  }
  
  /**
   * Get a valid access token, refreshing if necessary
   * This is the main method you'll use for automated token management
   */
  async getAccessToken() {
    // Check if we have tokens
    if (!this.tokens || !this.tokens.refresh_token) {
      throw new Error('No refresh token available. Please complete the initial authorization.');
    }
    
    // Check if token is expired or will expire soon (within 5 minutes)
    const isExpired = !this.tokens.expiry_date || this.tokens.expiry_date <= Date.now() + 5 * 60 * 1000;
    
    if (isExpired) {
      console.log('Access token expired or expiring soon, refreshing...');
      try {
        // Refresh the token
        const { credentials } = await this.oAuth2Client.refreshAccessToken();
        
        // Save the refresh token from previous tokens if it's not in the new credentials
        if (!credentials.refresh_token && this.tokens.refresh_token) {
          credentials.refresh_token = this.tokens.refresh_token;
        }
        
        // Update and save tokens
        this.tokens = credentials;
        this.oAuth2Client.setCredentials(credentials);
        this.saveTokens(credentials);
        
        console.log('Access token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh access token:', error);
        throw error;
      }
    }
    
    return this.tokens.access_token;
  }
  
  /**
   * Get the OAuth2 client with valid credentials
   */
  async getAuthorizedClient() {
    await this.getAccessToken();
    return this.oAuth2Client;
  }
  
  /**
   * Manually set and save a refresh token
   * Useful if you got a refresh token through other means
   */
  setRefreshToken(refreshToken) {
    this.tokens = this.tokens || {};
    this.tokens.refresh_token = refreshToken;
    this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
    this.saveTokens(this.tokens);
  }
}

module.exports = GoogleTokenManager;