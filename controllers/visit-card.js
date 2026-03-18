const puppeteer = require("puppeteer");
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
const { getVisitMedicalCodes } = require("../services/visitMedicalCodesService");

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

// Find Chrome binary inside a directory (e.g. .cache/puppeteer); returns path or null.
function findChromeInDir(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const names = ["chrome", "chromium", "chrome-headless-shell"];
  const trySubdirs = (d, depth) => {
    if (depth > 5) return null;
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isFile() && (e.name === "chrome" || e.name === "chromium" || e.name === "chrome-headless-shell"))
          return full;
        if (e.isDirectory() && (e.name.startsWith("chrome") || e.name.startsWith("linux") || e.name.startsWith("headless"))) {
          const found = trySubdirs(full, depth + 1);
          if (found) return found;
        }
      }
    } catch (_) {}
    return null;
  };
  return trySubdirs(dir, 0);
}

// Function to find Chrome executable. On Render use .cache/puppeteer (filled by postinstall) or CHROME_EXECUTABLE_PATH.
const findChrome = () => {
  const possiblePaths = [
    process.env.CHROME_EXECUTABLE_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
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

  // Project cache (Render: .puppeteerrc.cjs sets cacheDirectory to .cache/puppeteer; postinstall installs Chrome there)
  const cacheDirs = [
    path.join(process.cwd(), ".cache", "puppeteer"),
    process.env.PUPPETEER_CACHE_DIR,
    "/opt/render/.cache/puppeteer",
  ].filter(Boolean);
  for (const cacheDir of cacheDirs) {
    const found = findChromeInDir(cacheDir);
    if (found) return found;
  }

  // Fallback: use Chromium from "puppeteer" (executablePath() respects .puppeteerrc.cjs)
  try {
    const executablePath = puppeteer.executablePath();
    if (executablePath && fs.existsSync(executablePath)) {
      return executablePath;
    }
  } catch (e) {
    // executablePath() failed
  }

  throw new Error(
    "Chrome executable not found. On Render: ensure .puppeteerrc.cjs exists, postinstall runs 'npx puppeteer browsers install chrome', and PUPPETEER_SKIP_CHROMIUM_DOWNLOAD is not set to true. Or set CHROME_EXECUTABLE_PATH."
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

    // ICD-10 diagnoses and ICD-9 procedures for this visit (per spec: Main Section)
    const medicalCodes = await getVisitMedicalCodes(appointmentId);
    const diagnoses = medicalCodes.diagnoses || [];
    const procedures = medicalCodes.procedures || [];
    // Medications for this visit (show at beginning of documentation when present)
    const medications = appointment.medications || [];

    // Spec: file naming karta_wizyty_PESEL_DATE.pdf
    const peselForFile = (patient.govtId && String(patient.govtId).replace(/\D/g, "")) || (patient.npesei && String(patient.npesei).replace(/\s/g, "_")) || "brak";
    const dateForFile = appointment.date
      ? new Date(appointment.date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const pdfBaseName = `karta_wizyty_${peselForFile}_${dateForFile}.pdf`;
    const filename = pdfBaseName;
    const tempFilePath = path.join(__dirname, "..", "temp", filename);

    // Make sure temp directory exists
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Format visit time (spec: Start Time and End Time)
    const visitTime = appointment.startTime || "10:00";
    const visitTimeDisplay = visitTime;

    // Get doctor's name (no "Dr." prefix – show "Lekarz: Name Surname" only)
    let doctorName = "";
    if (appointment.doctor) {
      doctorName = `${appointment.doctor.name.first || ""} ${appointment.doctor.name.last || ""}`.trim();
    } else {
      doctorName = req.user
        ? `${req.user.name.first || ""} ${req.user.name.last || ""}`.trim()
        : "";
    }
    doctorName = doctorName.replace(/^\s*Dr\.?\s*/i, "").trim();

    // Get patient's full name
    const patientName =
      `${patient.name?.first || ""} ${patient.name?.last || ""}`.trim() ||
      "Jan Kowalski";

    // Get patient's date of birth (null if missing – row hidden)
    const dob = patient.dateOfBirth
      ? new Date(patient.dateOfBirth).toLocaleDateString("pl-PL")
      : null;

    // Get patient's address: street, postal code, city, province, country
    // e.g. "Testowa 4A/9, 26-110 Skarżysko-Kamienna, świętokrzyskie, Poland"
    const addressParts = [];
    if (patient.address && String(patient.address).trim()) addressParts.push(patient.address.trim());
    if (patient.pinCode && patient.city) {
      addressParts.push(`${String(patient.pinCode).trim()} ${String(patient.city).trim()}`);
    } else if (patient.pinCode) {
      addressParts.push(String(patient.pinCode).trim());
    } else if (patient.city && String(patient.city).trim()) {
      addressParts.push(patient.city.trim());
    }
    if (patient.state && String(patient.state).trim()) addressParts.push(patient.state.trim());
    if (patient.district && String(patient.district).trim() && !patient.state) addressParts.push(patient.district.trim());
    if (patient.country && String(patient.country).trim()) addressParts.push(patient.country.trim());

    const address =
      addressParts.length > 0
        ? addressParts.join(", ")
        : null;

    // Visit/consultation type for "Rodzaj wizyty" (prefer visitReason from dictionary)
    const visitTypeLabel =
      appointment.consultation?.visitReason ||
      appointment.consultation?.consultationType ||
      appointment.metadata?.visitType ||
      (appointment.mode === "online" ? "Konsultacja online" : appointment.mode === "offline" ? "Konsultacja w przychodni" : null) ||
      "—";

    // Get patient's phone (no placeholder – show nothing or "—" when missing)
    let phone = (patient.phone || patient.phoneFormatted || "").trim() || null;
    if (phone && (/^__no_phone/i.test(phone) || /__no_phone/i.test(phone))) {
      phone = null;
    }

    // Get patient gender (null when not set – row hidden)
    const sex = (patient.sex || "").trim();
    const gender =
      /^male$/i.test(sex)
        ? "Mężczyzna"
        : /^female$/i.test(sex)
        ? "Kobieta"
        : null;

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
                font-family: 'Arial', Helvetica, sans-serif;
                margin: 0;
                padding: 15px;
                font-size: 14px;
                line-height: 1.45;
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
                font-size: 18px;
                font-weight: bold;
                color: #2c3e50;
                line-height: 1.1;
            }
            
            .company-info {
                text-align: right;
                font-size: 11px;
                line-height: 1.3;
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
                margin-bottom: 10px;
                page-break-inside: avoid;
            }
            
            .left-column, .right-column {
                flex: 1;
            }
            
            .section-title {
                font-size: 15px;
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 5px;
                text-transform: uppercase;
                page-break-after: avoid;
            }
            
            .info-row {
                margin-bottom: 4px;
                font-size: 14px;
                display: flex;
                align-items: flex-start;
            }
            
            .info-label {
                font-weight: bold;
                flex-shrink: 0;
                width: 120px;
            }
            
            .info-value {
                flex: 1;
                min-width: 0;
                text-align: left;
            }
            
            .visit-card-title {
                text-align: center;
                font-size: 20px;
                font-weight: bold;
                color: #2c3e50;
                margin: 6px 0 4px 0;
                padding: 2px 0;
                page-break-inside: avoid;
                page-break-after: avoid;
            }
            
            .consultation-section {
                margin-bottom: 0;
                page-break-inside: auto;
            }
            
            .consultation-item {
                margin-bottom: 2px;
                page-break-inside: avoid;
            }
            
            .consultation-label {
                font-weight: bold;
                color: #2c3e50;
                margin-bottom: 0;
                font-size: 14px;
                page-break-after: avoid;
            }
            
            .consultation-content {
                font-size: 14px;
                line-height: 1.25;
                word-wrap: break-word;
                white-space: pre-wrap;
                margin: 0;
                padding: 0;
            }
            
            .diagnosis-line {
                margin-bottom: 1px;
                line-height: 1.25;
            }
            
            .diagnosis-line:last-child {
                margin-bottom: 0;
            }
            
            .consultation-content .info-row {
                margin-bottom: 2px;
            }
            
            .consultation-content .info-row:last-child {
                margin-bottom: 0;
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
            height: 28px;
            display: flex;
            align-items: center;
            padding: 0;
            font-size: 10px;
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
                    ${patientName ? `<div class="info-row"><span class="info-label">Imię i nazwisko:</span><span class="info-value">${patientName}</span></div>` : ""}
                    ${gender ? `<div class="info-row"><span class="info-label">Płeć:</span><span class="info-value">${gender}</span></div>` : ""}
                    ${patient.govtId ? `<div class="info-row"><span class="info-label">PESEL:</span><span class="info-value">${patient.govtId}</span></div>` : ""}
                    ${dob ? `<div class="info-row"><span class="info-label">Data urodzenia:</span><span class="info-value">${dob}</span></div>` : ""}
                    ${address ? `<div class="info-row"><span class="info-label">Adres:</span><span class="info-value">${address}</span></div>` : ""}
                    ${phone ? `<div class="info-row"><span class="info-label">Numer telefonu:</span><span class="info-value">${phone}</span></div>` : `<div class="info-row"><span class="info-label">Numer telefonu:</span><span class="info-value">—</span></div>`}
                    ${(patient.patientId && patient.patientId.toString().trim()) ? `<div class="info-row"><span class="info-label">ID Pacjenta:</span><span class="info-value">${patient.patientId}</span></div>` : ""}
                    ${(patient.email && patient.email.trim()) ? `<div class="info-row"><span class="info-label">Adres E-mail:</span><span class="info-value">${patient.email.trim()}</span></div>` : ""}
                </div>
                
                <div class="right-column">
                    <div class="section-title">SZCZEGÓŁY WIZYTY:</div>
                    ${visitDate ? `<div class="info-row"><span class="info-label">Data wizyty:</span><span class="info-value">${visitDate}</span></div>` : ""}
                    ${visitTimeDisplay ? `<div class="info-row"><span class="info-label">Godzina wizyty:</span><span class="info-value">${visitTimeDisplay}</span></div>` : ""}
                    ${doctorName ? `<div class="info-row"><span class="info-label">Lekarz:</span><span class="info-value">${doctorName}</span></div>` : ""}
                    ${visitTypeLabel && visitTypeLabel !== "—" ? `<div class="info-row"><span class="info-label">Rodzaj wizyty:</span><span class="info-value">${visitTypeLabel}</span></div>` : ""}
                </div>
            </div>
            
            <div class="visit-card-title">KARTA WIZYTY</div>
            
            ${medications.length > 0 ? `
            <div class="consultation-item">
              <div class="consultation-label">Leki:</div>
              <div class="consultation-content">
                ${medications.map((m) => `<div class="info-row">${m.name || ""}${m.dosage ? " – " + m.dosage : ""}${m.frequency ? ", " + m.frequency : ""}</div>`).join("")}
              </div>
            </div>
            ` : ""}
            ${diagnoses.length > 0 ? `
            <div class="consultation-item">
              <div class="consultation-label">Rozpoznanie:</div>
              <div class="consultation-content">
                ${diagnoses.map((d) => d.isPrimary ? `<div class="diagnosis-line"><strong>${d.code} – ${d.name} (główne)</strong></div>` : `<div class="diagnosis-line">${d.code} – ${d.name}</div>`).join("")}
              </div>
            </div>
            ` : ""}
            ${procedures.length > 0 ? `
            <div class="consultation-item">
              <div class="consultation-label">Procedury:</div>
              <div class="consultation-content">
                ${procedures.map((p) => `<div class="info-row">${p.code} – ${p.name}</div>`).join("")}
              </div>
            </div>
            ` : ""}
            
            <div class="consultation-section">
                ${consultationData.interview ? `
                <div class="consultation-item">
                    <div class="consultation-label">Wywiad z pacjentem:</div>
                    <div class="consultation-content">${consultationData.interview}</div>
                </div>
                ` : ""}
                ${consultationData.physicalExamination ? `
                <div class="consultation-item">
                    <div class="consultation-label">Badanie przedmiotowe:</div>
                    <div class="consultation-content">${consultationData.physicalExamination}</div>
                </div>
                ` : ""}
                ${consultationData.treatment ? `
                <div class="consultation-item">
                    <div class="consultation-label">Zastosowane leczenie:</div>
                    <div class="consultation-content">${consultationData.treatment}</div>
                </div>
                ` : ""}
                ${consultationData.recommendations ? `
                <div class="consultation-item">
                    <div class="consultation-label">Zalecenia:</div>
                    <div class="consultation-content">${consultationData.recommendations}</div>
                </div>
                ` : ""}
                <div class="consultation-item">
                    <div class="consultation-label">Kontrola:</div>
                    <div class="consultation-content">${consultationData.consultationNotes && String(consultationData.consultationNotes).trim() ? consultationData.consultationNotes : "brak"}</div>
                </div>
                ${consultationData.description ? `
                <div class="consultation-item">
                    <div class="consultation-label">Notatki:</div>
                    <div class="consultation-content">${consultationData.description}</div>
                </div>
                ` : ""}
            </div>
        </div><div class="footer">

</div>

    </body>
    </html>
    `;

    // Launch browser (uses system Chrome if CHROME_EXECUTABLE_PATH set, else Puppeteer's bundled Chromium)
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
        bottom: "18mm",
        left: "0mm",
      },
      displayHeaderFooter: true,
      footerTemplate: `
        <div style="width: 100%; font-size: 11px; color: #333;">
          <div style="width: 100%; height: 7px; display: flex; margin: 0; padding: 0;">
            <div style="width: 72.33%; height: 100%; background: #008C8C;"></div>
            <div style="width: 27.67%; height: 100%; background: #2c3e50;"></div>
          </div>
          <div style="text-align: right; padding: 6px 15px 0 0; font-weight: 500;">Strona <span class="pageNumber"></span> z <span class="totalPages"></span></div>
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
        public_id: `karta_wizyty_${peselForFile}_${dateForFile}`,
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

      // Spec: "The file is saved exclusively in the Medical Documents section of this specific visit.
      // It must not appear in the general patient documents available to the reception."
      // So we do NOT push to patient.documents – only appointment.reports.

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
      console.error("Upload error details:", {
        message: uploadError.message,
        http_code: uploadError.http_code,
        name: uploadError.name
      });

      return res.status(200).json({
        success: true,
        message: "Karta wizyty wygenerowana, ale nie udało się przesłać do chmury",
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
 * Get all visit cards for a patient (from all their appointments that have a visit-card report).
 * @param {Object} req - Express request object with patientId parameter
 * @param {Object} res - Express response object
 * @returns {Object} JSON with array of visit cards, each with appointment context
 */
exports.getVisitCardsByPatientId = async (req, res) => {
  try {
    const patientId = req.params.patientId;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format",
      });
    }

    // Patient can only access their own visit cards
    if (req.user && req.user.role === "patient" && req.user._id.toString() !== patientId) {
      return res.status(403).json({
        success: false,
        message: "Nieautoryzowany dostęp do danych tego pacjenta",
      });
    }

    const appointments = await Appointment.find({ patient: patientId })
      .populate("doctor", "name.first name.last")
      .sort({ date: -1, startTime: -1 })
      .lean()
      .exec();

    const visitCardsList = [];

    for (const apt of appointments) {
      const reports = apt.reports || [];
      const cards = reports.filter(
        (r) => r.type === "Visit Card" || r.type === "visit-card"
      );
      for (const card of cards) {
        const url = card.fileUrl || card.url || card.downloadUrl;
        if (!url) continue;
        visitCardsList.push({
          appointmentId: apt._id,
          date: apt.date,
          startTime: apt.startTime,
          endTime: apt.endTime,
          status: apt.status,
          doctor: apt.doctor
            ? {
                id: apt.doctor._id,
                name: `${apt.doctor.name?.first || ""} ${apt.doctor.name?.last || ""}`.trim(),
              }
            : null,
          visitCard: {
            reportId: card._id,
            url,
            name: card.name || card.fileName || "Karta wizyty",
            type: card.type || card.documentType || "visit-card",
            createdAt: card.uploadedAt || card.updatedAt || card.createdAt,
          },
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        patientId,
        visitCards: visitCardsList,
        total: visitCardsList.length,
      },
    });
  } catch (error) {
    console.error("Error fetching visit cards by patient:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać kart wizyty",
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
