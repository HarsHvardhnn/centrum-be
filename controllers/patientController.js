const bcrypt = require("bcrypt");
const patient = require("../models/user-entity/patient");
const { default: mongoose } = require("mongoose");
const doctor = require("../models/user-entity/doctor");
const Appointment = require("../models/appointment");
const user = require("../models/user-entity/user");
const Specialization = require("../models/specialization");
const sendWelcomeEmail = require("../utils/welcomeEmail");
const { ObjectId } = mongoose.Types;


// Create a new patient
exports.createPatient = async (req, res) => {
  try {
    const {
      fullName,
      fatherName,
      email,
      motherName,
      smsConsentAgreed,
      spouseName,
      sex,
      dateOfBirth,
      birthWeight,
      maritalStatus,
      motherTongue,
      religion,
      ethnicity,
      education,
      occupation,
      address,
      city,
      district,
      state,
      country,
      pinCode,
      alternateContact,
      govtId,
      isInternationalPatient,
      ivrLanguage,
      mainComplaint,
      reviewNotes,
      consultingSpecialization,
      consultingDoctor,
      photo,
      otherHospitalIds,
      referrerName,
      referrerEmail,
      referrerNumber,
      referrerType,
      consents = [],
    } = req.body;

    const documents = (req.files || []).map((file) => ({
      fileName: `${new Date().toISOString().split('T')[0]}`,
      path: file.path,
      originalname: file.originalname,
      mimetype: file.mimetype,
    }));

    const existingPatient = await patient.findOne({ email });
    if (existingPatient) {
      return res.status(409).json({
        message: "A patient with this email already exists.",
        patient: existingPatient,
      });
    }
    console.log(consultingSpecialization);  
    const consultSpec = await Specialization.findOne({
      _id: consultingSpecialization,
    });

    const age = calculateAge(dateOfBirth);
    console.log("age is ",age)

    const newPatient = new patient({
      name: {
        first: fullName.split(" ")[0],
        last: fullName.split(" ").slice(1).join(" "),
      },
      email: req.body.email,
      patientId: `P-${new Date().getTime()}`,
      phone: req.body.mobileNumber,
      password: "defaultPassword123",
      role: "patient",
      signupMethod: "email",
      profilePicture: null,
      age,
      smsConsentAgreed,
      fatherName,
      motherName,
      spouseName,
      sex,
      dateOfBirth,
      birthWeight,
      maritalStatus,
      motherTongue,
      religion,
      ethnicity,
      education,
      occupation,
      address,
      city,
      district,
      state,
      country,
      pinCode,
      alternateContact,
      govtId,
      isInternationalPatient:!!isInternationalPatient,
      ivrLanguage,
      mainComplaint,
      reviewNotes,
      consultingSpecialization: consultSpec?.name || "General",
      consultingDoctor: new mongoose.Types.ObjectId(consultingDoctor),
      photo,
      otherHospitalIds,
      referrerName,
      referrerEmail,
      referrerNumber,
      referrerType,
      consents,
      documents,
    });

    await newPatient.save();
    await sendWelcomeEmail(newPatient,'polish');

    res
      .status(201)
      .json({ message: "Patient created successfully", patient: newPatient });
  } catch (error) {
    console.error("Create patient error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
// Get all patients
exports.getAllPatients = async (req, res) => {
  try {
const patients = await patient
  .find({deleted: false})
  .populate({
    path: "doctor",
    select: "name _id",
    options: { strictPopulate: false },
  });
    res.status(200).json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Server error while fetching patients" });
  }
};

function deepParse(value) {
  let result = value;
  try {
    while (typeof result === "string") {
      result = JSON.parse(result);
    }
  } catch (e) {
    console.warn("Consent parse failed at level:", result);
  }
  return result;
}

exports.getPatientById = async (req, res) => {
  try {
    let info =null;
    if(req.params.id.includes("P-")){
      info = await patient.findOne({ patientId: req.params.id }).lean();
    }else{
      info = await patient.findById(req.params.id).lean();
    }

    if (!info) {
      return res.status(404).json({ message: "Patient not found" });
    }

    let parsedConsents = [];
    console.log(info.consents);
    // Parse deeply stringified consent data
    if (info.consents && info.consents.length > 0) {
   parsedConsents= JSON.parse(info?.consents);
    }
    // Transform documents
    const transformedDocuments = info?.documents?.map((docUrlOrObj) => {
      const url =
        typeof docUrlOrObj === "string"
          ? docUrlOrObj
          : docUrlOrObj.url || docUrlOrObj.path;
      const fileType = url.endsWith(".pdf") ? "application/pdf" : "image/jpeg";
      return {
        id: Date.now() + Math.random(),
        name: docUrlOrObj.fileName,
        type: fileType,
        preview: fileType.startsWith("image/") ? url : null,
        isPdf: fileType === "application/pdf",
      };
    });

    const transformedInfo = {
      ...info,
      consents: parsedConsents,
      documents: transformedDocuments || [],
    };

    res.status(200).json(transformedInfo);
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ message: "Server error while fetching patient" });
  }
};



// Controller: PatientController.js
exports.getPatientsList = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      status,
      doctor,
      sex,
      minAge,
      maxAge,
    } = req.query;

  
    const query = {deleted:false};
    
    if (doctor) {
      query.consultingDoctor = doctor;
    }

   
    if (search) {
      query.$or = [
        { "name.first": { $regex: search, $options: "i" } },
        { "name.last": { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
        { mainComplaint: { $regex: search, $options: "i" } }
      ];
    }
    
   
    if (status) {
      query.status = status;
    }
    
   
    if (doctor) {
      query.consultingDoctor = doctor;
    }
    
   
    if (sex) {
      query.sex = sex;
    }
    
    
    if (minAge || maxAge) {
      const currentDate = new Date();
      
      if (minAge) {
        const maxDOB = new Date(currentDate);
        maxDOB.setFullYear(maxDOB.getFullYear() - parseInt(minAge));
        query.dateOfBirth = { ...query.dateOfBirth, $lte: maxDOB };
      }
      
      if (maxAge) {
        const minDOB = new Date(currentDate);
        minDOB.setFullYear(minDOB.getFullYear() - parseInt(maxAge) - 1);
        query.dateOfBirth = { ...query.dateOfBirth, $gte: minDOB };
      }
    }

    // Create sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination info
    const totalCount = await patient.countDocuments(query);
    
    // Execute the query with pagination and sorting
    const patients = await patient
      .find(query)
      .populate("consultingDoctor", "name")
      .sort(sort)
      .skip(skipAmount)
      .limit(parseInt(limit))
      .lean();

    // console.log("Patients fetched:", patients[0].profilePicture, "from", totalCount, "total");
    // Transform the data
    const simplifiedPatients = patients.map((patient) => {
      const patientDate = patient.createdAt
        ? new Date(patient.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "2-digit",
          })
        : new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "2-digit",
          });

      let doctorName = "Unassigned";
      if (patient.consultingDoctor?.name) {
        doctorName = `Dr. ${patient.consultingDoctor.name.first} ${patient.consultingDoctor.name.last}`;
      }
      
      const dob = patient.dateOfBirth;
      const age = dob
        ? Math.floor(
            (Date.now() - new Date(dob).getTime()) /
              (1000 * 60 * 60 * 24 * 365.25)
          )
        : patient.age || 0;

      return {
        id: patient.patientId || `#${Math.floor(Math.random() * 10000000)}`,
        name:
          `${patient.name?.first || ""} ${patient.name?.last || ""}`.trim() ||
          "Unknown",
        username: patient.username ? `@${patient.username}` : "",
        date: patientDate,
        email: patient.email || "Not specified",
        phone: patient.phone || "Not specified",
        sex: patient.sex || "Not specified",
        isCheckedIn:patient.checkedIn || false,
        dateOfBirth: patient.dateOfBirth || "Not specified",
        age,
        avatar: patient?.profilePicture || "",
        disease: patient.mainComplaint || "Not specified",
        status: patient.status || "in-treatment",
        doctor: doctorName,
        _id: patient._id 
      };
    });

    // Return response with pagination metadata
    res.status(200).json({
      success: true,
      count: simplifiedPatients.length,
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      currentPage: parseInt(page),
      patients: simplifiedPatients
    });
  } catch (error) {
    console.error("Error fetching patients list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patients list",
      error: error.message,
    });
  }
};



