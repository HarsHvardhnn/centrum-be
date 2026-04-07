const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const authorizeRoles = require("../middlewares/authenticateRole");
const { upload, cloudinaryCategory } = require("../middlewares/cloudinaryUpload");

// Create
router.post(
  "/",
  authorizeRoles(["admin"]),
  cloudinaryCategory("service"),
  upload.array("images"),
  serviceController.createService
);

// Read
router.get("/", serviceController.getAllServices);
// New slug-based route for SEO-friendly URLs
router.get("/slug/:slug", serviceController.getServiceBySlug);
// Keep ID route for backward compatibility
router.get("/:id", serviceController.getServiceById);

// Update
router.put(
  "/:id",
    authorizeRoles(["admin"]),
  cloudinaryCategory("service"),
  upload.array("images"),
  serviceController.updateService
);

// Delete (soft delete)
router.delete("/:id", authorizeRoles(["admin"]), serviceController.deleteService);

module.exports = router;
