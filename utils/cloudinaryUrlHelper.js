const { isSecureResource, generateSignedUrl } = require("../utils/generateSignedUrl");

/**
 * Helper utility to get the appropriate URL for a Cloudinary resource
 * - For regular public resources: returns the original URL
 * - For secure resources: generates and returns a signed URL
 * 
 * @param {string} url - The original Cloudinary URL or public ID
 * @param {Object} options - Options for signed URL generation (for secure resources)
 * @param {number} [options.expiresAt] - Timestamp when the URL expires (default: 1 hour)
 * @param {Array} [options.transformation] - Array of transformation objects
 * @returns {string} - The appropriate URL for the resource
 */
const getResourceUrl = (url, options = {}) => {
  if (!url) return null;
  
  // Check if this is a secure resource that needs a signed URL
  if (isSecureResource(url)) {
    // Extract the public ID from the URL
    // This assumes standard Cloudinary URL format
    let publicId;
    
    try {
      // Extract the path after /upload/ and before any transformation parameters
      const uploadIndex = url.indexOf('/upload/');
      if (uploadIndex !== -1) {
        let endPath = url.substring(uploadIndex + 8); // +8 to skip '/upload/'
        
        // Remove any transformation parameters (after ?)
        const queryIndex = endPath.indexOf('?');
        if (queryIndex !== -1) {
          endPath = endPath.substring(0, queryIndex);
        }
        
        // Remove version number if present (v1234/)
        const versionMatch = endPath.match(/v\d+\//);
        if (versionMatch) {
          endPath = endPath.substring(versionMatch[0].length);
        }
        
        publicId = endPath;
      } else {
        // If we can't parse it as a URL, assume it's already a public ID
        publicId = url;
      }
      
      // Generate a signed URL for this resource
      return generateSignedUrl(publicId, options);
    } catch (error) {
      console.error("Error generating signed URL:", error);
      return url; // Return original URL if there's an error
    }
  }
  
  // For public resources, return the original URL
  return url;
};

module.exports = {
  getResourceUrl
};


