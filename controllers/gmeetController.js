const User = require("../models/user-entity/user");
const Appointment = require("../models/appointment");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/mailer");
const { formatDateForSMS, formatTimeForSMS } = require("../utils/dateUtils");
const MessageReceipt = require("../models/smsData");
const { sendSMS } = require("../utils/smsapi");
const { getCalendarClient } = require("../config/googleCalendar");
const path = require("path");
const fs = require("fs");
const { getMeetingsClient } = require("../utils/zohoMeetings");

// Import centralized appointment configuration
const APPOINTMENT_CONFIG = require("../config/appointmentConfig");
// const doctor = require("../models/user-entity/doctor");
// const Service = require("../models/service");
// const PatientService = require("../models/patientService");
// const mongoose = require("mongoose");

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
  
  // Full HTML template with all formatting - using regular CSS instead of Tailwind
  let html = `<html>

  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Potwierdzenie wizyty</title>
    <script>
      window.FontAwesomeConfig = {
        autoReplaceSvg: 'nest'
      };
    </script>
    <script
      src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/js/all.min.js"
      crossorigin="anonymous" referrerpolicy="no-referrer"></script>
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
            <div class="text-lg font-semibold text-navy">Centrum Medyczne 7
            </div>
          </div>
          <div class="text-xs text-gray-500 uppercase tracking-wider">
            automatyczny system powiadomień</div>
        </div>
      </header>
      <section id="title-section" class="px-8 py-12 text-center">
        <div class="flex justify-center mb-6"><i
            class="fa-solid fa-calendar-check text-4xl text-teal-custom"></i>
        </div>
        <h1 class="text-3xl font-bold text-navy mb-4">Potwierdzenie wizyty</h1>
        <p class="text-lg text-gray-600 leading-relaxed max-w-md mx-auto">
          Twoja wizyta została pomyślnie zarezerwowana. Poniżej znajdziesz
          wszystkie szczegóły dotyczące nadchodzącej konsultacji medycznej.
        </p>
      </section>
      <section id="confirmation-notice"
        class="mx-8 mb-8 px-6 py-5 bg-emerald-50 rounded-lg">
        <div class="flex items-start gap-4"><i
            class="fa-solid fa-circle-check text-lg text-success-green mt-1"></i>
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
        <div class="flex items-center gap-3 mb-8"><i
            class="fa-solid fa-clipboard-list text-xl text-teal-custom"></i>
          <h2 class="text-xl font-bold text-navy">Szczegóły wizyty</h2>
        </div>
        <div class="space-y-5">
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i
              class="fa-solid fa-user text-teal-custom w-5"></i><span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Pacjent</span><span
              class="text-deep-navy font-medium">${patientName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i
              class="fa-solid fa-user-doctor text-teal-custom w-5"></i><span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Lekarz
              prowadzący</span><span class="text-deep-navy font-medium">${doctorName}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i
              class="fa-solid fa-calendar text-teal-custom w-5"></i><span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Data</span><span
              class="text-deep-navy font-medium">${date}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i
              class="fa-solid fa-clock text-teal-custom w-5"></i><span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Godzina</span><span
              class="text-deep-navy font-medium">${time}</span></div>
          <div class="flex items-center gap-4 py-4 border-b border-gray-100"><i
              class="fa-solid fa-stethoscope text-teal-custom w-5"></i><span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Forma
              konsultacji</span><span
              class="text-deep-navy font-medium">${consultationType}</span></div>
          <div class="flex items-start gap-4 py-4"><i
              class="fa-solid fa-location-dot text-teal-custom w-5 mt-1"></i><span
              class="text-sm text-gray-500 uppercase tracking-wide w-32">Adres</span><span
              class="text-deep-navy font-medium">Centrum Medyczne 7<br>ul.
              Powstańców Warszawy 7/1.5<br>26-110 Skarżysko-Kamienna</span>
          </div>
        </div>
      </section>
      <section id="preparation-section"
        class="mx-8 my-8 px-6 py-6 bg-blue-50 rounded-lg">
        <div class="flex items-start gap-4"><i
            class="fa-solid fa-list-check text-lg text-teal-custom mt-1"></i>
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
        <div class="flex items-start gap-4"><i
            class="fa-solid fa-info-circle text-lg text-teal-custom mt-1"></i>
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
          <div class="flex items-center gap-3"><i
              class="fa-solid fa-phone text-teal-custom"></i>
            <div>
              <div class="text-xs text-gray-500 uppercase tracking-wide">Telefon
              </div>
              <div class="font-medium text-deep-navy">+48 797 127 487</div>
            </div>
          </div>
          <div class="flex items-center gap-3"><i
              class="fa-solid fa-envelope text-teal-custom"></i>
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

// Function to get admin user for Google Calendar auth
async function getCalendarAdmin() {
  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    throw new Error("Admin account not found for Google Calendar integration");
  }
  return admin;
}

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
  const formattedDoctorName = doctorName.startsWith('Dr.') 
    ? doctorName.replace('Dr.', 'lek.')
    : doctorName.startsWith('lek.') 
      ? doctorName 
      : `lek. ${doctorName}`;

  return processConfirmationEmail({
    patientName,
    doctorName: formattedDoctorName,
    date,
    time,
    mode: mode || 'stacjonarna'
  });
};

// Book appointment API
exports.bookAppointment = async (req, res) => {
  try {
    const {
      date,
      department,
      doctor: doctorId,
      email,
      gender,
      message,
      name,
      address,
      dateOfBirth,
      govtId,
      phone,
      smsConsentAgreed,
      consultationType,
      time,
      privacyPolicyAgreed,
      medicalDataProcessingAgreed,
      teleportationConfirmed,
      contactConsentAgreed,
    } = req.body;

    // Validate required fields
    if (
      !date ||
      !doctorId ||
      !phone ||  // Changed to prioritize phone
      !name ||
      !time ||
      !consultationType
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Brakujące wymagane pola" });
    }

    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValidEmail = email ? emailRegex.test(email) : false;

    // Validate consultationType
    if (!["online", "offline"].includes(consultationType.toLowerCase())) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Nieprawidłowy typ konsultacji. Musi być albo 'online' albo 'offline'",
        });
    }

    // Validate consent fields
    // Privacy policy is mandatory for all consultations
    if (!privacyPolicyAgreed) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Zgoda na politykę prywatności jest wymagana",
        });
    }

    // Additional consents are mandatory for online consultations


    // Parse name into first and last
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    // Find the doctor
    const doctorDetails = await User.findById(doctorId);
    if (!doctorDetails || doctorDetails.role !== "doctor") {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    // Calculate appointment dates and times
    const appointmentDate = new Date(`${date}T${time}:00`);
    const duration = APPOINTMENT_CONFIG.DEFAULT_DURATION; // Default duration in minutes
    const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
    const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
    const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
    const endTime = `${endTimeHour}:${endTimeMinute}`;

    // Check for existing appointments
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
        message:
          "Jest już zaplanowana wizyta u tego lekarza w tej godzinie.",
        conflict: true,
      });
    }

    // Look for existing patient by phone number first
    let patient = await User.findOne({
      phone: phone,
      role: "patient",
    });

    // If not found by phone and email is valid, try finding by email
    if (!patient && isValidEmail) {
      patient = await User.findOne({
        email: email.toLowerCase(),
        role: "patient",
      });
    }

    let isNewUser = false;
    const temporaryPassword = APPOINTMENT_CONFIG.DEFAULT_TEMPORARY_PASSWORD;

    console.log("smsConsentAgreed", smsConsentAgreed);

    // Create consent objects
    const smsConsent = {
      id: Date.now(),
      text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
      agreed: smsConsentAgreed,
    };

    const privacyPolicyConsent = {
      id: Date.now() + 1,
      text: "Zapoznałem(-am) się z Regulaminem i Polityką Prywatności i akceptuję ich postanowienia.",
      agreed: privacyPolicyAgreed,
    };

    // Additional consents for online consultations
    const additionalConsents = [];
    if (consultationType.toLowerCase() === "online") {
      additionalConsents.push(
        {
          id: Date.now() + 2,
          text: "Potwierdzam, że konsultacja medyczna odbędzie się w formie zdalnej (online) i jestem świadomy(-a) tej formy świadczenia zdrowotnego",
          agreed: medicalDataProcessingAgreed,
        },
        {
          id: Date.now() + 3,
          text: "Wyrażam zgodę na kontakt telefoniczny lub e-mailowy w celu realizacji konsultacji online, w tym przesłania linku do spotkania.",
          agreed: teleportationConfirmed,
        },
        {
          id: Date.now() + 4,
          text: "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
          agreed: contactConsentAgreed,
        }
      );
    }

    // If patient doesn't exist, create a new one
    if (!patient) {
      isNewUser = true;

      // Double check for any existing user with either phone or email
      const existingUserByPhone = await User.findOne({ phone: phone });
      const existingUserByEmail = isValidEmail ? await User.findOne({ email: email.toLowerCase() }) : null;

      if (existingUserByPhone) {
        patient = existingUserByPhone;
        isNewUser = false;
      } else if (existingUserByEmail) {
        patient = existingUserByEmail;
        isNewUser = false;
        // Update phone number if it doesn't exist
        if (!patient.phone) {
          patient.phone = phone;
          await patient.save();
        }
      } else {
        // Create new user if no existing user found
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        // Prepare all consents for new user
        const allConsents = [smsConsent, privacyPolicyConsent, ...additionalConsents];
        console.log(allConsents,"allConsents")

        patient = new User({
          name: {
            first: firstName,
            last: lastName || "",
          },
          email: isValidEmail ? email.toLowerCase() : null,
          sex:
            gender === "male"
              ? "Male"
              : gender === "female"
              ? "Female"
              : "Others",
          phone,
          password: hashedPassword,
          patientId:`P-${new Date().getTime()}`,
          role: "patient",
          signupMethod: "phone",
          address,
      dateOfBirth,
      govtId,
          smsConsentAgreed: smsConsentAgreed,
          consents: allConsents, // Store all consents as array
        });

        try {
          await patient.save();
        } catch (saveError) {
          if (saveError.code === 11000) {
            // If we get here, there might be a race condition or unique constraint violation
            // Try one final lookup
            patient = await User.findOne({
              $or: [
                { phone: phone },
                ...(isValidEmail ? [{ email: email.toLowerCase() }] : [])
              ]
            });
            
            if (!patient) {
              throw saveError;
            }
            isNewUser = false;
          } else {
            throw saveError;
          }
        }
      }
    }

    // Handle consents for existing user
    if (!isNewUser) {
      // Ensure consents is always an array
      const existingConsents = Array.isArray(patient.consents) ? patient.consents : [];
      
      // Helper function to update or add consent
      const updateConsent = (consent) => {
        const consentIndex = existingConsents.findIndex(
          (c) => c.text === consent.text
        );
        
        if (consentIndex === -1) {
          // Consent doesn't exist, add it
          existingConsents.push(consent);
        } else {
          // Update existing consent's agreed status
          existingConsents[consentIndex].agreed = consent.agreed;
        }
      };

      // Update all consents
      updateConsent(smsConsent);
      updateConsent(privacyPolicyConsent);
      additionalConsents.forEach(updateConsent);

      patient.smsConsentAgreed = smsConsentAgreed;
      patient.consents = existingConsents; // Store directly as array
      await patient.save();
    }

    // Create appointment
    const appointment = new Appointment({
      doctor: doctorId,
      patient: patient._id,
      bookedBy: patient._id,
      date: appointmentDate,
      startTime: time,
      endTime: endTime,
      duration: duration,
      mode: consultationType.toLowerCase(),
      notes: message || "",
    });

    await appointment.save();

    // Prepare appointment data for email
    let meetingLink = "";
    let calendarSetupNeeded = false;

    // Create Zoho Meeting event only for online consultations
    if (consultationType.toLowerCase() === "online") {
      try {
        const adminUser = await User.findOne({ role: "admin" });
        // Get meetings client with fresh token
        const meetingsClient = await getMeetingsClient(adminUser._id);

        // Convert appointment time to Polish timezone
        const appointmentDateTime = new Date(appointmentDate);
        const [hours, minutes] = time.split(":").map(Number);
        appointmentDateTime.setHours(hours, minutes, 0, 0);

        // Format the date for Zoho
        const formattedDate = format(appointmentDateTime, "MMM dd, yyyy hh:mm a");

        // Create the meeting
        const meetingDetails = {
          session: {
            topic: `Wizyta Medyczna: ${department || "Konsultacja"}`,
            agenda: message || "Regularna konsultacja medyczna",
            presenter: 20105821462,
            startTime: formattedDate,
            timezone: "Europe/Warsaw",
            participants: [
              ...(isValidEmail ? [{ email: patient.email }] : []),
              {
                email: doctorDetails.email
              }
            ]
          }
        };

        const meetingResponse = await meetingsClient.createMeeting(meetingDetails);

        if (!meetingResponse?.session?.joinLink) {
          throw new Error("Nie udało się pobrać linku do spotkania Zoho");
        }

        // Update appointment with the meeting link
        meetingLink = meetingResponse.session.joinLink;
        appointment.joining_link = meetingLink;
        await appointment.save();

        console.log("Pomyślnie utworzono link do spotkania Zoho:", meetingLink);
      } catch (zohoError) {
        console.error("Błąd Zoho Meetings:", zohoError);
        calendarSetupNeeded = true;
      }
    }

    // Send SMS notification if consent is agreed
    let smsResult = null;
    if (smsConsentAgreed) {
      try {
        const formattedDate = formatDateForSMS(appointmentDate);
        const formattedTime = formatTimeForSMS(time);
        const message =
          appointment.mode === "online"
            ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz. ${formattedTime}. ${isValidEmail ? 'Link do wizyty otrzymaja Panstwo na adres e-mail.' : 'Prosimy o kontakt w celu otrzymania linku do wizyty.'}`
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
        console.error("Błąd wysyłania powiadomienia SMS:", smsError);
      }
    }

    // Send email to patient only if email is valid
    let emailSent = false;
    if (isValidEmail && patient.email && smsConsentAgreed) {
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");
        const formattedTime = formatTimeForSMS(time);

        // Email data
        const emailData = {
          patientName: `${patient.name.first} ${patient.name.last}`,
          doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
          date: formattedDate,
          time: time,
          department: department || "General",
          meetingLink:
            consultationType.toLowerCase() === "online" ? meetingLink : null,
          notes: message || "",
          mode: consultationType.toLowerCase(),
          isNewUser,
          temporaryPassword: isNewUser ? temporaryPassword : null,
        };

        // Send email
        await sendEmail({
          to: patient.email,
          subject: "Potwierdzenie Wizyty",
          html: createAppointmentEmailHtml(emailData),
          text: `Twoja wizyta u dr ${doctorDetails.name.first} ${
            doctorDetails.name.last
          } została zaplanowana na ${formattedDate} o godz ${formattedTime}. ${
            meetingLink
              ? `Dołącz do spotkania pod adresem: ${meetingLink}`
              : "Rejestracja skontaktuje się z Panem/Panią w celu przekazania dalszych instrukcji."
          }`,
        });

        console.log(`Appointment confirmation email sent to ${patient.email}`);
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send appointment email:", emailError);
      }
    }

    // Return appropriate response based on consultation type and meeting creation result
    if (consultationType.toLowerCase() === "online") {
      if (meetingLink) {
        return res.status(201).json({
          success: true,
          message: "Wizyta online została pomyślnie zarezerwowana z Zoho Meetings",
          data: appointment,
          meetLink: meetingLink,
          isNewUser,
          emailSent,
          notifications: {
            sms: smsResult
              ? {
                  sent: smsResult.success,
                  error: smsResult.error,
                }
              : {
                  sent: false,
                  error: "Nie udało się wysłać powiadomienia SMS",
                },
          },
        });
      } else if (calendarSetupNeeded) {
        return res.status(201).json({
          success: true,
          message: "Wizyta online została zarezerwowana, ale wymagana jest konfiguracja integracji z Zoho Meetings",
          data: appointment,
          isNewUser,
          calendarSetupNeeded: true,
          emailSent,
          notifications: {
            sms: smsResult
              ? {
                  sent: smsResult.success,
                  error: smsResult.error,
                }
              : {
                  sent: false,
                  error: "Nie udało się wysłać powiadomienia SMS",
                },
          },
        });
      } else {
        return res.status(201).json({
          success: true,
          message: "Wizyta online została zarezerwowana, ale nie udało się utworzyć wydarzenia Zoho Meetings",
          data: appointment,
          isNewUser,
          emailSent,
          notifications: {
            sms: smsResult
              ? {
                  sent: smsResult.success,
                  error: smsResult.error,
                }
              : {
                  sent: false,
                  error: "Nie udało się wysłać powiadomienia SMS",
                },
          },
        });
      }
    } else {
      return res.status(201).json({
        success: true,
        message: "Wizyta stacjonarna została pomyślnie zarezerwowana",
        data: appointment,
        isNewUser,
        emailSent,
        notifications: {
          sms: smsResult
            ? {
                sent: smsResult.success,
                error: smsResult.error,
              }
            : {
                sent: false,
                error: "Nie udało się wysłać powiadomienia SMS",
              },
        },
      });
    }
  } catch (error) {
    console.error("Błąd rezerwacji wizyty:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się zarezerwować wizyty",
      error: error.message,
    });
  }
};
