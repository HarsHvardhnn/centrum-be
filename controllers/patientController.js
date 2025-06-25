const bcrypt = require("bcrypt");
const patient = require("../models/user-entity/patient");
const { default: mongoose } = require("mongoose");
const doctor = require("../models/user-entity/doctor");
const Appointment = require("../models/appointment");
const user = require("../models/user-entity/user");
const Specialization = require("../models/specialization");
const sendWelcomeEmail = require("../utils/welcomeEmail");
const { ObjectId } = mongoose.Types;

// Helper function to create standardized document structure
exports.createStandardizedDocument = (fileData, documentType = "general") => {
  const documentId = new mongoose.Types.ObjectId().toString();
  const timestamp = new Date();
  
  // Handle both file upload objects and existing document objects
  if (fileData.originalname || fileData.name) {
    // This is a file upload from multer
    const isPdf = fileData.mimetype === "application/pdf";
    let downloadUrl = fileData.path;
    
    // For PDFs, ensure we have a proper download URL with file extension
    if (isPdf && downloadUrl && !downloadUrl.includes('.pdf')) {
      // Extract the file extension and add it to the URL
      const fileExtension = fileData.originalname.split('.').pop().toLowerCase();
      if (downloadUrl.includes('cloudinary.com')) {
        // For Cloudinary URLs, add the extension as a query parameter for proper content-type
        downloadUrl = `${fileData.path}.${fileExtension}`;
      }
    }
    
    return {
      _id: documentId,
      documentId: documentId,
      fileName: fileData.originalname || fileData.name,
      originalName: fileData.originalname || fileData.name,
      path: fileData.path,
      preview: downloadUrl, // Use the processed URL for preview
      url: downloadUrl, // Use the processed URL for download
      downloadUrl: downloadUrl, // Explicit download URL
      mimeType: fileData.mimetype,
      fileType: fileData.mimetype,
      isPdf: isPdf,
      documentType: documentType,
      uploadDate: timestamp,
      size: fileData.size || null,
      fileExtension: fileData.originalname ? fileData.originalname.split('.').pop().toLowerCase() : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  } else {
    // This is an existing document object being updated
    const isPdfType = (fileData.mimeType || fileData.type || fileData.mimetype) === "application/pdf";
    let processedUrl = fileData.url || fileData.path;
    
    // Process URL for existing documents too
    if (isPdfType && processedUrl && !processedUrl.includes('.pdf')) {
      const fileExtension = (fileData.fileName || fileData.name || "").split('.').pop()?.toLowerCase();
      if (fileExtension && processedUrl.includes('cloudinary.com')) {
        processedUrl = `${processedUrl}.${fileExtension}`;
      }
    }
    
    return {
      _id: documentId,
      documentId: documentId,
      fileName: fileData.fileName || fileData.name || "Unknown",
      originalName: fileData.originalName || fileData.fileName || fileData.name || "Unknown",
      path: fileData.path || fileData.url,
      preview: processedUrl,
      url: processedUrl,
      downloadUrl: processedUrl,
      mimeType: fileData.mimeType || fileData.type || fileData.mimetype,
      fileType: fileData.fileType || fileData.type || fileData.mimetype,
      isPdf: isPdfType,
      documentType: fileData.documentType || fileData.document_type || documentType,
      uploadDate: fileData.uploadDate || timestamp,
      size: fileData.size || null,
      fileExtension: (fileData.fileName || fileData.name || "").split('.').pop()?.toLowerCase(),
      createdAt: fileData.createdAt || timestamp,
      updatedAt: timestamp,
      ...fileData // Spread any additional properties
    };
  }
};

// Helper function to delete a document by ID from patient's documents array
exports.deleteDocumentById = async (patientId, documentId) => {
  try {
    const updatedPatient = await patient.findByIdAndUpdate(
      patientId,
      {
        $pull: {
          documents: {
            $or: [
              { _id: documentId },
              { documentId: documentId }
            ]
          }
        }
      },
      { new: true }
    );
    return updatedPatient;
  } catch (error) {
    throw new Error(`Failed to delete document: ${error.message}`);
  }
};

// Create a new patient
exports.createPatient = async (req, res) => {
  try {
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
      consents = [],
      // New fields
      isAdult,
      contactPerson,
      fatherPhone,
      motherPhone,
      relationToPatient,
      allergies,
      nationality,
      preferredLanguage,
    } = req.body;

    // console.log("req.body is ",dateOfBirth)
    // Remove leading zeros from phone number
    const phoneNumber = req.body.mobileNumber?.replace(/^0+/, '') || '';
    
    if (!phoneNumber) {
      return res.status(400).json({
        message: "Numer telefonu jest wymagany",
      });
    }

    // Check for existing patient with same phone number

    const existingPatientByPhone = await patient.findOne({ phone: phoneNumber });
    if (existingPatientByPhone) {
      return res.status(409).json({
        message: "Pacjent z tym numerem telefonu już istnieje",
        patient: existingPatientByPhone,
      });
    }
    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Handle email - check if it's actually provided and not "undefined"
    const emailToSave = email && email !== "undefined" ? email.trim() : "";
    
    // If email is provided, validate its format
    if (emailToSave && !emailRegex.test(emailToSave)) {
      return res.status(400).json({
        message: "Nieprawidłowy format adresu email",
      });
    }
    
    // If email is provided and valid, check for existing patient with same email
    if (emailToSave) {
      const existingPatientByEmail = await patient.findOne({ email: emailToSave });
      if (existingPatientByEmail) {
        return res.status(409).json({
          message: "Pacjent z tym adresem email już istnieje",
          patient: existingPatientByEmail,
        });
      }
    }

    const TARGET_TEXT = "Pacjent wyraża zgodę na otrzymywanie powiadomień SMS";

    // Initialize consent variables
    let parsedConsents = [];
    let smsConsentAgreed = false;

    // Validate and parse consents
    if (consents && consents.length > 0 && consents !== "undefined") {
      try {
        const parsed = JSON.parse(consents);
        // Validate that parsed result is an array and not empty
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Additional validation to ensure each consent has required properties
          const isValidConsent = parsed.every(consent => 
            consent && 
            typeof consent === 'object' && 
            'text' in consent && 
            'agreed' in consent &&
            typeof consent.text === 'string' &&
            typeof consent.agreed === 'boolean'
          );
          
          if (isValidConsent) {
            parsedConsents = parsed;
            // Check for SMS consent
            smsConsentAgreed = parsedConsents.some(
              (consent) => consent.text === TARGET_TEXT && consent.agreed === true
            );
          } else {
            console.warn("Invalid consent format detected");
            parsedConsents = []; // Reset to empty array if invalid
          }
        }
      } catch (error) {
        console.error("Error parsing consents:", error);
        parsedConsents = []; // Reset to empty array if parsing fails
      }
    }
    // console.log("consents are ",parsedConsents)
    //move back uip
 



    console.log("req.files are ",req.files)
    // Use standardized document creation
    const documents = (req.files || []).map((file) => 
      exports.createStandardizedDocument(file, "medical_record")
    );

    // console.log(consultingSpecialization);  
    const consultSpec = await Specialization.findOne({
      _id: consultingSpecialization,
    });

    // Calculate age from dateOfBirth
    const calculatedAge = calculateAge(dateOfBirth);
    // console.log("Calculated age:", calculatedAge);

    const newPatient = new patient({
      name: {
        first: fullName.split(" ")[0],
        last: fullName.split(" ").slice(1).join(" "),
      },
      email: emailToSave, // Use validated email
      patientId: `P-${new Date().getTime()}`,
      phone: phoneNumber, // Store phone number without leading zeros
      password: "defaultPassword123",
      role: "patient",
      signupMethod: "email",
      profilePicture: null,
      age: calculatedAge, // Use the calculated age
      dateOfBirth, // Store the original date of birth
      smsConsentAgreed,
      fatherName,
      motherName,
      spouseName,
      sex,
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
      consultingSpecialization: new mongoose.Types.ObjectId(consultingSpecialization),
      alternateContact,
      govtId,
      isInternationalPatient:!!isInternationalPatient,
      ivrLanguage,
      mainComplaint,
      reviewNotes,
      consultingDoctor: new mongoose.Types.ObjectId(consultingDoctor),
      photo,
      otherHospitalIds,
      referrerName,
      referrerEmail,
      referrerNumber,
      referrerType,
      consents: parsedConsents, // Store validated consents
      documents,
      // New fields
      isAdult:isAdult=="NIE" ? false : true,
      contactPerson,
      fatherPhone,
      motherPhone,
      relationToPatient,
      allergies,
      nationality,
      preferredLanguage,
    });

    console.log("Before saving - consents:", newPatient.consents);
    await newPatient.save();
    
    // Fetch the saved patient to verify the consents
    const savedPatient = await patient.findById(newPatient._id);
    console.log("After saving - consents:", savedPatient.consents);

    await sendWelcomeEmail(newPatient,'polish');

    res
      .status(201)
      .json({ message: "Pacjent został pomyślnie utworzony", patient: newPatient });
  } catch (error) {
    console.error("Create patient error:", error);
    res.status(500).json({ error: "Błąd wewnętrzny serwera" });
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
      return res.status(404).json({ message: "Nie znaleziono pacjenta" });
    }
    delete info.password;

    let parsedConsents = [];
    console.log(info.consents);
    // Parse deeply stringified consent data
    if (info.consents.length >0 && info.consents && typeof info.consents[0]==='string') {
   parsedConsents= JSON.parse(info?.consents);
    }
    else{
      parsedConsents=info.consents;
    }
    // Transform documents


    const transformedInfo = {
      ...info,
      consents: parsedConsents,
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
      const searchLower = search.toLowerCase().trim();
      query.$or = [
        { 
          $expr: {
            $regexMatch: {
              input: { $toLower: { $concat: ["$name.first", " ", "$name.last"] } },
              regex: searchLower,
              options: "i"
            }
          }
        },
        { username: { $regex: searchLower, $options: "i" } },
        { patientId: { $regex: searchLower, $options: "i" } },
        { mainComplaint: { $regex: searchLower, $options: "i" } }
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
        email: patient.email || "Nieokreślony",
        phone: patient.phone || "Nieokreślony",
        sex: patient.sex || "Nieokreślony",
        isCheckedIn:patient.checkedIn || false,
        dateOfBirth: patient.dateOfBirth || "Nieokreślony",
        age,
        avatar: patient?.profilePicture || "",
        disease: patient.mainComplaint || "Nieokreślony",
        status: patient.status || "w trakcie leczenia",
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
        sex: p.sex || "Nieokreślony",
        age: age,
        status: p.status === "completed" ? "Zakończone" : "w trakcie leczenia",
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
    // Handle uploaded files with standardized document structure
    if (uploadedFiles && uploadedFiles.length > 0) {
      // Ensure patient.documents is initialized
      if (!updatedPatient.documents) {
        updatedPatient.documents = [];
      }

      // Create standardized documents with "report" type
      const newDocuments = uploadedFiles.map((doc) => 
        exports.createStandardizedDocument(doc, "report")
      );

      // Push new standardized documents
      updatedPatient.documents.push(...newDocuments);

      // Save updated patient
      await updatedPatient.save();
    }


    if (!updatedPatient) {
      return res
        .status(404)
        .json({ success: false, message: "Nie znaleziono pacjenta" });
    }

    res.status(200).json({
      success: true,
      data: updatedPatient,
      message: "Dane pacjenta zostały zaktualizowane pomyślnie",
    });
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować danych pacjenta",
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
      return res.status(404).json({ message: "Nie znaleziono pacjenta" });
    }

    console.log("Patient details:", patient);
    // Format response to match frontend expectations
    const patientData = {
      id: patient._id,
      name: `${patient.name.first || ""} ${patient.name.last || ""}`,
      age: patient?.age || patient?.dateOfBirth ? calculateAge(patient.dateOfBirth) : null,
      gender: patient.sex,
      email: patient.email,
      phone: patient.phone,
      birthDate: patient.dateOfBirth,
      disease: patient.disease || "",
      avatar: patient.profilePicture || null,
      isInternationalPatient: patient.isInternationalPatient || false,
      notes: patient.notes || "",
      roomNumber: patient?.roomNumber || "",
      riskStatus: patient?.riskStatus || "",
      treatmentStatus: patient?.treatmentStatus || "",
      bloodPressure: patient.bloodPressure?.value || "",
      temperature: patient?.temperature || "",
      weight: patient?.weight || "",
      height: patient?.height || "",
      // New fields
      isAdult: patient.isAdult,
      contactPerson: patient.contactPerson || null,
      fatherPhone: patient.fatherPhone || "",
      motherPhone: patient.motherPhone || "",
      relationToPatient: patient.relationToPatient || "",
      allergies: patient.allergies|| "",
      nationality: patient.nationality || "",
      preferredLanguage: patient.preferredLanguage || "",
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
  consultingSpecialization: patient?.consultingSpecialization?.name || "Ogólny",

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
  if (!birthDate) return null;

  const today = new Date();
  const dob = new Date(birthDate);

  // Check if birthDate is a valid date
  if (isNaN(dob.getTime())) return null;

  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  // Adjust age if birthday hasn't occurred this year
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
      return res.status(404).json({ message: "Nie znaleziono pacjenta" });
    }

    // Find appointment by ID if provided
    let appointment = null;
    if (appointmentId) {
     
      appointment = await Appointment.findById(appointmentId)
        .populate("doctor", "name.first name.last")
        .lean();
      
      if (!appointment) {
        return res.status(404).json({ message: "Nie znaleziono wizyty" });
      }
    }

    // Format last checked date - use appointment date if available
    let lastChecked = "Nie nagrane";
    if (appointment && appointment.date) {
      const doctor = appointment.doctor
        ? `Dr. ${appointment.doctor.name.first} ${appointment.doctor.name.last}`
        : "Unknown doctor";
      const date = new Date(appointment.date).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      lastChecked = `${doctor} on ${date}`;
    } else if (patient.consultations && patient.consultations.consultationDate) {
      const doctor = patient.consultingDoctor
        ? `Dr. ${patient.consultingDoctor.name.first} ${patient.consultingDoctor.name.last}`
        : "Nie nagrane";
      const date = new Date(
        patient.consultations.consultationDate
      ).toLocaleDateString("pl-PL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      lastChecked = `${doctor} on ${date}`;
    }

    // Get health data - prefer from appointment if available
    const healthData = appointment?.healthData || patient.healthData || {};
    
    // Format blood pressure
    const bp = healthData.bloodPressure?.value || "Nie nagrane";

    // Get weight
    const weight = healthData.bodyWeight?.value 
      ? `${healthData.bodyWeight.value} kg` 
      : "Nie nagrane";

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
              )} Dni`
            : "Jak przepisano",
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
                )} Dni`
              : "Jak przepisano",
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
      name: patient.name || "Nie nagrane",
      patientId:
        patient.patientId ||
        patient.hospId ||
        `#${patient._id.toString().slice(-8)}`,
      avatar: patient.profilePicture || null,
      email: patient.email,
      phone: patient.phone || patient.phoneFormatted || "Niedostępny",
      lastChecked,
      prescription: appointment?.consultation || consultation
        ? `#${Date.now().toString().slice(-8)}`
        : "Niedostępny",
      weight,
      bp,
      pulseRate: "Normalny", // This doesn't seem to be in your model, so using a default
      observation: appointment?.consultation?.consultationNotes || consultation.consultationNotes || "Brak obserwacji",
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
    return res.status(400).json({ message: "Identyfikator wizyty jest wymagany" });
  }

  console.log("Received appointment ID:", appointmentId);
  try {
    const appointment = await Appointment.findById(appointmentId)
      .select("medications tests consultation reports healthData")
      .lean();
    
    console.log("Appointment medical details:", appointment);

    if (!appointment) {
      return res.status(404).json({ message: "Nie znaleziono wizyty" });
    }

    return res.status(200).json({
      medications: appointment.medications || [],
      tests: appointment.tests || [],
      consultation: appointment.consultation || {},
      reports: appointment.reports || [],
    });
  } catch (error) {
    console.error("Error fetching appointment medical details:", error);
    return res.status(500).json({ message: "Błąd serwera", error: error.message });
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
      // New fields
      isAdult,
      contactPerson,
      fatherPhone,
      motherPhone,
      relationToPatient,
      allergies,
      nationality,
      preferredLanguage,
    } = req.body;

    // Remove leading zeros from phone number if provided
    const phoneNumber = mobileNumber?.replace(/^0+/, '') || '';

    // Find the existing patient first
    const existingPatient = await patient.findOne({_id: patientId});
    if (!existingPatient) {
      return res.status(404).json({ error: "Nie znaleziono pacjenta" });
    }

    // Check for phone number uniqueness if being updated
    if (phoneNumber && phoneNumber !== existingPatient.phone) {
      const existingPatientByPhone = await patient.findOne({
        phone: phoneNumber,
        _id: { $ne: patientId }
      });
      if (existingPatientByPhone) {
        return res.status(409).json({
          message: "Inny pacjent z tym numerem telefonu już istnieje",
        });
      }
    }

    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Handle email - check if it's actually provided and not "undefined"
    const emailToSave = email && email !== "undefined" ? email.trim() : existingPatient.email;
    
    // If email is being updated, validate its format
    if (emailToSave !== existingPatient.email && !emailRegex.test(emailToSave)) {
      return res.status(400).json({
        message: "Nieprawidłowy format adresu email",
      });
    }
    
    // Check for email uniqueness if being updated
    if (emailToSave && emailToSave !== existingPatient.email) {
      const existingPatientByEmail = await patient.findOne({
        email: emailToSave,
        _id: { $ne: patientId }
      });
      if (existingPatientByEmail) {
        return res.status(409).json({
          message: "Inny pacjent z tym adresem email już istnieje",
        });
      }
    }

    // Handle consents validation
    const TARGET_TEXT = "Pacjent wyraża zgodę na otrzymywanie powiadomień SMS";
    let parsedConsents = [];
    let smsConsentAgreed = existingPatient.smsConsentAgreed; // Keep existing value by default

    if (consents && consents.length > 0 && consents !== "undefined") {
      try {
        const parsed = JSON.parse(consents);
        // Validate that parsed result is an array and not empty
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Additional validation to ensure each consent has required properties
          const isValidConsent = parsed.every(consent => 
            consent && 
            typeof consent === 'object' && 
            'text' in consent && 
            'agreed' in consent &&
            typeof consent.text === 'string' &&
            typeof consent.agreed === 'boolean'
          );
          
          if (isValidConsent) {
            parsedConsents = parsed;
            // Check for SMS consent
            smsConsentAgreed = parsedConsents.some(
              (consent) => consent.text === TARGET_TEXT && consent.agreed === true
            );
          } else {
            console.warn("Invalid consent format detected");
            parsedConsents = existingPatient.consents || []; // Keep existing consents if invalid
          }
        }
      } catch (error) {
        console.error("Error parsing consents:", error);
        parsedConsents = existingPatient.consents || []; // Keep existing consents if parsing fails
      }
    }

    // Use standardized document creation for uploaded files
    const newDocuments = (req.files || []).map((file) => 
      exports.createStandardizedDocument(file, "medical_record")
    );

    console.log("newDocuments",newDocuments)

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
      ...(emailToSave && { email: emailToSave }),
      smsConsentAgreed,
      ...(phoneNumber && { phone: phoneNumber }),
      ...(fatherName !== undefined && fatherName !== "undefined" && { fatherName }),
      ...(motherName !== undefined && motherName !== "undefined" && { motherName }),
      ...(spouseName !== undefined && spouseName !== "undefined" && { spouseName }),
      ...(sex !== undefined && sex !== "undefined" && { sex }),
      ...(dateOfBirth !== undefined && dateOfBirth !== "undefined" && {dateOfBirth: new Date(dateOfBirth) }),
      ...(birthWeight !== undefined && birthWeight !== "undefined" && { birthWeight }),
      ...(maritalStatus !== undefined && maritalStatus !== "undefined" && { maritalStatus }),
      ...(motherTongue !== undefined && motherTongue !== "undefined" && { motherTongue }),
      ...(religion !== undefined && religion !== "undefined" && { religion }),
      ...(ethnicity !== undefined && ethnicity !== "undefined" && { ethnicity }),
      ...(education !== undefined && education !== "undefined" && { education }),
      ...(occupation !== undefined && occupation !== "undefined" && { occupation }),
      ...(address !== undefined && address !== "undefined" && { address }),
      ...(city !== undefined && city !== "undefined" && { city }),
      ...(district !== undefined && district !== "undefined" && { district }),
      ...(state !== undefined && state !== "undefined" && { state }),
      ...(country !== undefined && country !== "undefined" && { country }),
      ...(pinCode !== undefined && pinCode !== "undefined" && { pinCode }),
      ...(alternateContact !== undefined && alternateContact !== "undefined" && { alternateContact }),
      ...(govtId !== undefined && govtId !== "undefined" && { govtId }),
      ...(isInternationalPatient !== undefined && isInternationalPatient !== "undefined" && { isInternationalPatient }),
      ...(ivrLanguage !== undefined && ivrLanguage !== "undefined" && { ivrLanguage }),
      ...(mainComplaint !== undefined && mainComplaint !== "undefined" && { mainComplaint }),
      ...(reviewNotes !== undefined && reviewNotes !== "undefined" && { reviewNotes }),
      ...(consultingSpecialization && {
        consultingSpecialization: new mongoose.Types.ObjectId(consultingSpecialization),
      }),
      ...(consultingDoctor && {
        consultingDoctor: new mongoose.Types.ObjectId(consultingDoctor),
      }),
      ...(photo !== undefined && photo !== "undefined" && { photo }),
      ...(otherHospitalIds !== undefined && otherHospitalIds !== "undefined" && { otherHospitalIds }),
      ...(referrerName !== undefined && referrerName !== "undefined" && { referrerName }),
      ...(referrerEmail !== undefined && referrerEmail !== "undefined" && { referrerEmail }),
      ...(referrerNumber !== undefined && referrerNumber !== "undefined" && { referrerNumber }),
      ...(referrerType !== undefined && referrerType !== "undefined" && { referrerType }),
      // New fields
      ...(isAdult !== undefined && isAdult !== "undefined" && { isAdult }),
      ...(contactPerson !== undefined && contactPerson !== "undefined" && { contactPerson }),
      ...(fatherPhone !== undefined && fatherPhone !== "undefined" && { fatherPhone }),
      ...(motherPhone !== undefined && motherPhone !== "undefined" && { motherPhone }),
      ...(relationToPatient !== undefined && relationToPatient !== "undefined" && { relationToPatient }),
      ...(allergies !== undefined && allergies !== "undefined" && { allergies }),
      ...(nationality !== undefined && nationality !== "undefined" && { nationality }),
      ...(preferredLanguage !== undefined && preferredLanguage !== "undefined" && { preferredLanguage }),
    };

    // Handle consents update - only if we have valid parsed consents
    if (parsedConsents.length > 0) {
      updateData.consents = parsedConsents;
    }

    // Handle documents update - append new documents to existing ones
    if (newDocuments.length > 0) {
      updateData.$push = { documents: { $each: newDocuments } };
    }

    // Update patient with new data
    const updatedPatient = await patient.findOneAndUpdate(
      {_id: patientId},
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ error: "Nie znaleziono pacjenta" });
    }

    res.status(200).json({
      message: "Dane pacjenta zostały zaktualizowane pomyślnie",
      patient: updatedPatient,
    });
  } catch (error) {
    console.error("Update patient error:", error);
    res
      .status(500)
      .json({ error: "Błąd wewnętrzny serwera", details: error.message });
  }
};

