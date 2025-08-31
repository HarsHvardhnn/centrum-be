const express = require("express");
const router = express.Router();
const secureDocumentController = require("../controllers/secureDocumentController");
const authenticateRole = require("../middlewares/authenticateRole");

// Route to generate a signed URL directly from a public ID
// Use a query parameter instead of path parameter to handle slashes in public IDs
router.get("/signed-url", authenticateRole(["admin", "doctor", "staff"]), secureDocumentController.getSignedUrl);

// Route to get a patient document with a fresh signed URL
router.get("/patient/:patientId/document/:documentId", authenticateRole(["admin", "doctor", "staff"]), secureDocumentController.getPatientDocument);

// Route to get an appointment report (including visit cards) with a fresh signed URL
router.get("/appointment/:appointmentId/report/:reportId", authenticateRole(["admin", "doctor", "staff"]), secureDocumentController.getAppointmentReport);

module.exports = router;
