const rateLimit = require('express-rate-limit');

// Rate limiter for cookie consent endpoints
const cookieConsentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each user to 20 requests per windowMs (generous for legitimate use)
  message: {
    success: false,
    message: 'Too many cookie consent requests. Please try again later.',
    retryAfter: 15 * 60 // 15 minutes in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain conditions
  skip: (req, res) => {
    // Skip rate limiting if user is admin (optional)
    return req.user && req.user.role === 'admin';
  },
  // Custom key generator to use user ID if available
  keyGenerator: (req, res) => {
    return req.user?.id || req.ip;
  }
});

// More restrictive rate limiter for deletion requests
const deleteConsentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each user to 5 deletion requests per hour
  message: {
    success: false,
    message: 'Too many consent deletion requests. Please try again later.',
    retryAfter: 60 * 60 // 1 hour in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    return req.user?.id || req.ip;
  }
});

module.exports = {
  cookieConsentLimiter,
  deleteConsentLimiter
}; 