// Delete a specific document from patient's documents array
exports.deletePatientDocument = async (req, res) => {
  try {
    const { patientId, documentId } = req.params;

    // Validate MongoDB IDs
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format"
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: "Document ID is required"
      });
    }

    // Delete the document
    const updatedPatient = await exports.deleteDocumentById(patientId, documentId);

    if (!updatedPatient) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono pacjenta"
      });
    }

    res.status(200).json({
      success: true,
      message: "Dokument został pomyślnie usunięty",
      patient: updatedPatient
    });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się usunąć dokumentu",
      error: error.message
    });
  }
};

// Get all documents for a specific patient
exports.getPatientDocuments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { documentType, limit = 50, page = 1 } = req.query;

    // Validate MongoDB ID
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format"
      });
    }

    // Build query
    const query = { _id: patientId };
    
    // Find patient
    const patientData = await patient.findById(patientId).select('documents name patientId').lean();
    
    if (!patientData) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono pacjenta"
      });
    }

    let documents = patientData.documents || [];

    // Filter by document type if specified
    if (documentType && documentType !== 'all') {
      documents = documents.filter(doc => doc.documentType === documentType);
    }

    // Sort by upload date (newest first)
    documents.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedDocuments = documents.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      count: paginatedDocuments.length,
      total: documents.length,
      pages: Math.ceil(documents.length / parseInt(limit)),
      currentPage: parseInt(page),
      patient: {
        id: patientData._id,
        name: patientData.name,
        patientId: patientData.patientId
      },
      documents: paginatedDocuments
    });
  } catch (error) {
    console.error("Error fetching patient documents:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać dokumentów pacjenta",
      error: error.message
    });
  }
};

