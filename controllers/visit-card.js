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
        message: "Nieprawidłowy format ID wizyty",
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
        message: "Wizyta nie znaleziona",
      });
    }

    // Get the patient from appointment
    const patient = appointment.patient;
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Pacjent nie znaleziony w wizycie",
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
        Author: "Centrum Medyczne 7",
      },
    });

    // Function to safely add text with normalized Polish characters
    const addText = (text, options = {}) => {
      const normalizedText = normalizePolishText(text);
      return doc.text(normalizedText, options);
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
    const patientName = `${patient.name?.first || ""} ${patient.name?.last || ""}`.trim();

    // Get patient's date of birth
    const dob = patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toLocaleDateString("en-GB")
      : "Nie dostarczone";

    // Get patient's address
    const address = patient.address
      ? `${patient.address}, ${patient.city || ""} ${patient.pinCode || ""}`
      : "Nie dostarczone";

    // Get patient's phone
    const phone = patient.phone || patient.phoneFormatted || "Nie dostarczone";

    // Add logo
    if (fs.existsSync(logoPath)) {
      const logoWidth = 160;
      const topPosition = 20;
      const startX = (doc.page.width - logoWidth) / 2;
      doc.image(logoPath, startX, topPosition, { width: logoWidth });
    } else {
      doc.fillColor("black").fontSize(20);
      addText("Centrum Medyczne", { 
        x: doc.page.width / 2 - 80, 
        y: 40 
      });
    }

    // Move to header section
    doc.y = 100;
    doc.fontSize(10);

    // Calculate column widths
    const pageWidth = doc.page.width - (doc.options.margin * 2);
    const columnWidth = pageWidth / 2 - 10; // 10px gap between columns
    const leftColumnX = doc.options.margin;
    const rightColumnX = doc.options.margin + columnWidth + 20;

    // Save current position
    const headerStartY = doc.y;

    // LEFT COLUMN - Visit Information
    doc.x = leftColumnX;
    doc.y = headerStartY;
    
    addText(`Data wizyty: ${visitDate}`, { 
      width: columnWidth,
      continued: false 
    });
    doc.moveDown(0.5);
    
    addText(`Godzina wizyty: ${visitTime}`, { 
      width: columnWidth,
      continued: false 
    });
    doc.moveDown(0.5);
    
    addText(`Lekarz: ${doctorName}`, { 
      width: columnWidth,
      continued: false 
    });

    // RIGHT COLUMN - Patient Information
    doc.x = rightColumnX;
    doc.y = headerStartY;
    
    addText(`Imię i nazwisko: ${patientName}`, { 
      width: columnWidth,
      continued: false 
    });
    doc.moveDown(0.5);
    
    addText(`Data urodzenia: ${dob}`, { 
      width: columnWidth,
      continued: false 
    });
    doc.moveDown(0.5);
    
    addText(`Adres: ${address}`, { 
      width: columnWidth,
      continued: false 
    });
    doc.moveDown(0.5);
    
    addText(`Numer telefonu: ${phone}`, { 
      width: columnWidth,
      continued: false 
    });

    // Reset to full width and add title
    doc.x = doc.options.margin;
    doc.y = Math.max(doc.y, headerStartY + 80); // Ensure we're below both columns
    doc.moveDown(1);

    doc.fontSize(16);
    addText("Visit Card/ Karta Wizyty", { 
      align: 'center',
      width: pageWidth 
    });

    doc.moveDown(2);
    doc.fontSize(11);

    // Helper to add a section with automatic page break
    const addSection = (title, content) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
        doc.y = 80;
      }

      doc.font("Helvetica-Bold");
      addText(title, { 
        width: pageWidth,
        align: "left" 
      });
      
      doc.moveDown(0.3);
      doc.font("Helvetica");
      
      addText(content, { 
        width: pageWidth,
        align: "left" 
      });
      
      doc.moveDown(1);
    };

    // Add each section
    addSection(
      "Wywiad z pacjentem",
      consultationData.interview || "Brak danych wywiadu"
    );
    
    addSection(
      "Badanie przedmiotowe",
      consultationData.physicalExamination || "Brak danych badania"
    );
    
    addSection(
      "Zastosowane leczenie",
      consultationData.treatment || "Brak danych leczenia"
    );
    
    addSection(
      "Zalecenia",
      consultationData.recommendations || "Brak zaleceń"
    );
    
    addSection(
      "Notatki",
      consultationData.description || "Brak notatek"
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
          resource_type: "raw",
          type: "upload",
          use_filename: true,
          unique_filename: true,
          access_mode:"public",
          public_id: `karta_wizyty_[${patient.name?.first || ""} ${
          patient.name?.last || ""
        }][${visitDate}]_CM7`,
          format: "pdf",
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
      name: `Karta wizyty - ${visitDate}`,
      type: "visit-card",
      fileUrl: result.secure_url,
      fileType: "pdf",
      description: `Karta wizyty wygenerowana dla wizyty z dnia ${visitDate}`,
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
      message: "Karta wizyty wygenerowana pomyślnie",
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
      message: "Nie udało się wygenerować karty wizyty",
      error: error.message,
    });
  }
};