exports.getPatientsByDoctorId = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctorData = await doctor.findOne({ d_id: doctorId });

    const patients = await patient.find({ consultingDoctor: doctorData._id }).lean();

    const formattedPatients = patients.map((p, index) => {
      const age = p.dateOfBirth
        ? Math.floor(
            (Date.now() - new Date(p.dateOfBirth)) /
              (1000 * 60 * 60 * 24 * 365.25)
          )
        : p.age || 0;

      return {
        id: p.patientId || `${index + 1}`,
        name:
          `${p.name?.first || ""} ${p.name?.last || ""}`.trim() || "Unknown",
        username: p.username ? `@${p.username}` : "",
        avatar: p.profilePicture || `https://i.pravatar.cc/150?img=${(index % 70) + 1}`,
        sex: p.sex || "Not specified",
        age: age,
        status: p.status === "completed" ? "Finished" : "in-treatment",
      };
    });

    res.status(200).json({
      success: true,
      patients: formattedPatients,
    });
  } catch (error) {
    console.error("Error fetching patients by doctor ID:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patients by doctor ID",
      error: error.message,
    });
  }
};



exports.updatePatientDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid patient ID format" });
    }

    const {
      patientData,
      consultationData,
      medications,
      tests,
      uploadedFiles,
      notifyPatient,
    } = req.body;

    // Prepare update data
    const updateData = {};
 

    // Update basic patient info if provided
    if (patientData) {
      // Properly handle name
      // if (patientData.name) {
      //   const nameParts = patientData.name.split(" ");
      //   updateData["name.first"] = nameParts[0];
      //   updateData["name.last"] = nameParts.slice(1).join(" ");
      // }

      // if (patientData.gender) updateData.sex = patientData.gender;
      // if (patientData.email) updateData.email = patientData.email;
      // if (patientData.phone) updateData.phone = patientData.phone;
      // if (patientData.birthDate)
      //   updateData.dateOfBirth = new Date(patientData.birthDate);
      if (patientData.disease) updateData.mainComplaint = patientData.disease;
      if (patientData.isInternationalPatient !== undefined)
        updateData.isInternationalPatient = patientData.isInternationalPatient;
      if (patientData.reviewNotes)
        updateData.reviewNotes = patientData.reviewNotes;

      // Map UI fields to schema structure
      if (patientData.roomNumber) {
        updateData["currentStatus.roomNumber"] = patientData.roomNumber;
      }

      if (patientData.riskStatus) {
        updateData["currentStatus.isRisky"] =
          patientData.riskStatus === "Risky";
      }

      if (patientData.treatmentStatus) {
        updateData["currentStatus.treatmentStatus"] =
          patientData.treatmentStatus;
      }

      // Health data fields
      if (patientData.bloodPressure) {
        updateData["healthData.bloodPressure.value"] =
          patientData.bloodPressure;
      }

      if (patientData.temperature) {
        updateData["healthData.bloodPressure.temperature"] = parseFloat(
          patientData.temperature.replace("°C", "")
        );
      }

      if (patientData.weight) {
        updateData["healthData.bodyWeight.value"] = parseFloat(
          patientData.weight.replace("kg", "")
        );
      }

      if (patientData.height) {
        updateData["healthData.bodyHeight.value"] = patientData.height;
      }
    }

    // Handle consultation data if provided
