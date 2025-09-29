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

  const logoPath = path.join(__dirname, "../public", "logo_new.png");
  console.log(logoPath, "logoPath");

  // Read and convert logo to base64
  const logoBase64 = fs.readFileSync(logoPath, { encoding: "base64" });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: left; margin-bottom: 20px;">
        <img src="data:image/png;base64,${logoBase64}" alt="Centrum Medyczne 7" style="height: 50px;" />
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 5px;">Potwierdzenie Wizyty</h2>
        <p style="color: #666; font-size: 16px; margin-top: 0;">Twoja wizyta została umówiona pomyślnie.</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #333; margin-top: 0;">Szczegóły Wizyty:</h3>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${time}</p>
          <p style="margin: 5px 0;"><strong>Typ konsultacji:</strong> ${
            mode === "online" ? "Online" : "Stacjonarna"
          }</p>
          ${
            notes
              ? `<p style="margin: 5px 0;"><strong>Uwagi pacjenta:</strong> ${notes}</p>`
              : ""
          }
        </div>
      </div>
      
      ${
        mode === "online"
          ? `
        ${
          meetingLink
            ? `
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0;">Link do spotkania zostanie przesłany w osobnej wiadomości e-mail. Jeśli nie otrzymasz wiadomości najpóźniej godzinę przed planowanym spotkaniem, skontaktuj się z Recepcją – nasz zespół udzieli Ci niezbędnych instrukcji i pomoże w dostępie do konsultacji.</p>
          </div>
        `
            : `
        `
        }
      `
          : `

      `
      }
      

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #666; margin-bottom: 10px;">W przypadku potrzeby zmiany terminu lub odwołania wizyty prosimy o kontakt telefoniczny co najmniej 24 godziny przed planowaną wizytą.</p>
        <p style="color: #666; margin-bottom: 10px;">Dziękujemy za zaufanie!</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Centrum Medyczne 7 -  Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
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
            ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${formattedTime}. ${isValidEmail ? 'Link do wizyty otrzymaja Panstwo na adres e-mail.' : 'Prosimy o kontakt w celu otrzymania linku do wizyty.'}`
            : `Twoja wizyta u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${formattedTime} w naszej placowce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;

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

        // Email data
        const emailData = {
          patientName: `${patient.name.first} ${patient.name.last}`,
          doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
          date: formattedDate,
          time: `${time} - ${endTime}`,
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
