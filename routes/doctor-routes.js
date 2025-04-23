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
} = require("../controllers/doctorController");
const upload = require("../middlewares/cloudinaryUpload");
const authorizeRoles = require("../middlewares/authenticateRole");

router.post("/", upload.single("file"), addDoctor);

router.get("/", getAllDoctors);

router.get("/:id", getDoctorById);

router.get(
  "/schedule/shifts/",
  authorizeRoles(["doctor"]),

  getWeeklyShifts
);
router.get(
  "/schedule/off-time/",
  authorizeRoles(["doctor"]),
  getOffSchedule
);

// Update doctor's schedule
router.put(
  "/schedule/shifts/",
  authorizeRoles(["doctor"]),
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
  authorizeRoles(["doctor"]),
  getAvailableSlots
);

module.exports = router;
