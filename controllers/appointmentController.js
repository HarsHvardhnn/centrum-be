// controllers/appointmentController.js

const { validationResult } = require("express-validator");
const Appointment = require("../models/appointment");
const PatientBill = require("../models/patientBill");
const doctor = require("../models/user-entity/doctor");
const user = require("../models/user-entity/user");
const MessageReceipt = require("../models/smsData");
const { sendSMS } = require("../utils/smsapi");
const { formatDate, formatTime, formatDateForSMS, formatTimeForSMS } = require("../utils/dateUtils");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const mongoose = require("mongoose");
const PatientService = require("../models/patientServices");
const Service = require("../models/services");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/mailer");
const { format } = require("date-fns");
const { toZonedTime } = require("date-fns-tz");
const patient = require("../models/user-entity/patient");
const path = require("path");
const fs = require("fs");

// Import the standardized document helper from patient controller
const { createStandardizedDocument } = require("./patientController");

// Import centralized appointment configuration
const APPOINTMENT_CONFIG = require("../config/appointmentConfig");
const {
  getVisitReasons: getVisitReasonsConfig,
  getOnlineRegistrationVisitReason,
  getVisitTypeForRadiologDoctor,
} = require("../config/visitReasons");
const {
  getVisitTypeDisplayForFe,
  decorateAppointmentResponseForFe,
} = require("../utils/visitTypeDisplay");
const { validatePesel } = require("../utils/peselValidation");
const { validateInternationalDocument } = require("../utils/internationalDocumentValidation");

const DOCTOR_BILL_COMPLETION_BLOCK_ENABLED =
  String(process.env.DOCTOR_BILL_COMPLETION_BLOCK_ENABLED || "").toLowerCase() === "true";

// Email icons as inline SVG (Font Awesome 6 style) for visibility in all email clients
const { getIconImg } = require("../utils/emailIcons");

// Helper function to load and process HTML email templates
const loadEmailTemplate = (templateName, replacements) => {
  try {
    const templatePath = path.join(__dirname, '..', 'emails', templateName);
    let html = fs.readFileSync(templatePath, 'utf8');
    
    // Replace all placeholders with actual data
    Object.keys(replacements).forEach(key => {
      const value = replacements[key] || '';
      // Replace placeholder patterns like {{key}}
      const placeholderRegex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      html = html.replace(placeholderRegex, value);
    });
    
    return html;
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    throw error;
  }
};

// Helper function to replace hardcoded values in cancellation email
const processCancellationEmail = (data) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  
  const {
    patientName = 'Anna Kowalska',
    doctorName = 'lek. Marek Nowak',
    date = 'DD.MM.YYY',
    time = '10:30',
    mode = 'Stacjonarna'
  } = data;
  
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  const teal = '#008C8C';
  const red = '#dc2626';
  const orange = '#ea580c';
  
  // Full HTML template - Font Awesome 6 icons as inline SVG (visible in all email clients)
  let html = `<html>

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Odwołanie wizyty</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap"
      rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', sans-serif;
        background-color: #ffffff;
        color: #0f1419;
      }
      
      ::-webkit-scrollbar {
        display: none;
      }
      
      /* Utility Classes */
      .bg-white { background-color: #ffffff; }
      .bg-gray-50 { background-color: #f9fafb; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-emerald-50 { background-color: #ecfdf5; }
      .bg-blue-50 { background-color: #eff6ff; }
      .bg-yellow-50 { background-color: #fefce8; }
      .bg-red-50 { background-color: #fef2f2; }
      .bg-orange-50 { background-color: #fff7ed; }
      .bg-green-50 { background-color: #f0fdf4; }
      .bg-teal-50 { background-color: #f0fdfa; }
      
      .text-white { color: #ffffff; }
      .text-gray-400 { color: #9ca3af; }
      .text-gray-500 { color: #6b7280; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-700 { color: #374151; }
      .text-navy { color: #1e3a8a; }
      .text-deep-navy { color: #0f1419; }
      .text-teal-custom { color: #008C8C; }
      .text-success-green { color: #16a34a; }
      .text-warning-red { color: #dc2626; }
      .text-warning-orange { color: #ea580c; }
      
      .font-inter { font-family: 'Inter', sans-serif; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
      
      .uppercase { text-transform: uppercase; }
      .tracking-wide { letter-spacing: 0.025em; }
      .tracking-wider { letter-spacing: 0.05em; }
      .leading-relaxed { line-height: 1.625; }
      .line-through { text-decoration: line-through; }
      
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .px-8 { padding-left: 2rem; padding-right: 2rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; }
      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
      .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
      .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
      
      .mx-8 { margin-left: 2rem; margin-right: 2rem; }
      .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mb-8 { margin-bottom: 2rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mt-4 { margin-top: 1rem; }
      
      .flex { display: flex; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      
      .gap-3 { gap: 0.75rem; }
      .gap-4 { gap: 1rem; }
      .gap-6 { gap: 1.5rem; }
      
      .border-b { border-bottom-width: 1px; }
      .border-t { border-top-width: 1px; }
      .border-gray-100 { border-color: #f3f4f6; }
      .border-teal-100 { border-color: #ccfbf1; }
      
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-full { border-radius: 9999px; }
      
      .text-center { text-align: center; }
      
      .max-w-680 { max-width: 680px; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      
      .w-5 { width: 1.25rem; }
      .w-8 { width: 2rem; }
      .w-32 { width: 8rem; }
      .h-8 { height: 2rem; }
      
      .space-y-2 > * + * { margin-top: 0.5rem; }
      .space-y-4 > * + * { margin-top: 1rem; }
      .space-y-5 > * + * { margin-top: 1.25rem; }
      
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      
      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .max-w-md { max-width: 28rem; }
      }
      
      /* Mobile Responsive Styles */
      @media (max-width: 600px) {
        .px-8 { padding-left: 1rem; padding-right: 1rem; }
        .px-6 { padding-left: 1rem; padding-right: 1rem; }
        .py-12 { padding-top: 2rem; padding-bottom: 2rem; }
        .py-8 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .py-6 { padding-top: 1rem; padding-bottom: 1rem; }
        .mx-8 { margin-left: 1rem; margin-right: 1rem; }
        .text-3xl { font-size: 1.5rem; line-height: 2rem; }
        .text-xl { font-size: 1.125rem; line-height: 1.75rem; }
        .text-lg { font-size: 1rem; line-height: 1.5rem; }
        .w-32 { width: 6rem; min-width: 6rem; }
        .gap-4 { gap: 0.75rem; }
        .flex { flex-wrap: nowrap; }
        #email-container { max-width: 100% !important; }
        .space-y-5 > * + * { margin-top: 0.75rem; }
      }
      
      a {
        color: inherit;
        text-decoration: underline;
      }
      
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>

  <body class="bg-white font-inter">
    <div id="email-container" class="max-w-680 mx-auto bg-white" style="max-width: 680px;">
      <header id="header" class="px-8 py-4 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" style="height: 50px; width: auto;" />
          </div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6">${getIconImg('calendar-xmark', red, 40)}
        </div>
        <h1 class="text-3xl font-bold text-navy mb-4">Odwołanie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Informujemy, że Twoja wizyta została odwołana. Poniżej znajdziesz
          szczegóły dotyczące anulowanej konsultacji oraz dalsze instrukcje.
        </p>
      </section>
      <section id="cancellation-notice"
        class="mx-8 mb-8 px-6 py-5 bg-red-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('circle-exclamation', red, 22)}
          <div>
            <p class="text-deep-navy font-medium mb-2">Wizyta została odwołana
            </p>
            <p class="text-deep-navy leading-relaxed">
              Twoja wizyta została anulowana z przyczyn organizacyjnych lub na
              prośbę pacjenta. W celu umówienia nowego terminu prosimy o kontakt
              telefoniczny z recepcją.
            </p>
          </div>
        </div>
      </section>
      <section id="appointment-details" class="px-8 py-8">
        <div class="flex items-center gap-3 mb-8">${getIconImg('clipboard-list', teal, 22)}
          <h2 class="text-xl font-bold text-navy">Szczegóły odwołanej wizyty
          </h2>
        </div>
        <div class="space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('user', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span
              class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('user-doctor', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz
              prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('calendar', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span
              class="text-deep-navy font-medium line-through text-gray-500">${date}</span>
          </div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('clock', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span
              class="text-deep-navy font-medium line-through text-gray-500">${time}</span>
          </div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('stethoscope', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Forma
              konsultacji</span><span
              class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4">${getIconImg('location-dot', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Adres</span><span
              class="text-deep-navy font-medium">
              Centrum Medyczne 7<br>
              ul. Powstańców Warszawy 7/1.5<br>
              26-110 Skarżysko-Kamienna
            </span></div>
        </div>
      </section>
      <section id="next-steps-section"
        class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('calendar-plus', teal, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Umówienie nowego terminu</p>
            <p class="text-deep-navy leading-relaxed">
              Aby umówić się na nowy termin wizyty, skontaktuj się z nami
              telefonicznie lub przez naszą stronę internetową.<br>
              Nasz zespół pomoże Ci znaleźć dogodny termin w najbliższym
              możliwym czasie.
            </p>
          </div>
        </div>
      </section>
      <section id="important-notice"
        class="mx-8 my-8 px-6 py-6 bg-yellow-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('triangle-exclamation', orange, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Ważne informacje</p>
            <p class="text-deep-navy leading-relaxed">
              W przypadku gdy wizyta nie została odwołana z Państwa inicjatywy
              ani nie przekazano wcześniej takiej informacji telefonicznie,
              prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia
              statusu wizyty. Informacja o odwołaniu mogła zostać wygenerowana
              automatycznie w wyniku błędu systemowego lub nieprawidłowej
              synchronizacji danych.
            </p>
          </div>
        </div>
      </section>
      <section id="contact-section" class="px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-3">${getIconImg('phone', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon
              </div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3">${getIconImg('envelope', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Email
              </div>
              <div class="font-medium text-deep-navy">
                kontakt@centrummedyczne7.pl</div>
            </div>
          </div>
        </div>
      </section>
      <section id="privacy-section" class="px-8 py-6 border-t border-gray-100">
        <p class="text-xs text-gray-500 leading-relaxed">
          Niniejsza wiadomość zawiera informacje medyczne podlegające ochronie
          prawnej. Jeśli nie jesteś właściwym odbiorcą, prosimy o niezwłoczne
          usunięcie wiadomości i poinformowanie nadawcy. Centrum Medyczne 7
          dołożyło wszelkich starań, aby zapewnić bezpieczeństwo transmisji
          danych.
        </p>
      </section>
      <footer id="footer" class="px-8 py-8 bg-gray-50 text-center">
        <div class="space-y-2">
          <div class="text-sm text-gray-600 font-medium">© 2025 Centrum Medyczne
            7</div>
          <div class="text-xs text-gray-400 mt-4">Ta wiadomość została
            wygenerowana automatycznie. Prosimy nie odpowiadać na ten e-mail.<br
              id="isjg8n" draggable="true">Administratorem danych osobowych jest
            CM7 Sp. z o.o. Szczegółowe informacje na temat przetwarzania danych
            osobowych znajdują się w&nbsp;<a id="ikua0g" draggable="true"
              href="https://centrummedyczne7.pl/polityka-prywatnosci>Polityce
              Prywatności</a>.</div>
        </div>
      </footer>
    </div>
  </body>

</html>`;
  
  return html;
};

function formatReservationActorLabel(value) {
  const v = String(value || "").toLowerCase();
  if (v === "receptionist") return "Reception";
  if (v === "online" || v === "patient") return "Online";
  if (v === "admin") return "Admin";
  if (v === "doctor") return "Doctor";
  return value || "Unknown";
}

function toDisplayDateTime(input) {
  if (!input) return null;
  const dt = new Date(input);
  if (isNaN(dt.getTime())) return null;
  return dt.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function hasActiveBillForAppointment(appointmentId) {
  const bill = await PatientBill.findOne({
    appointment: appointmentId,
    isDeleted: false,
  })
    .select("_id")
    .lean();
  return Boolean(bill);
}

function normalizeConsentSnapshot(consents) {
  if (!Array.isArray(consents)) return [];
  return consents
    .filter((c) => c && typeof c === "object")
    .map((c) => ({ ...c }));
}

async function appendBookingConsentSnapshotToUser({
  patientId,
  appointmentId,
  consents,
  source = "booking",
}) {
  if (!patientId) return;
  const normalizedConsents = normalizeConsentSnapshot(consents);
  if (!normalizedConsents.length) return;

  await user.updateOne(
    { _id: patientId, role: "patient" },
    {
      $push: {
        bookingConsentSnapshots: {
          appointmentId: appointmentId || null,
          source,
          capturedAt: new Date(),
          consents: normalizedConsents,
        },
      },
    }
  );
}

function toTrimmedOrNull(value) {
  if (value == null) return null;
  const v = String(value).trim();
  return v ? v : null;
}

/** Canonical rodzaj wizyty for equality checks (matches propagateVisitTypeFields priority). */
function getCanonicalVisitTypeFromConsult(consult) {
  if (!consult) return null;
  return (
    toTrimmedOrNull(consult.visitType) ||
    toTrimmedOrNull(consult.visitReason) ||
    toTrimmedOrNull(consult.consultationType)
  );
}

/**
 * Propagate any of consultationType / visitType / visitReason to all three fields.
 * Also stores original incoming values in backup_* fields.
 */
function propagateVisitTypeFields({
  existingConsultation = {},
  consultationType,
  visitType,
  visitReason,
}) {
  const backupConsultationType = toTrimmedOrNull(consultationType);
  const backupVisitType = toTrimmedOrNull(visitType);
  const backupVisitReason = toTrimmedOrNull(visitReason);

  const canonicalVisitType =
    backupVisitType ||
    backupVisitReason ||
    backupConsultationType ||
    toTrimmedOrNull(existingConsultation.visitType) ||
    toTrimmedOrNull(existingConsultation.visitReason) ||
    toTrimmedOrNull(existingConsultation.consultationType);

  return {
    ...existingConsultation,
    visitType: canonicalVisitType,
    visitReason: canonicalVisitType,
    consultationType: canonicalVisitType,
    backup_consultationtype:
      backupConsultationType ?? existingConsultation.backup_consultationtype ?? null,
    backup_visitType:
      backupVisitType ?? existingConsultation.backup_visitType ?? null,
    backup_visitReason:
      backupVisitReason ?? existingConsultation.backup_visitReason ?? null,
  };
}

// Helper function to replace hardcoded values in reschedule email
const processRescheduleEmail = (data) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  
  const {
    patientName = 'Anna Kowalska',
    doctorName = 'lek. Marek Nowak',
    oldDate = 'DD.MM.YYYY',
    oldTime = '10:30',
    newDate = 'DD.MM.YYYY',
    newTime = '14:15',
    mode = 'Stacjonarna'
  } = data;
  
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  const teal = '#008C8C';
  const orange = '#f97316';
  const gray = '#9ca3af';
  
  // Full HTML template - Font Awesome 6 icons as inline SVG (visible in all email clients)
  let html = `<html>

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Przełożenie wizyty</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap"
      rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', sans-serif;
        background-color: #ffffff;
        color: #0f1419;
      }
      
      ::-webkit-scrollbar {
        display: none;
      }
      
      /* Utility Classes */
      .bg-white { background-color: #ffffff; }
      .bg-gray-50 { background-color: #f9fafb; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-emerald-50 { background-color: #ecfdf5; }
      .bg-blue-50 { background-color: #eff6ff; }
      .bg-yellow-50 { background-color: #fefce8; }
      .bg-red-50 { background-color: #fef2f2; }
      .bg-orange-50 { background-color: #fff7ed; }
      .bg-green-50 { background-color: #f0fdf4; }
      .bg-teal-50 { background-color: #f0fdfa; }
      
      .text-white { color: #ffffff; }
      .text-gray-400 { color: #9ca3af; }
      .text-gray-500 { color: #6b7280; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-700 { color: #374151; }
      .text-navy { color: #1e3a8a; }
      .text-deep-navy { color: #0f1419; }
      .text-teal-custom { color: #008C8C; }
      .text-success-green { color: #16a34a; }
      .text-warning-red { color: #dc2626; }
      .text-warning-orange { color: #f97316; }
      
      .font-inter { font-family: 'Inter', sans-serif; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
      
      .uppercase { text-transform: uppercase; }
      .tracking-wide { letter-spacing: 0.025em; }
      .tracking-wider { letter-spacing: 0.05em; }
      .leading-relaxed { line-height: 1.625; }
      .line-through { text-decoration: line-through; }
      
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .px-8 { padding-left: 2rem; padding-right: 2rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; }
      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
      .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
      .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
      
      .mx-8 { margin-left: 2rem; margin-right: 2rem; }
      .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mb-8 { margin-bottom: 2rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mt-4 { margin-top: 1rem; }
      
      .flex { display: flex; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      
      .gap-3 { gap: 0.75rem; }
      .gap-4 { gap: 1rem; }
      .gap-6 { gap: 1.5rem; }
      
      .border-b { border-bottom-width: 1px; }
      .border-t { border-top-width: 1px; }
      .border-gray-100 { border-color: #f3f4f6; }
      .border-teal-100 { border-color: #ccfbf1; }
      
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-full { border-radius: 9999px; }
      
      .text-center { text-align: center; }
      
      .max-w-680 { max-width: 680px; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      
      .w-5 { width: 1.25rem; }
      .w-8 { width: 2rem; }
      .w-32 { width: 8rem; }
      .h-8 { height: 2rem; }
      
      .space-y-2 > * + * { margin-top: 0.5rem; }
      .space-y-4 > * + * { margin-top: 1rem; }
      .space-y-5 > * + * { margin-top: 1.25rem; }
      
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      
      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .max-w-md { max-width: 28rem; }
      }
      
      /* Mobile Responsive Styles */
      @media (max-width: 600px) {
        .px-8 { padding-left: 1rem; padding-right: 1rem; }
        .px-6 { padding-left: 1rem; padding-right: 1rem; }
        .py-12 { padding-top: 2rem; padding-bottom: 2rem; }
        .py-8 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .py-6 { padding-top: 1rem; padding-bottom: 1rem; }
        .mx-8 { margin-left: 1rem; margin-right: 1rem; }
        .text-3xl { font-size: 1.5rem; line-height: 2rem; }
        .text-xl { font-size: 1.125rem; line-height: 1.75rem; }
        .text-lg { font-size: 1rem; line-height: 1.5rem; }
        .w-32 { width: 6rem; min-width: 6rem; }
        .gap-4 { gap: 0.75rem; }
        .flex { flex-wrap: nowrap; }
        #email-container { max-width: 100% !important; }
        .space-y-5 > * + * { margin-top: 0.75rem; }
      }
      
      a {
        color: inherit;
        text-decoration: underline;
      }
      
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>

  <body class="bg-white font-inter">
    <div id="email-container" class="max-w-680 mx-auto bg-white" style="max-width: 680px;">
      <header id="header" class="px-8 py-4 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" style="height: 50px; width: auto;" />
          </div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6">${getIconImg('calendar-xmark', orange, 40)}
        </div>
        <h1 class="text-3xl font-bold text-navy mb-4">Przełożenie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Informujemy, że Twoja wizyta została przełożona na inny termin.
          Poniżej znajdziesz szczegóły.&nbsp;</p>
      </section>
      <section id="postponement-notice"
        class="mx-8 mb-8 px-6 py-5 bg-orange-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('triangle-exclamation', orange, 22)}
          <div>
            <p class="text-deep-navy leading-relaxed">W przypadku gdy
              wizyta nie została przełożona z Państwa inicjatywy ani nie
              przekazano wcześniej takiej informacji telefonicznie, prosimy
              o niezwłoczny kontakt z rejestracją w celu potwierdzenia
              statusu wizyty. Informacja o przełożeniu wizyty mogła zostać
              wygenerowana automatycznie w wyniku błędu systemowego lub
              nieprawidłowej synchronizacji danych.
            </p>
          </div>
        </div>
      </section>
      <section id="original-appointment" class="px-8 py-6">
        <div class="flex items-center gap-3 mb-6">${getIconImg('calendar-minus', gray, 22)}
          <h2 class="text-xl font-bold text-navy">Pierwotny termin wizyty</h2>
        </div>
        <div class="bg-gray-50 rounded-lg p-6 space-y-4">
          <div class="flex items-center gap-4 py-3">${getIconImg('user', gray, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span
              class="text-gray-700 font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-3">${getIconImg('user-doctor', gray, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz
              prowadzący</span><span class="text-gray-700 font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-3">${getIconImg('calendar', gray, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span
              class="text-gray-700 font-medium line-through">${oldDate}</span>
          </div>
          <div class="flex items-center gap-4 py-3">${getIconImg('clock', gray, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span
              class="text-gray-700 font-medium line-through">${oldTime}</span></div>
        </div>
      </section>
      <section id="new-appointment-details" class="px-8 py-8">
        <div class="flex items-center gap-3 mb-8">${getIconImg('calendar-plus', teal, 22)}
          <h2 class="text-xl font-bold text-navy">Nowy termin wizyty</h2>
        </div>
        <div class="bg-teal-50 rounded-lg p-6 space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-teal-100">${getIconImg('user', teal, 20)}<span
              class="text-sm text-gray-600 uppercase tracking-wide w-32">Pacjent</span><span
              class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100">${getIconImg('user-doctor', teal, 20)}<span
              class="text-sm text-gray-600 uppercase tracking-wide w-32">Lekarz
              prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100">${getIconImg('calendar', teal, 20)}<span
              class="text-sm text-gray-600 uppercase tracking-wide w-32">Nowa
              data</span><span
              class="text-deep-navy font-bold">${newDate}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100">${getIconImg('clock', teal, 20)}<span
              class="text-sm text-gray-600 uppercase tracking-wide w-32">Nowa
              godzina</span><span class="text-deep-navy font-bold">${newTime}</span>
          </div>
          <div class="flex items-center gap-4 py-4 border-b border-teal-100">${getIconImg('stethoscope', teal, 20)}<span
              class="text-sm text-gray-600 uppercase tracking-wide w-32">Forma
              konsultacji</span><span
              class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4">${getIconImg('location-dot', teal, 20)}<span
              class="text-sm text-gray-600 uppercase tracking-wide w-32">Adres</span><span
              class="text-deep-navy font-medium">Centrum Medyczne 7<br>ul.
              Powstańców Warszawy 7/1.5<br>26-110 Skarżysko-Kamienna</span>
          </div>
        </div>
      </section>
      <section id="confirmation-required"
        class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('circle-check', teal, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Potwierdzenie nowego terminu
            </p>
            <p class="text-deep-navy leading-relaxed mb-4">Nowy termin został
              automatycznie zarezerwowany. Jeśli nie jest on odpowiedni, prosimy
              o kontakt z rejestracją w celu ustalenia innego, dogodnego terminu
              wizyty.<br></p>
          </div>
        </div>
      </section>
      <section id="preparation-section"
        class="mx-8 my-8 px-6 py-6 bg-green-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('list-check', teal, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Przygotowanie do wizyty</p>
            <p class="text-deep-navy leading-relaxed">Prosimy o zabranie ze sobą
              dokumentu tożsamości, w celu rejestracji. Dodatkową dokumentację
              medyczną można zabrać według uznania, jeśli pacjent chce przekazać
              ją lekarzowi.</p>
          </div>
        </div>
      </section>
      <section id="contact-section" class="px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-3">${getIconImg('phone', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon
              </div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3">${getIconImg('envelope', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Email
              </div>
              <div class="font-medium text-deep-navy">
                kontakt@centrummedyczne7.pl</div>
            </div>
          </div>
        </div>
      </section>
      <section id="privacy-section" class="px-8 py-6 border-t border-gray-100">
        <p class="text-xs text-gray-500 leading-relaxed">
          Niniejsza wiadomość zawiera informacje medyczne podlegające ochronie
          prawnej. Jeśli nie jesteś właściwym odbiorcą, prosimy o niezwłoczne
          usunięcie wiadomości i poinformowanie nadawcy. Centrum Medyczne 7
          dołożyło wszelkich starań, aby zapewnić bezpieczeństwo transmisji
          danych.
        </p>
      </section>
      <footer id="footer" class="px-8 py-8 bg-gray-50 text-center">
        <div class="space-y-2">
          <div class="text-sm text-gray-600 font-medium">© 2025 Centrum Medyczne
            7</div>
          <div class="text-xs text-gray-400 mt-4">Ta wiadomość została
            wygenerowana automatycznie. Prosimy nie odpowiadać na ten e-mail.<br
              id="isjg8n" draggable="true">Administratorem danych osobowych jest
            CM7 Sp. z o.o. Szczegółowe informacje na temat przetwarzania danych
            osobowych znajdują się w&nbsp;<a id="ikua0g" draggable="true"
              href="https://centrummedyczne7.pl/polityka-prywatnosci">Polityce
              Prywatności</a>.</div>
        </div>
      </footer>
    </div>
  </body>

</html>`;
  
  return html;
};

