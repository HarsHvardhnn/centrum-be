const express = require("express");
const router = express.Router();

// Import controllers
const ipRestrictionController = require("../controllers/ipRestrictionController");

// Import middlewares
const authorizeRoles = require("../middlewares/authenticateRole");

// Routes for IP restriction management
// All routes require admin authentication

/**0
 * @route GET /api/ip-restrictions
 * @desc Get all allowed IPs with pagination and filtering
 * @access Admin only
 */
router.get("/", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.getAllowedIps
);

/**
 * @route GET /api/ip-restrictions/stats
 * @desc Get IP restriction statistics
 * @access Admin only
 */
router.get("/stats", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.getIpStats
);

/**
 * @route GET /api/ip-restrictions/check-current
 * @desc Check if current IP is allowed (for testing)
 * @access Admin only
 */
router.get("/check-current", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.checkCurrentIp
);

/**
 * @route GET /api/ip-restrictions/settings
 * @desc Get IP restriction settings
 * @access Admin only
 */
router.get("/settings", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.getIpRestrictionSettings
);

/**
 * @route PUT /api/ip-restrictions/settings
 * @desc Update IP restriction settings
 * @access Admin only
 */
router.put("/settings", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.updateIpRestrictionSettings
);

/**
 * @route POST /api/ip-restrictions/settings/toggle
 * @desc Quick toggle IP restrictions on/off
 * @access Admin only
 */
router.post("/settings/toggle", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.toggleIpRestrictions
);

/**
 * @route GET /api/ip-restrictions/:id
 * @desc Get a specific allowed IP by ID
 * @access Admin only
 */
router.get("/:id", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.getAllowedIpById
);

/**
 * @route POST /api/ip-restrictions
 * @desc Add a new allowed IP
 * @access Admin only
 */
router.post("/", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.addAllowedIp
);

/**
 * @route PUT /api/ip-restrictions/:id
 * @desc Update an allowed IP
 * @access Admin only
 */
router.put("/:id", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.updateAllowedIp
);

/**
 * @route DELETE /api/ip-restrictions/:id
 * @desc Delete an allowed IP
 * @access Admin only
 */
router.delete("/:id", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.deleteAllowedIp
);

/**
 * @route POST /api/ip-restrictions/bulk
 * @desc Bulk operations for allowed IPs (activate, deactivate, delete)
 * @access Admin only
 */
router.post("/bulk", 
  authorizeRoles(["admin"]), 
  ipRestrictionController.bulkUpdateAllowedIps
);

module.exports = router; 