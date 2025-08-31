const cloudinary = require("./cloudinary");

/**
 * Generates a signed URL for accessing authenticated Cloudinary resources
 * @param {string} publicId - The public ID of the resource
 * @param {Object} options - Options for URL generation
 * @param {number} [options.expiresAt] - Timestamp when the URL expires (default: 1 hour from now)
 * @param {Array} [options.transformation] - Array of transformation objects
 * @returns {string} - Signed URL for accessing the resource
 */
const generateSignedUrl = (publicId, options = {}) => {
  // Default expiration to 1 hour from now if not specified
  const expiresAt = options.expiresAt || Math.floor(Date.now() / 1000) + 3600;
  
  // Set resource_type based on the context or default to 'image'
  const resourceType = options.resourceType || 
    (publicId.includes('/secure_documents/') ? 'raw' : 'image');
  
  return cloudinary.url(publicId, {
    type: "authenticated",
    sign_url: true,
    secure: true,
    resource_type: resourceType,
    expires_at: expiresAt,
    ...(options.transformation && { transformation: options.transformation }),
  });
};

/**
 * Checks if a URL is from our secure Cloudinary folders
 * @param {string} url - The Cloudinary URL to check
 * @returns {boolean} - True if the URL is from a secure folder
 */
const isSecureResource = (url) => {
  if (!url) return false;
  
  // Check if URL contains secure folder patterns
  return url.includes('/secure_images/') || 
         url.includes('/secure_documents/') || 
         url.includes('/hospital_app/secure_');
};

module.exports = {
  generateSignedUrl,
  isSecureResource
};
