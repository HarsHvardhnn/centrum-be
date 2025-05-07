const express = require("express");
const router = express.Router();
const userServicesController = require("../controllers/userServicesController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Add services to a user (patient or doctor)
router.post(
  "/",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  userServicesController.addServicesToUser
);

// Get all services for a specific user
router.get(
  "/:userId/:userType",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  userServicesController.getUserServices
);

// Update a specific service for a user
router.patch(
  "/:userId/:userType/service/:serviceId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  userServicesController.updateUserService
);

// Remove a specific service from a user
router.delete(
  "/:userId/:userType/service/:serviceId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  userServicesController.removeServiceFromUser
);

// Delete all services for a user (soft delete)
router.delete(
  "/:userId/:userType",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  userServicesController.deleteUserServices
);

module.exports = router; 