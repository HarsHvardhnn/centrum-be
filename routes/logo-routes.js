const express = require("express");
const router = express.Router();
const logoController = require("../controllers/logoController");
const authorizeRoles = require("../middlewares/authenticateRole");

/**
 * @route POST /api/logo/upload
 * @desc Upload CM7MED logo to Cloudinary
 * @access Admin only
 * @body FormData with 'logo' field containing the image file
 */
router.post(
  "/upload",
  logoController.uploadLogo
);

/**
 * @route GET /api/logo/current
 * @desc Get current logo URL
 * @access Public
 */
router.get(
  "/current",
  logoController.getCurrentLogo
);

/**
 * @route DELETE /api/logo/delete/:publicId
 * @desc Delete logo from Cloudinary
 * @access Admin only
 * @params {string} publicId - Cloudinary public ID of the logo
 */
router.delete(
  "/delete/:publicId",
  authorizeRoles(["admin"]),
  logoController.deleteLogo
);

module.exports = router;
