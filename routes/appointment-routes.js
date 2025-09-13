// routes/appointmentRoutes.js

const express = require("express");
const router = express.Router();
const { check } = require("express-validator");
const appointmentController = require("../controllers/appointmentController");
const authorizeRoles = require("../middlewares/authenticateRole");
const { bookAppointment } = require("../controllers/gmeetController");
const { upload } = require("../middlewares/cloudinaryUpload");
const {createRecaptchaMiddleware} = require("../middlewares/recaptchaVerification");


// @route   POST /api/appointments
// @desc    Create a new appointment
// @access  Private
router.post(
  "/",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  [
    [
      check("doctor", "Doctor ID is required").notEmpty(),
      check("date", "Valid date is required").isDate(),
      check("startTime", "Start time is required").notEmpty(),
      check("endTime", "End time is required").notEmpty(),
    ],
  ],
  appointmentController.createAppointment
);

// @route   POST /api/appointments/reception
// @desc    Create a new appointment with reception override
// @access  Private (receptionist, admin)
router.post(
  "/reception",
  authorizeRoles(["receptionist", "admin","doctor"]),
  [
    [
      check("doctorId", "Doctor ID is required").notEmpty(),
      check("patientId", "Patient ID is required").notEmpty(),
      check("date", "Valid date is required").isDate(),
      check("startTime", "Start time is required").notEmpty(),
    ],
  ],
  appointmentController.createReceptionAppointment
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
  authorizeRoles(["doctor", "receptionist", "admin","patient"]),
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

// Reschedule appointment
router.patch(
  "/:appointmentId/reschedule",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.rescheduleAppointment
);

router.get(
  "/dashboard/",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getAppointmentsDashboard
);
router.patch(
  "/cancel/:id",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.cancelAppointment
);

router.patch(
  "/check-in/:id",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.completeCheckIn
);

// @route   POST /api/appointments/book
// @desc    Book a new appointment with reCAPTCHA verification
// @access  Public
router.post("/book", 
  createRecaptchaMiddleware.appointment(), 
  bookAppointment
);

// Update appointment details (consultation, tests, medications)
router.put(
  "/:id/details",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.updateAppointmentDetails
);

// Get appointment details
router.get(
  "/:id",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getAppointmentDetails
);

// Get all appointments for a patient
router.get(
  "/patient/:patientId",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getPatientAppointments
);

// Get all appointments with pagination, sorting and filtering
router.get(
  "/details/list",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getAppointments
);

// Upload a single report file to an appointment
router.post(
  "/rep/:id/upload-report",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  upload.single("file"), // Using single file upload
  appointmentController.uploadAppointmentReport
);

// Delete a report from an appointment
router.delete(
  "/:appointmentId/reports/:reportId",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.deleteReport
);

// Add a report to an appointment
router.post(
  "/:id/reports",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.addReportToAppointment
);

// Add a route for updating only consultation details
router.put(
  "/:id/consultation",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.updateConsultation
);

// @route   PATCH /api/appointments/:id/time
// @desc    Update the date, time and doctor of an appointment
// @access  Private (doctor, receptionist, admin)
router.patch(
  "/:id/time",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.updateAppointmentTime
);

// @route   GET /api/appointments/doctor/:doctorId/by-date
// @desc    Get appointments by doctor ID grouped by date
// @access  Private
router.get(
  "/doctor/:doctorId/by-date",
  authorizeRoles(["doctor", "receptionist", "admin"]),
  appointmentController.getDoctorAppointmentsByDate
);

module.exports = router;
