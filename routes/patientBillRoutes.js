const express = require("express");
const router = express.Router();
const patientBillController = require("../controllers/patientBillController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Generate bill for appointment
router.post(
  "/generate/:appointmentId",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientBillController.generateBill
);

// Generate invoice PDF for a bill
router.get(
  "/:billId/invoice",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  patientBillController.generateInvoice
);

// Get all bills with pagination, sorting, and filtering
router.get(
  "/all",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  patientBillController.getAllBills
);

// Get bills for a specific patient
router.get(
  "/patient/:patientId",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  patientBillController.getPatientBills
);

// Get a single bill by ID
router.get(
  "/:billId",
  authorizeRoles(["admin", "doctor", "receptionist", "patient"]),
  patientBillController.getBillById
);

// Update bill payment status
router.patch(
  "/:billId/payment-status",
  authorizeRoles(["admin", "receptionist"]),
  patientBillController.updateBillPaymentStatus
);

// Delete a bill (soft delete)
router.delete(
  "/:billId",
  authorizeRoles(["admin"]),
  patientBillController.deleteBill
);

// Get bill statistics
router.get(
  "/statistics/summary",
  authorizeRoles(["admin", "doctor"]),
  patientBillController.getBillStatistics
);

module.exports = router; 