// exports.generateVisitCard = async (req, res) => {
//   try {

//     // Get appointment ID from parameters
//     const appointmentId = req.params.appointmentId;

//     if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid appointment ID format",
//       });
//     }

//     // Find the appointment with populated patient and doctor data
//     const appointment = await Appointment.findById(appointmentId)
//       .populate("patient", "name dateOfBirth address city pinCode phone phoneFormatted documents")
//       .populate("doctor", "name.first name.last")
//       .exec();

//     if (!appointment) {
//       return res.status(404).json({
//         success: false,
//         message: "Appointment not found",
//       });
//     }

//     // Get the patient from appointment
//     const patient = appointment.patient;
//     if (!patient) {
//       return res.status(404).json({
//         success: false,
//         message: "Patient not found in appointment",
//       });
//     }

//     const visitDate = appointment.date
//       ? new Date(appointment.date).toLocaleDateString("pl-PL")
//       : new Date().toLocaleDateString("pl-PL");

//     // Get consultation data from appointment
//     const consultationData = appointment.consultation || {};

//     // Create a unique filename
//     const filename = `visit_card_${patient._id}_${uuidv4()}.pdf`;
//     const tempFilePath = path.join(__dirname, "..", "temp", filename);

//     // Make sure temp directory exists
//     const tempDir = path.join(__dirname, "..", "temp");
//     if (!fs.existsSync(tempDir)) {
//       fs.mkdirSync(tempDir, { recursive: true });
//     }

//     // Format visit time
//     const visitTime = appointment.startTime || 
//       new Date().toLocaleTimeString("pl-PL", {
//         hour: "2-digit",
//         minute: "2-digit",
//       });

//     // Get doctor's name
//     let doctorName = "Dr. ";
//     if (appointment.doctor) {
//       doctorName += `${appointment.doctor.name.first} ${appointment.doctor.name.last}`;
//     } else {
//       doctorName += req.user.name.first + " " + req.user.name.last;
//     }

//     // Get patient's full name
//     const patientName = `${patient.name?.first || ""} ${patient.name?.last || ""}`.trim();

//     // Get patient's date of birth
//     const dob = patient.dateOfBirth
//       ? new Date(patient.dateOfBirth).toLocaleDateString("pl-PL")
//       : "Nie podano";

//     // Get patient's address
//     const address = patient.address
//       ? `${patient.address}, ${patient.city || ""} ${patient.pinCode || ""}`
//       : "Nie podano";

//     // Get patient's phone
//     const phone = patient.phone || patient.phoneFormatted || "Nie podano";

//     // Load logo as base64
//     const logoPath = path.join(__dirname, "../public/logo_new.png");
//     let logoBase64 = '';
//     if (fs.existsSync(logoPath)) {
//       const logoBuffer = fs.readFileSync(logoPath);
//       logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
//     }

//     // Create HTML content
//     const htmlContent = `
//     <!DOCTYPE html>
//     <html lang="pl">
//     <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <title>Karta Wizyty - ${patientName} - ${visitDate}</title>
//         <style>
//             @page {
//                 size: A4;
//                 margin: 50px;
//             }
            
//             * {
//                 margin: 0;
//                 padding: 0;
//                 box-sizing: border-box;
//             }
            
//             body {
//                 font-family: 'Arial', sans-serif;
//                 font-size: 10px;
//                 line-height: 1.4;
//                 color: #000;
//                 background: white;
//             }
            
//             .container {
//                 width: 100%;
//                 max-width: 100%;
//             }
            