if (consultationData) {
  // Create a new consultation object with valid date
  const consultDate = new Date(consultationData.date);
  const notes = consultationData.notes || "No notes provided";
  updateData.reviewNotes = notes;
  const newConsultation = {
    consultationType: consultationData.consultationType,
    consultationNotes: consultationData.notes,
    consultationTime: consultationData.time,
    treatmentCategory: consultationData?.treatmentCategory || "",
    description: consultationData.description,
    // Use current date if invalid
    consultationDate: !isNaN(consultDate.getTime()) ? consultDate : new Date(),
    consultationStatus: "Scheduled",
    isOnline: consultationData.isOnline || false,
    // New fields
    interview: consultationData.interview || "",
    physicalExamination: consultationData.physicalExamination || "",
    treatment: consultationData.treatment || "",
    recommendations: consultationData.recommendations || "",
  };
  // Add to consultations array with $push operator
  updateData.$push = updateData.$push || {};
  updateData.consultations = newConsultation;
}

    // Handle medications if provided
 updateData.medications = []; 
 updateData.tests = [];

 if (medications && medications.length > 0) {
   updateData.medications = medications.map((med) => ({
     name: med.name,
     dosage: med.dosage,
     frequency: med.frequency,
     startDate: new Date(med.startDate),
     endDate: med.endDate ? new Date(med.endDate) : null,
     status: med.status,
   }));
 }

 // Add new tests if provided
 if (tests && tests.length > 0) {
   updateData.tests = tests.map((test) => ({
     name: test.name,
     date: new Date(test.date),
     results: test.results,
     status: test.status,
   }));
 }

    console.log("Update data:", updateData);

    // Update using patient model to ensure proper schema validation
    const updatedPatient = await patient.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });
