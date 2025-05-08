const express = require("express");
const router = express.Router();
const doctorStatsController = require("../controllers/doctorStatsController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Route to get a simplified list of doctors (id and name only)
router.get(
  "/doctors-list",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  doctorStatsController.getDoctorsList
);

// Route to get appointment statistics for a doctor
router.get(
  "/:doctorId/appointment-stats",
  authorizeRoles(["admin", "doctor"]), 
  doctorStatsController.getDoctorAppointmentStats
);

// Route to get appointment distribution statistics for a doctor
router.get(
  "/:doctorId/distribution",
  authorizeRoles(["admin", "doctor"]),
  doctorStatsController.getDoctorDistributionStats
);

// Route to get performance metrics for a doctor
router.get(
  "/:doctorId/performance",
  authorizeRoles(["admin", "doctor"]),
  doctorStatsController.getDoctorPerformanceMetrics
);

module.exports = router; 