const cloudinary = require("./cloudinary");

/**
 * Deletes a single image from Cloudinary
 * @param {string} publicId - The public ID of the image to delete
 * @returns {Promise<Object>} - Result of the deletion operation
 */
const deleteImageFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error("Public ID is required");
    }

    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === "ok") {
      console.log(`Successfully deleted image: ${publicId}`);
      return { success: true, message: "Image deleted successfully" };
    } else {
      console.error(`Failed to delete image: ${publicId}`, result);
      return { success: false, message: "Failed to delete image", result };
    }
  } catch (error) {
    console.error(`Error deleting image ${publicId}:`, error);
    return { success: false, message: error.message, error };
  }
};

/**
 * Deletes multiple images from Cloudinary
 * @param {string[]} publicIds - Array of public IDs to delete
 * @returns {Promise<Object>} - Result of the deletion operations
 */
const deleteMultipleImagesFromCloudinary = async (publicIds) => {
  try {
    if (!Array.isArray(publicIds) || publicIds.length === 0) {
      throw new Error("Public IDs array is required and must not be empty");
    }

    const results = [];
    const successful = [];
    const failed = [];

    for (const publicId of publicIds) {
      const result = await deleteImageFromCloudinary(publicId);
      results.push({ publicId, ...result });
      
      if (result.success) {
        successful.push(publicId);
      } else {
        failed.push(publicId);
      }
    }

    return {
      success: failed.length === 0,
      message: `Deleted ${successful.length} images, ${failed.length} failed`,
      successful,
      failed,
      results
    };
  } catch (error) {
    console.error("Error deleting multiple images:", error);
    return { success: false, message: error.message, error };
  }
};

/**
 * Extracts public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID or null if invalid URL
 */
const extractPublicIdFromUrl = (url) => {
  try {
    if (!url) return null;
    
    // Handle different Cloudinary URL formats
    const urlPattern = /\/v\d+\/([^\/]+)\.(jpg|jpeg|png|gif|webp|svg)/;
    const match = url.match(urlPattern);
    
    if (match) {
      return match[1];
    }
    
    // If no version in URL, try to extract directly
    const directPattern = /\/upload\/([^\/]+)\.(jpg|jpeg|png|gif|webp|svg)/;
    const directMatch = url.match(directPattern);
    
    if (directMatch) {
      return directMatch[1];
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting public ID from URL:", error);
    return null;
  }
};

/**
 * Deletes images from Cloudinary using URLs
 * @param {string|string[]} urls - Single URL or array of URLs
 * @returns {Promise<Object>} - Result of the deletion operations
 */
const deleteImagesByUrls = async (urls) => {
  try {
    const urlArray = Array.isArray(urls) ? urls : [urls];
    const publicIds = urlArray
      .map(url => extractPublicIdFromUrl(url))
      .filter(publicId => publicId !== null);

    if (publicIds.length === 0) {
      return { success: false, message: "No valid public IDs found in URLs" };
    }

    return await deleteMultipleImagesFromCloudinary(publicIds);
  } catch (error) {
    console.error("Error deleting images by URLs:", error);
    return { success: false, message: error.message, error };
  }
};

module.exports = {
  deleteImageFromCloudinary,
  deleteMultipleImagesFromCloudinary,
  deleteImagesByUrls,
  extractPublicIdFromUrl
}; 