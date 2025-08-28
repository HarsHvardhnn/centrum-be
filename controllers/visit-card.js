const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");
const Patient = require("../models/user-entity/patient");
const Appointment = require("../models/appointment");
const cloudinary = require("../utils/cloudinary");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/user-entity/user");
const mongoose = require("mongoose");

// Import the standardized document helper from patient controller
const { createStandardizedDocument } = require("./patientController");

// Function to convert logo to base64
const getLogoBase64 = async () => {
  try {
    const logoPath = path.join(__dirname, "..", "public", "logo_teal.png");
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      return logoBuffer.toString("base64");
    } else {
      console.warn("Logo file not found, using fallback");
      return null;
    }
  } catch (error) {
    console.error("Error reading logo file:", error);
    return null;
  }
};

// Function to find Chrome executable (copied from patientBillController)
const findChrome = () => {
  const possiblePaths = [
    process.env.CHROME_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];

  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error(
    "Chrome executable not found. Please install Chrome or set CHROME_EXECUTABLE_PATH environment variable."
  );
};

/**
 * Generate a visit card PDF for a patient based on appointment
 * @param {Object} req - Express request object with appointmentId parameter and optional forceNew query parameter
 * @param {Object} res - Express response object
 * @returns {Object} JSON with download URL
 * @query {boolean} forceNew - Set to 'true' to generate a new visit card even if one already exists
 */
