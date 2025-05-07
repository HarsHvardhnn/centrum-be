const express = require("express");
const router = express.Router();
const patientServicesController = require("../controllers/patientServicesController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Add services to a patient (replacing any existing ones)
router.post(
  "/",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.addServicesToPatient
);

// Get all services for a specific patient
router.get(
  "/:patientId",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  patientServicesController.getPatientServices
);

// Update a specific service for a patient
router.patch(
  "/:patientId/service/:serviceId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.updatePatientService
);

// Remove a specific service from a patient
router.delete(
  "/:patientId/service/:serviceId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.removeServiceFromPatient
);

// Delete all services for a patient (soft delete)
router.delete(
  "/:patientId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.deletePatientServices
);

module.exports = router; 