// Helper function to replace hardcoded values in confirmation email
const processConfirmationEmail = (data) => {
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1760433101/hospital_app/images/guukmrukas8w9mcyeipv.png';
  
  const {
    patientName = 'Anna Kowalska',
    doctorName = 'lek. Marek Nowak',
    date = 'DD.MM.YYYY',
    time = '10:30',
    mode = 'Stacjonarna'
  } = data;
  
  const consultationType = mode === 'online' ? 'Online' : 'Stacjonarna';
  const teal = '#008C8C';
  const green = '#16a34a';
  
  // Full HTML template with all formatting - using regular CSS instead of Tailwind
  // Icons: Font Awesome 6 solid as inline SVG data URIs (visible in all email clients)
  let html = `<html>

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Potwierdzenie wizyty</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap"
      rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', sans-serif;
        background-color: #ffffff;
        color: #0f1419;
      }
      
      ::-webkit-scrollbar {
        display: none;
      }
      
      /* Utility Classes */
      .bg-white { background-color: #ffffff; }
      .bg-gray-50 { background-color: #f9fafb; }
      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-emerald-50 { background-color: #ecfdf5; }
      .bg-blue-50 { background-color: #eff6ff; }
      .bg-yellow-50 { background-color: #fefce8; }
      .bg-red-50 { background-color: #fef2f2; }
      .bg-orange-50 { background-color: #fff7ed; }
      .bg-green-50 { background-color: #f0fdf4; }
      .bg-teal-50 { background-color: #f0fdfa; }
      
      .text-white { color: #ffffff; }
      .text-gray-400 { color: #9ca3af; }
      .text-gray-500 { color: #6b7280; }
      .text-gray-600 { color: #4b5563; }
      .text-gray-700 { color: #374151; }
      .text-navy { color: #1e3a8a; }
      .text-deep-navy { color: #0f1419; }
      .text-teal-custom { color: #008C8C; }
      .text-success-green { color: #16a34a; }
      .text-warning-red { color: #dc2626; }
      .text-warning-orange { color: #ea580c; }
      
      .font-inter { font-family: 'Inter', sans-serif; }
      .font-medium { font-weight: 500; }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      
      .text-xs { font-size: 0.75rem; line-height: 1rem; }
      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
      
      .uppercase { text-transform: uppercase; }
      .tracking-wide { letter-spacing: 0.025em; }
      .tracking-wider { letter-spacing: 0.05em; }
      .leading-relaxed { line-height: 1.625; }
      .line-through { text-decoration: line-through; }
      
      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
      .px-8 { padding-left: 2rem; padding-right: 2rem; }
      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
      .py-5 { padding-top: 1.25rem; padding-bottom: 1.25rem; }
      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
      .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
      .py-12 { padding-top: 3rem; padding-bottom: 3rem; }
      
      .mx-8 { margin-left: 2rem; margin-right: 2rem; }
      .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
      .mb-2 { margin-bottom: 0.5rem; }
      .mb-4 { margin-bottom: 1rem; }
      .mb-6 { margin-bottom: 1.5rem; }
      .mb-8 { margin-bottom: 2rem; }
      .mt-1 { margin-top: 0.25rem; }
      .mt-4 { margin-top: 1rem; }
      
      .flex { display: flex; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      
      .gap-3 { gap: 0.75rem; }
      .gap-4 { gap: 1rem; }
      .gap-6 { gap: 1.5rem; }
      
      .border-b { border-bottom-width: 1px; }
      .border-t { border-top-width: 1px; }
      .border-gray-100 { border-color: #f3f4f6; }
      .border-teal-100 { border-color: #ccfbf1; }
      
      .rounded-lg { border-radius: 0.5rem; }
      .rounded-full { border-radius: 9999px; }
      
      .text-center { text-align: center; }
      
      .max-w-680 { max-width: 680px; }
      .mx-auto { margin-left: auto; margin-right: auto; }
      
      .w-5 { width: 1.25rem; }
      .w-8 { width: 2rem; }
      .w-32 { width: 8rem; }
      .h-8 { height: 2rem; }
      
      .space-y-2 > * + * { margin-top: 0.5rem; }
      .space-y-4 > * + * { margin-top: 1rem; }
      .space-y-5 > * + * { margin-top: 1.25rem; }
      
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
      
      @media (min-width: 768px) {
        .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .max-w-md { max-width: 28rem; }
      }
      
      /* Mobile Responsive Styles */
      @media (max-width: 600px) {
        .px-8 { padding-left: 1rem; padding-right: 1rem; }
        .px-6 { padding-left: 1rem; padding-right: 1rem; }
        .py-12 { padding-top: 2rem; padding-bottom: 2rem; }
        .py-8 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
        .py-6 { padding-top: 1rem; padding-bottom: 1rem; }
        .mx-8 { margin-left: 1rem; margin-right: 1rem; }
        .text-3xl { font-size: 1.5rem; line-height: 2rem; }
        .text-xl { font-size: 1.125rem; line-height: 1.75rem; }
        .text-lg { font-size: 1rem; line-height: 1.5rem; }
        .w-32 { width: 6rem; min-width: 6rem; }
        .gap-4 { gap: 0.75rem; }
        .flex { flex-wrap: nowrap; }
        #email-container { max-width: 100% !important; }
        .space-y-5 > * + * { margin-top: 0.75rem; }
      }
      
      a {
        color: inherit;
        text-decoration: underline;
      }
      
      img {
        max-width: 100%;
        height: auto;
      }
    </style>
  </head>

  <body class="bg-white font-inter">
    <div id="email-container" class="max-w-680 mx-auto bg-white" style="max-width: 680px;">
      <header id="header" class="px-8 py-4 border-b border-gray-100">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-3">
            <img src="${logoUrl}" alt="Centrum Medyczne 7 Logo" style="height: 50px; width: auto;" />
          </div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6">${getIconImg('calendar-check', teal, 40)}
        </div>
        <h1 class="text-3xl font-bold text-navy mb-4">Potwierdzenie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Twoja wizyta została pomyślnie zarezerwowana. Poniżej znajdziesz
          wszystkie szczegóły dotyczące nadchodzącej konsultacji medycznej.
        </p>
      </section>
      <section id="confirmation-notice"
        class="mx-8 mb-8 px-6 py-5 bg-emerald-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('circle-check', green, 22)}
          <div>
            <p class="text-deep-navy font-medium mb-2">Wizyta potwierdzona</p>
            <p class="text-deep-navy leading-relaxed">Twoja wizyta została
              zarejestrowana w naszym systemie. <br>Prosimy o przybycie 10 minut
              przed wyznaczoną godziną w celu wypełnienia niezbędnych
              formalności.</p>
          </div>
        </div>
      </section>
      <section id="appointment-details" class="px-8 py-8">
        <div class="flex items-center gap-3 mb-8">${getIconImg('clipboard-list', teal, 22)}
          <h2 class="text-xl font-bold text-navy">Szczegóły wizyty</h2>
        </div>
        <div class="space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('user', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span
              class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('user-doctor', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz
              prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('calendar', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span
              class="text-deep-navy font-medium">${date}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('clock', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span
              class="text-deep-navy font-medium">${time}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100">${getIconImg('stethoscope', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Forma
              konsultacji</span><span
              class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4">${getIconImg('location-dot', teal, 20)}<span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Adres</span><span
              class="text-deep-navy font-medium">Centrum Medyczne 7<br>ul.
              Powstańców Warszawy 7/1.5<br>26-110 Skarżysko-Kamienna</span>
          </div>
        </div>
      </section>
      <section id="preparation-section"
        class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('list-check', teal, 22)}
          <div>
            <p class="text-navy font-medium mb-2">Przygotowanie do wizyty</p>
            <p class="text-deep-navy leading-relaxed">Prosimy o zabranie ze sobą
              dokumentu tożsamości w celu rejestracji. Dodatkową dokumentację
              medyczną można zabrać według uznania, jeśli pacjent chce przekazać
              ją lekarzowi.</p>
          </div>
        </div>
      </section>
      <section id="cancellation-policy"
        class="mx-8 my-8 px-6 py-6 bg-yellow-50 rounded-lg">
        <div class="flex items-start gap-4">${getIconImg('info-circle', teal, 22)}
          <div id="i0zx4">
            <p class="text-navy font-medium mb-2">Polityka odwoływania wizyt</p>
            <p class="text-deep-navy leading-relaxed">W przypadku konieczności
              odwołania wizyty prosimy o kontakt <br>z recepcją najpóźniej 24
              godziny przed wyznaczonym terminem.&nbsp;<br>Odwołania dokonane w
              krótszym czasie nie będą rozpatrywane, zgodnie z regulaminem
              placówki.</p>
          </div>
        </div>
      </section>
      <section id="contact-section" class="px-8 py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-3">${getIconImg('phone', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon
              </div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3">${getIconImg('envelope', teal, 20)}
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Email
              </div>
              <div class="font-medium text-deep-navy">
                kontakt@centrummedyczne7.pl</div>
            </div>
          </div>
        </div>
      </section>
      <section id="privacy-section" class="px-8 py-6 border-t border-gray-100">
        <p class="text-xs text-gray-500 leading-relaxed">
          Niniejsza wiadomość zawiera informacje medyczne podlegające ochronie
          prawnej. Jeśli nie jesteś właściwym odbiorcą, prosimy o niezwłoczne
          usunięcie wiadomości i poinformowanie nadawcy. Centrum Medyczne 7
          dołożyło wszelkich starań, aby zapewnić bezpieczeństwo transmisji
          danych.
        </p>
      </section>
      <footer id="footer" class="px-8 py-8 bg-gray-50 text-center">
        <div class="space-y-2">
          <div class="text-sm text-gray-600 font-medium">© 2025 Centrum Medyczne
            7</div>
          <div class="text-xs text-gray-400 mt-4">Ta wiadomość została
            wygenerowana automatycznie. Prosimy nie
            odpowiadać na ten e-mail.<br>Administratorem danych osobowych jest
            CM7 Sp. z o.o. Szczegółowe informacje na temat przetwarzania danych
            osobowych znajdują się w <a href="https://centrummedyczne7.pl/polityka-prywatnosci" id="ikua0g">Polityce
              Prywatności</a>.</div>
        </div>
      </footer>
    </div>
  </body>

</html>`;
  
  return html;
};

// Helper function to check if patient has consented to SMS notifications
const hasPatientConsentedToSMS = (patientDetails) => {
  return patientDetails && patientDetails.smsConsentAgreed === true;
};

// Helper function to send appointment status SMS
const sendAppointmentStatusSMS = async (
  appointment,
  patientDetails,
  doctorDetails,
  status
) => {
  try {
    if (!patientDetails || !hasPatientConsentedToSMS(patientDetails)) {
      console.log("Patient has not consented to SMS notifications");
      return {
        success: false,
        error: "Patient has not consented to SMS notifications",
      };
    }

    const phoneNumber = patientDetails.phone;
    if (!phoneNumber) {
      return { success: false, error: "No phone number available" };
    }

    const appointmentDate = formatDateForSMS(new Date(appointment.date));
    const startTimeFormatted = formatTimeForSMS(appointment.startTime);
    const patientName = `${patientDetails.name.first} ${patientDetails.name.last}`;
    const doctorName = `${doctorDetails.name.first} ${doctorDetails.name.last}`;

    let message = "";
    switch (status) {
      case "cancelled":
        const doctorSurname = doctorDetails.name.last;
        message = `Twoja wizyta u dr ${doctorSurname} dnia ${appointmentDate} godz. ${startTimeFormatted} zostala odwolana. W celu ustalenia nowego terminu prosimy o kontakt z recepcja CM7 Skarzysko.`;
        break;
      case "completed":
        message = `Wizyta u dr ${doctorName} w dniu ${appointmentDate} zostala zakonczona. Dziekujemy!`;
        break;
      case "rescheduled":
        message = `Twoja wizyta u dr ${doctorName} zostala przeniesiora na ${appointmentDate} godz. ${startTimeFormatted}.`;
        break;
      default:
        message = `Status wizyty u dr ${doctorName} w dniu ${appointmentDate} godz. ${startTimeFormatted} zostal zmieniony: ${status}`;
    }

    const batchId = uuidv4();
    await MessageReceipt.create({
      content: message,
      batchId,
      recipient: {
        userId: patientDetails._id.toString(),
        phone: phoneNumber,
      },
      status: "PENDING",
    });

    return await sendSMS(phoneNumber, message);
  } catch (error) {
    console.error("Error sending appointment status SMS:", error);
    return { success: false, error: error.message };
  }
};


// Helper function to generate temporary password
const generateTemporaryPassword = () => {
  return crypto.randomBytes(8).toString("hex");
};

const sendAppointmentConfirmationSMS = async (
  appointment,
  patientDetails,
  doctorDetails
) => {
  try {
    if (!patientDetails) {
      return { success: false, error: "No patient details" };
    }
    // Get patient's phone number
    const phoneNumber = patientDetails.phone;

    // Check SMS consent using the new smsConsentAgreed field
    if (!patientDetails.smsConsentAgreed) {
      console.log("Patient has not consented to SMS notifications");
      return { success: false, error: "Patient has not consented to SMS notifications" };
    }

    if (!phoneNumber) {
      console.warn(`No phone number found for patient ${patientDetails._id}`);
      return { success: false, error: "No phone number available" };
    }

    // Format date and time for SMS
    const appointmentDate = formatDateForSMS(new Date(appointment.date));
    const startTimeFormatted = formatTimeForSMS(appointment.startTime);

    const patientName = `${patientDetails.name.first} ${patientDetails.name.last}`;
    const doctorName = `${doctorDetails.name.first} ${doctorDetails.name.last}`;
    // Create SMS content - shorter Polish version to save costs
    const message = `Witaj ${patientName}, Twoja wizyta u dr ${doctorName} zostala umowiona na ${appointmentDate} godz. ${startTimeFormatted}. Prosimy przybyc 15 min wczesniej. Pozdrawiamy, CM7.`.trim();

    // Generate batch ID for tracking
    const batchId = uuidv4();

    // Create receipt record
    const receipt = await MessageReceipt.create({
      content: message,
      batchId,
      recipient: {
        userId: patientDetails._id.toString(),
        phone: phoneNumber,
      },
      status: "PENDING",
    });

    console.log("phone", phoneNumber);
    // Send the SMS
    const result = await sendSMS(phoneNumber, message);

    // Update receipt status based on result
    if (result.success) {
      await MessageReceipt.findByIdAndUpdate(receipt._id, {
        status: "DELIVERED",
        messageId: result.messageId,
        sentAt: new Date(),
        deliveredAt: new Date(),
        providerResponse: result.providerResponse || null,
      });

      return {
        success: true,
        messageId: result.messageId,
        receiptId: receipt._id,
      };
    } else {
      await MessageReceipt.findByIdAndUpdate(receipt._id, {
        status: "FAILED",
        failedAt: new Date(),
        error: {
          code: result.errorCode || "UNKNOWN",
          message: result.error?.message || result.error || "Unknown error",
        },
        providerResponse: result.providerResponse || null,
      });

      return {
        success: false,
        error: result.error || "Failed to send SMS",
        receiptId: receipt._id,
      };
    }
  } catch (error) {
    console.error("Error sending appointment confirmation SMS:", error);
    return { success: false, error: error.message };
  }
};

