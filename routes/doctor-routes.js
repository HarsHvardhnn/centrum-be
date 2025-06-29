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
  getDoctorProfile,
  getNextAvailableDate,
  getDoctorDetails,
  updateDoctor,
  getDoctorBySlug,
} = require("../controllers/doctorController");
const {upload} = require("../middlewares/cloudinaryUpload");
const authorizeRoles = require("../middlewares/authenticateRole");

router.post("/", upload.single("file"), addDoctor);

router.get("/", getAllDoctors);

// SEO-optimized doctor profile endpoint - MUST come before /:id route
router.get("/profile/slug/:slug", getDoctorBySlug);

// Doctor profile endpoints
router.get("/profile", authorizeRoles(["doctor"]), getDoctorProfile);
router.get("/profile/:doctorId", getDoctorProfile);

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
  "/schedule/off-time/",
  authorizeRoles(["doctor"]),
  removeOffTime
);

// Get available slots
router.get(
  "/schedule/available-slots/:id",
  // authorizeRoles(["doctor","admin"]),
  getAvailableSlots
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
  upload.single("file"),
  updateDoctor
);

module.exports = router;
