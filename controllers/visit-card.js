const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Patient = require("../models/user-entity/patient");
const Appointment = require("../models/appointment");
const cloudinary = require("../utils/cloudinary");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/user-entity/user");
const mongoose = require("mongoose");

/**
 * Generate a visit card PDF for a patient based on appointment
 * @param {Object} req - Express request object with appointmentId parameter
 * @param {Object} res - Express response object
 * @returns {Object} JSON with download URL
 */
exports.generateVisitCard = async (req, res) => {
  try {
    // Function to normalize Polish characters
    const normalizePolishText = (text) => {
      if (!text) return '';
      
      const polishCharMap = {
        'ą': 'a', 'Ą': 'A',
        'ć': 'c', 'Ć': 'C',
        'ę': 'e', 'Ę': 'E',
        'ł': 'l', 'Ł': 'L',
        'ń': 'n', 'Ń': 'N',
        'ó': 'o', 'Ó': 'O',
        'ś': 's', 'Ś': 'S',
        'ź': 'z', 'Ź': 'Z',
        'ż': 'z', 'Ż': 'Z'
      };
      
      return text.replace(/[ąĄćĆęĘłŁńŃóÓśŚźŹżŻ]/g, (match) => polishCharMap[match] || match);
    };

    // Get appointment ID from parameters
    const appointmentId = req.params.appointmentId;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    // Find the appointment with populated patient and doctor data
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name dateOfBirth address city pinCode phone phoneFormatted documents")
      .populate("doctor", "name.first name.last")
      .exec();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Get the patient from appointment
    const patient = appointment.patient;
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found in appointment",
      });
    }

    const visitDate = appointment.date
    ? new Date(appointment.date).toLocaleDateString("en-GB")
    : new Date().toLocaleDateString("en-GB");

    // Get consultation data from appointment
    const consultationData = appointment.consultation || {};

    // Create a unique filename
    const filename = `visit_card_${patient._id}_${uuidv4()}.pdf`;
    const tempFilePath = path.join(__dirname, "..", "temp", filename);

    // Make sure temp directory exists
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create a PDF document
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: normalizePolishText(`karta_wizyty_[${patient.name?.first || ""} ${
          patient.name?.last || ""
        }][${visitDate}]_CM7`),
        Author: "Hospital Management System",
      },
    });

    // Function to safely add text with normalized Polish characters
    const addText = (text, x, y, options = {}) => {
      const normalizedText = normalizePolishText(text);
      return doc.text(normalizedText, x, y, options);
    };

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    // Load logo
    const logoPath = path.join(__dirname, "../public/logo_new.png");

    // Format visit time
    const visitTime = appointment.startTime || 
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

    // Get doctor's name
    let doctorName = "Dr. ";
    if (appointment.doctor) {
      doctorName += `${appointment.doctor.name.first} ${appointment.doctor.name.last}`;
    } else {
      doctorName += req.user.name.first + " " + req.user.name.last;
    }

    // Get patient's full name
    const patientName = `${patient.name?.first || ""} ${
      patient.name?.last || ""
    }`;

    // Get patient's date of birth
    const dob = patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toLocaleDateString("en-GB")
      : "Not provided";

    // Get patient's address
    const address = patient.address
      ? `${patient.address}, ${patient.city || ""} ${patient.pinCode || ""}`
      : "Not provided";

    // Get patient's phone
    const phone = patient.phone || patient.phoneFormatted || "Not provided";

    // Add logo
    if (fs.existsSync(logoPath)) {
      const logoWidth = 160;
      const topPosition = 20;
    
      // Center the logo horizontally
      const startX = (doc.page.width - logoWidth) / 2;
    
      doc.image(logoPath, startX, topPosition, { width: logoWidth });
    } else {
      // If no logo, just display text in center position with black color
      doc
        .fillColor("black")
        .fontSize(20);
      addText("Centrum Medyczne", doc.page.width / 2 - 80, 40);
    }

    // Add visit information
    doc.moveDown(2);
    doc.fontSize(10);
    addText(`Data wizyty: ${visitDate}`, 50, 100);
    addText(`Godzina wizyty: ${visitTime}`, 50, 115);
    addText(`Lekarz: ${doctorName}`, 50, 130);
    
    // Informacje o pacjencie
    addText(`Imie i nazwisko: ${patientName}`, doc.page.width - 240, 100);
    addText(`Data urodzenia: ${dob}`, doc.page.width - 240, 115);
    addText(`Adres: ${address}`, doc.page.width - 240, 130);
    addText(`Numer telefonu: ${phone}`, doc.page.width - 240, 145);

    // Add visit card title
    doc.fontSize(16);
    addText("Visit Card/ Karta Wizyty", doc.page.width / 2 - 80, 170);

    // Add consultation sections
    doc.fontSize(11);
    let yPosition = 210;
    const lineHeight = 15;
    const sectionSpacing = 10;

    // Interview section
    doc.font("Helvetica-Bold");
    addText("Interview with the patient/ Wywiad z pacjentem", 50, yPosition);
    yPosition += lineHeight;
    doc.font("Helvetica");
    addText(
      consultationData.interview || "No interview data available",
      50,
      yPosition
    );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Physical examination section
    doc.font("Helvetica-Bold");
    addText("Physical examination/ Badanie przedmiotowe", 50, yPosition);
    yPosition += lineHeight;
    doc.font("Helvetica");
    addText(
      consultationData.physicalExamination || "No examination data available",
      50,
      yPosition
    );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Treatment section
    doc.font("Helvetica-Bold");
    addText("The treatment used/ Zastosowane leczenie", 50, yPosition);
    yPosition += lineHeight;
    doc.font("Helvetica");
    addText(
      consultationData.treatment || "No treatment data available",
      50,
      yPosition
    );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Recommendations section
    doc.font("Helvetica-Bold");
    addText("Recommendations/ Zalecenia", 50, yPosition);
    yPosition += lineHeight;
    doc.font("Helvetica");
    addText(
      consultationData.recommendations || "No recommendations available",
      50,
      yPosition
    );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Notes section
    doc.font("Helvetica-Bold");
    addText("Notes/ Notatki", 50, yPosition);
    yPosition += lineHeight;
    doc.font("Helvetica");
    addText(
      consultationData.description || "No notes available",
      50,
      yPosition
    );

    // Finalize the PDF
    doc.end();

    // Wait for the stream to finish
    await new Promise((resolve, reject) => {
      stream.on("finish", resolve);
      stream.on("error", reject);
    });

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        tempFilePath,
        {
          folder: "hospital_app/images",
          resource_type: "raw", // required for non-image files like PDFs
          type: "upload",       // ensures it's treated as an uploaded file
          use_filename: true,
          unique_filename: true,
          access_mode:"public",
          public_id: filename.replace(".pdf", ""), // remove .pdf for public_id
          format: "pdf",        // not needed if it's already a .pdf file
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
    });
  
    // Delete the temporary file
    fs.unlinkSync(tempFilePath);

    // Create a report for the appointment
    const newReport = {
      name: `Visit Card - ${visitDate}`,
      type: "Visit Card",
      fileUrl: result.secure_url,
      fileType: "pdf",
      description: `Visit card generated for appointment on ${visitDate}`,
      uploadedAt: new Date(),
      metadata: {
        originalName: filename,
        cloudinaryId: result.public_id,
        appointmentId: appointmentId,
        patientId: patient._id.toString()
      }
    };

    // Add report to appointment
    if (!appointment.reports) {
      appointment.reports = [];
    }
    appointment.reports.push(newReport);
    await appointment.save();

    // Save the document reference to the patient as well for backward compatibility
    const patientDoc = await Patient.findById(patient._id);
    if (patientDoc) {
      if (!patientDoc.documents) {
        patientDoc.documents = [];
      }

      patientDoc.documents.push({
        type: "visit-card",
        url: result.secure_url,
        publicId: result.public_id,
        createdAt: new Date(),
        appointmentId: appointmentId
      });

      await patientDoc.save();
    }

    // Return the download URL
    return res.status(200).json({
      success: true,
      message: "Visit card generated successfully",
      data: {
        url: result.secure_url,
        reportId: appointment.reports[appointment.reports.length - 1]._id,
        appointmentId: appointmentId
      },
    });
  } catch (error) {
    console.error("Error generating visit card:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate visit card",
      error: error.message,
    });
  }
};

