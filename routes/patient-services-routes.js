const express = require("express");
const router = express.Router();
const patientServicesController = require("../controllers/patientServicesController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Add services to a patient
router.post(
  "/",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.addServicesToPatient
);

// Get all services for a specific patient
// Can filter by appointmentId using query parameter: ?appointmentId=xyz
router.get(
  "/:patientId",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  patientServicesController.getPatientServices
);

// Update a specific service for a patient
// Can specify appointmentId using query parameter: ?appointmentId=xyz
router.patch(
  "/:patientId/service/:serviceId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.updatePatientService
);

// Remove a specific service from a patient
// Can specify appointmentId using query parameter: ?appointmentId=xyz
router.delete(
  "/:patientId/service/:serviceId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.removeServiceFromPatient
);

// Delete all services for a patient (soft delete)
// Can specify appointmentId using query parameter: ?appointmentId=xyz
router.delete(
  "/:patientId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientServicesController.deletePatientServices
);

module.exports = router; 