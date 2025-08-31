const express = require("express");
const router = express.Router();
const appointmentConfigController = require("../controllers/appointmentConfigController");
const authenticateRole = require("../middlewares/authenticateRole");

// Get all configuration settings (admin only)
router.get("/", authenticateRole(["admin"]), appointmentConfigController.getAllConfigs);

// Get configuration as a single object (used by the system)
router.get("/object", appointmentConfigController.getConfigObject);

// Get a specific configuration by key
router.get("/:key", authenticateRole(["admin", "doctor", "staff"]), appointmentConfigController.getConfigByKey);

// Update a configuration value (admin only)
router.put("/:key", authenticateRole(["admin"]), appointmentConfigController.updateConfig);

// Reset a configuration to default value (admin only)
router.post("/:key/reset", authenticateRole(["admin"]), appointmentConfigController.resetConfig);

module.exports = router;
