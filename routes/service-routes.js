const express = require("express");
const router = express.Router();
const serviceController = require("../controllers/serviceController");
const authorizeRoles = require("../middlewares/authenticateRole");
const {upload} = require("../middlewares/cloudinaryUpload");

// Create
router.post(
  "/",
  authorizeRoles(["admin"]),
  upload.array("images"),
  serviceController.createService
);

// Read
router.get("/", serviceController.getAllServices);
router.get("/:id", serviceController.getServiceById);

// Update
router.put(
  "/:id",
    authorizeRoles(["admin"]),
  upload.array("images"),
  serviceController.updateService
);

// Delete (soft delete)
router.delete("/:id", authorizeRoles(["admin"]), serviceController.deleteService);

module.exports = router;
