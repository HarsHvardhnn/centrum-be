const express = require("express");
const router = express.Router();
const visitCardController = require("../controllers/visit-card");
const authorizeRoles = require("../middlewares/authenticateRole");

// Generate visit card for a patient using appointment data (new)
router.post(
  "/appointment/:appointmentId",
  authorizeRoles(["doctor", "receptionist", "admin"]),

  visitCardController.generateVisitCard
);

// Get visit card by appointment ID (new)
router.get(
  "/appointment/:appointmentId",
  visitCardController.getVisitCardByAppointment
);

// Get all visit cards for a patient (by patient ID)
router.get(
  "/patient/:patientId",
  authorizeRoles(["doctor", "receptionist", "admin", "patient"]),
  visitCardController.getVisitCardsByPatientId
);

// Legacy routes for backward compatibility
router.post(
  "/:patientId",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  visitCardController.generateVisitCard
);

router.get(
  "/:patientId",
  authorizeRoles(["doctor", "admin", "receptionist", "patient"]),
  visitCardController.getVisitCard
);

module.exports = router;
