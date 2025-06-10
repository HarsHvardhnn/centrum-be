const CookieConsent = require('../models/cookieConsent');

// GET /api/cookie-consent - Get user's cookie consent preferences
exports.getConsent = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const consent = await CookieConsent.findOne({ userId });
    
    if (!consent) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'No consent found for user'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        consent: consent.consent
      }
    });
  } catch (error) {
    console.error('Error fetching cookie consent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// POST /api/cookie-consent - Save or update user's cookie consent preferences
exports.saveConsent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { consent } = req.body;
    
    // Validation
    if (!consent || typeof consent !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Invalid consent data'
      });
    }

    // Validate consent structure
    const requiredFields = ['analytics', 'marketing', 'preferences'];
    for (const field of requiredFields) {
      if (typeof consent[field] !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: `Invalid consent data: ${field} must be a boolean`
        });
      }
    }

    // Ensure necessary is always true (GDPR requirement)
    const validatedConsent = {
      necessary: true,
      analytics: consent.analytics,
      marketing: consent.marketing,
      preferences: consent.preferences,
      timestamp: new Date(),
      version: consent.version || '1.0'
    };
    
    const consentData = {
      userId,
      consent: validatedConsent,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent') || '',
      updatedAt: new Date()
    };
    
    const result = await CookieConsent.findOneAndUpdate(
      { userId },
      consentData,
      { 
        upsert: true, 
        new: true, 
        runValidators: true,
        setDefaultsOnInsert: true 
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Cookie consent saved successfully',
      data: { 
        consent: result.consent 
      }
    });
  } catch (error) {
    console.error('Error saving cookie consent:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// DELETE /api/cookie-consent - Withdraw user's cookie consent
exports.deleteConsent = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await CookieConsent.findOneAndDelete({ userId });
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'No consent found to delete'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Cookie consent withdrawn successfully'
    });
  } catch (error) {
    console.error('Error deleting cookie consent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/cookie-consent/history - Get user's consent history
exports.getConsentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // For now, we only store the latest consent, but this can be extended
    // to store audit trail in a separate collection if needed
    const history = await CookieConsent.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('consent createdAt updatedAt');
    
    res.status(200).json({
      success: true,
      data: { 
        history 
      }
    });
  } catch (error) {
    console.error('Error fetching consent history:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/cookie-consent/status - Check if user has given consent
exports.getConsentStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const consent = await CookieConsent.findOne({ userId });
    
    res.status(200).json({
      success: true,
      data: {
        hasConsent: !!consent,
        consentGiven: consent ? consent.consent.timestamp : null
      }
    });
  } catch (error) {
    console.error('Error fetching consent status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// GET /api/cookie-consent/health - Health check endpoint for monitoring
exports.healthCheck = async (req, res) => {
  try {
    // Test database connection by performing a simple query
    await CookieConsent.findOne().limit(1);
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'cookie-consent-api',
      version: '1.0',
      database: 'connected'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'cookie-consent-api',
      version: '1.0',
      database: 'disconnected',
      error: error.message
    });
  }
}; 