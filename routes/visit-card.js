const express = require("express");
const router = express.Router();
const visitCardController = require("../controllers/visit-card");
const authorizeRoles = require("../middlewares/authenticateRole");

// Generate visit card for a patient
router.get(
  "/generate/:patientId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  visitCardController.generateVisitCard
);

// Get visit card by ID
router.get(
  "/:patientId",
  authorizeRoles(["doctor", "admin", "receptionist", "patient"]),
  visitCardController.getVisitCard
);

module.exports = router;
