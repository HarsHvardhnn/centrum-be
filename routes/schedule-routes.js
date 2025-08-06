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

module.exports = router; 