// Create appointment with reception override capability
exports.createAppointment = async (req, res) => {
  try {
    const {
      date,
      dob,
      doctorId,
      email,
      firstName,
      lastName,
      phone,
      startTime,
      consultationType = APPOINTMENT_CONFIG.DEFAULT_CONSULTATION_TYPE,
      message,
      smsConsentAgreed,
      patient: patientId,
      customDuration, // New field for custom appointment duration
      isBackdated = false, // New field to indicate if appointment is for past date
      overrideConflicts = false, // New field to allow overriding time conflicts
      registrationType: registrationTypeBody, // Optional: "online registration" | "receptionist registration" | "admin registration" | "offline registration"
      visitType, // Rodzaj wizyty display name (e.g. "Konsultacja pierwszorazowa"); from GET /visit-reasons
    } = req.body;

    let name = `${firstName} ${lastName}`;
    let time = startTime;
    console.log("whats missing", date, doctorId, time, consultationType);
    
    // Validate required fields
    if (!date || !doctorId || !time || !consultationType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Find the doctor
    const doctorDetails = await doctor.findById(doctorId);
    if (!doctorDetails || doctorDetails.role !== "doctor") {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    // Calculate appointment dates and times
    const appointmentDate = new Date(`${date}T${time}:00`);
    
    // Use custom duration if provided, otherwise use default
    const duration = customDuration || APPOINTMENT_CONFIG.DEFAULT_DURATION;
    
    // Validate custom duration (minimum 1 minute, maximum 480 minutes/8 hours)
    if (customDuration && (customDuration < 1 || customDuration > 480)) {
      return res.status(400).json({
        success: false,
        message: "Custom duration must be between 1 and 480 minutes",
      });
    }
    
    const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
    const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
    const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
    const endTime = `${endTimeHour}:${endTimeMinute}`;

    // Check if appointment is backdated (past date)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const appointmentDateOnly = new Date(appointmentDate);
    appointmentDateOnly.setHours(0, 0, 0, 0);
    
    if (appointmentDateOnly < currentDate && !isBackdated) {
      return res.status(400).json({
        success: false,
        message: "Cannot book appointments for past dates. Set isBackdated to true to override this restriction.",
      });
    }

    // Check for existing appointments (only if not overriding conflicts)
    if (!overrideConflicts) {
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        doctor: doctorId,
        date: { $gte: startOfDay, $lte: endOfDay },
        startTime: time,
        status: "booked",
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message: "Jest już umówiona wizyta u tego lekarza w tym czasie. Set overrideConflicts to true to override this restriction.",
          conflict: true,
        });
      }
    }

    let patient;
    let isNewUser = false;
    const temporaryPassword = APPOINTMENT_CONFIG.DEFAULT_TEMPORARY_PASSWORD;

    // If patient ID is provided, use that
    if (patientId) {
      patient = await user.findById(patientId);
      if (!patient || patient.role !== "patient") {
        return res.status(404).json({
          success: false,
          message: "Pacjent nie znaleziony",
        });
      }
    } else {
      // Handle new patient creation
      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          message: "Wystąpił błąd",
        });
      }

      // Remove leading zeros from phone number
      const phoneNumber = phone.replace(/^0+/, "");

      // Email validation regex
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      // Handle email - check if it's actually provided and not "undefined"
      const emailToSave = email && email !== "undefined" ? email.trim() : "";

      // Validate email format if provided
      if (emailToSave && !emailRegex.test(emailToSave)) {
        return res.status(400).json({
          success: false,
          message: "Nieprawidłowy format adresu e-mail",
        });
      }

      // Parse name into first and last
      const nameParts = name.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");

      // Look for existing patient by phone first
      patient = await user.findOne({
        phone: phoneNumber,
        role: "patient",
      });

      // If not found by phone and email is provided, look by email
      if (!patient && emailToSave) {
        patient = await user.findOne({
          email: emailToSave.toLowerCase(),
          role: "patient",
        });
      }

      // If patient not found, create new patient (password stored hashed only)
      if (!patient) {
        const hashedTemporaryPassword = await bcrypt.hash(temporaryPassword, 10);
        const newPatient = new user({
          name: {
            first: firstName,
            last: lastName,
          },
          email: emailToSave,
          phone: phoneNumber,
          password: hashedTemporaryPassword,
          role: "patient",
          signupMethod: "email",
          dateOfBirth: dob,
          smsConsentAgreed: smsConsentAgreed || false,
          consents: [
            {
              id: Date.now(),
              text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
              agreed: smsConsentAgreed || false,
            },
          ],
        });

        patient = await newPatient.save();
        isNewUser = true;
      }

      // Handle consents for existing user
      if (!isNewUser) {
        let existingConsents = [];
        try {
          existingConsents = patient.consents
            ? JSON.parse(patient.consents)
            : [];
        } catch (e) {
          existingConsents = [];
        }

        const smsConsent = {
          id: Date.now(),
          text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
          agreed: smsConsentAgreed,
        };

        const consentIndex = existingConsents.findIndex(
          (c) => c.text === smsConsent.text
        );

        if (consentIndex === -1) {
          // Consent doesn't exist, add it
          existingConsents.push(smsConsent);
        } else {
          // Update existing consent's agreed status
          existingConsents[consentIndex].agreed = smsConsentAgreed;
        }

        patient.smsConsentAgreed = smsConsentAgreed;
        patient.consents = JSON.stringify(existingConsents);
        await patient.save();
      }
    }

    // createdByRole: patient when no token or token role is patient; otherwise admin / receptionist / doctor from token
    const rawRole = req.user && req.user.role ? req.user.role : null;
    const createdByRole = (rawRole === "admin" || rawRole === "receptionist" || rawRole === "doctor") ? rawRole : "patient";
    let createdBy = "online";
    if (createdByRole === "receptionist") createdBy = "receptionist";
    else if (createdByRole === "doctor") createdBy = "doctor";
    else if (createdByRole === "admin") createdBy = "admin";
    // Visit mode: offline when created by admin/receptionist/doctor
    const visitMode = (createdByRole === "admin" || createdByRole === "receptionist" || createdByRole === "doctor") ? "offline" : (consultationType || "offline").toLowerCase();

    const validRegistrationTypes = ["online registration", "receptionist registration", "admin registration", "offline registration"];
    const registrationTypeResolved = registrationTypeBody && validRegistrationTypes.includes(registrationTypeBody)
      ? registrationTypeBody
      : (createdBy === "admin" ? "admin registration" : createdBy === "receptionist" ? "receptionist registration" : createdBy === "doctor" ? "offline registration" : "online registration");
    let resolvedVisitType =
      (visitType && visitType.trim()) ||
      (req.body.visitReason && String(req.body.visitReason).trim()) ||
      req.body.metadata?.visitType?.trim() ||
      null;
    const radiologVisitTypeCreate = getVisitTypeForRadiologDoctor(doctorDetails);
    if (radiologVisitTypeCreate) {
      resolvedVisitType = radiologVisitTypeCreate;
    }
    const propagatedCreateConsultation = propagateVisitTypeFields({
      consultationType: resolvedVisitType,
      visitType: resolvedVisitType,
      visitReason: req.body.visitReason,
    });
    // International patient flags and document info (for online booking metadata/temp data)
    const isInternationalPatientRaw = req.body.isInternationalPatient;
    const isInternationalPatient =
      isInternationalPatientRaw === true ||
      (typeof isInternationalPatientRaw === "string" &&
        isInternationalPatientRaw.toLowerCase() === "true");
    const documentCountry =
      req.body.documentCountry != null && req.body.documentCountry !== "undefined"
        ? String(req.body.documentCountry).trim()
        : "";
    const documentType =
      req.body.documentType != null && req.body.documentType !== "undefined"
        ? String(req.body.documentType).trim()
        : "";
    const documentNumber =
      req.body.documentNumber != null && req.body.documentNumber !== "undefined"
        ? String(req.body.documentNumber).trim()
        : "";
    const internationalPatientDocumentKey =
      req.body.internationalPatientDocumentKey != null &&
      req.body.internationalPatientDocumentKey !== "undefined"
        ? String(req.body.internationalPatientDocumentKey).trim()
        : "";

    const appointment = new Appointment({
      doctor: doctorId,
      patient: patient._id,
      bookedBy: patient._id,
      booking_source: "RECEPTION",
      registrationType: registrationTypeResolved,
      date: appointmentDate,
      startTime: time,
      endTime: endTime,
      duration: duration,
      customDuration: customDuration || null,
      isBackdated: isBackdated,
      createdBy: createdBy,
      createdByRole: createdByRole,
      mode: visitMode,
      notes: message || "",
      consultation: resolvedVisitType
        ? {
            ...propagatedCreateConsultation,
            // Default: doctor/admin must explicitly verify the visit type
            visitTypeVerified: true,
          }
        : undefined,
      metadata: {
        ...(req.body.metadata || {}),
        overrideConflicts: overrideConflicts,
        receptionistOverride: req.user && req.user.role === "receptionist",
        ...(resolvedVisitType
          ? { visitType: propagatedCreateConsultation.visitType }
          : {}),
        bookingConsentsSnapshot: normalizeConsentSnapshot(
          Array.isArray(req.body.consents) && req.body.consents.length
            ? req.body.consents
            : [
                {
                  id: Date.now(),
                  text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
                  agreed: !!smsConsentAgreed,
                },
              ]
        ),
        ...(isInternationalPatient
          ? {
              isInternationalPatient: true,
            }
          : {}),
        ...(documentCountry
          ? {
              documentCountry,
            }
          : {}),
        ...(documentType
          ? {
            documentType,
          }
          : {}),
        ...(documentNumber
          ? {
              documentNumber,
            }
          : {}),
        ...(internationalPatientDocumentKey
          ? {
              internationalPatientDocumentKey,
            }
          : {}),
      },
    });

    await appointment.save();
    await appendBookingConsentSnapshotToUser({
      patientId: patient?._id,
      appointmentId: appointment._id,
      consents: appointment.metadata?.bookingConsentsSnapshot,
      source: "createAppointment",
    });

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    let emailSent = false;
    if (emailRegex.test(patient.email) && patient.email) {
      try {
        const formattedDate = formatDateForSMS(appointmentDate);
        const formattedTime = formatTimeForSMS(time);

        // Email data
        const emailData = {
          patientName: `${patient.name.first} ${patient.name.last}`,
          doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
          date: formattedDate,
          time: time,
          department: doctorDetails.specialization || "General",
          meetingLink:
            consultationType.toLowerCase() === "online" ? meetingLink : null,
          notes: message || "",
          mode: consultationType.toLowerCase(),
          isNewUser,
          temporaryPassword: isNewUser ? temporaryPassword : null,
        };

        const emailRecipients = [patient.email];
        if (doctorDetails.email && String(doctorDetails.email).trim()) {
          emailRecipients.push(doctorDetails.email.trim());
        }
        await sendEmail({
          to: emailRecipients,
          subject: "Potwierdzenie Wizyty",
          html: createAppointmentEmailHtml(emailData),
          text: `Twoja wizyta u dr ${doctorDetails.name.first} ${
            doctorDetails.name.last
          } została zaplanowana na ${formattedDate} o godz ${time}. ${
            false
              ? `Dołącz do spotkania pod adresem: ${false}`
              : "Rejestracja skontaktuje się z Panem/Panią w celu przekazania dalszych instrukcji."
          }`,
        });

        console.log(`Appointment confirmation email sent to ${emailRecipients.join(", ")}`);
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send appointment email:", emailError);
      }
    }

    if (patient.smsConsentAgreed) {
      try {
        const formattedDate = formatDateForSMS(appointmentDate);
        const formattedTime = formatTimeForSMS(time);
        const message =
          appointment.mode === "online"
            ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz. ${formattedTime}. Link do wizyty otrzymaja Panstwo na adres e-mail.`
            : `Twoja wizyta u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz. ${formattedTime} w naszej placowce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;

        const batchId = uuidv4();
        await MessageReceipt.create({
          content: message,
          batchId,
          recipient: {
            userId: patient._id.toString(),
            phone: phone,
          },
          status: "PENDING",
        });

        smsResult = await sendSMS(phone, message);
      } catch (smsError) {
        console.error(
          "Wystąpił błąd podczas wysyłania powiadomienia SMS:",
          smsError
        );
      }
    }

    // Prepare response data
    const apptPlain = appointment.toObject ? appointment.toObject() : appointment;
    const responseData = {
      appointment: decorateAppointmentResponseForFe(apptPlain),
      isNewUser,
      temporaryPassword: isNewUser ? temporaryPassword : undefined,
      emailSent,
      overrideInfo: {
        customDuration: customDuration ? `${customDuration} minutes` : null,
        isBackdated: isBackdated,
        overrideConflicts: overrideConflicts,
        createdBy: createdBy,
      }
    };

    res.status(201).json({
      success: true,
      message: "Wizyta została umówiona pomyślnie",
      data: responseData,
    });
  } catch (error) {
    console.error("Wystąpił błąd podczas tworzenia wizyty:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się utworzyć wizyty",
      error: error.message,
    });
  }
};

// Create appointment with reception override (for receptionists and admins) - Now has same logic as createAppointment
exports.createReceptionAppointment = async (req, res) => {
  try {
    const {
      date,
      dob,
      doctorId,
      email,
      firstName,
      lastName,
      phone,
      startTime,
      consultationType = APPOINTMENT_CONFIG.DEFAULT_CONSULTATION_TYPE,
      message,
      smsConsentAgreed, // Only used for this appointment's notifications (temporary)
      persistSmsConsent = false, // If true, skip sending all notifications (email and SMS); if false, send notifications based on smsConsentAgreed
      patientId,
      customDuration, // New field for custom appointment duration
      isBackdated = false, // New field to indicate if appointment is for past date
      overrideConflicts = false, // New field to allow overriding time conflicts
      visitType, // Rodzaj wizyty display name (e.g. "Konsultacja pierwszorazowa"); from GET /visit-reasons
    } = req.body;

    let name = `${firstName} ${lastName}`;
    let time = startTime;
    console.log("whats missing", smsConsentAgreed);
    
    // Validate required fields
    if (!date || !doctorId || !time || !consultationType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Find the doctor
    const doctorDetails = await doctor.findById(doctorId);
    if (!doctorDetails || doctorDetails.role !== "doctor") {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    let resolvedVisitTypeReception =
      (visitType && visitType.trim()) ||
      (req.body.visitReason && String(req.body.visitReason).trim()) ||
      req.body.metadata?.visitType?.trim() ||
      null;
    const radiologVisitTypeReception = getVisitTypeForRadiologDoctor(doctorDetails);
    if (radiologVisitTypeReception) {
      resolvedVisitTypeReception = radiologVisitTypeReception;
    }
    const propagatedReceptionConsultation = propagateVisitTypeFields({
      consultationType: resolvedVisitTypeReception,
      visitType: resolvedVisitTypeReception,
      visitReason: req.body.visitReason,
    });

    // Calculate appointment dates and times
    const appointmentDate = new Date(`${date}T${time}:00`);
    
    // Use custom duration if provided, otherwise use default
    const duration = customDuration || APPOINTMENT_CONFIG.DEFAULT_DURATION;
    
    // Validate custom duration (minimum 1 minute, maximum 480 minutes/8 hours)
    if (customDuration && (customDuration < 1 || customDuration > 480)) {
      return res.status(400).json({
        success: false,
        message: "Custom duration must be between 1 and 480 minutes",
      });
    }
    
    const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
    const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
    const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
    const endTime = `${endTimeHour}:${endTimeMinute}`;

    // Check if appointment is backdated (past date)
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const appointmentDateOnly = new Date(appointmentDate);
    appointmentDateOnly.setHours(0, 0, 0, 0);
    
    if (appointmentDateOnly < currentDate && !isBackdated) {
      return res.status(400).json({
        success: false,
        message: "Cannot book appointments for past dates. Set isBackdated to true to override this restriction.",
      });
    }

    // Check for existing appointments (only if not overriding conflicts)
    if (!overrideConflicts) {
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        doctor: doctorId,
        date: { $gte: startOfDay, $lte: endOfDay },
        startTime: time,
        status: "booked",
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message: "Jest już umówiona wizyta u tego lekarza w tym czasie. Set overrideConflicts to true to override this restriction.",
          conflict: true,
        });
      }
    }

    let patient = null;
    let isNewUser = false;
    let emailSent = false;
    const temporaryPassword = APPOINTMENT_CONFIG.DEFAULT_TEMPORARY_PASSWORD;
    const rawRole = req.user && req.user.role ? req.user.role : null;
    const createdByRole = (rawRole === "admin" || rawRole === "receptionist" || rawRole === "doctor") ? rawRole : "receptionist";
    // Visit mode: offline when created by admin/receptionist/doctor (this route is staff-only)
    const visitMode = (createdByRole === "admin" || createdByRole === "receptionist" || createdByRole === "doctor") ? "offline" : (consultationType || "offline").toLowerCase();

    // Follow-up: patientId provided → use existing patient. First visit: no patientId → visit only (complete registration later)
    if (patientId) {
      patient = await user.findById(patientId);
      if (!patient || patient.role !== "patient") {
        return res.status(404).json({
          success: false,
          message: "Pacjent nie znaleziony",
        });
      }
    } else {
      // Reception first visit: require only name; phone optional per spec
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Imię i nazwisko są wymagane",
        });
      }
    }

    let appointment;
    if (patient) {
      appointment = new Appointment({
        doctor: doctorId,
        patient: patient._id,
        bookedBy: patient._id,
        booking_source: "RECEPTION",
        registrationType: "receptionist registration",
        date: appointmentDate,
        startTime: time,
        endTime: endTime,
        duration: duration,
        customDuration: customDuration || null,
        isBackdated: isBackdated,
        createdBy: createdByRole || "receptionist",
        createdByRole: createdByRole,
        mode: visitMode,
        notes: message || "",
        consultation: resolvedVisitTypeReception
          ? {
              ...propagatedReceptionConsultation,
              visitTypeVerified: true,
            }
          : undefined,
        metadata: {
          ...(req.body.metadata || {}),
          overrideConflicts: overrideConflicts,
          receptionistOverride: req.user && req.user.role === "receptionist",
          ...(resolvedVisitTypeReception
            ? { visitType: propagatedReceptionConsultation.visitType }
            : {}),
          bookingConsentsSnapshot: normalizeConsentSnapshot(
            Array.isArray(req.body.consents) && req.body.consents.length
              ? req.body.consents
              : [
                  {
                    id: Date.now(),
                    text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
                    agreed: !!smsConsentAgreed,
                  },
                ]
          ),
        },
      });
      await appointment.save();
      await appendBookingConsentSnapshotToUser({
        patientId: patient?._id,
        appointmentId: appointment._id,
        consents: appointment.metadata?.bookingConsentsSnapshot,
        source: "createReceptionAppointment",
      });

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!persistSmsConsent && patient) {
        const hasSmsConsent = Boolean(smsConsentAgreed);
        const hasPhone = Boolean(patient.phone);
        const hasValidEmail = Boolean(patient.email) && emailRegex.test(patient.email);
        const shouldSendBoth = hasSmsConsent && hasPhone && hasValidEmail;
        if (shouldSendBoth) {
          try {
            const formattedDate = formatDateForSMS(appointmentDate);
            const emailData = {
              patientName: `${patient.name.first} ${patient.name.last}`,
              doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
              date: formattedDate,
              time: time,
              department: doctorDetails.specialization || "General",
              meetingLink: consultationType.toLowerCase() === "online" ? false : null,
              notes: message || "",
              mode: consultationType.toLowerCase(),
              isNewUser: false,
              temporaryPassword: null,
            };
            const receptionEmailRecipients = [patient.email];
            if (doctorDetails.email && String(doctorDetails.email).trim()) {
              receptionEmailRecipients.push(doctorDetails.email.trim());
            }
            await sendEmail({
              to: receptionEmailRecipients,
              subject: "Potwierdzenie Wizyty",
              html: createAppointmentEmailHtml(emailData),
              text: `Twoja wizyta u dr ${doctorDetails.name.first} ${doctorDetails.name.last} została zaplanowana na ${formattedDate} o godz ${time}. Rejestracja skontaktuje się z Panem/Panią w celu przekazania dalszych instrukcji.`,
            });
            emailSent = true;
            const messageText = appointment.mode === "online"
              ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz. ${formattedTime}. Link do wizyty otrzymaja Panstwo na adres e-mail.`
              : `Twoja wizyta u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz. ${formattedTime} w naszej placowce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;
            const batchId = uuidv4();
            await MessageReceipt.create({
              content: messageText,
              batchId,
              recipient: { userId: patient._id.toString(), phone: patient.phone },
              status: "PENDING",
            });
            await sendSMS(patient.phone, messageText);
          } catch (notifyError) {
            console.error("Failed to send reception notifications (email/SMS):", notifyError);
          }
        }
      }
    } else {
      // First visit: create visit only (no patient); store basic data in registrationData
      const phoneNumber = phone && String(phone).replace(/^0+/, "").trim() || null;
      const emailToSave = email && email !== "undefined" ? email.trim() : null;
      if (emailToSave) {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(emailToSave)) {
          return res.status(400).json({ success: false, message: "Nieprawidłowy format adresu e-mail" });
        }
      }
      const isInternational = req.body.isInternational === true || String(req.body.isInternational || "").toLowerCase() === "true";
      const isWalkin = !!(req.body.isWalkin === true || String(req.body.isWalkin || "").toLowerCase() === "true" || req.body.metadata?.isWalkin === true || req.body.metadata?.isWalkin === "true");
      const needsAttention = !!(req.body.needsAttention === true || String(req.body.needsAttention || "").toLowerCase() === "true" || req.body.metadata?.needsAttention === true || req.body.metadata?.needsAttention === "true");
      const nameParts = name.trim().split(" ");
      const registrationData = {
        name: name.trim(),
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || "",
        phone: phoneNumber,
        email: emailToSave,
        dateOfBirth: dob || null,
        smsConsentAgreed: !!smsConsentAgreed,
        consents: [],
        isInternationalPatient: isInternational,
        isWalkin,
        needsAttention,
      };
      appointment = new Appointment({
        doctor: doctorId,
        patient: null,
        bookedBy: null,
        booking_source: "RECEPTION",
        registrationType: "receptionist registration",
        date: appointmentDate,
        startTime: time,
        endTime: endTime,
        duration: duration,
        customDuration: customDuration || null,
        isBackdated: isBackdated,
        createdBy: createdByRole || "receptionist",
        createdByRole: createdByRole,
        mode: visitMode,
        notes: message || "",
        registrationData,
        consultation: resolvedVisitTypeReception
        ? {
            ...propagatedReceptionConsultation,
            visitTypeVerified: true,
          }
          : undefined,
        metadata: {
          ...(req.body.metadata || {}),
          overrideConflicts: overrideConflicts,
          receptionistOverride: req.user && req.user.role === "receptionist",
          ...(resolvedVisitTypeReception
            ? { visitType: propagatedReceptionConsultation.visitType }
            : {}),
          bookingConsentsSnapshot: normalizeConsentSnapshot(
            Array.isArray(req.body.consents) && req.body.consents.length
              ? req.body.consents
              : (smsConsentAgreed !== undefined
                  ? [
                      {
                        id: Date.now(),
                        text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
                        agreed: !!smsConsentAgreed,
                      },
                    ]
                  : [])
          ),
          isInternational: isInternational,
          isWalkin,
          needsAttention,
        },
      });
      await appointment.save();
    }

    const apptPlainReception = appointment.toObject ? appointment.toObject() : appointment;
    const responseData = {
      appointment: decorateAppointmentResponseForFe(apptPlainReception),
      isNewUser,
      temporaryPassword: isNewUser ? temporaryPassword : undefined,
      emailSent,
      overrideInfo: {
        customDuration: customDuration ? `${customDuration} minutes` : null,
        isBackdated: isBackdated,
        overrideConflicts: overrideConflicts,
        createdBy: createdByRole,
      }
    };

    res.status(201).json({
      success: true,
      message: patient ? "Wizyta została umówiona pomyślnie przez recepcję" : "Wizyta (pierwsza wizyta) została utworzona. Dokończ rejestrację pacjenta po podaniu PESEL.",
      data: responseData,
    });
  } catch (error) {
    console.error("Wystąpił błąd podczas tworzenia wizyty przez recepcję:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się utworzyć wizyty",
      error: error.message,
    });
  }
};

// Helper function to create HTML email template for appointments
// Function to create HTML email for appointment details
const createAppointmentEmailHtml = (appointmentDetails) => {
  const {
    patientName,
    doctorName,
    date,
    time,
    department,
    meetingLink,
    notes,
    mode,
    isNewUser,
    temporaryPassword,
  } = appointmentDetails;

  // Format doctor name to match template format (lek. FirstName LastName)
  // Remove any "Dr." or "Dr " prefix (case insensitive) before adding "lek."
  let cleanedName = doctorName.trim();
  if (cleanedName.match(/^(Dr\.|Dr\s+|dr\.|dr\s+)/i)) {
    cleanedName = cleanedName.replace(/^(Dr\.|Dr\s+|dr\.|dr\s+)/i, '').trim();
  }
  // Remove "lek." if already present to avoid duplication
  if (cleanedName.match(/^(lek\.|lek\s+)/i)) {
    cleanedName = cleanedName.replace(/^(lek\.|lek\s+)/i, '').trim();
  }
  const formattedDoctorName = `lek. ${cleanedName}`;

  return processConfirmationEmail({
    patientName,
    doctorName: formattedDoctorName,
    date,
    time,
    mode: mode || 'stacjonarna'
  });
};

// Function to create HTML email for appointment cancellation
const createCancellationEmailHtml = (cancellationDetails) => {
  const {
    patientName,
    doctorName,
    date,
    time,
    mode,
  } = cancellationDetails;

  // Format doctor name to match template format (lek. FirstName LastName)
  // Remove any "Dr." or "Dr " prefix (case insensitive) before adding "lek."
  let cleanedName = doctorName.trim();
  if (cleanedName.match(/^(Dr\.|Dr\s+|dr\.|dr\s+)/i)) {
    cleanedName = cleanedName.replace(/^(Dr\.|Dr\s+|dr\.|dr\s+)/i, '').trim();
  }
  // Remove "lek." if already present to avoid duplication
  if (cleanedName.match(/^(lek\.|lek\s+)/i)) {
    cleanedName = cleanedName.replace(/^(lek\.|lek\s+)/i, '').trim();
  }
  const formattedDoctorName = `lek. ${cleanedName}`;

  return processCancellationEmail({
    patientName,
    doctorName: formattedDoctorName,
    date,
    time,
    mode: mode || 'stacjonarna'
  });
};