/**
 * Get visit cards by appointment ID
 * @param {Object} req - Express request object with appointmentId parameter
 * @param {Object} res - Express response object
 * @returns {Object} JSON with visit card URL
 */
exports.getVisitCardByAppointment = async (req, res) => {
  try {
    const appointmentId = req.params.appointmentId;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "_id role")
      .exec();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }
    console.log("appointment",req.user)

    // Check if user is authorized to access this appointment's data
    if (appointment.patient.role === "patient" && req.user.id.toString() !== appointment.patient.id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this appointment's data",
      });
    }

    // Find the visit cards in appointment reports
    const visitCards = appointment.reports?.filter(report => 
      report.type === "Visit Card" || report.type === "visit-card"
    ) || [];

    if (visitCards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No visit cards found for this appointment",
      });
    }

    // Return the most recent visit card
    const latestVisitCard = visitCards.sort(
      (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
    )[0];

    return res.status(200).json({
      success: true,
      data: {
        url: latestVisitCard.fileUrl,
        reportId: latestVisitCard._id,
        createdAt: latestVisitCard.uploadedAt,
        type: latestVisitCard.type,
        name: latestVisitCard.name
      },
    });
  } catch (error) {
    console.error("Error fetching visit card:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visit card",
      error: error.message,
    });
  }
};

// Keep the original getVisitCard function for backward compatibility
exports.getVisitCard = async (req, res) => {
  try {
    const patientId = req.params.patientId;

    // Check if user is authorized to access this patient's data
    if (req.user.role === "patient" && req.user._id.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized access to this patient's data",
      });
    }

    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    // Find the visit cards in patient documents
    const visitCards =
      patient.documents?.filter((doc) => doc.type === "visit-card") || [];

    if (visitCards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No visit cards found for this patient",
      });
    }

    // Return the most recent visit card
    const latestVisitCard = visitCards.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    )[0];

    return res.status(200).json({
      success: true,
      data: {
        url: latestVisitCard.url,
        documentId: latestVisitCard._id,
        createdAt: latestVisitCard.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching visit card:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visit card",
      error: error.message,
    });
  }
};
