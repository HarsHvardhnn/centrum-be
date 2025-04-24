const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const upload = require("../middlewares/cloudinaryUpload");

router.post("/", upload.array("files", 10), patientController.createPatient);

router.get("/", patientController.getAllPatients);
router.get("/:id", patientController.getPatientById);
router.get("/data/simple", patientController.getPatientsList);

router.get("/by-doctor/:doctorId", patientController.getPatientsByDoctorId);

module.exports = router;
