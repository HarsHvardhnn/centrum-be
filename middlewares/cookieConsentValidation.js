// Validation middleware for cookie consent data
const validateConsentData = (req, res, next) => {
  const { consent } = req.body;
  
  // Check if consent object exists
  if (!consent || typeof consent !== 'object') {
    return res.status(400).json({
      success: false,
      message: 'Consent data is required and must be an object'
    });
  }
  
  // Required fields with their expected types
  const requiredFields = {
    analytics: 'boolean',
    marketing: 'boolean', 
    preferences: 'boolean'
  };
  
  // Validate each required field
  for (const [field, expectedType] of Object.entries(requiredFields)) {
    if (!(field in consent)) {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${field}`
      });
    }
    
    if (typeof consent[field] !== expectedType) {
      return res.status(400).json({
        success: false,
        message: `Invalid type for ${field}. Expected ${expectedType}, got ${typeof consent[field]}`
      });
    }
  }
  
  // Optional fields validation
  if ('version' in consent && typeof consent.version !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Version must be a string'
    });
  }
  
  // Sanitize the consent object to only include allowed fields
  const allowedFields = ['analytics', 'marketing', 'preferences', 'version'];
  const sanitizedConsent = {};
  
  for (const field of allowedFields) {
    if (field in consent) {
      sanitizedConsent[field] = consent[field];
    }
  }
  
  // Replace the original consent with sanitized version
  req.body.consent = sanitizedConsent;
  
  next();
};

// Input sanitization middleware to prevent XSS
const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs (in case of version field)
  if (req.body.consent && req.body.consent.version) {
    // Remove any HTML tags and special characters that could be harmful
    req.body.consent.version = req.body.consent.version
      .replace(/[<>]/g, '') // Remove < and >
      .trim() // Remove leading/trailing whitespace
      .slice(0, 50); // Limit length
  }
  
  next();
};

module.exports = {
  validateConsentData,
  sanitizeInput
}; 