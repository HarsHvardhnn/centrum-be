// routes/permanent-delete-routes.js
const express = require("express");
const router = express.Router();
const permanentDeleteController = require("../controllers/permanentDeleteController");
const authorizeRoles = require("../middlewares/authenticateRole");

// All permanent deletion routes require admin role only
// These are destructive operations that should be restricted

// Get deletion statistics
router.get("/stats", authorizeRoles(["admin"]), permanentDeleteController.getDeletionStats);

// Permanently delete patient(s)
router.delete("/patients/bulk", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeletePatient); // Bulk delete by IDs
router.delete("/patients/:patientId", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeletePatient); // Single delete

// Permanently delete appointment(s)
router.delete("/appointments/bulk", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteAppointments); // Bulk delete by IDs
router.delete("/appointments/:appointmentId", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteAppointments); // Single delete
router.delete("/appointments", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteAppointments); // Bulk delete by status

// Permanently delete contact message(s)
router.delete("/contacts/bulk", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteContact); // Bulk delete by IDs
router.delete("/contacts/:contactId", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteContact); // Single delete
router.delete("/contacts", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteContact); // Bulk delete all soft-deleted

// Permanently delete user account
router.delete("/users/:userId", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteUser);

// Permanently delete invoices
router.delete("/invoices/:invoiceId", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteInvoice);
router.delete("/invoices", authorizeRoles(["admin"]), permanentDeleteController.permanentlyDeleteInvoice); // For bulk delete

module.exports = router;


