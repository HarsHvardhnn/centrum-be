// routes/appointmentRoutes.js

const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const appointmentController = require("../controllers/appointmentController");
const authorizeRoles = require("../middlewares/authenticateRole");


// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private
router.post(
  "/",
  [
    authorizeRoles(["doctor","receptionist","admin"]),
    [
      check("doctor", "Doctor ID is required").notEmpty(),
      check("patient", "Patient ID is required").notEmpty(),
      check("date", "Valid date is required").isDate(),
      check("startTime", "Start time is required").notEmpty(),
      check("endTime", "End time is required").notEmpty(),
    ],
  ],
  appointmentController.createAppointment
);

// @route   GET /api/appointments/doctor/:doctorId
// @desc    Get all appointments for a doctor
// @access  Private
router.get(
  "/doctor/:doctorId",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getAppointmentsByDoctor
);

// @route   GET /api/appointments/patient/:patientId
// @desc    Get all appointments for a patient
// @access  Private
router.get(
  "/patient/:patientId",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getAppointmentsByPatient
);

// @route   PATCH /api/appointments/:appointmentId/status
// @desc    Update appointment status
// @access  Private
router.patch(
  "/:appointmentId/status",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.updateAppointmentStatus
);

module.exports = router;
