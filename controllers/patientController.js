const bcrypt = require("bcrypt");
const patient = require("../models/user-entity/patient");
const { default: mongoose } = require("mongoose");
const doctor = require("../models/user-entity/doctor");

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
      consultingDepartment,
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
      filename: file.filename,
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

    const newPatient = new patient({
      name: {
        first: fullName.split(" ")[0],
        last: fullName.split(" ").slice(1).join(" "),
      },
      email: req.body.email,
      patientId:`P-${new Date().getTime()}`,
      phone: req.body.mobileNumber,
      password: "defaultPassword123",
      role: "patient",
      signupMethod: "email",
      profilePicture: null,
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
      isInternationalPatient,
      ivrLanguage,
      mainComplaint,
      reviewNotes,
      consultingDepartment,
      consultingDoctor:new mongoose.Types.ObjectId(consultingDoctor),
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
    const patients = await patient.find().populate("doctor", "name id");
    res.status(200).json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Server error while fetching patients" });
  }
};

// Get a patient by ID
exports.getPatientById = async (req, res) => {
  try {
    const info = await patient.findOne({ patientId: req.params.id }).lean();

    if (!info) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const transformedInfo = {
      ...info,
      documents: Array.isArray(info.documents)
        ? info.documents.map((doc) => doc.path)
        : [],
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
      maxAge
    } = req.query;

    // Build the filter query
    const query = {};
    
    // Search by name, username, or patientId
    if (search) {
      query.$or = [
        { "name.first": { $regex: search, $options: "i" } },
        { "name.last": { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
        { mainComplaint: { $regex: search, $options: "i" } }
      ];
    }
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Filter by doctor if provided
    if (doctor) {
      query.consultingDoctor = doctor;
    }
    
    // Filter by sex if provided
    if (sex) {
      query.sex = sex;
    }
    
    // Filter by age range if provided
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
        sex: patient.sex || "Not specified",
        age,
        avatar: patient?.profilePicture || "",
        disease: patient.mainComplaint || "Not specified",
        status: patient.status || "in-treatment",
        doctor: doctorName,
        _id: patient._id // Include the MongoDB ID for reference
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