// Fix existing PDF documents with broken URLs
exports.fixPatientDocumentUrls = async (req, res) => {
  try {
    const { patientId } = req.params;

    // Validate MongoDB ID
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format"
      });
    }

    // Find patient
    const patientData = await patient.findById(patientId);
    
    if (!patientData) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono pacjenta"
      });
    }

    let fixedCount = 0;

    // Fix document URLs
    if (patientData.documents && patientData.documents.length > 0) {
      patientData.documents = patientData.documents.map(doc => {
        if (doc.isPdf && doc.url && !doc.url.includes('.pdf') && doc.fileName) {
          const fileExtension = doc.fileName.split('.').pop().toLowerCase();
          if (fileExtension === 'pdf' && doc.url.includes('cloudinary.com')) {
            doc.url = `${doc.url}.pdf`;
            doc.downloadUrl = `${doc.url}`;
            doc.preview = `${doc.url}`;
            doc.fileExtension = 'pdf';
            doc.updatedAt = new Date();
            fixedCount++;
          }
        }
        return doc;
      });
    }

    // Save the updated patient
    await patientData.save();

    res.status(200).json({
      success: true,
      message: `Fixed ${fixedCount} document URLs`,
      fixedCount: fixedCount,
      totalDocuments: patientData.documents?.length || 0
    });
  } catch (error) {
    console.error("Error fixing document URLs:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się naprawić adresów URL dokumentów",
      error: error.message
    });
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
      .populate("patient", "name patientId dateOfBirth sex profilePicture username email phone")
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
        email: appointment.patient?.email || "Nieokreślony",
        phone: appointment.patient?.phone || "Nieokreślony",
        sex: appointment.patient?.sex || "Nieokreślony",
        isCheckedIn: appointment.checkedIn || false,
        dateOfBirth: appointment.patient?.dateOfBirth || "Nieokreślony",
        age,
        avatar: appointment.patient?.profilePicture || "",
        disease: appointment.consultation?.description || "Nieokreślony",
        status: appointment.status || "zarezerwowane",
        doctor: doctorName,
        _id: appointment._id,
        patient_id: appointment.patient?._id,
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
      message: "Nie udało się pobrać listy wizyt",
      error: error.message,
    });
  }
};