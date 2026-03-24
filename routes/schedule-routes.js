const express = require("express");
const router = express.Router();
const  authorizeRoles  = require("../middlewares/authenticateRole");
const scheduleController = require("../controllers/scheduleController");

// Schedule management routes
router.post(
  "/schedule",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.createOrUpdateSchedule
);

router.get(
  "/schedule/:doctorId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.getSchedule
);

// Delete a single time block from a schedule (must be before delete by scheduleId only)
router.delete(
  "/schedule/id/:scheduleId/blocks/:blockIndex",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.deleteScheduleTimeBlock
);

// Permanently delete by schedule document _id (use from Edit Schedule modal; must be before :doctorId/:date)
router.delete(
  "/schedule/id/:scheduleId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.deleteScheduleById
);

router.delete(
  "/schedule/:doctorId/:date",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.deleteSchedule
);

// Schedule exception routes
router.post(
  "/exception",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.createException
);

router.get(
  "/exception/:doctorId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.getExceptions
);

router.delete(
  "/exception/:exceptionId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.deleteException
);

// Copy last week's schedule to current week
router.post(
  "/copy-last-week/:doctorId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.copyLastWeekSchedule
);

// Copy schedule from custom date range to target date range
router.post(
  "/copy-date-range/:doctorId",
  authorizeRoles(["doctor", "admin", "receptionist"]),
  scheduleController.copyScheduleFromDateRange
);

module.exports = router; 