// Function to create HTML email for appointment reschedule
const createRescheduleEmailHtml = (rescheduleDetails) => {
  const {
    patientName,
    doctorName,
    oldDate,
    oldTime,
    newDate,
    newTime,
    department,
    mode,
  } = rescheduleDetails;

  // Format doctor name to match template format (lek. FirstName LastName)
  // Remove any "Dr." or "Dr " prefix (case insensitive) before adding "lek."
  let cleanedName = doctorName.trim();
  if (cleanedName.match(/^(Dr\.|Dr\s+|dr\.|dr\s+)/i)) {
    cleanedName = cleanedName.replace(/^(Dr\.|Dr\s+|dr\.|dr\s+)/i, '').trim();
  }
  // Remove "lek." if already present to avoid duplication
  if (cleanedName.match(/^(lek\.|lek\s+)/i)) {
    cleanedName = cleanedName.replace(/^(lek\.|lek\s+)/i, '').trim();
  }
  const formattedDoctorName = `lek. ${cleanedName}`;

  return processRescheduleEmail({
    patientName,
    doctorName: formattedDoctorName,
    oldDate,
    oldTime,
    newDate,
    newTime,
    mode: mode || 'stacjonarna'
  });
};

const calculateAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  const age = new Date(diff).getUTCFullYear() - 1970;
  return age;
};

const formatDateToYYYYMMDD = (date) => {
  const d = new Date(date);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * Complete registration: assign visit to patient by PESEL (create patient if new, link if existing).
 * POST /appointments/:visitId/complete-registration
 * Body: either (pesel + optional patient data) or (isExisting: true + patientId) to link existing patient without PESEL.
 */
exports.completeRegistration = async (req, res) => {
  try {
    const { visitId } = req.params;
    const appointment = await Appointment.findById(visitId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: "Wizyta nie znaleziona." });
    }
    if (appointment.patient) {
      return res.status(400).json({
        success: false,
        message: "Rejestracja dla tej wizyty została już zakończona.",
      });
    }

    // Consents: prefer request body, fallback to visit's registrationData (from online booking)
    const consentsFromVisit = Array.isArray(appointment.registrationData?.consents) ? appointment.registrationData.consents : [];

    // isInternational: from body or from visit (so complete-registration keeps visit's flag when FE doesn't send it)
    const fromBody = req.body.isInternationalPatient === true || String(req.body.isInternationalPatient || "").toLowerCase() === "true";
    const fromVisit = !!(appointment.registrationData?.isInternationalPatient ?? appointment.metadata?.isInternational);
    const isInternational = req.body.isInternationalPatient !== undefined && req.body.isInternationalPatient !== null && req.body.isInternationalPatient !== ""
      ? fromBody
      : fromVisit || fromBody;
    let patientDoc = null;
    let isExisting = false;
    let peselWarning = null;
    let pesel = null;

    if (isInternational) {
      // International patient (no PESEL): document number and key validated (same rigor as PESEL); key must be unique
      const firstName = req.body.firstName != null ? String(req.body.firstName).trim() : "";
      const lastName = req.body.lastName != null ? String(req.body.lastName).trim() : "";
      const dateOfBirthRaw = req.body.dateOfBirth;
      const documentCountry = req.body.documentCountry != null ? String(req.body.documentCountry).trim() : "";
      const documentType = req.body.documentType != null ? String(req.body.documentType).trim() : "";
      const docValidation = validateInternationalDocument({
        documentNumber: req.body.documentNumber,
        internationalPatientDocumentKey: req.body.internationalPatientDocumentKey,
      });
      if (!docValidation.valid) {
        return res.status(400).json({
          success: false,
          message: docValidation.warning || "W trybie międzynarodowym wymagane są: numer dokumentu i klucz dokumentu (internationalPatientDocumentKey).",
        });
      }
      if (!firstName || !lastName || !dateOfBirthRaw || !documentCountry || !documentType) {
        return res.status(400).json({
          success: false,
          message: "W trybie międzynarodowym wymagane są: imię, nazwisko, data urodzenia, kraj dokumentu i typ dokumentu.",
        });
      }
      const existingByDocKey = await patient.findOne({
        internationalPatientDocumentKey: docValidation.internationalPatientDocumentKey,
        deleted: { $ne: true },
      });
      if (existingByDocKey) {
        return res.status(409).json({
          success: false,
          message: "Pacjent z podanym kluczem dokumentu międzynarodowego już istnieje w systemie.",
          existingPatientId: existingByDocKey._id.toString(),
        });
      }
      const documents = (req.files || []).map((file) => createStandardizedDocument(file, "medical_record"));
      const phoneCodeReq = req.body.phoneCode && String(req.body.phoneCode).trim() ? String(req.body.phoneCode).trim() : "+48";
      const phoneFull = req.body.phone && String(req.body.phone).trim()
        ? String(req.body.phone).replace(/\D/g, "").replace(/^0+/, "").trim()
        : (req.body.mobileNumber && String(req.body.mobileNumber).replace(/\D/g, "").replace(/^0+/, "").trim()) || "";
      const phoneToSave = phoneFull || `__no_phone_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const emailVal = req.body.email && req.body.email !== "undefined" ? String(req.body.email).trim() : "";
      const streetVal = (req.body.street != null && req.body.street !== "undefined") ? String(req.body.street).trim() : "";
      const zipCodeVal = (req.body.zipCode != null && req.body.zipCode !== "undefined") ? String(req.body.zipCode).trim() : "";
      const cityVal = (req.body.city != null && req.body.city !== "undefined") ? String(req.body.city).trim() : "";
      const tempPassword = APPOINTMENT_CONFIG.DEFAULT_TEMPORARY_PASSWORD;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const newInternationalPatient = new patient({
        name: { first: firstName, last: lastName },
        email: emailVal || undefined,
        phone: phoneToSave,
        phoneCode: phoneFull ? phoneCodeReq : "+48",
        password: hashedPassword,
        role: "patient",
        signupMethod: "email",
        govtId: undefined,
        npesei: patient.generateNpesei(),
        internationalPatientDocumentKey: docValidation.internationalPatientDocumentKey,
        documentCountry,
        documentType,
        documentNumber: docValidation.documentNumber,
        patientId: `P-${Date.now()}`,
        dateOfBirth: new Date(dateOfBirthRaw),
        sex: req.body.sex || undefined,
        smsConsentAgreed: !!req.body.smsConsentAgreed,
        consents: (Array.isArray(req.body.consents) && req.body.consents.length) ? req.body.consents : consentsFromVisit,
        address: streetVal || undefined,
        pinCode: zipCodeVal || undefined,
        city: cityVal || undefined,
        isInternationalPatient: true,
        documents,
      });
      const savedInternational = await newInternationalPatient.save();
      patientDoc = await patient.findById(savedInternational._id).lean();
      isExisting = false;
    } else if (req.body.isExisting === true && req.body.patientId && mongoose.Types.ObjectId.isValid(req.body.patientId)) {
      patientDoc = await patient.findById(req.body.patientId).lean();
      if (!patientDoc || patientDoc.deleted) {
        return res.status(404).json({
          success: false,
          message: "Pacjent nie znaleziony.",
        });
      }
      isExisting = true;
    } else {
      const rawPesel = req.body.pesel;
      pesel = rawPesel && String(rawPesel).replace(/\D/g, "");
      if (!pesel || pesel.length !== 11) {
        return res.status(400).json({
          success: false,
          message: "Prawidłowy numer PESEL (11 cyfr) jest wymagany do zakończenia rejestracji.",
        });
      }
      const validation = validatePesel(pesel);
      peselWarning = validation.warning || null;
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: validation.warning || "Nieprawidłowy format PESEL (11 cyfr).",
        });
      }
      patientDoc = await patient.findOne({ govtId: pesel, deleted: { $ne: true } });
      isExisting = !!patientDoc;
    }

    if (patientDoc && !isInternational) {
      const { firstName, lastName, dateOfBirth, phone, phoneCode, mobileNumber, email, sex, street, zipCode, city } = req.body;
      const updates = {};
      if (firstName !== undefined || lastName !== undefined) {
        updates.name = {
          first: firstName !== undefined ? String(firstName).trim() : patientDoc.name?.first,
          last: lastName !== undefined ? String(lastName).trim() : patientDoc.name?.last,
        };
      }
      if (dateOfBirth !== undefined) updates.dateOfBirth = new Date(dateOfBirth);
      if (email !== undefined) updates.email = email && email !== "undefined" ? String(email).trim() : "";
      if (sex !== undefined) updates.sex = sex;
      if (phone !== undefined || mobileNumber !== undefined || phoneCode !== undefined) {
        const code = (phoneCode && String(phoneCode).trim()) || "+48";
        const fullNum = phone && String(phone).trim()
          ? String(phone).replace(/\D/g, "").replace(/^0+/, "")
          : (mobileNumber && String(mobileNumber).replace(/\D/g, "").replace(/^0+/, "")) || "";
        updates.phone = fullNum || patientDoc.phone || "";
        updates.phoneCode = code;
      }
      if (street !== undefined && street !== "undefined") updates.address = String(street).trim();
      if (zipCode !== undefined && zipCode !== "undefined") updates.pinCode = String(zipCode).trim();
      if (city !== undefined && city !== "undefined") updates.city = String(city).trim();
      if (req.body.smsConsentAgreed !== undefined) updates.smsConsentAgreed = !!req.body.smsConsentAgreed;
      if (Array.isArray(req.body.consents) && req.body.consents.length) updates.consents = req.body.consents;
      else if (consentsFromVisit.length) updates.consents = consentsFromVisit;
      if (req.body.isInternationalPatient === true && !patientDoc.npesei) updates.npesei = patient.generateNpesei();
      if (req.body.isInternationalPatient !== undefined) updates.isInternationalPatient = !!req.body.isInternationalPatient;
      else updates.isInternationalPatient = !!isInternational;
      if (Object.keys(updates).length > 0) {
        await patient.updateOne({ _id: patientDoc._id }, { $set: updates });
      }
      patientDoc = await patient.findById(patientDoc._id).lean();
    } else if (!patientDoc) {
      const firstName = req.body.firstName || (req.body.name && String(req.body.name).trim().split(" ")[0]) || "Imię";
      const lastName = req.body.lastName || (req.body.name && String(req.body.name).trim().split(" ").slice(1).join(" ")) || "Nazwisko";
      const phoneCodeReq = req.body.phoneCode && String(req.body.phoneCode).trim() ? String(req.body.phoneCode).trim() : "+48";
      const phoneFull = req.body.phone && String(req.body.phone).trim()
        ? String(req.body.phone).replace(/\D/g, "").replace(/^0+/, "").trim()
        : (req.body.mobileNumber && String(req.body.mobileNumber).replace(/\D/g, "").replace(/^0+/, "").trim()) || "";
      const phoneToSave = phoneFull
        ? phoneFull
        : `__no_phone_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const emailVal = req.body.email && req.body.email !== "undefined" ? String(req.body.email).trim() : "";
      const streetVal = (req.body.street != null && req.body.street !== "undefined") ? String(req.body.street).trim() : "";
      const zipCodeVal = (req.body.zipCode != null && req.body.zipCode !== "undefined") ? String(req.body.zipCode).trim() : "";
      const cityVal = (req.body.city != null && req.body.city !== "undefined") ? String(req.body.city).trim() : "";
      const isInternationalPatient = (req.body.isInternationalPatient !== undefined && req.body.isInternationalPatient !== null && req.body.isInternationalPatient !== "")
        ? !!(req.body.isInternationalPatient === true || String(req.body.isInternationalPatient).toLowerCase() === "true")
        : !!isInternational;
      const tempPassword = APPOINTMENT_CONFIG.DEFAULT_TEMPORARY_PASSWORD;
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      const newPatient = new patient({
        name: { first: firstName, last: lastName },
        email: emailVal || undefined,
        phone: phoneToSave,
        phoneCode: phoneFull ? phoneCodeReq : "+48",
        password: hashedPassword,
        role: "patient",
        signupMethod: "email",
        govtId: pesel,
        ...(isInternationalPatient ? { npesei: patient.generateNpesei() } : {}),
        patientId: `P-${Date.now()}`,
        dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : undefined,
        sex: req.body.sex || undefined,
        smsConsentAgreed: !!req.body.smsConsentAgreed,
        consents: (Array.isArray(req.body.consents) && req.body.consents.length) ? req.body.consents : consentsFromVisit,
        address: streetVal || undefined,
        pinCode: zipCodeVal || undefined,
        city: cityVal || undefined,
        isInternationalPatient: isInternationalPatient || undefined,
      });
      const saved = await newPatient.save();
      patientDoc = await patient.findById(saved._id).lean();
    }

    const patientDocRef = patientDoc && typeof patientDoc.toObject === "function" ? patientDoc.toObject() : patientDoc;
    // Link visit to patient: existing (isExisting) or newly created
    appointment.patient = patientDocRef._id;
    appointment.bookedBy = patientDocRef._id;
    await appointment.save();
    await appendBookingConsentSnapshotToUser({
      patientId: patientDocRef._id,
      appointmentId: appointment._id,
      consents:
        appointment.metadata?.bookingConsentsSnapshot ||
        appointment.registrationData?.consents ||
        req.body.consents,
      source: "completeRegistration",
    });

    const appointmentPopulated = await Appointment.findById(visitId)
      .populate("patient", "name govtId npesei patientId dateOfBirth phone phoneCode email sex address pinCode city documentCountry documentType documentNumber internationalPatientDocumentKey documents")
      .populate("doctor", "name")
      .lean();

    const maskNoPhone = (p) => {
      if (!p || !p.phone || typeof p.phone !== "string") return p;
      if (p.phone.startsWith("__no_phone_")) {
        return { ...p, phone: "" };
      }
      return p;
    };
    if (appointmentPopulated?.patient) {
      appointmentPopulated.patient = maskNoPhone(appointmentPopulated.patient);
    }

    return res.status(200).json({
      success: true,
      message: isExisting
        ? "Rejestracja zakończona. Wizyta przypisana do istniejącego pacjenta."
        : "Rejestracja zakończona. Utworzono nowego pacjenta i przypisano wizytę.",
      appointment: decorateAppointmentResponseForFe(appointmentPopulated),
      patient: {
        _id: patientDocRef._id,
        patientId: patientDocRef.patientId,
        name: patientDocRef.name,
        govtId: patientDocRef.govtId || null,
        npesei: patientDocRef.npesei || null,
        documentCountry: patientDocRef.documentCountry || null,
        documentType: patientDocRef.documentType || null,
        documentNumber: patientDocRef.documentNumber || null,
        internationalPatientDocumentKey: patientDocRef.internationalPatientDocumentKey || null,
        phone: maskNoPhone(patientDocRef).phone,
        phoneCode: patientDocRef.phoneCode || "+48",
        street: patientDocRef.address || "",
        zipCode: patientDocRef.pinCode || "",
        city: patientDocRef.city || "",
        ...(patientDocRef.documents && { documents: patientDocRef.documents }),
      },
      existing: isExisting,
      ...(peselWarning && { peselWarning }),
    });
  } catch (error) {
    console.error("Complete registration error:", error);
    if (error.code === 11000) {
      const msg = (error.message || "").toLowerCase();
      const kv = error.keyValue || {};
      const isPhone = msg.includes("phone") || "phone" in kv;
      const isEmail = msg.includes("email") || "email" in kv;
      const isGovtId = msg.includes("govtid") || msg.includes("govt_id") || "govtId" in kv;
      if (isPhone) {
        return res.status(409).json({
          success: false,
          message: "Ten numer telefonu jest już zarejestrowany w systemie.",
        });
      }
      if (isEmail) {
        return res.status(409).json({
          success: false,
          message: "Ten adres e-mail jest już zarejestrowany w systemie.",
        });
      }
      if (isGovtId) {
        return res.status(409).json({
          success: false,
          message: "Pacjent z tym numerem PESEL już istnieje w systemie. Użyj „Załaduj dane istniejącego pacjenta”.",
        });
      }
      const isDocKey = msg.includes("internationalpatientdocumentkey") || "internationalPatientDocumentKey" in kv;
      if (isDocKey) {
        return res.status(409).json({
          success: false,
          message: "Pacjent z podanym kluczem dokumentu międzynarodowego już istnieje w systemie.",
        });
      }
      const field = Object.keys(kv)[0] || "pole";
      return res.status(409).json({
        success: false,
        message: `Dane pacjenta kolidują z istniejącym wpisem (zduplikowana wartość: ${field}).`,
      });
    }
    res.status(500).json({
      success: false,
      message: "Nie udało się zakończyć rejestracji.",
      error: error.message,
    });
  }
};

exports.getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const {
      startDate,
      endDate,
      status = "all",
      page = 1,
      limit = 10,
    } = req.query;

    const query = {
      doctor: doctorId,
      // status: { $nin: ["cancelled"] },
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const appointments = await Appointment.find(query)
      .populate("patient", "name dateOfBirth email profilePicture sex patientId")
      .populate("doctor", "name email")
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    // Full-day counts (same date range), regardless of pagination
    const liczbaWizytQuery = { ...query, status: { $in: ["booked", "checkedIn", "completed"] } };
    const pozostaloWizytQuery = { ...query, status: { $in: ["booked", "checkedIn"] } };
    const [liczbaWizyt, pozostaloWizyt] = await Promise.all([
      Appointment.countDocuments(liczbaWizytQuery),
      Appointment.countDocuments(pozostaloWizytQuery),
    ]);

    // patientId is on Patient discriminator; populate uses User and omits it. Fetch from Patient model.
    const patientIds = [...new Set(appointments.map((a) => a.patient?._id?.toString()).filter(Boolean))];
    const patientIdMap = new Map();
    if (patientIds.length > 0) {
      const patients = await patient
        .find({ _id: { $in: patientIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select("patientId")
        .lean();
      patients.forEach((p) => {
        if (p._id) patientIdMap.set(p._id.toString(), p.patientId != null ? String(p.patientId).trim() : null);
      });
    }

    const rd = (a) => a?.registrationData;
    const transformed = appointments.map((appt) => {
      const fromReg = rd(appt);
      const name = appt.patient
        ? `${appt.patient?.name?.first || ""} ${appt.patient?.name?.last || ""}`.trim()
        : (fromReg?.firstName || fromReg?.lastName
            ? [fromReg.firstName, fromReg.lastName].filter(Boolean).join(" ")
            : fromReg?.name || "");
      const consultationType = getVisitTypeDisplayForFe(appt);

      const patientLessVisit = !appt.patient || !appt.patient._id;
      const patientIdValue = appt.patient?._id
        ? (patientIdMap.get(appt.patient._id.toString()) ?? null)
        : null;
      return {
        id: appt._id.toString(),
        name: name || "—",
        patient_id: appt.patient?._id?.toString() || null,
        patientId: patientIdValue,
        patientLessVisit,
        username: appt.patient?.name?.first
          ? `@${appt.patient.name.first.toLowerCase()}`
          : (fromReg?.firstName ? `@${String(fromReg.firstName).toLowerCase()}` : "—"),
        avatar: appt.patient?.profilePicture || null,
        sex: appt.patient?.sex ?? fromReg?.gender ?? fromReg?.sex ?? "Unknown",
        mode: appt.mode || "offline",
        joining_link: appt.joining_link || null,
        age: appt.patient?.dateOfBirth
          ? calculateAge(appt.patient.dateOfBirth)
          : (fromReg?.dateOfBirth ? calculateAge(fromReg.dateOfBirth) : null),
        status: appt.status || "Unknown",
        date: formatDateToYYYYMMDD(appt.date),
        startTime: appt.startTime || null,
        endTime: appt.endTime || null,
        consultationType,
        visitType: consultationType,
        visitTypeVerified: Boolean(appt.consultation?.visitTypeVerified),
      };
    });

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      liczbaWizyt,
      pozostaloWizyt,
      data: transformed,
    });
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
};

exports.getAppointmentsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const appointments = await Appointment.find({ patient: patientId })
      .populate("doctor", "name email")
      .sort({ date: -1, startTime: 1 })
      .lean();

    // Manually fetch patient data to get govtId
    const patientData = await patient.findById(patientId).lean();

    // Add govtId to each appointment without changing the structure
    appointments.forEach(appointment => {
      appointment.govtId = patientData?.govtId || null;
    });

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments.map((a) => decorateAppointmentResponseForFe(a)),
    });
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { status, visitTypeVerified: bodyVisitTypeVerified } = req.body;

    if (!["booked", "cancelled", "completed", "checkedIn", "no-show"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const appointment = await Appointment.findById(appointmentId).populate(
      "doctor patient",
      "name email phone"
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const doctorDetails = await doctor.findById(appointment.doctor?._id);
    const patientDetails = appointment.patient?._id
      ? await user.findById(appointment.patient._id)
      : null;

    if (!doctorDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor details not found",
      });
    }

    // Allow verifying visit type in the same request when completing (so frontend can send status: "completed" + visitTypeVerified: true in one call)
    if (status === "completed" && bodyVisitTypeVerified === true) {
      if (!appointment.consultation) appointment.consultation = {};
      appointment.consultation.visitTypeVerified = true;
    }

    // Business rule: doctor cannot complete visit without generating a bill.
    if (
      status === "completed" &&
      req.user?.role === "doctor" &&
      DOCTOR_BILL_COMPLETION_BLOCK_ENABLED
    ) {
      const hasBill = await hasActiveBillForAppointment(appointmentId);
      if (!hasBill) {
        return res.status(403).json({
          success: false,
          message:
            "Lekarz nie może zakończyć wizyty bez wystawienia faktury. Najpierw wygeneruj fakturę.",
          code: "BILL_REQUIRED_FOR_DOCTOR_COMPLETION",
        });
      }
    }

    // Before completing: visit type must be verified.
    if (status === "completed") {
      const visitTypeVerified = appointment.consultation?.visitTypeVerified === true;
      if (!visitTypeVerified) {
        return res.status(400).json({
          success: false,
          message:
            "Nie można zamknąć wizyty bez weryfikacji rodzaju wizyty. Lekarz musi potwierdzić visitType przed zamknięciem.",
          code: "VISIT_TYPE_NOT_VERIFIED",
          visitTypeVerified,
        });
      }
    }

    // Update appointment status
    appointment.status = status;
    await appointment.save();

    // Send SMS notification only when patient exists (visit-only appointments have no patient)
    // and skip SMS for completed status.
    let smsResult = null;
    if (patientDetails && status !== "completed") {
      try {
        smsResult = await sendAppointmentStatusSMS(
          appointment,
          patientDetails,
          doctorDetails,
          status
        );
      } catch (smsError) {
        console.error("Error sending status update SMS:", smsError);
      }
    }

    const statusPlain = appointment.toObject ? appointment.toObject() : appointment;
    res.status(200).json({
      success: true,
      data: decorateAppointmentResponseForFe(statusPlain),
      notifications: {
        sms: smsResult
          ? {
              sent: smsResult.success,
              error: smsResult.error,
            }
          : {
              sent: false,
              error: "SMS notification not sent - patient consent not given",
            },
      },
    });
  } catch (error) {
    console.error("Error updating appointment status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
      error: error.message,
    });
  }
};