//             .logo-section {
//                 text-align: center;
//                 margin-bottom: 30px;
//                 padding-top: 20px;
//             }
            
//             .logo {
//                 max-width: 160px;
//                 height: auto;
//             }
            
//             .header-section {
//                 display: flex;
//                 justify-content: space-between;
//                 margin-bottom: 40px;
//                 gap: 20px;
//             }
            
//             .header-column {
//                 flex: 1;
//             }
            
//             .header-item {
//                 margin-bottom: 8px;
//             }
            
//             .title {
//                 font-size: 16px;
//                 font-weight: bold;
//                 text-align: center;
//                 margin: 40px 0;
//             }
            
//             .section {
//                 margin-bottom: 25px;
//                 page-break-inside: avoid;
//             }
            
//             .section-title {
//                 font-weight: bold;
//                 font-size: 11px;
//                 margin-bottom: 5px;
//                 color: #000;
//             }
            
//             .section-content {
//                 font-size: 11px;
//                 line-height: 1.5;
//                 text-align: justify;
//                 min-height: 20px;
//             }
            
//             .page-break {
//                 page-break-before: always;
//             }
//         </style>
//     </head>
//     <body>
//         <div class="container">
//             <!-- Logo Section -->
//             <div class="logo-section">
//                 ${logoBase64 ? `<img src="${logoBase64}" class="logo" alt="Logo">` : '<div style="font-size: 20px; font-weight: bold;">Centrum Medyczne</div>'}
//             </div>
            
//             <!-- Header Section -->
//             <div class="header-section">
//                 <div class="header-column">
//                     <div class="header-item">Data wizyty: ${visitDate}</div>
//                     <div class="header-item">Godzina wizyty: ${visitTime}</div>
//                     <div class="header-item">Lekarz: ${doctorName}</div>
//                 </div>
//                 <div class="header-column">
//                     <div class="header-item">Imię i nazwisko: ${patientName}</div>
//                     <div class="header-item">Data urodzenia: ${dob}</div>
//                     <div class="header-item">Adres: ${address}</div>
//                     <div class="header-item">Numer telefonu: ${phone}</div>
//                 </div>
//             </div>
            
//             <!-- Title -->
//             <div class="title">Karta Wizyty</div>
            
//             <!-- Sections -->
//             <div class="section">
//                 <div class="section-title">Wywiad z pacjentem</div>
//                 <div class="section-content">${consultationData.interview || "Brak danych wywiadu"}</div>
//             </div>
            
//             <div class="section">
//                 <div class="section-title">Badanie przedmiotowe</div>
//                 <div class="section-content">${consultationData.physicalExamination || "Brak danych badania"}</div>
//             </div>
            
//             <div class="section">
//                 <div class="section-title">Zastosowane leczenie</div>
//                 <div class="section-content">${consultationData.treatment || "Brak danych leczenia"}</div>
//             </div>
            
//             <div class="section">
//                 <div class="section-title">Zalecenia</div>
//                 <div class="section-content">${consultationData.recommendations || "Brak zaleceń"}</div>
//             </div>
            
//             <div class="section">
//                 <div class="section-title">Notatki</div>
//                 <div class="section-content">${consultationData.description || "Brak notatek"}</div>
//             </div>
//         </div>
//     </body>
//     </html>
//     `;

//     // Function to find Chrome executable
//     const findChrome = () => {
//       const possiblePaths = [
//         // Windows paths
//         'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
//         'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
//         process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
//         // macOS paths
//         '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
//         '/Applications/Chromium.app/Contents/MacOS/Chromium',
//         // Linux paths
//         '/usr/bin/google-chrome',
//         '/usr/bin/google-chrome-stable',
//         '/usr/bin/chromium',
//         '/usr/bin/chromium-browser',
//         '/snap/bin/chromium',
//         // Heroku buildpack path
//         process.env.GOOGLE_CHROME_BIN,
//         // Railway/Docker paths
//         '/usr/bin/google-chrome-stable',
//         '/usr/bin/chromium-browser'
//       ];

//       for (const path of possiblePaths) {
//         if (path && fs.existsSync(path)) {
//           return path;
//         }
//       }
      
//       // If no path found, try to use system PATH
//       return null;
//     };

//     const chromePath = findChrome();
//     if (!chromePath) {
//       throw new Error('Chrome/Chromium executable not found. Please install Google Chrome or set GOOGLE_CHROME_BIN environment variable.');
//     }

