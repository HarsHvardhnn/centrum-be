/**
 * Patient Portal – Login / Create account flow (to be enabled later).
 * Rule: No registration for users who have never been patients (must have PATIENT_ID and at least one visit).
 *
 * @route POST /api/patient-portal/check-by-pesel  – Check if patient exists and has visited; returns found + patientId or 404
 * @route POST /api/patient-portal/create-account   – Associate email with patient, set temp password, send login details email
 */

const express = require("express");
const router = express.Router();
const patientPortalController = require("../controllers/patientPortalController");

router.post("/check-by-pesel", patientPortalController.checkByPesel);
router.post("/create-account", patientPortalController.createAccount);

module.exports = router;
