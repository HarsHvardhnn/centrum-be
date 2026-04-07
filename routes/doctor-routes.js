const express = require("express");
const router = express.Router();
const {
  addDoctor,
  getAllDoctors,
  getDoctorById,
  getWeeklyShifts,
  getOffSchedule,
  updateWeeklyShifts,
  removeOffTime,
  addOffTime,
  getAvailableSlots,
  getWeekAvailability,
  getDoctorProfile,
  getNextAvailableDate,
  getDoctorDetails,
  updateDoctor,
  getDoctorBySlug,
  copyLastWeekSchedule,
  copyScheduleFromDateRange,
} = require("../controllers/doctorController");
const { upload, cloudinaryCategory } = require("../middlewares/cloudinaryUpload");
const authorizeRoles = require("../middlewares/authenticateRole");
const userServicesController = require("../controllers/userServicesController");

/** Maps :doctorId → user-services handler params (UserService links services to doctor user _id). */
function aliasDoctorServicesParams(req, res, next) {
  req.params.userId = req.params.doctorId;
  req.params.userType = "doctor";
  next();
}

router.post("/", cloudinaryCategory("doctor"), upload.single("file"), addDoctor);

router.get("/", getAllDoctors);

// SEO-optimized doctor profile endpoint - MUST come before /:id route
router.get("/profile/slug/:slug", getDoctorBySlug);

// Doctor profile endpoints
router.get("/profile", authorizeRoles(["doctor"]), getDoctorProfile);
router.get("/profile/:doctorId", getDoctorProfile);

// Services linked to this doctor (User services modal / catalog) — same data as GET /user-services/:userId/doctor
router.get(
  "/:doctorId/services",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  aliasDoctorServicesParams,
  userServicesController.getUserServices
);

router.get("/:id", getDoctorById);

router.get(
  "/schedule/shifts/",
  authorizeRoles(["doctor","admin"]),

  getWeeklyShifts
);
router.get(
  "/schedule/off-time/",
  authorizeRoles(["doctor"]),
  getOffSchedule
);

// Update doctor's schedule
router.put(
  "/schedule/shifts",
  authorizeRoles(["doctor","admin"]),
  updateWeeklyShifts
);
router.post(
  "/schedule/off-time/",
  authorizeRoles(["doctor"]),
  addOffTime
);
router.delete(
  "/schedule/off-time/:id",
  authorizeRoles(["doctor"]),
  removeOffTime
);

// Copy last week's schedule to current week (convenience function)
router.post(
  "/schedule/copy-last-week",
  authorizeRoles(["doctor", "admin"]),
  copyLastWeekSchedule
);

// Copy schedule from custom date range to target date range (convenience function)
router.post(
  "/schedule/copy-date-range",
  authorizeRoles(["doctor", "admin"]),
  copyScheduleFromDateRange
);

// Get available slots
router.get(
  "/schedule/available-slots/:id",
  // authorizeRoles(["doctor","admin"]),
  getAvailableSlots
);

// Get week slot availability
router.get(
  "/schedule/week-availability/:doctorId",
  // authorizeRoles(["doctor","admin"]),
  getWeekAvailability
);

// Get next available date
router.get(
  "/schedule/next-available/:id",
  getNextAvailableDate
);

// Get detailed doctor information
router.get(
  "/details/:id",
  authorizeRoles(["doctor", "admin","receptionist"]),
  getDoctorDetails
);

// Update doctor information
router.patch(
  "/details/:id",
  authorizeRoles(["doctor", "admin","receptionist"]),
  cloudinaryCategory("doctor"),
  upload.single("file"),
  updateDoctor
);

module.exports = router;
