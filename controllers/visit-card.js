const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const Patient = require("../models/user-entity/patient");
const cloudinary = require("../utils/cloudinary");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/user-entity/user");

/**
 * Generate a visit card PDF for a patient
 * @param {Object} req - Express request object with patientId parameter and consultation details
 * @param {Object} res - Express response object
 * @returns {Object} JSON with download URL
 */
exports.generateVisitCard = async (req, res) => {
  try {
    // Find the patient
    const patientId = req.params.patientId;
    const patient = await Patient.findById(patientId)
      .populate("consultingDoctor", "name.first name.last")
      .exec();

    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // Get consultation data from request or use the latest consultation
    let consultationData = req.body;
    if (!consultationData?.consultationDate) {
      if (patient.consultations && Array.isArray(patient.consultations)) {
        // If patient has consultations array, sort and get the latest
        const latestConsultation = patient.consultations.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )[0];
        consultationData = latestConsultation || {};
      } else if (patient.consultations) {
        // If patient has a single consultation object
        consultationData = patient.consultations;
      }
    }

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
        Title: `Visit Card - ${patient.name?.first || ""} ${
          patient.name?.last || ""
        }`,
        Author: "Hospital Management System",
      },
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    // Load logo
    const logoPath = path.join(__dirname, "../public/logo_teal.png");

    // Format visit date
    const visitDate = consultationData.consultationDate
      ? new Date(consultationData.consultationDate).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB");

    // Format visit time
    const visitTime =
      consultationData.consultationTime ||
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

    // Get doctor's name
    let doctorName = "Dr. ";
    if (patient.consultingDoctor) {
      doctorName += `${patient.consultingDoctor.name.first} ${patient.consultingDoctor.name.last}`;
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

    // Draw border
    doc
      .rect(20, 20, doc.page.width - 40, doc.page.height - 40)
      .dash(5, { space: 10 }) // Create a dashed line
      .stroke();

    // Add logo
if (fs.existsSync(logoPath)) {
  // Set dimensions
  const logoWidth = 50;
  const textWidth = 160; // Approximate width of "Centrum Medyczne" text
  const spacing = 20; // Space between logo and text
  const totalWidth = logoWidth + spacing + textWidth;
  const topPosition = 40; // Vertical position

  // Calculate center positioning
  const startX = (doc.page.width - totalWidth) / 2;

  // Position the logo on the left of the centered group
  doc.image(logoPath, startX, topPosition, { width: logoWidth });

  // Position the text to the right of the logo
  doc
    .fillColor("black")
    .fontSize(20)
    .text("Centrum Medyczne", startX + logoWidth + spacing, topPosition + 15); // Align text vertically with logo
} else {
  // If no logo, just display text in center position with black color
  doc
    .fillColor("black")
    .fontSize(20)
    .text("Centrum Medyczne", doc.page.width / 2 - 80, 40);
}
    // Add visit information
    doc.moveDown(2);
    doc.fontSize(10);
    doc.text(`Data of visite: ${visitDate}`, 50, 100);
    doc.text(`Time of visite: ${visitTime}`, 50, 115);
    doc.text(`Doctor: ${doctorName}`, 50, 130);

    // Add patient information
    doc.text(`Name and Surname: ${patientName}`, doc.page.width - 240, 100);
    doc.text(`Date fo birth: ${dob}`, doc.page.width - 240, 115);
    doc.text(`Address: ${address}`, doc.page.width - 240, 130);
    doc.text(`Phone number: ${phone}`, doc.page.width - 240, 145);

    // Add visit card title
    doc
      .fontSize(16)
      .text("Visit Card/ Karta Wizyty", doc.page.width / 2 - 80, 170);

    // Add consultation sections
    doc.fontSize(11);
    let yPosition = 210;
    const lineHeight = 15;
    const sectionSpacing = 10;

    // Interview section
    doc
      .font("Helvetica-Bold")
      .text("Interview with the patient/ Wywiad z pacjentem", 50, yPosition);
    yPosition += lineHeight;
    doc
      .font("Helvetica")
      .text(
        consultationData.interview || "Text from the text pole",
        50,
        yPosition
      );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Physical examination section
    doc
      .font("Helvetica-Bold")
      .text("Physical examination/ Badanie przedmiotowe", 50, yPosition);
    yPosition += lineHeight;
    doc
      .font("Helvetica")
      .text(
        consultationData.physicalExamination || "Text from the text pole",
        50,
        yPosition
      );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Treatment section
    doc
      .font("Helvetica-Bold")
      .text("The treatment used/ Zastosowane leczenie", 50, yPosition);
    yPosition += lineHeight;
    doc
      .font("Helvetica")
      .text(
        consultationData.treatment || "Text from the text pole",
        50,
        yPosition
      );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Recommendations section
    doc
      .font("Helvetica-Bold")
      .text("Recommendations/ Zalecenia", 50, yPosition);
    yPosition += lineHeight;
    doc
      .font("Helvetica")
      .text(
        consultationData.recommendations || "Text from the text pole",
        50,
        yPosition
      );
    yPosition += lineHeight * 2 + sectionSpacing;

    // Notes section
    doc.font("Helvetica-Bold").text("Notes/ Notatki", 50, yPosition);
    yPosition += lineHeight;
    doc
      .font("Helvetica")
      .text(
        consultationData.consultationNotes || "Text from the text pole",
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

    // Save the document reference to the patient
    if (!patient.documents) {
      patient.documents = [];
    }

    patient.documents.push({
      type: "visit-card",
      url: result.secure_url,
      publicId: result.public_id,
      createdAt: new Date(),
      consultationId: consultationData._id || undefined,
    });

    await patient.save();

    // Return the download URL
    return res.status(200).json({
      success: true,
      message: "Visit card generated successfully",
      data: {
        url: result.secure_url,
        documentId: patient.documents[patient.documents.length - 1]._id,
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
 * Get visit card by patient ID
 * @param {Object} req - Express request object with patientId parameter
 * @param {Object} res - Express response object
 * @returns {Object} JSON with visit card URL
 */
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