if (uploadedFiles && uploadedFiles.length > 0) {
  // Ensure patient.documents is initialized
  if (!updatedPatient.documents) {
    updatedPatient.documents = [];
  }

  // 2. Prepare new documents with document_type "report"
  const newDocuments = uploadedFiles.map((doc) => ({
    ...doc,
    document_type: "report", // Always hardcoded here
  }));

  // 3. Push new report documents
  updatedPatient.documents.push(...newDocuments);

  // 4. Save updated patient
  await updatedPatient.save();
}


    if (!updatedPatient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    res.status(200).json({
      success: true,
      data: updatedPatient,
      message: "Patient updated successfully",
    });
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update patient details",
      error: error.message,
    });
  }
};

exports.getPatientDetails = async (req, res) => {
  try {
  const patientId = req.params.id;
  let patient = null;

  if (mongoose.Types.ObjectId.isValid(patientId)) {
    patient = await user
      .findById(patientId)
      .populate("consultingDoctor", "name.first name.last")
      .lean();
  }

  if (!patient) {
    patient = await user
      .findOne({ patientId })
      .populate("consultingDoctor", "name.first name.last")
      .lean();
  }
   

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    console.log("Patient details:", patient);
    // Format response to match frontend expectations
    const patientData = {
      id: patient._id,
      name: `${patient.name.first || ""} ${patient.name.last || ""}`,
      age: patient.age,
      gender: patient.sex,
      email: patient.email,
      phone: patient.phone,
      birthDate: patient.dateOfBirth,
      disease: patient.disease || "",
      avatar:
        patient.profilePicture ||
        null,
      isInternationalPatient: patient.isInternationalPatient || false,
      notes: patient.notes || "",
      roomNumber: patient.currentStatus?.roomNumber || "",
      riskStatus: patient.currentStatus?.riskStatus || "Risky",
      treatmentStatus:
        patient.currentStatus?.treatmentStatus || "Under Treatment",
      bloodPressure: patient.bloodPressure?.value || "141/90 mmHg",
      temperature: patient.bloodPressure?.temperature || "29°C",
      weight: patient.bodyWeight?.value || "78kg",
      height: patient.bodyHeight?.value || "5'6\" inc",
    };

    // Get latest consultation if exists
    const latestConsultation =
      patient.consultations;
    console.log("Latest consultation:", latestConsultation);


    // Consultation data
const consultationData = {
  doctor:
    patient?.consultingDoctor?.name?.first &&
    patient?.consultingDoctor?.name?.last
      ? patient.consultingDoctor.name.first +
        " " +
        patient.consultingDoctor.name.last
      : "",

  consultationType: latestConsultation?.consultationType || "",
  locationType: latestConsultation?.locationType || "",
  time: latestConsultation?.consultationTime || "",
  date: latestConsultation?.consultationDate || "",
  treatmentCategory: latestConsultation?.treatmentCategory || "",
  description: latestConsultation?.description || "",
  notes: patient?.notes || patient?.reviewNotes || "",
  isOnline: !!latestConsultation?.isOnline, 
  interview: latestConsultation?.interview || "",
  physicalExamination: latestConsultation?.physicalExamination || "",
  treatment: latestConsultation?.treatment || "",
  recommendations: latestConsultation?.recommendations || "",
};


    // Format medications
    const medications =
      patient?.medications && patient.medications.length > 0
        ? patient.medications.map((med) => ({
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            startDate: med.startDate,
            endDate: med.endDate,
            status: med.status,
          }))
        : [];

    // Format tests
    const tests =
      patient?.tests && patient.tests.length > 0
        ? patient.tests.map((test) => ({
            name: test.name,
            date: test.date,
            results: test.results,
            status: test.status,
          }))
        : [];

    // Format files
    // const uploadedFiles = patient.documents || [];

    // Return complete response
    res.status(200).json({
      patientData,
      consultationData,
      medications,
      tests,
    });
  } catch (error) {
    console.error("Error in getPatientDetails:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Helper function to calculate age from birth date
function calculateAge(birthDate) {
  if (!birthDate) return 0;

  const today = new Date();
  const dob = new Date(birthDate);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}





exports.getPatientDetailsAndReports = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { appointmentId } = req.query; // Get appointmentId from query params
    console.log("Received patientId:", patientId, "appointmentId:", appointmentId);

    // Find patient by ID
    const patient = await user
      .findById(patientId)
      .populate("consultingDoctor", "name.first name.last")
      .lean();
    
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Find appointment by ID if provided
    let appointment = null;
    if (appointmentId) {
     
      appointment = await Appointment.findById(appointmentId)
        .populate("doctor", "name.first name.last")
        .lean();
      
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
    }

    // Format last checked date - use appointment date if available
    let lastChecked = "Not available";
    if (appointment && appointment.date) {
      const doctor = appointment.doctor
        ? `Dr. ${appointment.doctor.name.first} ${appointment.doctor.name.last}`
        : "Unknown doctor";
      const date = new Date(appointment.date).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      lastChecked = `${doctor} on ${date}`;
    } else if (patient.consultations && patient.consultations.consultationDate) {
      const doctor = patient.consultingDoctor
        ? `Dr. ${patient.consultingDoctor.name.first} ${patient.consultingDoctor.name.last}`
        : "Unknown doctor";
      const date = new Date(
        patient.consultations.consultationDate
      ).toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      lastChecked = `${doctor} on ${date}`;
    }

    // Get health data - prefer from appointment if available
    const healthData = appointment?.healthData || patient.healthData || {};
    
    // Format blood pressure
    const bp = healthData.bloodPressure?.value || "Not recorded";

    // Get weight
    const weight = healthData.bodyWeight?.value 
      ? `${healthData.bodyWeight.value} kg` 
      : "Not recorded";

    // Format medications - use appointment data if available
    const medications = appointment?.medications 
      ? appointment.medications.map((med) => ({
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.endDate
            ? `X ${Math.ceil(
                (new Date(med.endDate) - new Date(med.startDate)) /
                  (1000 * 60 * 60 * 24)
              )} Days`
            : "As prescribed",
        }))
      : patient.medications
        ? patient.medications.map((med) => ({
            name: med.name,
            dosage: med.dosage,
            frequency: med.frequency,
            duration: med.endDate
              ? `X ${Math.ceil(
                  (new Date(med.endDate) - new Date(med.startDate)) /
                    (1000 * 60 * 60 * 24)
                )} Days`
              : "As prescribed",
          }))
        : [];

    console.log("Appointment reports:", medications);

    // Format reports - use appointment reports if available
    const reports = appointment?.reports || 
      (patient.documents || []).filter(doc => doc.document_type === "report");

    // Get consultation data from appointment if available
    const consultation = appointment?.consultation || patient.consultations || {};

    // Format final response
    const formattedPatient = {
      name: patient.name || "Unknown",
      patientId:
        patient.patientId ||
        patient.hospId ||
        `#${patient._id.toString().slice(-8)}`,
      avatar: patient.profilePicture || "/path/to/patient-avatar.jpg",
      email: patient.email,
      phone: patient.phone || patient.phoneFormatted || "Not available",
      lastChecked,
      prescription: appointment?.consultation || consultation
        ? `#${Date.now().toString().slice(-8)}`
        : "Not available",
      weight,
      bp,
      pulseRate: "Normal", // This doesn't seem to be in your model, so using a default
      observation: appointment?.consultation?.consultationNotes || consultation.consultationNotes || "No observations recorded",
      medications,
      reports,
      appointmentId: appointment?._id || null
    };

    return res.status(200).json(formattedPatient);
  } catch (error) {
    console.error("Error fetching patient details:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};



exports.getPatientMedicalDetails = async (req, res) => {
  const { appointmentId } = req.params;

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment ID is required" });
  }

  console.log("Received appointment ID:", appointmentId);
  try {
    const appointment = await Appointment.findById(appointmentId)
      .select("medications tests consultation reports healthData")
      .lean();
    
    console.log("Appointment medical details:", appointment);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    return res.status(200).json({
      medications: appointment.medications || [],
      tests: appointment.tests || [],
      consultation: appointment.consultation || {},
      reports: appointment.reports || [],
    });
  } catch (error) {
    console.error("Error fetching appointment medical details:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


exports.updatePatient = async (req, res) => {
  try {
    const patientId = req.params.id;

    


    const {
      fullName,
      fatherName,
      email,
      motherName,
      spouseName,
      sex,
      dateOfBirth,
      birthWeight,
      maritalStatus,
      motherTongue,
      religion,
      ethnicity,
      education,
      occupation,
      address,
      city,
      district,
      state,
      country,
      pinCode,
      alternateContact,
      govtId,
      isInternationalPatient,
      ivrLanguage,
      mainComplaint,
      reviewNotes,
      consultingSpecialization,
      consultingDoctor,
      photo,
      otherHospitalIds,
      referrerName,
      referrerEmail,
      referrerNumber,
      referrerType,

      consents,
      mobileNumber,
    } = req.body;

    console.log("date of birth", dateOfBirth);

    console.log(":req.",req.files)
    const newDocuments = (req.files || []).map((file) => ({
      fileName: `${new Date().toISOString().split('T')[0]}`,
      path: file.path,
      originalname: file.originalname,
      mimetype: file.mimetype,
    }));

    // Check if another patient with the same email exists (excluding current patient)
    if (email) {
      const existingPatient = await patient.findOne({
        email,
        _id: { $ne: patientId },
      });

      if (existingPatient) {
        return res.status(409).json({
          message: "Another patient with this email already exists.",
        });
      }
    }

    // Find the existing patient
    const existingPatient = await patient.findOne({_id:patientId});
    if (!existingPatient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    // Handle consulting specialization
    let consultingSpecName = existingPatient.consultingSpecialization;
    if (consultingSpecialization) {
      const consultSpec = await Specialization.findOne({
        _id: consultingSpecialization,
      });
      if (consultSpec) {
        consultingSpecName = consultSpec.name;
      }
    }

    // Prepare update data
    const updateData = {
      ...(fullName && {
        name: {
          first: fullName.split(" ")[0],
          last: fullName.split(" ").slice(1).join(" "),
        },
      }),
      ...(email && { email }),
      ...(mobileNumber && { phone: mobileNumber }),
      ...(fatherName !== undefined && { fatherName }),
      ...(motherName !== undefined && { motherName }),
      ...(spouseName !== undefined && { spouseName }),
      ...(sex !== undefined && { sex }),
      ...(dateOfBirth !== undefined && {dateOfBirth: new Date(dateOfBirth) }),
      ...(birthWeight !== undefined && { birthWeight }),
      ...(maritalStatus !== undefined && { maritalStatus }),
      ...(motherTongue !== undefined && { motherTongue }),
      ...(religion !== undefined && { religion }),
      ...(ethnicity !== undefined && { ethnicity }),
      ...(education !== undefined && { education }),
      ...(occupation !== undefined && { occupation }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(district !== undefined && { district }),
      ...(state !== undefined && { state }),
      ...(country !== undefined && { country }),
      ...(pinCode !== undefined && { pinCode }),
      ...(alternateContact !== undefined && { alternateContact }),
      ...(govtId !== undefined && { govtId }),
      ...(isInternationalPatient !== undefined && { isInternationalPatient }),
      ...(ivrLanguage !== undefined && { ivrLanguage }),
      ...(mainComplaint !== undefined && { mainComplaint }),
      ...(reviewNotes !== undefined && { reviewNotes }),
      ...(consultingSpecialization && {
        consultingSpecialization: consultingSpecName,
      }),
      ...(consultingDoctor && {
        consultingDoctor: new mongoose.Types.ObjectId(consultingDoctor),
      }),
      ...(photo !== undefined && { photo }),
      ...(otherHospitalIds !== undefined && { otherHospitalIds }),
      ...(referrerName !== undefined && { referrerName }),
      ...(referrerEmail !== undefined && { referrerEmail }),
      ...(referrerNumber !== undefined && { referrerNumber }),
      ...(referrerType !== undefined && { referrerType }),
    };

    // Handle consents update
    if (consents) {
      updateData.consents = consents;
    }

    // Handle documents update - append new documents to existing ones
    if (newDocuments.length > 0) {
      updateData.$push = { documents: { $each: newDocuments } };
    }

    // Update patient with new data
    const updatedPatient = await patient.findOneAndUpdate(
      {_id:patientId},
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.status(200).json({
      message: "Patient updated successfully",
      patient: updatedPatient,
    });
  } catch (error) {
    console.error("Update patient error:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
};

exports.getAppointmentsList = async (req, res) => {
  try {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "date",
      sortOrder = "desc",
      status,
      doctor,
      mode,
    } = req.query;

    const query = {};
    
    if (doctor) {
      query.doctor = doctor;
    }

    if (search) {
      query.$or = [
        { "patient.name.first": { $regex: search, $options: "i" } },
        { "patient.name.last": { $regex: search, $options: "i" } },
        { "patient.patientId": { $regex: search, $options: "i" } },
        { "consultation.description": { $regex: search, $options: "i" } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    if (mode) {
      query.mode = mode;
    }

    // Create sort object
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    
    // Get total count for pagination info
    const totalCount = await Appointment.countDocuments(query);
    
    // Execute the query with pagination and sorting
    const appointments = await Appointment
      .find(query)
      .populate("patient", "name patientId dateOfBirth sex profilePicture username")
      .populate("doctor", "name")
      .sort(sort)
      .skip(skipAmount)
      .limit(parseInt(limit))
      .lean();

    // Transform the data
    const simplifiedAppointments = appointments.map((appointment) => {
      const appointmentDate = appointment.date
        ? new Date(appointment.date).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "2-digit",
          })
        : new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "2-digit",
          });

      let doctorName = "Unassigned";
      if (appointment.doctor?.name) {
        doctorName = `Dr. ${appointment.doctor.name.first} ${appointment.doctor.name.last}`;
      }
      
      const dob = appointment.patient?.dateOfBirth;
      const age = dob
        ? Math.floor(
            (Date.now() - new Date(dob).getTime()) /
              (1000 * 60 * 60 * 24 * 365.25)
          )
        : 0;

      return {
        id: appointment._id,
        name: appointment.patient 
          ? `${appointment.patient.name?.first || ""} ${appointment.patient.name?.last || ""}`.trim()
          : "Unknown",
        username: appointment.patient?.username ? `@${appointment.patient.username}` : "",
        date: appointmentDate,
        email: appointment.patient?.email || "Not specified",
        phone: appointment.patient?.phone || "Not specified",
        sex: appointment.patient?.sex || "Not specified",
        isCheckedIn: appointment.checkedIn || false,
        dateOfBirth: appointment.patient?.dateOfBirth || "Not specified",
        age,
        avatar: appointment.patient?.profilePicture || "",
        disease: appointment.consultation?.description || "Not specified",
        status: appointment.status || "booked",
        doctor: doctorName,
        _id: appointment._id,
        patient_id: appointment.patient._id,
        mode: appointment.mode || "offline",
        startTime: appointment.startTime,
        endTime: appointment.endTime
      };
    });

    // Return response with pagination metadata
    res.status(200).json({
      success: true,
      count: simplifiedAppointments.length,
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      currentPage: parseInt(page),
      appointments: simplifiedAppointments
    });
  } catch (error) {
    console.error("Error fetching appointments list:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments list",
      error: error.message,
    });
  }
};