exports.generateVisitCard = async (req, res) => {
  let browser = null;

  try {
    // Get appointment ID from parameters
    const appointmentId = req.params.appointmentId;

    // Get the forceNew query parameter to allow creating new visit cards even if one exists
    const forceNew =
      req.query.forceNew === "true" || req.query.forceNew === true;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID wizyty",
      });
    }

    // Find the appointment with populated patient and doctor data
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient")
      .populate("doctor", "name.first name.last")
      .exec();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Wizyta nie znaleziona",
      });
    }

    // Check if a visit card already exists for this appointment
    const existingVisitCard = appointment.reports?.find(
      (report) => report.type === "visit-card"
    );

    if (existingVisitCard && !forceNew) {
      return res.status(200).json({
        success: true,
        message: "Karta wizyty już istnieje",
        data: {
          url: existingVisitCard.fileUrl,
          reportId: existingVisitCard._id,
          appointmentId: appointmentId,
        },
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
      ? new Date(appointment.date).toLocaleDateString("pl-PL")
      : new Date().toLocaleDateString("pl-PL");

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

    // Format visit time
    const visitTime = appointment.startTime || "10:00";

    // Get doctor's name
    let doctorName = "Dr. ";
    if (appointment.doctor) {
      doctorName += `${appointment.doctor.name.first} ${appointment.doctor.name.last}`;
    } else {
      doctorName += req.user
        ? `${req.user.name.first} ${req.user.name.last}`
        : "Harsh Vardhan Chawla";
    }

    // Get patient's full name
    const patientName =
      `${patient.name?.first || ""} ${patient.name?.last || ""}`.trim() ||
      "Jan Kowalski";

    // Get patient's date of birth
    const dob = patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toLocaleDateString("pl-PL")
      : "6.01.2004";

    // Get patient's address - construct from available fields
    const addressParts = [];
    if (patient.address) addressParts.push(patient.address);
    if (patient.city) addressParts.push(patient.city);
    if (patient.district) addressParts.push(patient.district);
    if (patient.state) addressParts.push(patient.state);
    if (patient.pinCode) addressParts.push(patient.pinCode);
    if (patient.country) addressParts.push(patient.country);

    const address =
      addressParts.length > 0
        ? addressParts.join(", ")
        : "Złota 44/1, Warszawa, mazowieckie, 00-000, Polska";

    // Get patient's phone
    const phone = patient.phone || patient.phoneFormatted || "730953325";

    // Get patient gender
    const gender =
      patient.sex === "Male"
        ? "Mężczyzna"
        : patient.sex === "Female"
        ? "Kobieta"
        : "ADD gender!!";

    // Get logo as base64
    const logoBase64 = await getLogoBase64();

    // Create HTML content that matches the image exactly
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Karta Wizyty</title>
        <style>
            @page {
                margin: 15px 15px 25px 15px;
                size: A4;

            }
            
            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 15px;
                font-size: 10px;
                line-height: 1.2;
                color: #333;
                background: white;
            }
            
            .page {
                min-height: calc(100vh - 65px);
                padding-bottom: 50px;
                page-break-after: auto;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            
            .logo-section {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .logo {
                width: 50px;
                height: 50px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            
            .logo img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 6px;
            }
            
            .company-name {
                font-size: 16px;
                font-weight: bold;
                color: #2c3e50;
                line-height: 1.1;
            }
            
            .company-info {
                text-align: right;
                font-size: 8px;
                line-height: 1.2;
            }
            
            .separator-line {
                width: 100%;
                height: 3px;
                margin: 10px 0;
                page-break-inside: avoid;
                display: flex;
            }
            .separator-line::before {
                content: '';
                width: 72.33%;
                height: 7px;
                background: #008C8C;
            }
            .separator-line::after {
                content: '';
                width: 27.67%;
                height: 7px;
                background: #2c3e50;
            }
            
            .main-content {
                display: flex;
                gap: 30px;
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            
            .left-column, .right-column {
                flex: 1;
            }
            
            .section-title {
                font-size: 10px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 8px;
                text-transform: uppercase;
                page-break-after: avoid;
            }
            
            .info-row {
                margin-bottom: 4px;
                font-size: 9px;
            }
            
            .info-label {
                font-weight: bold;
                display: inline-block;
                width: 100px;
            }
            
            .visit-card-title {
                text-align: center;
                font-size: 14px;
                font-weight: bold;
                color: #2c3e50;
                margin: 15px 0 10px 0;
                padding: 8px 0;
                page-break-inside: avoid;
                page-break-after: avoid;
            }
            
            .consultation-section {
                margin-bottom: 15px;
                page-break-inside: auto;
            }
            
            .consultation-item {
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            
            .consultation-label {
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
                font-size: 9px;
                page-break-after: avoid;
            }
            
            .consultation-content {
                font-size: 9px;
                line-height: 1.3;
                word-wrap: break-word;
                white-space: pre-wrap;
            }
            
            /* Content wrapper for proper spacing */
            .content-wrapper {
                padding-bottom: 20px;
            }
                 .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 25px;
            display: flex;
            align-items: center;
            padding: 0;
            font-size: 8px;
            page-break-inside: avoid;
        }
        
        .footer-item {
            display: flex;
            align-items: center;
            color: white;
            font-weight: 500;
            gap: 8px;
            padding: 0 15px;
            height: 100%;
        }
        
        .footer-phone1 {
            background: #008C8C;
            flex: 1;
        }
        
        .footer-phone2 {
            background: #008C8C;
            flex: 1;
        }
        
        .footer-email {
            background: #008C8C;
            flex: 1;
        }
        
        .footer-website {
            background: #2c3e50;
            flex: 1;
        }
        
        .footer-icon {
            width: 16px;
            height: 16px;
            background: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            color: #333;
            font-weight: bold;
        }
        
        /* Content wrapper for proper spacing */
        .content-wrapper {
            padding-bottom: 20px;
        }
        
        .footer a {
    color: inherit;       /* Inherit the text color from the parent */
    text-decoration: none; /* Remove underline */
}

.footer a:hover {
    text-decoration: underline; /* Optional: underline on hover for accessibility */
}

        /* Print-specific adjustments */
        @media print {
            body {
                padding-bottom: 0;
            }
            
            .footer {
                position: fixed;
                bottom: 0;
            }
        }
        </style>
    </head>
    <body>
        <div class="content-wrapper">
            <div class="header">
                <div class="logo-section">
                    <div class="logo">
                        ${
                          logoBase64
                            ? `<img src="data:image/png;base64,${logoBase64}" alt="Centrum Medyczne 7 Logo" />`
                            : '<div style="width: 100%; height: 100%; display: flex; border-radius: 6px; overflow: hidden;"><div style="width: 33.33%; background: #17a2b8; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: bold;">7</div><div style="width: 66.67%; background: #2c3e50;"></div></div>'
                        }
                    </div>
                    <div class="company-name">Centrum<br>Medyczne</div>
                </div>
                <div class="company-info">
                    <div><strong>CM7 sp. z o.o.</strong></div>
                    <div>ul. Powstańców Warszawy 7/1.5</div>
                    <div>26-110 Skarżysko-Kamienna</div>
                    <div>NIP: 6631891951</div>
                    <div>REGON: 541934650</div>
                    <div>KRS: 0001177361</div>
                </div>
            </div>
            
            <div class="separator-line"></div>
            
            <div class="main-content">
                <div class="left-column">
                    <div class="section-title">DANE PACJENTA</div>
                    <div class="info-row">
                        <span class="info-label">Imię i nazwisko:</span>
                        <span>${patientName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Płeć:</span>
                        <span>${gender}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">PESEL:</span>
                        <span>${patient.govtId || "04526398512"}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Data urodzenia:</span>
                        <span>${dob}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Adres zamieszkania:</span>
                        <span>${address}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Numer telefonu:</span>
                        <span>${phone}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">ID Pacjenta:</span>
                        <span>${patient.patientId || "P-174945520900"}</span>
                    </div>
                        <div class="info-row">
                        <span class="info-label">Adres E-mail:</span>
                        <span>${patient.email && patient.email !== "undefined" && patient.email !== "null" ? patient.email : ""}</span>
                    </div>
                </div>
                
                <div class="right-column">
                    <div class="section-title">SZCZEGÓŁY WIZYTY:</div>
                    <div class="info-row">
                        <span class="info-label">Data wizyty:</span>
                        <span>${visitDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Godzina wizyty:</span>
                        <span>${visitTime}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Lekarz:</span>
                        <span>${doctorName}</span>
                    </div>
                </div>
            </div>
            
            <div class="visit-card-title">KARTA WIZYTY</div>
            
            <div class="consultation-section">
                <div class="consultation-item">
                    <div class="consultation-label">Wywiad z pacjentem:</div>
                    <div class="consultation-content">${
                      consultationData.interview || "Brak danych wywiadu"
                    }</div>
                </div>
                
                <div class="consultation-item">
                    <div class="consultation-label">Badanie przedmiotowe:</div>
                    <div class="consultation-content">${
                      consultationData.physicalExamination ||
                      "Brak danych badania"
                    }</div>
                </div>
                
                <div class="consultation-item">
                    <div class="consultation-label">Zastosowane leczenie:</div>
                    <div class="consultation-content">${
                      consultationData.treatment || "Brak danych leczenia"
                    }</div>
                </div>
                
                <div class="consultation-item">
                    <div class="consultation-label">Zalecenia:</div>
                    <div class="consultation-content">${
                      consultationData.recommendations || "Brak zaleceń"
                    }</div>
                </div>
                
                <div class="consultation-item">
                    <div class="consultation-label">Notatki:</div>
                    <div class="consultation-content">${
                      consultationData.description || "Brak notatek"
                    }</div>
                </div>
            </div>
        </div><div class="footer">
    <div class="footer-item footer-phone1">
        <div class="footer-icon">📞</div>
        <span><a href="tel:+48797097487">(+48) 797-097-487</a></span>
    </div>
    <div class="footer-item footer-phone2">
        <div class="footer-icon">📞</div>
        <span><a href="tel:+48797197487">(+48) 797-197-487</a></span>
    </div>
    <div class="footer-item footer-email">
        <div class="footer-icon">✉</div>
        <span><a href="mailto:kontakt@centrummedycznecm7.pl">kontakt@centrummedycznecm7.pl</a></span>
    </div>
    <div class="footer-item footer-website">
        <div class="footer-icon">🌐</div>
        <span><a href="https://www.centrummedycznecm7.pl" target="_blank">www.centrummedycznecm7.pl</a></span>
    </div>
</div>

    </body>
    </html>
    `;

    // Launch browser with puppeteer-core
    browser = await puppeteer.launch({
      headless: true,
      executablePath: findChrome(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-features=TranslateUI",
        "--disable-extensions",
      ],
    });

    const page = await browser.newPage();

    // Set content and wait for it to load
    await page.setContent(htmlContent, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 30000,
    });

    // Generate PDF with high quality settings
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "15mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="width: 100%; height: 7px; display: flex; margin: 0; padding: 0;">
          <div style="width: 72.33%; height: 100%; background: #008C8C;"></div>
          <div style="width: 27.67%; height: 100%; background: #2c3e50;"></div>
        </div>
      `,
      headerTemplate: "<div></div>",
    });

    await browser.close();
    browser = null;

    // Save PDF to temp file
    fs.writeFileSync(tempFilePath, pdfBuffer);

    try {
      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(tempFilePath, {
        folder: "hospital_app/images",
        resource_type: "raw",
        type: "upload",
        use_filename: true,
        unique_filename: true,
        access_mode: "public",
        public_id: `karta_wizyty_${patientName.replace(
          /\s+/g,
          "_"
        )}_${visitDate.replace(/\./g, "_")}_CM7`,
        format: "pdf",
      });

      // Delete the temporary file
      fs.unlinkSync(tempFilePath);

      // Create a mock file object for the standardized document creation
      const mockFileData = {
        originalname: filename,
        filename: result.public_id,
        path: result.secure_url,
        mimetype: "application/pdf",
        size: result.bytes || null,
        public_id: result.public_id,
      };

      // Create standardized document for the visit card
      const standardizedDocument = createStandardizedDocument(
        mockFileData,
        "report"
      );

      // Create a report for the appointment using standardized structure
      const newReport = {
        ...standardizedDocument,
        name: `Karta wizyty - ${visitDate}`,
        type: "visit-card",
        description: `Karta wizyty wygenerowana dla wizyty z dnia ${visitDate}`,
        fileUrl: result.secure_url,
        fileType: "pdf",
        metadata: {
          ...standardizedDocument.metadata,
          originalName: filename,
          cloudinaryId: result.public_id,
          appointmentId: appointmentId,
          patientId: patient._id.toString(),
        },
      };

      // Add report to appointment
      if (!appointment.reports) {
        appointment.reports = [];
      }
      appointment.reports.push(newReport);
      await appointment.save();

      // Save the standardized document reference to the patient as well for backward compatibility
      const patientDoc = await Patient.findById(patient._id);
      if (patientDoc) {
        if (!patientDoc.documents) {
          patientDoc.documents = [];
        }

        // Create standardized document for patient's documents array
        const patientDocument = createStandardizedDocument(
          mockFileData,
          "report"
        );
        patientDocument.documentType = "visit-card"; // Override document type for patient
        patientDocument.appointmentId = appointmentId; // Add appointment reference

        patientDoc.documents.push(patientDocument);
        await patientDoc.save();
      }

      // Return the download URL
      return res.status(200).json({
        success: true,
        message: "Karta wizyty wygenerowana pomyślnie",
        data: {
          url: result.secure_url,
          reportId: appointment.reports[appointment.reports.length - 1]._id,
          appointmentId: appointmentId,
        },
      });
    } catch (uploadError) {
      console.error("Error uploading visit card to Cloudinary:", uploadError);

      return res.status(200).json({
        success: true,
        message:
          "Karta wizyty wygenerowana, ale nie udało się przesłać do chmury",
        data: {
          url: `/temp/${filename}`,
          appointmentId: appointmentId,
        },
      });
    }
  } catch (error) {
    console.error("Error generating visit card:", error);

    // Ensure browser is closed even if there's an error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Nie udało się wygenerować karty wizyty",
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

    // Find the visit cards in appointment reports
    const visitCards =
      appointment.reports?.filter(
        (report) => report.type === "Visit Card" || report.type === "visit-card"
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
        name: latestVisitCard.name,
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
