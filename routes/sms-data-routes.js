const express = require("express");
const router = express.Router();
const smsController = require("../controllers/smsController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Get all SMS data with pagination, sorting, and filtering
router.get(
  "/",
  authorizeRoles(["admin", "receptionist"]),
  smsController.getAllSmsData
);

// Get SMS data by ID
router.get(
  "/:id",
  authorizeRoles(["admin", "receptionist"]),
  smsController.getSmsDataById
);

// Get SMS data by batch ID
router.get(
  "/batch/:batchId",
  authorizeRoles(["admin", "receptionist"]),
  smsController.getSmsDataByBatchId
);

// Get SMS data by user ID
router.get(
  "/user/:userId",
  authorizeRoles(["admin", "receptionist", "patient", "doctor"]),
  smsController.getSmsDataByUserId
);

module.exports = router; 