//     // Launch Puppeteer
//     const browser = await puppeteer.launch({
//       executablePath: chromePath,
//       headless: true,
//       args: [
//         '--no-sandbox',
//         '--disable-setuid-sandbox',
//         '--disable-dev-shm-usage',
//         '--disable-accelerated-2d-canvas',
//         '--no-first-run',
//         '--no-zygote',
//         '--disable-gpu',
//         '--disable-extensions',
//         '--disable-background-timer-throttling',
//         '--disable-backgrounding-occluded-windows',
//         '--disable-renderer-backgrounding'
//       ]
//     });

//     const page = await browser.newPage();
    
//     // Set content and generate PDF
//     await page.setContent(htmlContent, { 
//       waitUntil: 'networkidle0',
//       timeout: 30000 
//     });

//     const pdfBuffer = await page.pdf({
//       format: 'A4',
//       printBackground: true,
//       margin: {
//         top: '50px',
//         right: '50px',
//         bottom: '50px',
//         left: '50px'
//       }
//     });

//     await browser.close();

//     // Write PDF to temp file
//     fs.writeFileSync(tempFilePath, pdfBuffer);

//     // Upload to Cloudinary
//     const result = await new Promise((resolve, reject) => {
//       cloudinary.uploader.upload(
//         tempFilePath,
//         {
//           folder: "hospital_app/images",
//           resource_type: "raw",
//           type: "upload",
//           use_filename: true,
//           unique_filename: true,
//           access_mode: "public",
//           public_id: filename.replace(".pdf", ""),
//           format: "pdf",
//         },
//         (error, result) => {
//           if (error) reject(error);
//           else resolve(result);
//         }
//       );
//     });

//     // Delete the temporary file
//     fs.unlinkSync(tempFilePath);

//     // Create a report for the appointment
//     const newReport = {
//       name: `Karta Wizyty - ${visitDate}`,
//       type: "Karta Wizyty",
//       fileUrl: result.secure_url,
//       fileType: "pdf",
//       description: `Karta wizyty wygenerowana dla wizyty z dnia ${visitDate}`,
//       uploadedAt: new Date(),
//       metadata: {
//         originalName: filename,
//         cloudinaryId: result.public_id,
//         appointmentId: appointmentId,
//         patientId: patient._id.toString()
//       }
//     };

//     // Add report to appointment
//     if (!appointment.reports) {
//       appointment.reports = [];
//     }
//     appointment.reports.push(newReport);
//     await appointment.save();

//     // Save the document reference to the patient as well for backward compatibility
//     const patientDoc = await Patient.findById(patient._id);
//     if (patientDoc) {
//       if (!patientDoc.documents) {
//         patientDoc.documents = [];
//       }

//       patientDoc.documents.push({
//         type: "visit-card",
//         url: result.secure_url,
//         publicId: result.public_id,
//         createdAt: new Date(),
//         appointmentId: appointmentId
//       });

//       await patientDoc.save();
//     }

//     // Return the download URL
//     return res.status(200).json({
//       success: true,
//       message: "Karta wizyty została wygenerowana pomyślnie",
//       data: {
//         url: result.secure_url,
//         reportId: appointment.reports[appointment.reports.length - 1]._id,
//         appointmentId: appointmentId
//       },
//     });
//   } catch (error) {
//     console.error("Error generating visit card:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Nie udało się wygenerować karty wizyty",
//       error: error.message,
//     });
//   }
// };
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
        message: "Nieautoryzowany dostęp do danych tej wizyty",
      });
    }

    // Find the visit cards in appointment reports
    const visitCards = appointment.reports?.filter(report => 
      report.type === "Visit Card" || report.type === "visit-card"
    ) || [];

    if (visitCards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Brak kart wizyty dla tej wizyty",
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
      message: "Nie udało się pobrać karty wizyty",
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
        message: "Nieautoryzowany dostęp do danych tego pacjenta",
      });
    }

    const patient = await Patient.findById(patientId);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Pacjent nie znaleziony",
      });
    }

    // Find the visit cards in patient documents
    const visitCards =
      patient.documents?.filter((doc) => doc.type === "visit-card") || [];

    if (visitCards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Brak kart wizyty dla tego pacjenta",
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
      message: "Nie udało się pobrać karty wizyty",
      error: error.message,
    });
  }
};
