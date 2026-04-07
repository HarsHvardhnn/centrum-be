const cloudinary = require("./cloudinary");

/**
 * Full public_id from a Cloudinary delivery URL (supports nested folders, v123 version segment).
 * @param {string} url
 * @returns {string|null}
 */
function extractCloudinaryPublicIdFromUrl(url) {
  try {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.split("?")[0];
    const rawMarker = "/raw/upload/";
    const imageMarker = "/image/upload/";
    const idx =
      trimmed.includes(rawMarker)
        ? trimmed.indexOf(rawMarker)
        : trimmed.indexOf(imageMarker);
    if (idx === -1) return null;
    const marker = trimmed.includes(rawMarker) ? rawMarker : imageMarker;
    let afterUpload = trimmed.slice(idx + marker.length);
    const signedIdx = afterUpload.indexOf("/");
    if (afterUpload.startsWith("s--") && signedIdx !== -1) {
      afterUpload = afterUpload.slice(signedIdx + 1);
    }
    const parts = afterUpload.split("/").filter(Boolean);
    let i = 0;
    if (parts[0] && /^v\d+$/i.test(parts[0])) i = 1;
    const pathPart = parts.slice(i).join("/");
    if (!pathPart) return null;
    return pathPart.replace(/\.[a-z0-9]+$/i, "");
  } catch (error) {
    console.error("Error extracting public ID from Cloudinary URL:", error);
    return null;
  }
}

function resourceTypeForDestroy(publicId, originalInput) {
  const o = originalInput != null ? String(originalInput) : "";
  if (o.includes("/raw/upload/")) return "raw";
  const id = publicId != null ? String(publicId) : "";
  if (/\.(pdf|doc|docx|txt)$/i.test(id)) return "raw";
  return "image";
}

/**
 * Deletes a single image from Cloudinary
 * @param {string} publicId - The public ID of the image
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
 * Deletes by public_id or full HTTPS URL (nested folders, raw PDFs).
 * @param {string} publicIdOrUrl
 */
const deleteFromCloudinary = async (publicIdOrUrl) => {
  try {
    if (!publicIdOrUrl) {
      return { success: false, message: "Missing public id or URL" };
    }
    const original = String(publicIdOrUrl);
    let publicId = original;
    if (original.startsWith("http")) {
      publicId = extractCloudinaryPublicIdFromUrl(original) || "";
    }
    if (!publicId) {
      return { success: false, message: "Could not resolve Cloudinary public_id" };
    }
    const resourceType = resourceTypeForDestroy(publicId, original);
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    if (result.result === "ok" || result.result === "not found") {
      return { success: true, message: "Deleted", result };
    }
    return { success: false, message: "Failed to delete", result };
  } catch (error) {
    console.error("deleteFromCloudinary error:", error);
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
      results,
    };
  } catch (error) {
    console.error("Error deleting multiple images:", error);
    return { success: false, message: error.message, error };
  }
};

/**
 * Extracts public ID from Cloudinary URL (image extensions only — legacy helper).
 * @param {string} url - Cloudinary URL
 * @returns {string|null} - Public ID or null if invalid URL
 */
const extractPublicIdFromUrl = (url) => {
  const full = extractCloudinaryPublicIdFromUrl(url);
  if (full) return full;
  try {
    if (!url) return null;

    const urlPattern = /\/v\d+\/([^\/]+)\.(jpg|jpeg|png|gif|webp|svg)/;
    const match = url.match(urlPattern);

    if (match) {
      return match[1];
    }

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
      .map((url) => extractPublicIdFromUrl(url))
      .filter((publicId) => publicId !== null);

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
  deleteFromCloudinary,
  deleteMultipleImagesFromCloudinary,
  deleteImagesByUrls,
  extractPublicIdFromUrl,
  extractCloudinaryPublicIdFromUrl,
};