/**
 * Admin-only status update endpoint.
 * Lets admin set appointment status directly to any allowed appointment status.
 */
exports.adminUpdateAppointmentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const rawStatus = req.body?.status;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    if (rawStatus == null || String(rawStatus).trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const STATUS_ALIASES = {
      checkedin: "checkedIn",
      "checked-in": "checkedIn",
      no_show: "no-show",
      noshow: "no-show",
    };
    const allowedStatuses = ["booked", "cancelled", "completed", "checkedIn", "no-show"];
    const normalizedInput = String(rawStatus).trim();
    const lowered = normalizedInput.toLowerCase();
    const statusToSet = STATUS_ALIASES[lowered] || normalizedInput;

    if (!allowedStatuses.includes(statusToSet)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        availableStatuses: allowedStatuses,
      });
    }

    const updated = await Appointment.findByIdAndUpdate(
      appointmentId,
      { $set: { status: statusToSet } },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Appointment status updated successfully",
      data: decorateAppointmentResponseForFe(updated),
      availableStatuses: allowedStatuses,
    });
  } catch (error) {
    console.error("Error updating appointment status (admin):", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
      error: error.message,
    });
  }
};

// Reschedule appointment
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      newDate: bodyNewDate,
      newStartTime: bodyNewStartTime,
      newEndTime: bodyNewEndTime,
      date,
      startTime,
      endTime,
      doctorId: bodyDoctorId,
      newDoctorId,
      consultationType,
      visitType,
      visitReason, // legacy alias; mapped to visitType
      isBackdated = false, // Same override behavior as booking flow
      overrideConflicts = false, // Same override behavior as booking flow
      sendSMSNotification, // New: decoupled SMS toggle
      sendEmailNotification, // New: decoupled email toggle
      smsToBeSent, // Legacy compatibility (deprecated)
      persistSmsConsent = false, // Legacy compatibility (deprecated)
    } = req.body;

    // Accept both naming conventions: newDate/newStartTime/newEndTime or date/startTime/endTime
    const newDate = bodyNewDate || date;
    const newStartTime = bodyNewStartTime || startTime;
    const newEndTime = bodyNewEndTime || endTime;
    const requestedDoctorId = newDoctorId || bodyDoctorId || null;
    const requestedVisitType =
      (visitType && String(visitType).trim()) ||
      (visitReason && String(visitReason).trim()) ||
      (consultationType && String(consultationType).trim()) ||
      null;

    // Validate required fields
    if (!newDate || !newStartTime) {
      return res.status(400).json({
        success: false,
        message: "Nowa data i godzina rozpoczęcia są wymagane",
      });
    }

    // Validate date format
    const appointmentDate = new Date(`${newDate}T${newStartTime}:00`);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format daty lub godziny",
      });
    }

    // Check if the new date/time is in the past (unless explicitly overridden)
    const now = new Date();
    if (appointmentDate <= now && !isBackdated) {
      return res.status(400).json({
        success: false,
        message:
          "Nie można przełożyć wizyty na przeszłą datę/godzinę. Set isBackdated to true to override this restriction.",
      });
    }

    // Find the appointment and populate doctor/patient details
    const appointment = await Appointment.findById(appointmentId).populate(
      "doctor patient",
      "name email phone"
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono wizyty",
      });
    }

    // Check if appointment is already cancelled or completed
    if (appointment.status === "cancelled" || appointment.status === "completed") {
      return res.status(400).json({
        success: false,
        message: "Nie można przełożyć anulowanej lub zakończonej wizyty",
      });
    }

    // Visit-only appointments may have no patient; doctor is required for reschedule
    if (!appointment.doctor) {
      return res.status(400).json({
        success: false,
        message: "Nie można przełożyć wizyty bez przypisanego lekarza",
      });
    }

    const currentDoctorId = appointment.doctor._id || appointment.doctor;
    let targetDoctorId = currentDoctorId;
    if (requestedDoctorId) {
      if (!mongoose.Types.ObjectId.isValid(requestedDoctorId)) {
        return res.status(400).json({
          success: false,
          message: "Nieprawidłowy format ID lekarza",
        });
      }
      targetDoctorId = new mongoose.Types.ObjectId(requestedDoctorId);
    }

    const oldDoctorDetails = await doctor.findById(currentDoctorId);
    if (!oldDoctorDetails) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono szczegółów lekarza",
      });
    }

    const doctorDetails = await doctor.findById(targetDoctorId);
    if (!doctorDetails) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono szczegółów lekarza",
      });
    }

    let patientDetails = null;
    if (appointment.patient) {
      const patientId = appointment.patient._id || appointment.patient;
      patientDetails = await user.findById(patientId);
    }

    // Note: persistSmsConsent field is now used to skip sending notifications
    // If persistSmsConsent is true, no notifications will be sent (handled later in the code)

    // Use provided newEndTime or calculate based on existing duration
    let finalNewEndTime;
    if (newEndTime) {
      // Use the provided end time
      finalNewEndTime = newEndTime;
    } else {
      // Calculate new end time based on existing duration or default
      const duration = appointment.duration || APPOINTMENT_CONFIG.DEFAULT_DURATION;
      const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
      const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
      const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
      finalNewEndTime = `${endTimeHour}:${endTimeMinute}`;
    }

    // Check for existing appointments at the new time (only if not overriding conflicts)
    if (!overrideConflicts) {
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        doctor: targetDoctorId,
        date: { $gte: startOfDay, $lte: endOfDay },
        startTime: newStartTime,
        status: "booked",
        _id: { $ne: appointmentId }, // Exclude current appointment
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message:
            "Jest już umówiona wizyta u tego lekarza w tym czasie. Set overrideConflicts to true to override this restriction.",
          conflict: true,
        });
      }
    }

    // Store old appointment details for notification
    const oldDate = appointment.date;
    const oldStartTime = appointment.startTime;
    const oldEndTime = appointment.endTime;

    // Update appointment with new details
    const previousDoctorId = appointment.doctor?._id || appointment.doctor || null;
    const nextDoctorId = targetDoctorId || previousDoctorId;
    appointment.date = appointmentDate;
    appointment.startTime = newStartTime;
    appointment.endTime = finalNewEndTime;
    appointment.doctor = nextDoctorId;
    appointment.mode = consultationType || appointment.mode;
    if (requestedVisitType || consultationType || visitReason) {
      const prevCanonicalReschedule = getCanonicalVisitTypeFromConsult(
        appointment.consultation || {}
      );
      appointment.consultation = propagateVisitTypeFields({
        existingConsultation: appointment.consultation || {},
        consultationType,
        visitType,
        visitReason,
      });
      const nextCanonicalReschedule = getCanonicalVisitTypeFromConsult(
        appointment.consultation
      );
      if (prevCanonicalReschedule !== nextCanonicalReschedule) {
        appointment.consultation.visitTypeVerified = false;
      }
      appointment.metadata = appointment.metadata || {};
      appointment.metadata.visitType =
        appointment.consultation.visitType || appointment.metadata.visitType || null;
    }
    appointment.status = "booked"; // Ensure status is booked after rescheduling
    appointment.metadata = appointment.metadata || {};
    appointment.metadata.overrideConflicts = Boolean(overrideConflicts);
    appointment.metadata.isBackdated = Boolean(isBackdated);
    appointment.metadata.rescheduleHistory = appointment.metadata.rescheduleHistory || [];
    appointment.metadata.rescheduleHistory.push({
      action: "rescheduled",
      byRole: req.user?.role || "online",
      byUserId: req.user?.id || req.user?._id || null,
      changedAt: new Date(),
      previousDate: oldDate || null,
      previousStartTime: oldStartTime || null,
      previousEndTime: oldEndTime || null,
      newDate: appointmentDate,
      newStartTime,
      newEndTime: finalNewEndTime,
      previousDoctorId: previousDoctorId || null,
      newDoctorId: nextDoctorId || previousDoctorId || null,
    });

    await appointment.save();

    // Send notifications (SMS/email decoupled)
    let emailSent = false;
    let smsResult = null;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!patientDetails) {
      console.log("Skipping notifications for reschedule: no patient (visit-only or patient not found)");
    } else {
      // Backward compatibility:
      // - sendEmailNotification undefined => keep old behavior: send email unless persistSmsConsent=true
      // - sendSMSNotification undefined => fallback to legacy smsToBeSent, then to DB consent
      const wantsEmail =
        sendEmailNotification !== undefined
          ? Boolean(sendEmailNotification)
          : !persistSmsConsent;
      const wantsSMS =
        sendSMSNotification !== undefined
          ? Boolean(sendSMSNotification)
          : (smsToBeSent !== undefined
              ? Boolean(smsToBeSent)
              : Boolean(patientDetails.smsConsentAgreed));

      const hasValidEmail = Boolean(patientDetails.email) && emailRegex.test(patientDetails.email || "");
      const hasPhone = Boolean(patientDetails.phone);
      const hasSmsConsent = Boolean(patientDetails.smsConsentAgreed);

      if (wantsEmail && hasValidEmail) {
        try {
          const formattedDate = formatDateForSMS(appointmentDate);
          const formattedTime = formatTimeForSMS(newStartTime);
          const oldFormattedDate = format(oldDate, "dd.MM.yyyy");

          const emailData = {
            patientName: `${patientDetails.name.first} ${patientDetails.name.last}`,
            doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
            oldDate: oldFormattedDate,
            oldTime: oldStartTime,
            newDate: formattedDate,
            newTime: newStartTime,
            department: doctorDetails.specialization || "General",
            mode: appointment.mode,
          };

          await sendEmail({
            to: patientDetails.email,
            subject: "Zmiana Terminu Wizyty – Centrum Medyczne 7",
            html: createRescheduleEmailHtml(emailData),
            text: `Twoja wizyta u dr ${doctorDetails.name.first} ${doctorDetails.name.last} została przełożona z ${oldFormattedDate} o godz ${oldStartTime} na ${formattedDate} o godz ${newStartTime}.`,
          });

          console.log(`Reschedule confirmation email sent to ${patientDetails.email}`);
          emailSent = true;
        } catch (emailError) {
          console.error("Failed to send reschedule email:", emailError);
        }
      } else if (wantsEmail && !hasValidEmail) {
        console.log("Email not sent - invalid/missing email.");
      }

      // SMS sends only when requested + phone exists + patient consent is true.
      console.log(
        "Reschedule notifications:",
        {
          sendSMSNotification,
          sendEmailNotification,
          legacySmsToBeSent: smsToBeSent,
          legacyPersistSmsConsent: persistSmsConsent,
          wantsSMS,
          wantsEmail,
          hasSmsConsent,
        }
      );

      if (wantsSMS && hasPhone && hasSmsConsent) {
        console.log("Sending SMS notification for rescheduled appointment");
        try {
          const formattedDate = formatDateForSMS(appointmentDate);
          const formattedTime = formatTimeForSMS(newStartTime);
          const message = `Twoja wizyta u dr ${doctorDetails.name.last} została przełożona na ${formattedDate} o godz. ${formattedTime} w naszej placówce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;

          const batchId = uuidv4();
          await MessageReceipt.create({
            content: message,
            batchId,
            recipient: {
              userId: patientDetails._id.toString(),
              phone: patientDetails.phone,
            },
            status: "PENDING",
          });

          smsResult = await sendSMS(patientDetails.phone, message);
          console.log("SMS sent successfully for rescheduled appointment");
        } catch (smsError) {
          console.error(
            "Wystąpił błąd podczas wysyłania powiadomienia SMS:",
            smsError
          );
        }
      } else {
        if (!wantsSMS) {
          console.log("SMS not sent - sendSMSNotification=false (or equivalent legacy value).");
        } else if (!hasPhone) {
          console.log("SMS not sent - phone number missing.");
        } else if (!hasSmsConsent) {
          console.log("SMS not sent - patient consent not given.");
        }
      }
    }

    const reschedulePlain = appointment.toObject ? appointment.toObject() : appointment;
    res.status(200).json({
      success: true,
      message: "Wizyta została pomyślnie przełożona",
      data: {
        appointment: decorateAppointmentResponseForFe(reschedulePlain),
        oldDate: oldDate,
        oldStartTime: oldStartTime,
        oldEndTime: oldEndTime,
        newDate: appointmentDate,
        newStartTime: newStartTime,
        newEndTime: finalNewEndTime,
        oldDoctor: oldDoctorDetails
          ? {
              id: oldDoctorDetails._id,
              name: `${oldDoctorDetails.name?.first || ""} ${oldDoctorDetails.name?.last || ""}`.trim(),
            }
          : null,
        newDoctor: doctorDetails
          ? {
              id: doctorDetails._id,
              name: `${doctorDetails.name?.first || ""} ${doctorDetails.name?.last || ""}`.trim(),
            }
          : null,
        visitType:
          appointment.consultation?.visitType ||
          appointment.metadata?.visitType ||
          null,
        emailSent,
        smsSent: smsResult ? true : false,
        overrideInfo: {
          overrideConflicts: Boolean(overrideConflicts),
          isBackdated: Boolean(isBackdated),
        },
      },
    });
  } catch (error) {
    console.error("Error rescheduling appointment:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się przełożyć wizyty",
      error: error.message,
    });
  }
};

exports.getAppointmentsDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "date";
    const order = req.query.order === "desc" ? -1 : 1;

    const skip = (page - 1) * limit;

    // Upcoming only: from today 00:00 in Poland timezone; status = booked (reserved) only, no completed/cancelled/etc.
    const todayUTC = new Date();
    const todayInPoland = toZonedTime(todayUTC, "Europe/Warsaw");
    const today = new Date(todayInPoland);
    today.setHours(0, 0, 0, 0);

    const filter = {
      status: "booked",
      date: { $gte: today },
      patient: { $ne: null },
    };

    // Doctor token → only that doctor's appointments. Admin/receptionist → all.
    if (req.user && req.user.role === "doctor") {
      filter.doctor = req.user.id || req.user.d_id;
    }

    const appointments = await Appointment.find(filter)
      .sort({ [sortBy]: order })
      .skip(skip)
      .limit(limit)
      .populate("doctor", "name profilePicture")
      .populate("patient", "name")
      .lean();

    const total = await Appointment.countDocuments(filter);

    const formattedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        const doctorUser = appt.doctor;
        let doctorName = "Unassigned";
        let specialty = "General";
        let avatar = "/api/placeholder/40/40";

        if (doctorUser) {
          doctorName = `${doctorUser.name?.first || ""} ${doctorUser.name?.last || ""}`.trim() || "Doctor";
          avatar = doctorUser.profilePicture || avatar;
          const doctorProfile = await doctor
            .findOne({ _id: doctorUser._id })
            .populate("specialization")
            .lean();
          specialty = doctorProfile?.specialization?.[0]?.name || "General";
        }

        const fromReg = appt.registrationData;
        const patientName = appt.patient
          ? `${appt.patient.name?.first || ""} ${appt.patient.name?.last || ""}`.trim()
          : (fromReg?.firstName || fromReg?.lastName
            ? [fromReg.firstName, fromReg.lastName].filter(Boolean).join(" ")
            : fromReg?.name || null);

        const dateStr = new Date(appt.date).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        const timeStr = `${appt.startTime || ""} - ${appt.endTime || ""}`.trim();

        return {
          id: appt._id,
          appointmentId: appt._id,
          name: doctorName,
          specialty,
          avatar,
          date: dateStr,
          time: timeStr,
          doctor: {
            id: doctorUser?._id,
            name: doctorName,
            specialty,
            avatar,
          },
          patientName: patientName || null,
          patientId: appt.patient?.patientId || null,
          patientObjectId: appt.patient?._id || null,
          status: appt.status || "booked",
          mode: appt.mode || "offline",
          visitType: getVisitTypeDisplayForFe(appt),
          startTime: appt.startTime,
          endTime: appt.endTime,
        };
      })
    );

    res.status(200).json({
      data: formattedAppointments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const { sendSMSNotification = false, sendEmailNotification = false } = req.body; // Default to false if not provided

    const appointment = await Appointment.findById(id).populate(
      "doctor patient",
      "name email phone"
    );

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Appointment is already cancelled" });
    }

    // Update appointment status
    appointment.status = "cancelled";
    await appointment.save();

    // Send SMS notification only if requested and appointment has a patient (visit-only has no patient)
    let smsResult = null;
    if (sendSMSNotification) {
      try {
        const doctorDetails = await doctor.findById(appointment.doctor?._id);
        const patientDetails = appointment.patient?._id
          ? await user.findById(appointment.patient._id)
          : null;

        if (doctorDetails && patientDetails) {
          smsResult = await sendAppointmentStatusSMS(
            appointment,
            patientDetails,
            doctorDetails,
            "cancelled"
          );
        } else {
          smsResult = {
            success: false,
            error: !appointment.patient ? "Visit-only appointment - no patient to notify" : "Doctor or patient details not found",
          };
        }
      } catch (smsError) {
        console.error("Error sending cancellation SMS:", smsError);
        smsResult = {
          success: false,
          error: smsError.message
        };
      }
    }

    // Send email notification only if requested
    let emailResult = null;
    if (sendEmailNotification && appointment.patient?.email) {
      try {
        // Format appointment data for email
        const appointmentDate = new Date(appointment.date);
        const formattedDate = appointmentDate.toLocaleDateString('pl-PL');
        const formattedTime = appointment.startTime;
        
        const patientName = appointment.patient.name?.first && appointment.patient.name?.last 
          ? `${appointment.patient.name.first} ${appointment.patient.name.last}`
          : appointment.patient.name || 'Pacjent';
        
        const doctorName = appointment.doctor.name?.first && appointment.doctor.name?.last
          ? `Dr ${appointment.doctor.name.first} ${appointment.doctor.name.last}`
          : appointment.doctor.name || 'Lekarz';

        const emailData = {
          patientName,
          doctorName,
          date: formattedDate,
          time: formattedTime,
          mode: appointment.mode
        };

        await sendEmail({
          to: appointment.patient.email,
          subject: "Odwołanie wizyty – Centrum Medyczne 7",
          html: createCancellationEmailHtml(emailData),
          text: `Odwołanie Wizyty\n\nWizyta została odwołana z przyczyn organizacyjnych lub na prośbę pacjenta.\n\nSzczegóły Odwołanej Wizyty:\nPacjent: ${patientName}\nLekarz prowadzący: ${doctorName}\nData: ${formattedDate}\nGodzina: ${formattedTime}\nForma konsultacji: ${appointment.mode === "online" ? "Online" : "Stacjonarna"}\nAdres: ul. Powstańców Warszawy 7/1.5, 26-110 Skarżysko-Kamienna\n\nW przypadku gdy wizyta nie została odwołana z Państwa inicjatywy ani nie przekazano wcześniej takiej informacji telefonicznie, prosimy o niezwłoczny kontakt z rejestracją w celu potwierdzenia statusu wizyty.\n\nInformacja o odwołaniu mogła zostać wygenerowana automatycznie w wyniku błędu systemowego lub nieprawidłowej synchronizacji danych.\n\nKlauzula poufności:\nNiniejsza wiadomość oraz wszelkie załączone informacje są przeznaczone wyłącznie dla adresata i mogą zawierać dane osobowe lub informacje medyczne objęte tajemnicą zawodową.\nJeśli wiadomość trafiła do Państwa omyłkowo, prosimy o niezwłoczne usunięcie jej treści i poinformowanie nadawcy.\n\n© 2025 Centrum Medyczne 7 – Wszelkie prawa zastrzeżone`
        });

        emailResult = { success: true };
        console.log(`Cancellation email sent successfully to ${appointment.patient.email}`);
      } catch (emailError) {
        console.error("Error sending cancellation email:", emailError);
        emailResult = {
          success: false,
          error: emailError.message
        };
      }
    }

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
      notifications: {
        sms: sendSMSNotification ? (smsResult
          ? {
              sent: smsResult.success,
              error: smsResult.error,
            }
          : {
              sent: false,
              error: "SMS notification not sent - patient consent not given",
            }) : {
              sent: false,
              message: "SMS notification not requested"
            },
        email: sendEmailNotification ? (emailResult
          ? {
              sent: emailResult.success,
              error: emailResult.error,
            }
          : {
              sent: false,
              error: "Email notification not sent - no email address or error occurred",
            }) : {
              sent: false,
              message: "Email notification not requested"
            }
      },
    });
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.completeCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const patientId = req.query.patientId || req.body.patientId; // Read from query params or body

    const appointment = await Appointment.findOne({
      _id: id,
      patient: patientId,
    });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "completed") {
      return res
        .status(400)
        .json({ message: "Appointment is already completed" });
    }

    if (appointment.status === "checkedIn") {
      return res
        .status(400)
        .json({ message: "Appointment is already checked in" });
    }

    appointment.status = "checkedIn";
    appointment.checkedIn = true;
    appointment.checkInDate = new Date();
    await appointment.save();

    res.status(200).json({ message: "Appointment checked in successfully" });
  } catch (error) {
    console.error("Error checking in appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update appointment details including health data and reports
exports.updateAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      consultationData,
      patientData = {},
      medications,
      tests,
      healthData,
      reports,
      status: bodyStatus,
      visitTypeVerified: bodyVisitTypeVerified,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    const existingAppointment = await Appointment.findById(id).lean();
    if (!existingAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const updateData = {};

    const {
      bloodPressure,
      temperature,
      weight,
      height,
      riskStatus,
      treatmentStatus,
      roomNumber,
      id: patientId,
      bloodPressureSystolic,
      bloodPressureDiastolic,
      pulse,
      oxygenSaturation,
    } = patientData;

    console.log("patient id ", roomNumber, riskStatus, treatmentStatus);
    // Update patient model with health information
    if (patientId) {
      try {
        await patient.findByIdAndUpdate(
          patientId,
          {
            bloodPressure,
            temperature,
            weight,
            height,
            isRisky: riskStatus === "Risky",
            treatmentStatus,
            roomNumber,
            riskStatus,
            bloodPressureSystolic: bloodPressureSystolic ?? null,
            bloodPressureDiastolic: bloodPressureDiastolic ?? null,
            pulse: pulse ?? null,
            oxygenSaturation: oxygenSaturation ?? null,
          },
          { new: true }
        );
      } catch (error) {
        console.error("Error updating patient:", error);
      }
    }

    // Handle consultation data if provided (merge with existing — do not wipe visitType / verification flags)
    if (consultationData) {
      const existingConsult = existingAppointment.consultation || {};
      const consultDate = new Date(
        consultationData.date ?? consultationData.consultationDate
      );
      const notesVal =
        consultationData.notes !== undefined
          ? consultationData.notes
          : consultationData.consultationNotes !== undefined
            ? consultationData.consultationNotes
            : existingConsult.consultationNotes;
      const consultationStatusRaw =
        consultationData.consultationStatus !== undefined
          ? consultationData.consultationStatus
          : consultationData.status !== undefined
            ? consultationData.status
            : existingConsult.consultationStatus || "Scheduled";
      const propagatedConsultation = propagateVisitTypeFields({
        existingConsultation: existingConsult,
        consultationType:
          consultationData.consultationType !== undefined
            ? consultationData.consultationType
            : existingConsult.consultationType,
        visitType:
          consultationData.visitType !== undefined
            ? consultationData.visitType
            : existingConsult.visitType,
        visitReason:
          consultationData.visitReason !== undefined
            ? consultationData.visitReason
            : existingConsult.visitReason,
      });
      const prevCanonicalMerge = getCanonicalVisitTypeFromConsult(existingConsult);
      const nextCanonicalMerge = getCanonicalVisitTypeFromConsult(propagatedConsultation);
      const visitTypeChangedMerge = prevCanonicalMerge !== nextCanonicalMerge;
      const visitTypeVerifiedMerged =
        consultationData.visitTypeVerified !== undefined
          ? Boolean(consultationData.visitTypeVerified)
          : visitTypeChangedMerge
            ? false
            : existingConsult.visitTypeVerified ?? true;

      updateData.consultation = {
        ...propagatedConsultation,
        consultationNotes: notesVal,
        description:
          consultationData.description !== undefined
            ? consultationData.description
            : existingConsult.description,
        treatmentCategory:
          consultationData?.treatmentCategory !== undefined
            ? consultationData.treatmentCategory || ""
            : existingConsult.treatmentCategory || "",
        consultationDate: !isNaN(consultDate.getTime())
          ? consultDate
          : existingConsult.consultationDate || new Date(),
        consultationStatus: consultationStatusRaw,
        isOnline:
          consultationData.isOnline !== undefined
            ? consultationData.isOnline
            : existingConsult.isOnline || false,
        interview:
          consultationData.interview !== undefined
            ? consultationData.interview || ""
            : existingConsult.interview || "",
        physicalExamination:
          consultationData.physicalExamination !== undefined
            ? consultationData.physicalExamination || ""
            : existingConsult.physicalExamination || "",
        treatment:
          consultationData.treatment !== undefined
            ? consultationData.treatment || ""
            : existingConsult.treatment || "",
        recommendations:
          consultationData.recommendations !== undefined
            ? consultationData.recommendations || ""
            : existingConsult.recommendations || "",
        roomNumber:
          consultationData.roomNumber !== undefined
            ? consultationData.roomNumber
            : existingConsult.roomNumber ?? null,
        isRisky:
          consultationData.isRisky !== undefined
            ? consultationData.isRisky
            : existingConsult.isRisky || false,
        time:
          consultationData.time !== undefined
            ? consultationData.time || ""
            : existingConsult.time || "",
        visitTypeVerified: visitTypeVerifiedMerged,
      };
      updateData.metadata = {
        ...(existingAppointment.metadata || {}),
        ...(updateData.metadata || {}),
        visitType:
          propagatedConsultation.visitType ||
          existingAppointment.metadata?.visitType ||
          null,
      };
    }

    // Same as PATCH /appointments/:id/status: allow verifying in the same request when completing.
    if (bodyVisitTypeVerified === true) {
      if (!updateData.consultation) {
        updateData.consultation = {
          ...(existingAppointment.consultation || {}),
        };
      }
      if (bodyVisitTypeVerified === true) {
        updateData.consultation.visitTypeVerified = true;
      }
    }

    // Same rule as status PATCH / billing: completing requires at least one verification flag.
    const completingByAppointmentStatus =
      bodyStatus !== undefined &&
      String(bodyStatus).toLowerCase() === "completed";
    const consultationStatusStr = consultationData
      ? String(
          consultationData.consultationStatus !== undefined
            ? consultationData.consultationStatus
            : consultationData.status !== undefined
              ? consultationData.status
              : ""
        ).toLowerCase()
      : "";
    const completingByConsultation =
      consultationStatusStr === "completed" || consultationStatusStr === "zakończone";

    if (completingByAppointmentStatus) {
      updateData.status = "completed";
    }

    // Business rule: doctor cannot complete visit without generating a bill.
    if (
      (completingByAppointmentStatus || completingByConsultation) &&
      req.user?.role === "doctor" &&
      DOCTOR_BILL_COMPLETION_BLOCK_ENABLED
    ) {
      const hasBill = await hasActiveBillForAppointment(id);
      if (!hasBill) {
        return res.status(403).json({
          success: false,
          message:
            "Lekarz nie może zakończyć wizyty bez wystawienia faktury. Najpierw wygeneruj fakturę.",
          code: "BILL_REQUIRED_FOR_DOCTOR_COMPLETION",
        });
      }
    }

    if (completingByAppointmentStatus || completingByConsultation) {
      const c = updateData.consultation || existingAppointment.consultation || {};
      const visitTypeVerified = c.visitTypeVerified === true;
      if (!visitTypeVerified) {
        return res.status(400).json({
          success: false,
          message:
            "Nie można zamknąć wizyty bez weryfikacji rodzaju wizyty. Potwierdź visitType przed zapisem.",
          code: "VISIT_TYPE_NOT_VERIFIED",
          visitTypeVerified,
        });
      }
    }

    // Handle medications if provided
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

    // Handle tests if provided
    if (tests && tests.length > 0) {
      updateData.tests = tests.map((test) => ({
        name: test.name,
        date: new Date(test.date),
        results: test.results,
        status: test.status,
      }));
    }

    // Handle health data if provided
    if (healthData) {
      updateData.healthData = {
        bloodPressure: {
          value: healthData.bloodPressure?.value || "",
          percentage: healthData.bloodPressure?.percentage || 0,
          temperature: healthData.bloodPressure?.temperature || 0,
        },
        bodyHeight: {
          value: healthData.bodyHeight?.value || "",
          percentage: healthData.bodyHeight?.percentage || 0,
        },
        bodyWeight: {
          value: healthData.bodyWeight?.value || 0,
          percentage: healthData.bodyWeight?.percentage || 0,
        },
        notes: healthData.notes || "",
        recordedAt: new Date(),
      };
    }

    // Handle reports if provided
    if (reports && reports.length > 0) {
      // If we want to add to existing reports
      if (req.query.appendReports === "true") {
        updateData.$push = {
          reports: {
            $each: reports.map((report) => {
              // If this is a file object, use standardized creation
              if (report.originalname || report.mimetype) {
                const standardizedDocument = createStandardizedDocument(report, "report");
                return {
                  ...standardizedDocument,
                  name: report.name || report.originalname,
                  type: report.type || "Other",
                  description: report.description || "",
                  fileUrl: standardizedDocument.url,
                  fileType: standardizedDocument.mimeType.split("/")[1] || "pdf",
                  metadata: standardizedDocument.metadata || {},
                };
              } else {
                // If this is already a report object, keep it as is but add missing fields
                return {
                  name: report.name,
                  type: report.type,
                  fileUrl: report.fileUrl,
                  fileType: report.fileType,
                  description: report.description || "",
                  uploadedAt: new Date(),
                  metadata: report.metadata || {},
                };
              }
            }),
          },
        };
      } else {
        // Replace all reports
        updateData.reports = reports.map((report) => {
          // If this is a file object, use standardized creation
          if (report.originalname || report.mimetype) {
            const standardizedDocument = createStandardizedDocument(report, "report");
            return {
              ...standardizedDocument,
              name: report.name || report.originalname,
              type: report.type || "Other",
              description: report.description || "",
              fileUrl: standardizedDocument.url,
              fileType: standardizedDocument.mimeType.split("/")[1] || "pdf",
              metadata: standardizedDocument.metadata || {},
            };
          } else {
            // If this is already a report object, keep it as is but add missing fields
            return {
              name: report.name,
              type: report.type,
              fileUrl: report.fileUrl,
              fileType: report.fileType,
              description: report.description || "",
              uploadedAt: new Date(),
              metadata: report.metadata || {},
            };
          }
        });
      }
    }

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    const updatedPlain = updatedAppointment.toObject
      ? updatedAppointment.toObject()
      : updatedAppointment;
    res.status(200).json({
      success: true,
      data: decorateAppointmentResponseForFe(updatedPlain),
      message: "Appointment updated successfully",
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment details",
      error: error.message,
    });
  }
};

// Add a report to an appointment
exports.addReportToAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const reportData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    if (!reportData.name || !reportData.fileUrl) {
      return res.status(400).json({
        success: false,
        message: "Report name and fileUrl are required",
      });
    }

    const report = {
      name: reportData.name,
      type: reportData.type || "Other",
      fileUrl: reportData.fileUrl,
      fileType: reportData.fileType || "pdf",
      description: reportData.description || "",
      uploadedAt: new Date(),
      metadata: reportData.metadata || {},
    };

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      { $push: { reports: report } },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: updatedAppointment.reports,
      message: "Report added successfully",
    });
  } catch (error) {
    console.error("Error adding report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add report",
      error: error.message,
    });
  }
};

// Upload a single report file to appointment
exports.uploadAppointmentReport = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    // Check if appointment exists and get populated data
    const appointment = await Appointment.findById(id).populate(
      "doctor patient",
      "name email phone"
    );

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Process uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Create standardized report document
    const standardizedDocument = createStandardizedDocument(req.file, "report");
    
    // Create report object with standardized structure
    const report = {
      ...standardizedDocument,
      name: req.body.name || req.file.originalname,
      type: req.body.type || "Other",
      description: req.body.description || "",
      // Keep appointment-specific fields
      fileUrl: standardizedDocument.url, // For backward compatibility
      fileType: standardizedDocument.mimeType.split("/")[1] || "pdf",
      metadata: {
        ...standardizedDocument.metadata,
        originalName: req.file.originalname,
        size: req.file.size,
        cloudinaryId: req.file.filename || req.file.public_id,
      },
    };

    // Add report to appointment
    if (!appointment.reports) {
      appointment.reports = [];
    }
    appointment.reports.push(report);
    await appointment.save();

    const apptAfterReport = appointment.toObject ? appointment.toObject() : appointment;
    res.status(200).json({
      success: true,
      message: "Report uploaded successfully",
      data: {
        report,
        appointment: decorateAppointmentResponseForFe(apptAfterReport),
      },
    });
  } catch (error) {
    console.error("Error uploading report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload report",
      error: error.message,
    });
  }
};

// Delete a report from an appointment
exports.deleteReport = async (req, res) => {
  try {
    const { appointmentId, reportId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    // Find the appointment and verify it exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Find the report in the appointment
    const reportIndex = appointment.reports
      ? appointment.reports.findIndex((r) => r._id.toString() === reportId)
      : -1;

    if (reportIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Report not found in this appointment",
      });
    }

    // Get cloudinary ID to delete the file from cloud storage if available
    const cloudinaryId =
      appointment.reports[reportIndex].metadata?.cloudinaryId;

    // Remove the report from the reports array
    appointment.reports.splice(reportIndex, 1);
    await appointment.save();

    // If using Cloudinary, you could delete the file here
    // if (cloudinaryId) {
    //   try {
    //     await cloudinary.uploader.destroy(cloudinaryId);
    //   } catch (cloudError) {
    //     console.error('Error deleting file from Cloudinary:', cloudError);
    //   }
    // }

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
      data: {
        remainingReports: appointment.reports,
      },
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report",
      error: error.message,
    });
  }
};

/**
 * Get consents and basic visit/patient data for a visit (appointment).
 * For visits with a linked patient: returns patient consents + patient details.
 * For visit-only: returns registrationData.consents + registrationData fields.
 * FE can use this to display and update name, email, phone, etc. (update via PUT appointment details or complete-registration).
 *
 * GET /appointments/:visitId/consents
 */
exports.getVisitConsents = async (req, res) => {
  try {
    const { visitId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visit ID format",
      });
    }

    const appointment = await Appointment.findById(visitId)
      .select("patient registrationData createdBy createdByRole createdAt date startTime endTime status notes metadata.rescheduleHistory")
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Visit not found",
      });
    }

    let consents = [];
    let bookingConsentsAtBooking = normalizeConsentSnapshot(
      appointment.metadata?.bookingConsentsSnapshot
    );
    let source = "registration";
    let patientData = {
      name: null,
      firstName: null,
      lastName: null,
      email: null,
      phone: null,
      phoneCode: null,
      sex: null,
      dateOfBirth: null,
      govtId: null,
    };

    if (appointment.patient && appointment.patient._id) {
      const patientDoc = await patient
        .findById(appointment.patient._id)
        .select("consents bookingConsentSnapshots name email phone phoneCode sex dateOfBirth govtId")
        .lean();
      if (patientDoc) {
        source = "patient";
        const raw = patientDoc.consents;
        if (Array.isArray(raw)) {
          consents = raw;
        } else if (typeof raw === "string") {
          try {
            consents = JSON.parse(raw) || [];
          } catch {
            consents = [];
          }
        }
        if (!bookingConsentsAtBooking.length) {
          const byAppointment = Array.isArray(patientDoc.bookingConsentSnapshots)
            ? patientDoc.bookingConsentSnapshots
                .filter((s) => String(s?.appointmentId || "") === String(visitId))
                .sort((a, b) => new Date(b?.capturedAt || 0) - new Date(a?.capturedAt || 0))
            : [];
          if (byAppointment.length > 0) {
            bookingConsentsAtBooking = normalizeConsentSnapshot(byAppointment[0].consents);
          }
        }
        const first = patientDoc.name?.first || "";
        const last = patientDoc.name?.last || "";
        patientData = {
          name: [first, last].filter(Boolean).join(" ") || null,
          firstName: first || null,
          lastName: last || null,
          email: patientDoc.email && String(patientDoc.email).trim() ? patientDoc.email.trim() : null,
          phone: patientDoc.phone && String(patientDoc.phone).trim() ? patientDoc.phone : null,
          phoneCode: patientDoc.phoneCode && String(patientDoc.phoneCode).trim() ? patientDoc.phoneCode : null,
          sex: patientDoc.sex && String(patientDoc.sex).trim() ? patientDoc.sex : null,
          dateOfBirth: patientDoc.dateOfBirth ? patientDoc.dateOfBirth : null,
          govtId: patientDoc.govtId && String(patientDoc.govtId).trim() ? patientDoc.govtId : null,
        };
      }
    }

    if (source === "registration" && appointment.registrationData) {
      const rd = appointment.registrationData;
      if (Array.isArray(rd.consents)) consents = rd.consents;
      const firstName = rd.firstName != null ? String(rd.firstName).trim() : (rd.name ? String(rd.name).trim().split(" ")[0] : null);
      const lastName = rd.lastName != null ? String(rd.lastName).trim() : (rd.name && rd.name.trim().split(" ").length > 1 ? rd.name.trim().split(" ").slice(1).join(" ") : null);
      const fullName = rd.name && String(rd.name).trim() ? rd.name.trim() : [firstName, lastName].filter(Boolean).join(" ") || null;
      patientData = {
        name: fullName,
        firstName: firstName || null,
        lastName: lastName || null,
        email: rd.email && String(rd.email).trim() ? rd.email.trim() : null,
        phone: rd.phone && String(rd.phone).trim() ? rd.phone : null,
        phoneCode: rd.phoneCode && String(rd.phoneCode).trim() ? rd.phoneCode : null,
        sex: rd.sex && String(rd.sex).trim() ? rd.sex : null,
        dateOfBirth: rd.dateOfBirth ? rd.dateOfBirth : null,
        govtId: rd.govtId && String(rd.govtId).trim() ? rd.govtId : null,
      };
    }
    if (!bookingConsentsAtBooking.length && Array.isArray(appointment.registrationData?.consents)) {
      bookingConsentsAtBooking = normalizeConsentSnapshot(appointment.registrationData.consents);
    }

    const reservationCreatedBy = formatReservationActorLabel(
      appointment.createdByRole || appointment.createdBy || "online"
    );
    const reservationCreatedAt = toDisplayDateTime(appointment.createdAt);
    const rescheduleHistoryRaw = Array.isArray(appointment.metadata?.rescheduleHistory)
      ? appointment.metadata.rescheduleHistory
      : [];
    const doctorIdsFromHistory = [
      ...new Set(
        rescheduleHistoryRaw
          .flatMap((h) => [h.previousDoctorId, h.newDoctorId])
          .filter((id) => id && mongoose.Types.ObjectId.isValid(String(id)))
          .map((id) => String(id))
      ),
    ];
    const doctorNameMap = new Map();
    if (doctorIdsFromHistory.length > 0) {
      const historyDoctors = await user
        .find(
          { _id: { $in: doctorIdsFromHistory.map((id) => new mongoose.Types.ObjectId(id)) } },
          { "name.first": 1, "name.last": 1 }
        )
        .lean();
      historyDoctors.forEach((d) => {
        doctorNameMap.set(
          String(d._id),
          `${d.name?.first || ""} ${d.name?.last || ""}`.trim() || "Unknown"
        );
      });
    }
    const rescheduleHistory = rescheduleHistoryRaw
      .slice()
      .sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0))
      .map((h) => ({
        action: h.action || "rescheduled",
        by: formatReservationActorLabel(h.byRole || "unknown"),
        at: toDisplayDateTime(h.changedAt),
        previousDate: h.previousDate || null,
        previousStartTime: h.previousStartTime || null,
        previousEndTime: h.previousEndTime || null,
        newDate: h.newDate || null,
        newStartTime: h.newStartTime || null,
        newEndTime: h.newEndTime || null,
        previousDoctor: h.previousDoctorId
          ? {
              id: h.previousDoctorId,
              name: doctorNameMap.get(String(h.previousDoctorId)) || null,
            }
          : null,
        newDoctor: h.newDoctorId
          ? {
              id: h.newDoctorId,
              name: doctorNameMap.get(String(h.newDoctorId)) || null,
            }
          : null,
      }));
    const latestReschedule = rescheduleHistory.length
      ? rescheduleHistory[rescheduleHistory.length - 1]
      : null;
    const notesForSummary =
      appointment.notes != null && String(appointment.notes).trim()
        ? String(appointment.notes).trim()
        : (appointment.registrationData?.message != null &&
           String(appointment.registrationData.message).trim())
          ? String(appointment.registrationData.message).trim()
          : null;
    const summaryParts = [
      `Created by: ${reservationCreatedBy}${reservationCreatedAt ? ` (${reservationCreatedAt})` : ""}`,
    ];
    if (latestReschedule) {
      summaryParts.push(
        `rescheduled by: ${latestReschedule.by}${latestReschedule.at ? ` (${latestReschedule.at})` : ""}`
      );
    }
    const summaryText = summaryParts.join("; ");

    return res.status(200).json({
      success: true,
      visitId,
      source,
      consents,
      bookingConsentsAtBooking,
      patientData,
      appointmentData: {
        visitId,
        status: appointment.status || null,
        date: appointment.date || null,
        startTime: appointment.startTime || null,
        endTime: appointment.endTime || null,
        notes: notesForSummary,
        reservation: {
          createdBy: reservationCreatedBy,
          createdAt: appointment.createdAt || null,
          createdAtDisplay: reservationCreatedAt,
          wasRescheduled: rescheduleHistory.length > 0,
          latestRescheduledBy: latestReschedule?.by || null,
          latestRescheduledAt: latestReschedule?.at || null,
          history: rescheduleHistory,
          summaryText,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching visit consents:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visit consents",
      error: error.message,
    });
  }
};

// Get appointment details including consultation, tests, and medications
exports.getAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
   console.log("hit")
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    const appointment = await Appointment.findById(id)
      .populate("doctor", "name.first name.last")
      .populate("patient", "name.first name.last")
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    let appointmentData;
    if (appointment.patient && appointment.patient._id) {
      const patientData = await patient.findById(appointment.patient._id).lean();
      appointmentData = {
        ...appointment,
        booking_source: appointment.booking_source || null,
        registrationData: appointment.registrationData || null,
        patient: {
          _id: appointment.patient._id,
          name: appointment.patient.name,
          patientId: patientData?.patientId || null,
          age: patientData?.age || null,
          dateOfBirth: patientData?.dateOfBirth || null,
          height: patientData?.height ?? null,
          weight: patientData?.weight ?? null,
          bloodPressure: patientData?.bloodPressure ?? null,
          temperature: patientData?.temperature ?? null,
          bloodPressureSystolic: patientData?.bloodPressureSystolic ?? null,
          bloodPressureDiastolic: patientData?.bloodPressureDiastolic ?? null,
          pulse: patientData?.pulse ?? null,
          oxygenSaturation: patientData?.oxygenSaturation ?? null,
          riskStatus: patientData?.riskStatus || null,
          treatmentStatus: patientData?.treatmentStatus || null,
          roomNumber: patientData?.roomNumber || null,
          govtId: patientData?.govtId || null
        }
      };
    } else {
      appointmentData = {
        ...appointment,
        booking_source: appointment.booking_source || null,
        registrationData: appointment.registrationData || null,
        patient: null,
      };
    }

    // appointmentData is already defined above, no need to redeclare

    console.log(appointmentData);
    // Add doctor name to consultation
    if (appointmentData.consultation) {
      appointmentData.consultation.consultationDoctor = `${appointmentData.doctor.name.first} ${appointmentData.doctor.name.last}`;

      // Ensure consultation fields exist
      appointmentData.consultation.interview =
        appointmentData.consultation.interview || "";
      appointmentData.consultation.physicalExamination =
        appointmentData.consultation.physicalExamination || "";
      appointmentData.consultation.treatment =
        appointmentData.consultation.treatment || "";
      appointmentData.consultation.recommendations =
        appointmentData.consultation.recommendations || "";

      // Add appointment start time to consultation data
      appointmentData.consultation.time = appointmentData.startTime || "";

      // Use appointment.date as fallback for consultationDate if it doesn't exist or is null
      if (!appointmentData.consultation.consultationDate) {
        appointmentData.consultation.consultationDate = appointmentData.date;
      }
    } else {
      appointmentData.consultation = {
        consultationDoctor: `${appointmentData.doctor.name.first} ${appointmentData.doctor.name.last}`,
        interview: "",
        physicalExamination: "",
        treatment: "",
        recommendations: "",
        time: appointmentData.startTime || "",
        consultationDate: appointmentData.date,
      };
    }

    // Format reports if they exist
    if (appointmentData.reports && appointmentData.reports.length > 0) {
      appointmentData.reports = appointmentData.reports.map((report) => ({
        ...report,
        uploadedAt: report.uploadedAt || new Date(),
        displayName: report.name || "Unnamed Report",
        url: report.fileUrl,
        type: report.fileType || "pdf",
      }));
    } else {
      appointmentData.reports = [];
    }

    res.status(200).json({
      success: true,
      data: decorateAppointmentResponseForFe(appointmentData),
    });
  } catch (error) {
    console.error("Error fetching appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointment details",
      error: error.message,
    });
  }
};

// Get all appointments for a patient
exports.getPatientAppointments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status, startDate, endDate } = req.query;

    const query = { patient: patientId };

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }

    const appointments = await Appointment.find(query)
      .populate("doctor", "name.first name.last")
      .sort({ date: -1, startTime: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: appointments.map((a) => decorateAppointmentResponseForFe(a)),
    });
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch patient appointments",
      error: error.message,
    });
  }
};

// Update appointment time, date and doctor
exports.updateAppointmentTime = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      date,
      startTime,
      endTime,
      doctorId,
      isBackdated = false, // Same override behavior as booking flow
      overrideConflicts = false, // Same override behavior as booking flow
    } = req.body;

    // Validate required fields
    if (!date || !startTime) {
      return res.status(400).json({
        success: false,
        message: "Date and start time are required",
      });
    }

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    // Find the appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Calculate new appointment date and time
    const appointmentDate = new Date(`${date}T${startTime}:00`);
    
    // Validate date format
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date or time format",
      });
    }

    const now = new Date();
    if (appointmentDate <= now && !isBackdated) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot move appointment to past date/time. Set isBackdated to true to override this restriction.",
      });
    }
    
    console.log("New appointment date:", appointmentDate);

    // If doctorId is provided, validate it
    let doctorToAssign = appointment.doctor;
    if (doctorId) {
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID format",
        });
      }
      
      // Check if doctor exists
      const doctorExists = await doctor.findById(doctorId);
      if (!doctorExists || doctorExists.role !== "doctor") {
        return res.status(404).json({
          success: false,
          message: "Doctor not found",
        });
      }
      
      doctorToAssign = doctorId;
    }

    // Use provided endTime or calculate based on existing duration
    let finalEndTime;
    if (endTime) {
      // Use the provided endTime
      finalEndTime = endTime;
    } else {
      // Calculate new end time based on existing duration
      const duration = appointment.duration || APPOINTMENT_CONFIG.DEFAULT_DURATION;
      const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
      const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
      const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
      finalEndTime = `${endTimeHour}:${endTimeMinute}`;
    }

    // Check for existing appointments at the new time (only if not overriding conflicts)
    if (!overrideConflicts) {
      const startOfDay = new Date(appointmentDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(appointmentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingAppointment = await Appointment.findOne({
        doctor: doctorToAssign,
        date: { $gte: startOfDay, $lte: endOfDay },
        startTime: startTime,
        status: "booked",
        _id: { $ne: id },
      });

      if (existingAppointment) {
        return res.status(409).json({
          success: false,
          message:
            "Jest już umówiona wizyta u tego lekarza w tym czasie. Set overrideConflicts to true to override this restriction.",
          conflict: true,
        });
      }
    }

    // Update the appointment
    const oldDate = appointment.date;
    const oldStartTime = appointment.startTime;
    const oldEndTime = appointment.endTime;
    const oldDoctorId = appointment.doctor;
    appointment.date = appointmentDate;
    appointment.startTime = startTime;
    appointment.endTime = finalEndTime;
    
    // Update doctor if provided
    if (doctorId) {
      appointment.doctor = doctorToAssign;
    }
    appointment.metadata = appointment.metadata || {};
    appointment.metadata.overrideConflicts = Boolean(overrideConflicts);
    appointment.metadata.isBackdated = Boolean(isBackdated);
    appointment.metadata.rescheduleHistory = appointment.metadata.rescheduleHistory || [];
    appointment.metadata.rescheduleHistory.push({
      action: "time_updated",
      byRole: req.user?.role || "online",
      byUserId: req.user?.id || req.user?._id || null,
      changedAt: new Date(),
      previousDate: oldDate || null,
      previousStartTime: oldStartTime || null,
      previousEndTime: oldEndTime || null,
      newDate: appointmentDate,
      newStartTime: startTime,
      newEndTime: finalEndTime,
      previousDoctorId: oldDoctorId || null,
      newDoctorId: doctorToAssign || oldDoctorId || null,
    });
    
    console.log("Before save - appointment date:", appointment.date);
    
    // Use updateOne instead of save() to ensure date is properly updated
    await Appointment.updateOne(
      { _id: id },
      { 
        $set: { 
          date: appointmentDate,
          startTime: startTime,
          endTime: finalEndTime,
          ...(doctorId ? { doctor: doctorToAssign } : {}),
          metadata: appointment.metadata,
        } 
      }
    );
    
    // Fetch the updated appointment to return in response
    const updatedAppointment = await Appointment.findById(id);
    console.log("After save - appointment date:", updatedAppointment.date);

    // Get doctor details for response
    const doctorDetails = await doctor.findById(updatedAppointment.doctor);

    res.status(200).json({
      success: true,
      message: "Appointment updated successfully",
      data: {
        id: updatedAppointment._id,
        date: updatedAppointment.date,
        startTime: updatedAppointment.startTime,
        endTime: updatedAppointment.endTime,
        overrideInfo: {
          overrideConflicts: Boolean(overrideConflicts),
          isBackdated: Boolean(isBackdated),
        },
        doctor: doctorDetails ? {
          id: doctorDetails._id,
          name: doctorDetails.name ? `${doctorDetails.name.first} ${doctorDetails.name.last}` : "Unknown"
        } : null
      },
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update appointment",
      error: error.message,
    });
  }
};

// Get appointments with pagination, sorting and filtering


// Upload report files to appointment
exports.uploadAppointmentReports = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    // Check if appointment exists
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Process uploaded files from req.files (Multer should attach this)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    // Create standardized report objects from uploaded files
    const reports = req.files.map((file) => {
      const standardizedDocument = createStandardizedDocument(file, "report");
      
      return {
        ...standardizedDocument,
        name: req.body.name || file.originalname,
        type: req.body.type || "Other",
        description: req.body.description || "",
        // Keep appointment-specific fields for backward compatibility
        fileUrl: standardizedDocument.url,
        fileType: standardizedDocument.mimeType.split("/")[1] || "pdf",
        metadata: {
          ...standardizedDocument.metadata,
          originalName: file.originalname,
          size: file.size,
          cloudinaryId: file.filename || file.public_id,
        },
      };
    });

    // Update appointment with new reports
    let updatedAppointment;
    if (appointment.reports && appointment.reports.length > 0) {
      // Append to existing reports
      updatedAppointment = await Appointment.findByIdAndUpdate(
        id,
        { $push: { reports: { $each: reports } } },
        { new: true }
      );
    } else {
      // Set reports if none exist
      updatedAppointment = await Appointment.findByIdAndUpdate(
        id,
        { reports: reports },
        { new: true }
      );
    }

    res.status(200).json({
      success: true,
      data: updatedAppointment.reports,
      message: `${reports.length} raport(y) przesłane pomyślnie`,
    });
  } catch (error) {
    console.error("Error uploading reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload reports",
      error: error.message,
    });
  }
};

// Update only consultation details
exports.updateConsultation = async (req, res) => {
  try {
    const { id } = req.params;
    const consultationData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format identyfikatora wizyty",
      });
    }

    // Get the current appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono spotkania",
      });
    }

    // Prepare consultation update data
    const prevCanonicalUpdate = getCanonicalVisitTypeFromConsult(appointment.consultation);
    const propagatedConsultation = propagateVisitTypeFields({
      existingConsultation: appointment.consultation || {},
      consultationType: consultationData.consultationType,
      visitType: consultationData.visitType,
      visitReason: consultationData.visitReason,
    });
    const nextCanonicalUpdate = getCanonicalVisitTypeFromConsult(propagatedConsultation);
    const visitTypeChangedUpdate = prevCanonicalUpdate !== nextCanonicalUpdate;
    const visitTypeVerifiedResolved =
      consultationData.visitTypeVerified !== undefined
        ? Boolean(consultationData.visitTypeVerified)
        : visitTypeChangedUpdate
          ? false
          : appointment.consultation?.visitTypeVerified ?? true;

    const consultationUpdate = {
      ...propagatedConsultation,
      visitTypeVerified: visitTypeVerifiedResolved,
      consultationNotes:
        consultationData.notes ||
        consultationData.consultationNotes ||
        appointment.consultation?.consultationNotes,
      description:
        consultationData.description || appointment.consultation?.description,
      treatmentCategory:
        consultationData.treatmentCategory ||
        appointment.consultation?.treatmentCategory,
      consultationStatus:
        consultationData.status ||
        consultationData.consultationStatus ||
        appointment.consultation?.consultationStatus ||
        "Zaplanowane",
      isOnline:
        consultationData.isOnline !== undefined
          ? consultationData.isOnline
          : appointment.consultation?.isOnline,
      roomNumber:
        consultationData.roomNumber !== undefined
          ? consultationData.roomNumber
          : appointment.consultation?.roomNumber,
      isRisky:
        consultationData.isRisky !== undefined
          ? consultationData.isRisky
          : appointment.consultation?.isRisky,

      // Ensure the four required fields are included
      interview:
        consultationData.interview || appointment.consultation?.interview || "",
      physicalExamination:
        consultationData.physicalExamination ||
        appointment.consultation?.physicalExamination ||
        "",
      treatment:
        consultationData.treatment || appointment.consultation?.treatment || "",
      recommendations:
        consultationData.recommendations ||
        appointment.consultation?.recommendations ||
        "",

      // Add time from appointment's startTime if not provided
      time:
        consultationData.time ||
        appointment.startTime ||
        appointment.consultation?.time ||
        "",
    };

    // Add consultation date if provided
    if (consultationData.date || consultationData.consultationDate) {
      const dateValue =
        consultationData.date || consultationData.consultationDate;
      const consultDate = new Date(dateValue);
      if (!isNaN(consultDate.getTime())) {
        consultationUpdate.consultationDate = consultDate;
      }
    } else if (appointment.consultation?.consultationDate) {
      consultationUpdate.consultationDate =
        appointment.consultation.consultationDate;
    } else {
      consultationUpdate.consultationDate = new Date();
    }

    const updatePayload = { consultation: consultationUpdate };
    if (consultationUpdate.visitType) {
      updatePayload.metadata = {
        ...(appointment.metadata && typeof appointment.metadata === "object" ? appointment.metadata : {}),
        visitType: consultationUpdate.visitType,
      };
    }
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      updatePayload,
      { new: true, runValidators: true }
    );

    // Add start time to the response
    if (!updatedAppointment.consultation.time && updatedAppointment.startTime) {
      updatedAppointment.consultation.time = updatedAppointment.startTime;
    }

    const consultPlain = updatedAppointment.toObject
      ? updatedAppointment.toObject()
      : updatedAppointment;
    const decoratedConsultResponse = decorateAppointmentResponseForFe(consultPlain);
    res.status(200).json({
      success: true,
      message: "Consultation updated successfully",
      data: {
        consultation: decoratedConsultResponse.consultation,
        visitType: decoratedConsultResponse.visitType,
      },
    });
  } catch (error) {
    console.error("Error updating consultation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update consultation",
      error: error.message,
    });
  }
};

// Get appointments by doctor ID grouped by date
exports.getDoctorAppointmentsByDate = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate, status = "all" } = req.query;

    const query = {
      doctor: doctorId,
    };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }

    if (status !== "all") {
      query.status = status;
    }

    const appointments = await Appointment.find(query)
      .populate("patient", "name sex dateOfBirth")
      .sort({ date: 1, startTime: 1 })
      .lean();

    // Group appointments by date
    const groupedAppointments = appointments.reduce((acc, appointment) => {
      const date = appointment.date.toISOString().split("T")[0];

      if (!acc[date]) {
        acc[date] = [];
      }

      // Calculate age
      let age = null;
      if (appointment.patient?.dateOfBirth) {
        const todayUTC = new Date();
        const today = toZonedTime(todayUTC, "Europe/Warsaw");
        const birthDate = new Date(appointment.patient.dateOfBirth);
        age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
      }

      acc[date].push({
        appointmentId: appointment._id,
        patientName: appointment.patient
          ? `${appointment.patient.name.first} ${appointment.patient.name.last}`
          : "Unknown",
        age: age,
        gender: appointment.patient?.sex || "Unknown",
        appointmentTime: appointment.startTime,
        status: appointment.status,
        mode: appointment.mode,
        meetLink:
          appointment?.mode == "online" ? appointment?.joining_link : null,
      });

      return acc;
    }, {});

    // Convert to array format and sort dates
    const formattedResponse = Object.entries(groupedAppointments)
      .map(([date, appointments]) => ({
        date,
        appointments: appointments.sort((a, b) =>
          a.appointmentTime.localeCompare(b.appointmentTime)
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      data: formattedResponse,
    });
  } catch (error) {
    console.error("Error fetching doctor appointments by date:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
};

/** Date filter for appointment list: startDate → $gte only; endDate → $lte only when provided (no default cap). */
function buildAppointmentListDateRange(startDate, endDate) {
  const hasStart = startDate != null && String(startDate).trim() !== "";
  const hasEnd = endDate != null && String(endDate).trim() !== "";
  if (!hasStart && !hasEnd) {
    return { range: null };
  }
  const range = {};
  if (hasStart) {
    const startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      return { error: "Invalid start date format" };
    }
    range.$gte = startDateObj;
  }
  if (hasEnd) {
    const endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime())) {
      return { error: "Invalid end date format" };
    }
    range.$lte = endDateObj;
  }
  return { range };
}

exports.getAppointments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "date",
      sortOrder = "desc",
      status,
      startDate,
      endDate,
      doctorId,
      appointmentId,
      searchTerm,
      isClinicIp,
      // Clinic-only filter: when true and isClinicIp=true, return only patient-less (visit-only) appointments
      patientLessOnly,
      // Appointment type: filter by consultation.visitType / metadata.visitType (e.g. "Konsultacja pierwszorazowa" or "Badanie USG")
      visitType: visitTypeParam,
      visitReason: visitReasonParam,
      // Consultation form: "online" | "offline" – filter by appointment.mode
      mode: modeParam,
    } = req.query;

    // Support both visitReason and visitType query params (visitReason kept as legacy alias)
    const visitTypeFilter =
      (visitReasonParam && String(visitReasonParam).trim()) ||
      (visitTypeParam && String(visitTypeParam).trim());

    // Derived flags
    const visitOnlyFilter =
      patientLessOnly === "true" ||
      patientLessOnly === true ||
      patientLessOnly === "1";

    // Validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Invalid page number. Must be a positive integer."
      });
    }
    
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        message: "Invalid limit. Must be a positive integer between 1 and 100."
      });
    }

    const dateRangeResult = buildAppointmentListDateRange(startDate, endDate);
    if (dateRangeResult.error) {
      return res.status(400).json({
        success: false,
        message: dateRangeResult.error,
      });
    }

    const isDoctorRole = req.user?.role === "doctor";
    // Doctor tokens are always scoped to their own appointments.
    const effectiveDoctorId = isDoctorRole ? req.user?.id : doctorId;

    // Build query
    const query = {};

    // Status filter
    if (status && status !== "all") {
      if (status === "checkedIn") {
        query.status = status;
      } else {
        query.status = status.toLowerCase();
      }
    }


    if (dateRangeResult.range) {
      query.date = dateRangeResult.range;
    }

    // Doctor filter: accept doctorId as User _id or as doctor d_id (resolve to User _id for appointment query)
    let resolvedDoctorId = null;
    if (effectiveDoctorId && String(effectiveDoctorId).trim()) {
      const idStr = String(effectiveDoctorId).trim();
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        const doctorUser = await user.findOne(
          { role: "doctor", $or: [{ _id: new mongoose.Types.ObjectId(idStr) }, { d_id: idStr }] },
          { _id: 1 }
        ).lean();
        if (doctorUser) {
          resolvedDoctorId = doctorUser._id;
        } else {
          resolvedDoctorId = new mongoose.Types.ObjectId(idStr);
        }
      } else {
        const doctorUser = await user.findOne({ role: "doctor", d_id: idStr }, { _id: 1 }).lean();
        if (doctorUser) resolvedDoctorId = doctorUser._id;
      }
      if (resolvedDoctorId) {
        query.doctor = resolvedDoctorId;
      }
    }

    // Appointment ID filter
    if (appointmentId) {
      // Validate appointmentId format
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID format"
        });
      }
      query._id = new mongoose.Types.ObjectId(appointmentId);
    }

    // Note: Search logic is handled separately in clinic vs non-clinic branches

    // Build sort object - always sort by date in ascending order for appointments
    const sortObject = {};
    sortObject.date = 1; // Always ascending order for dates

    let responseData;
    let uniqueAppointments = []; // Define it here so it's always available

    // Handle isClinicIp=true case - Group by date but keep response format the same
    if (isClinicIp === "true") {
      // Build the match conditions for the clinic case (used at start of pipeline and for search)
      const matchConditions = {};
      
      // Add base query conditions (status, date range, doctorId)
      if (status && status !== "all") {
        if (status === "checkedIn") {
          matchConditions.status = status;
        } else {
          matchConditions.status = status.toLowerCase();
        }
      }
      // When filtering for visit-only (patientLessOnly=true) and no explicit status is provided,
      // default to excluding cancelled visits so reception sees only active (non-cancelled) visit-only appointments.
      if (visitOnlyFilter && (!status || status === "all")) {
        matchConditions.status = { $ne: "cancelled" };
      }

      if (dateRangeResult.range) {
        matchConditions.date = { ...dateRangeResult.range };
      }

      if (resolvedDoctorId) {
        matchConditions.doctor = resolvedDoctorId;
      }

      if (appointmentId) {
        // Validate appointmentId format
        if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid appointment ID format"
          });
        }
        matchConditions._id = new mongoose.Types.ObjectId(appointmentId);
      }

      // Visit type filter (Rodzaj wizyty): match consultation.visitType or metadata.visitType
      if (visitTypeFilter) {
        const vt = String(visitTypeFilter).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const vtRe = new RegExp(vt, "i");
        matchConditions.$and = matchConditions.$and || [];
        matchConditions.$and.push({
          $or: [
            { "consultation.visitType": vtRe },
            { "metadata.visitType": vtRe },
            { "consultation.consultationType": vtRe },
          ],
        });
      }

      // Consultation form filter (in-person vs online): appointment.mode
      if (modeParam && String(modeParam).trim()) {
        const modeVal = String(modeParam).trim().toLowerCase();
        if (modeVal === "online" || modeVal === "offline") {
          matchConditions.mode = modeVal;
        }
      }

      // Pipeline: match first (include all appointment filters), then lookup patient/doctor.
      // Use preserveNullAndEmptyArrays on patient unwind so visit-only (no patient) appointments are included.
      let appointmentsPipeline = [];
      if (Object.keys(matchConditions).length > 0) {
        appointmentsPipeline.push({ $match: matchConditions });
      }
      appointmentsPipeline.push(
        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "patientData",
          },
        },
        // Keep visit-only appointments: do not drop when patient is null
        { $unwind: { path: "$patientData", preserveNullAndEmptyArrays: true } },
        // Exclude only when patient exists and is deleted
        {
          $match: {
            $or: [
              { patientData: { $exists: false } },
              { patientData: null },
              { "patientData.deleted": { $ne: true } },
            ],
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "doctorData",
          },
        },
        { $unwind: "$doctorData" }
      );

      // Clinic-only filter: when visitOnlyFilter is true, keep only visit-only (no patient) appointments
      if (visitOnlyFilter) {
        appointmentsPipeline.push({
          $match: {
            $or: [
              { patient: null },
              { patientData: { $exists: false } },
              { patientData: null },
            ],
          },
        });
      }

      // Add search conditions if searchTerm exists (include registrationData for visit-only)
      if (searchTerm) {
        const searchRegex = { $regex: searchTerm, $options: "i" };
        appointmentsPipeline.push({
          $match: {
            $or: [
              { "patientData.name.first": searchRegex },
              { "patientData.name.last": searchRegex },
              {
                $expr: {
                  $regexMatch: {
                    input: {
                      $concat: [
                        { $ifNull: ["$patientData.name.first", ""] },
                        " ",
                        { $ifNull: ["$patientData.name.last", ""] },
                      ],
                    },
                    regex: searchTerm,
                    options: "i",
                  },
                },
              },
              { "patientData.email": searchRegex },
              { "patientData.phone": searchRegex },
              { "patientData.patientId": searchRegex },
              { "patientData.govtId": searchRegex },
              { tempPesel: searchRegex },
              { "registrationData.pendingPesel": searchRegex },
              { notes: searchRegex },
              { "consultation.consultationNotes": searchRegex },
              { "consultation.description": searchRegex },
              { "consultation.interview": searchRegex },
              { "consultation.physicalExamination": searchRegex },
              { "consultation.treatment": searchRegex },
              { "consultation.recommendations": searchRegex },
              // Visit-only: search registrationData
              { "registrationData.firstName": searchRegex },
              { "registrationData.lastName": searchRegex },
              { "registrationData.name": searchRegex },
              { "registrationData.phone": searchRegex },
              { "registrationData.email": searchRegex },
            ],
          },
        });
      }

      // Add sorting
      appointmentsPipeline.push({ $sort: sortObject });

      let appointments = await Appointment.aggregate(appointmentsPipeline);

      // Process appointments data (include visit-only: patient null, optional registrationData)
      let appointmentsWithAge = appointments.map((appointment) => {
        const patientData = appointment.patientData;
        let age = null;
        if (patientData?.dateOfBirth) {
          const today = new Date();
          const birthDate = new Date(patientData.dateOfBirth);
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (
            monthDiff < 0 ||
            (monthDiff === 0 && today.getDate() < birthDate.getDate())
          ) {
            age--;
          }
        }

        const hasPatient = patientData && (patientData._id || patientData.id);
        const mode = appointment.mode != null && appointment.mode !== "" ? appointment.mode : "offline";
        return {
          id: appointment._id,
          _id: appointment._id,
          created_at: appointment.createdAt ?? null,
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          meetLink: appointment?.joining_link || "",
          status: appointment.status,
          mode,
          modeDisplay: mode === "online" ? "online" : "in-person",
          checkIn: appointment.checkedIn,
          checkInDate: appointment.checkInDate,
          patient: hasPatient
            ? {
                patient_status: patientData?.status,
                id: patientData?._id,
                _id: patientData?._id,
                patientId: patientData?.patientId,
                name: `${patientData.name?.first || ""} ${patientData.name?.last || ""}`.trim() || null,
                sex: patientData?.sex,
                age: age,
                phoneNumber: patientData?.phone,
                profilePicture: patientData?.profilePicture || null,
                email: patientData?.email,
              }
            : null,
          patient_id: hasPatient ? patientData?._id : null,
          isVisitOnly: !hasPatient,
          registrationData: appointment.registrationData || null,
          registrationType: appointment.registrationType || "online registration",
          doctor: appointment.doctorData
            ? {
                id: appointment.doctorData._id,
                name: `${appointment.doctorData.name.first} ${appointment.doctorData.name.last}`,
                email: appointment.doctorData.email,
              }
            : null,
          metadata: appointment.metadata || {},
          isInternational: !!(appointment.metadata?.isInternational || appointment.registrationData?.isInternationalPatient),
          role: appointment.createdByRole != null ? appointment.createdByRole : "online",
          visitMode: appointment.mode != null && appointment.mode !== "" ? appointment.mode : "offline",
          visitType: getVisitTypeDisplayForFe(appointment),
          visitTypeVerified: Boolean(appointment.consultation?.visitTypeVerified),
        };
      });

      // Group by date and apply pagination
      const groupedByDate = {};
      appointmentsWithAge.forEach((appointment) => {
        const appointmentDate = new Date(appointment.date);
        const dateKey = appointmentDate.toISOString().split("T")[0];
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        appointment.dateGroup = dateKey;
        groupedByDate[dateKey].push(appointment);
      });

      // Sort appointments by date - from today onwards (ascending order)
      const sortedAppointments = Object.keys(groupedByDate)
        .sort((a, b) => a.localeCompare(b)) // Always ascending order for dates
        .flatMap((date) => groupedByDate[date]);

      const skip = (pageNum - 1) * limitNum;
      responseData = sortedAppointments.slice(skip, skip + limitNum);

      const total = sortedAppointments.length;

      return res.status(200).json({
        success: true,
        data: responseData,
        pagination: {
          total: total,
          page: pageNum,
          pages: Math.ceil(total / limitNum),
          limit: limitNum,
        },
      });
    } else {
      // For non-clinic mode, get patients based on doctorId
      const patientQuery = resolvedDoctorId
        ? {
            $or: [
              { consultingDoctor: resolvedDoctorId },
              { attendingPhysician: resolvedDoctorId },
            ],
          }
        : {};

      // Get all patients (including those without appointments)
      let allPatients = await user
        .find({
          role: "patient",
          deleted: { $ne: true }, // Exclude deleted patients
          ...patientQuery,
        })
        .select(
          "name email profilePicture sex dateOfBirth patientId status phone consultingDoctor govtId"
        )
        .sort({ "name.first": 1 })
        .lean();

      // Apply search filter to patients if searchTerm is provided
      if (searchTerm) {
        allPatients = allPatients.filter(patient => {
          const fullName = `${patient.name.first} ${patient.name.last}`.toLowerCase();
          const searchLower = searchTerm.toLowerCase();
          
          return (
            patient.name.first.toLowerCase().includes(searchLower) ||
            patient.name.last.toLowerCase().includes(searchLower) ||
            fullName.includes(searchLower) ||
            (patient.email && patient.email.toLowerCase().includes(searchLower)) ||
            (patient.phone && patient.phone.includes(searchTerm)) ||
            (patient.patientId && patient.patientId.toLowerCase().includes(searchLower)) ||
            (patient.govtId && patient.govtId.includes(searchTerm))
          );
        });
      }

      console.log("status at this point ",status && status !== "all" && status !== "no_appointment" ? 
        status === "checkedIn" ? { status: status } : { status: status.toLowerCase() }
      : {})
      
      // Build appointment query. Non-clinic: only appointments with a patient (exclude visit-only). Clinic (isClinicIp true) includes visit-only in its branch above.
      let appointmentQuery;
      try {
        const visitReasonMatch = visitTypeFilter
          ? (() => {
              const vt = String(visitTypeFilter).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const vtRe = new RegExp(vt, "i");
              return {
                $or: [
                  { "consultation.visitType": vtRe },
                  { "metadata.visitType": vtRe },
                  { "consultation.consultationType": vtRe },
                ],
              };
            })()
          : {};
        appointmentQuery = {
        patient: { $ne: null },
        ...(resolvedDoctorId ? { doctor: resolvedDoctorId } : {}),
        ...(appointmentId ? { _id: new mongoose.Types.ObjectId(appointmentId) } : {}),
        ...(status && status !== "all" && status !== "no_appointment" ? 
          status === "checkedIn" ? { status: status } : { status: status.toLowerCase() }
        : {}),
        ...(dateRangeResult.range ? { date: { ...dateRangeResult.range } } : {}),
        ...visitReasonMatch,
        };
      } catch (dateError) {
        return res.status(400).json({
          success: false,
          message: dateError.message
        });
      }

      console.log("appointment query", appointmentQuery);

      // Non-clinic: only appointments with patient (no visit-only)
      const allAppointments = await Appointment.find(appointmentQuery)
        .populate("doctor", "name email")
        .populate("patient", "name email phone patientId status sex dateOfBirth profilePicture govtId")
        .sort({ date: 1 }) // Sort by date in ascending order
        .lean();

      console.log("allAppointments", allAppointments);

      // Helper function to calculate age
      const calculatePatientAge = (dateOfBirth) => {
        if (!dateOfBirth) return null;
        const todayUTC = new Date();
        const today = toZonedTime(todayUTC, "Europe/Warsaw");
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      };

      // Non-clinic: one row per patient, showing only that patient's first visit (earliest date + time)
      const sortedByFirstVisit = [...allAppointments].sort((a, b) => {
        const dA = new Date(a.date);
        const dB = new Date(b.date);
        if (dA.getTime() !== dB.getTime()) return dA.getTime() - dB.getTime();
        return (a.startTime || "00:00").localeCompare(b.startTime || "00:00");
      });
      const firstVisitByPatient = new Map(); // patientId -> appointment (first chronologically)
      sortedByFirstVisit.forEach((apt) => {
        const pid = apt.patient?._id?.toString();
        if (!pid) return;
        if (!firstVisitByPatient.has(pid)) {
          firstVisitByPatient.set(pid, apt);
        }
      });

      const appointmentRows = [];
      const patientIdsInAppointments = new Set();
      firstVisitByPatient.forEach((appointment) => {
        const patientId = appointment.patient?._id?.toString();
        if (patientId) {
          patientIdsInAppointments.add(patientId);
        }
        const isVisitOnly = !appointment.patient || !appointment.patient._id;
        const patientDoc = appointment.patient;
        const age = patientDoc?.dateOfBirth ? calculatePatientAge(patientDoc.dateOfBirth) : null;
        appointmentRows.push({
          id: appointment._id,
          _id: appointment._id,
          created_at: appointment.createdAt ?? null,
          date: appointment.date || new Date(),
          startTime: appointment.startTime || "00:00",
          endTime: appointment.endTime || "00:00",
          meetLink: appointment.joining_link || "",
          status: appointment.status || "zaplanowane",
          mode: appointment.mode || "klinika",
          checkIn: appointment.checkedIn || false,
          checkInDate: appointment.checkInDate || null,
          isAppointment: true,
          patient: isVisitOnly
            ? null
            : {
                patient_status: patientDoc?.status,
                id: patientDoc._id,
                _id: patientDoc._id,
                patientId: patientDoc.patientId,
                name: `${patientDoc.name?.first || ""} ${patientDoc.name?.last || ""}`.trim() || null,
                sex: patientDoc?.sex,
                age,
                phoneNumber: patientDoc?.phone,
                profilePicture: patientDoc?.profilePicture || null,
                email: patientDoc?.email,
                govtId: patientDoc?.govtId || null,
              },
          patient_id: isVisitOnly ? null : patientDoc?._id,
          isVisitOnly,
          tempPesel: appointment.tempPesel || null,
          ...(appointment.registrationData && { registrationData: appointment.registrationData }),
          registrationType: appointment.registrationType || "online registration",
          doctor: appointment.doctor
            ? {
                id: appointment.doctor._id,
                name: `${appointment.doctor.name.first} ${appointment.doctor.name.last}`,
                email: appointment.doctor.email,
              }
            : null,
          metadata: appointment.metadata || {},
          isInternational: !!(appointment.metadata?.isInternational || appointment.registrationData?.isInternationalPatient),
          role: appointment.createdByRole != null ? appointment.createdByRole : "online",
          visitMode: appointment.mode != null && appointment.mode !== "" ? appointment.mode : "offline",
          visitType: getVisitTypeDisplayForFe(appointment),
          visitTypeVerified: Boolean(appointment.consultation?.visitTypeVerified),
        });
      });

      // Apply search to appointment rows (patient or registrationData)
      let filteredAppointmentRows = appointmentRows;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        filteredAppointmentRows = appointmentRows.filter((row) => {
          if (row.patient) {
            const name = (row.patient.name || "").toLowerCase();
            const email = (row.patient.email || "").toLowerCase();
            const phone = String(row.patient.phoneNumber || row.patient.phone || "");
            const patientId = (row.patient.patientId || "").toLowerCase();
            const govtId = String(row.patient.govtId || "");
            return name.includes(searchLower) || email.includes(searchLower) || phone.includes(searchTerm) || patientId.includes(searchLower) || govtId.includes(searchTerm);
          }
          if (row.registrationData) {
            const rd = row.registrationData;
            const firstName = (rd.firstName || rd.name || "").toLowerCase();
            const lastName = (rd.lastName || "").toLowerCase();
            const name = (rd.name || "").toLowerCase();
            const phone = String(rd.phone || "");
            const email = (rd.email || "").toLowerCase();
            const pendingPesel = String(rd.pendingPesel || "");
            const matchReg = firstName.includes(searchLower) || lastName.includes(searchLower) || name.includes(searchLower) || phone.includes(searchTerm) || email.includes(searchLower) || pendingPesel.includes(searchTerm);
            if (matchReg) return true;
          }
          if (row.tempPesel && String(row.tempPesel).includes(searchTerm)) return true;
          return false;
        });
      }

      // Add rows for patients who have no appointments (no_appointment)
      const processedPatients = [
        ...filteredAppointmentRows,
        ...allPatients
          .filter((p) => !patientIdsInAppointments.has(p._id.toString()))
          .map((patient) => {
            const age = calculatePatientAge(patient.dateOfBirth);
            return {
              id: null,
              date: new Date(),
              startTime: "00:00",
              endTime: "00:00",
              meetLink: "",
              status: "no_appointment",
              mode: "none",
              checkIn: false,
              checkInDate: null,
              isAppointment: false,
              patient: {
                patient_status: patient.status,
                id: patient._id,
                patientId: patient.patientId,
                name: `${patient.name.first} ${patient.name.last}`,
                sex: patient.sex,
                age: age,
                phoneNumber: patient.phone,
                profilePicture: patient.profilePicture || null,
                email: patient.email,
              },
              doctor: null,
              registrationType: null,
              metadata: {},
            };
          }),
      ];

             // Filter by status
       let filteredPatients = processedPatients;
       if (status && status !== "all") {
         if (status === "no_appointment") {
           // Only return patients without appointments
           filteredPatients = processedPatients.filter(p => p.status === "no_appointment");
         }else {
          const normalizedStatus = status === "checkedIn" ? status : status.toLowerCase();
          // Only return patients with appointments that match the specified status
          filteredPatients = processedPatients.filter(
            p => p.isAppointment === true && p.status === normalizedStatus
          );
        }
       }

      // Sort by date - appointments from today onwards (ascending), no_appointment cases at the end
      filteredPatients.sort((a, b) => {
        if (a.status === "no_appointment" && b.status !== "no_appointment") {
          return 1; // a comes after b
        }
        if (a.status !== "no_appointment" && b.status === "no_appointment") {
          return -1; // a comes before b
        }
        // For appointments, sort by date in ascending order (today onwards)
        return new Date(a.date) - new Date(b.date);
      });

      // Calculate skip for pagination
      const skip = (pageNum - 1) * limitNum;

      // Apply pagination
      responseData = filteredPatients.slice(skip, skip + limitNum);

      return res.status(200).json({
        success: true,
        data: responseData,
        pagination: {
          total: filteredPatients.length,
          page: pageNum,
          pages: Math.ceil(filteredPatients.length / limitNum),
          limit: limitNum,
        },
      });
    }
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error.message,
    });
  }
};

/**
 * Get visit reason dictionary (categories + types) for registration and doctor verification.
 * All values are in Polish. FE: show category dropdown → then type dropdown; send displayName as visitType.
 * @route GET /api/appointments/visit-reasons
 */
exports.getVisitReasons = async (req, res) => {
  try {
    const categories = getVisitReasonsConfig();
    res.status(200).json({
      success: true,
      data: { categories },
    });
  } catch (error) {
    console.error("Error fetching visit reasons:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać słownika rodzajów wizyt",
      error: error.message,
    });
  }
};

/**
 * Set consultation visit type verification flag (doctor/admin).
 * Does not require visitType to be populated.
 *
 * @route PATCH /api/appointments/visit-reason/verify/:id
 */
exports.verifyVisitReason = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    const updated = await Appointment.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          "consultation.visitTypeVerified": true,
        },
      },
      { new: true }
    ).select("consultation.visitTypeVerified");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    return res.status(200).json({
      success: true,
      appointmentId: updated._id,
      // Legacy FE compatibility: keep both keys in response.
      visitReasonVerified: updated.consultation?.visitTypeVerified === true,
      visitTypeVerified: updated.consultation?.visitTypeVerified === true,
    });
  } catch (error) {
    console.error("verifyVisitReason error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Get visitTypeVerified status for a single appointment.
 * Any authenticated role can call.
 *
 * @route GET /api/appointments/visit-reason/verify/:id/status
 */
exports.getVisitReasonVerifiedStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    const appointment = await Appointment.findById(id)
      .read("primary")
      .select("consultation.visitTypeVerified")
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    return res.status(200).json({
      success: true,
      appointmentId: id,
      // Legacy FE compatibility: keep both keys in response.
      visitReasonVerified: Boolean(appointment.consultation?.visitTypeVerified),
      visitTypeVerified: Boolean(appointment.consultation?.visitTypeVerified),
    });
  } catch (error) {
    console.error("getVisitReasonVerifiedStatus error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * Public maintenance endpoint: migrate legacy consultation.visitReason -> consultation.visitType.
 * No auth by request. Use carefully.
 *
 * @route POST /api/appointments/maintenance/migrate-visit-reason-to-visit-type
 */
exports.migrateVisitReasonToVisitType = async (req, res) => {
  try {
    const dryRunRaw = req.body?.dryRun ?? req.query?.dryRun;
    const dryRun =
      dryRunRaw === true ||
      String(dryRunRaw || "").toLowerCase() === "true" ||
      String(dryRunRaw || "") === "1";
    const limitRaw = req.body?.limit ?? req.query?.limit;
    const limitNum = Math.min(
      Math.max(parseInt(limitRaw, 10) || 5000, 1),
      50000
    );

    const criteria = {
      "consultation.visitReason": { $exists: true, $type: "string", $ne: "" },
      $or: [
        { "consultation.visitType": { $exists: false } },
        { "consultation.visitType": null },
        { "consultation.visitType": "" },
      ],
    };

    const candidates = await Appointment.find(criteria)
      .select("_id consultation.visitReason consultation.visitType metadata.visitType")
      .limit(limitNum)
      .lean();

    const operations = candidates
      .map((doc) => {
        const reason = String(doc?.consultation?.visitReason || "").trim();
        if (!reason) return null;
        const setPayload = {
          "consultation.visitType": reason,
        };
        if (!doc?.metadata?.visitType || !String(doc.metadata.visitType).trim()) {
          setPayload["metadata.visitType"] = reason;
        }
        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: setPayload },
          },
        };
      })
      .filter(Boolean);

    let modifiedCount = 0;
    if (!dryRun && operations.length > 0) {
      const bulkResult = await Appointment.bulkWrite(operations, { ordered: false });
      modifiedCount = bulkResult?.modifiedCount || 0;
    }

    const remaining = await Appointment.countDocuments(criteria);

    return res.status(200).json({
      success: true,
      dryRun,
      scanned: candidates.length,
      eligible: operations.length,
      migrated: dryRun ? 0 : modifiedCount,
      remainingLegacyRecords: remaining,
      message: dryRun
        ? "Dry run completed. No records were modified."
        : "Legacy visitReason -> visitType migration completed.",
    });
  } catch (error) {
    console.error("migrateVisitReasonToVisitType error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to migrate legacy visit reason data",
      error: error.message,
    });
  }
};

/**
 * Public maintenance endpoint: best-effort rollback for legacy migration.
 * Reverts records that look auto-migrated by migrateVisitReasonToVisitType:
 * consultation.visitType equals consultation.visitReason.
 *
 * @route POST /api/appointments/maintenance/revert-visit-type-migration
 */
exports.revertVisitTypeMigration = async (req, res) => {
  try {
    const dryRunRaw = req.body?.dryRun ?? req.query?.dryRun;
    const dryRun =
      dryRunRaw === true ||
      String(dryRunRaw || "").toLowerCase() === "true" ||
      String(dryRunRaw || "") === "1";
    const limitRaw = req.body?.limit ?? req.query?.limit;
    const limitNum = Math.min(
      Math.max(parseInt(limitRaw, 10) || 5000, 1),
      50000
    );

    // Candidate set: legacy reason exists and visitType exists.
    const baseCriteria = {
      "consultation.visitReason": { $exists: true, $type: "string", $ne: "" },
      "consultation.visitType": { $exists: true, $type: "string", $ne: "" },
    };

    const candidates = await Appointment.find(baseCriteria)
      .select("_id consultation.visitReason consultation.visitType metadata.visitType")
      .limit(limitNum)
      .lean();

    // Best-effort rollback signature:
    // - consultation.visitType exactly matches legacy visitReason.
    // - metadata.visitType is either missing OR equals the same value.
    const operations = candidates
      .map((doc) => {
        const reason = String(doc?.consultation?.visitReason || "").trim();
        const type = String(doc?.consultation?.visitType || "").trim();
        if (!reason || !type) return null;
        if (reason !== type) return null;

        const unsetPayload = { "consultation.visitType": "" };
        const metaType = doc?.metadata?.visitType;
        if (
          metaType == null ||
          String(metaType).trim() === "" ||
          String(metaType).trim() === reason
        ) {
          unsetPayload["metadata.visitType"] = "";
        }

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $unset: unsetPayload },
          },
        };
      })
      .filter(Boolean);

    let modifiedCount = 0;
    if (!dryRun && operations.length > 0) {
      const bulkResult = await Appointment.bulkWrite(operations, { ordered: false });
      modifiedCount = bulkResult?.modifiedCount || 0;
    }

    return res.status(200).json({
      success: true,
      dryRun,
      scanned: candidates.length,
      eligible: operations.length,
      reverted: dryRun ? 0 : modifiedCount,
      message: dryRun
        ? "Dry run completed. No records were modified."
        : "Best-effort rollback completed for eligible migrated records.",
      note:
        "Rollback is heuristic-based (visitType == legacy visitReason). Review with dryRun before executing.",
    });
  } catch (error) {
    console.error("revertVisitTypeMigration error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to rollback visit type migration",
      error: error.message,
    });
  }
};