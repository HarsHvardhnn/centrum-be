const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const {upload} = require("../middlewares/cloudinaryUpload");
const User = require("../models/user-entity/user");
const { format } = require("date-fns");
const authorizeRoles = require("../middlewares/authenticateRole");
const { default: mongoose } = require("mongoose");
const appointment = require("../models/appointment");

router.post("/", upload.array("files", 10), patientController.createPatient);
router.put("/:id", upload.array("files", 10), patientController.updatePatient);


router.get("/", patientController.getAllPatients);
router.get("/:id", patientController.getPatientById);
router.get("/data/simple", patientController.getPatientsList);
// router.get('/details/:id', async (req, res) => {
//   try {
//     const patient = await User.findById(req.params.id)
//       .where("role")
//       .equals("patient")
//       .select(
//         "name email phone sex dateOfBirth currentStatus phoneFormatted chronicConditions specialty consultations healthData isInternationalPatient reviewNotes attendingPhysician goals monitoringPlan tests medications"
//       )
//       .populate("consultingDoctor", "name.first name.last").lean();
//     console.log("Patient details:", patient.dateOfBirth, patient.attendingPhysician);
    
//     if (!patient) {
//       return res.status(404).json({ message: 'Patient not found' });
//     }

//     // Calculate age based on dateOfBirth
//     let age = null;
//     if (patient.dateOfBirth) {
//       const today = new Date();
//       const birthDate = new Date(patient.dateOfBirth);
//       age = today.getFullYear() - birthDate.getFullYear();
//       const monthDiff = today.getMonth() - birthDate.getMonth();
//       if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
//         age--;
//       }
//     }

//     // Format the response with only required fields
//     const patientData = {
//       id: patient._id,
//       name: patient.name ? `${patient.name.first} ${patient.name.last}` : null,
//       age: age,
//       birthDate: format(patient.dateOfBirth, "dd-MM-yyyy"),
//       gender: patient.sex,
//       email: patient.email,
//       phone: patient.phone,
//       // Enhanced patient data from the third model
//       currentStatus: patient.currentStatus,
//       phoneFormatted: patient.phoneFormatted,
//       chronicConditions: patient.chronicConditions,
//       specialty: patient.specialty,
//       consultations: patient.consultations,
//       healthData: patient.healthData,
//       isInternationalPatient: patient.isInternationalPatient,
//       reviewNotes: patient.reviewNotes,
//       attendingPhysician: `${patient.consultingDoctor?.name.first || ""} ${
//         patient.consultingDoctor?.name.last || ""
//       }`,
//       goals: patient.goals,
//       monitoringPlan: patient.monitoringPlan,
//       tests: patient.tests,
//       medications: patient.medications,
//     };

//     console.log("Formatted patient data:", patientData);
//     res.json(patientData);
//   } catch (err) {
//     console.error('Error fetching patient:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });

router.get("/details/:id", patientController.getPatientDetails);

router.get(
  "/det/reports/:patientId",
  patientController.getPatientDetailsAndReports
);


router.get("/by-doctor/:doctorId", patientController.getPatientsByDoctorId);



router.put(
  "/details/:id",
  authorizeRoles(["doctor", "admin","receptionist"]),
  upload.array("files"),
patientController.updatePatientDetails
);



router.post(
  "/documents/:patientId/upload/:appointmentId",
  upload.array("files"),
  async (req, res) => {
    try {
      const { patientId,appointmentId } = req.params;
      const files = req.files;

      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No files uploaded" });
      }

      // Check if patient exists
      const patient = await User.findById(patientId);
      if (!patient) {
        return res
          .status(404)
          .json({ success: false, message: "Patient not found" });
      }


      const appointmentData = await appointment.findById(appointmentId);
      appointmentData.status="checkedIn";
      appointmentData.checkedIn=true;
      appointmentData.checkInDate=new Date();
      await appointmentData.save();
      // Upload each file to cloudinary
       const uploadedDocuments = files.map((file) => ({
         type: file.mimetype,
         fileName: file.originalname,
         url: file.path, // Cloudinary auto-gives the file URL here via multer-storage-cloudinary
         uploadedAt: new Date(),
       }));

      patient.checkedIn = true;
      patient.checkedInDate = new Date();
      // Set checkInStatus to true
       // Push new documents into existing array
       patient.documents.push(...uploadedDocuments);
      await patient.save();
      res.status(200).json({
        success: true,
        message: "uploaded documents and checked in user",
      });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({
        success: false,
        message: "Failed to upload documents",
        error: error.message,
      });
    }
  }
);


router.get("/by-id/medical-details/:appointmentId",authorizeRoles(["patient"]), patientController.getPatientMedicalDetails);

module.exports = router;
