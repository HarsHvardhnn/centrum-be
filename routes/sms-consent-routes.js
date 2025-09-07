const express = require("express");
const router = express.Router();
const smsConsentController = require("../controllers/smsConsentController");
const authenticateRole = require("../middlewares/authenticateRole");

/**
 * @route GET /api/sms-consent/:userId
 * @desc Get SMS consent status for a patient
 * @access Private - Only accessible by authorized users (doctor, receptionist, admin)
 */
router.get(
  "/:userId",
  authenticateRole(["doctor", "receptionist", "admin"]),
  smsConsentController.getSmsConsentStatus
);

module.exports = router;
