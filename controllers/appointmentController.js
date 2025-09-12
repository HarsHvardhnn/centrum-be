// controllers/appointmentController.js

const { validationResult } = require("express-validator");
const Appointment = require("../models/appointment");
const doctor = require("../models/user-entity/doctor");
const user = require("../models/user-entity/user");
const MessageReceipt = require("../models/smsData");
const { sendSMS } = require("../utils/smsapi");
const { formatDate, formatTime } = require("../utils/dateUtils");
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
    if (!hasPatientConsentedToSMS(patientDetails)) {
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

    const appointmentDate = formatDate(new Date(appointment.date));
    const startTimeFormatted = formatTime(appointment.startTime);
    const patientName = `${patientDetails.name.first} ${patientDetails.name.last}`;
    const doctorName = `${doctorDetails.name.first} ${doctorDetails.name.last}`;

    let message = "";
    switch (status) {
      case "cancelled":
        const doctorSurname = doctorDetails.name.last;
        message = `Twoja wizyta u dr ${doctorSurname} dnia ${appointmentDate} godz. ${startTimeFormatted} zostala odwolana. W celu ustalenia nowego terminu prosimy o kontakt z recepcja CM7 Skarzysko.`;
        break;
      case "completed":
        message = `Thank you for visiting Dr. ${doctorName}. Your appointment on ${appointmentDate} has been completed. Take care!`;
        break;
      case "rescheduled":
        message = `Your appointment with Dr. ${doctorName} has been rescheduled to ${appointmentDate} at ${startTimeFormatted}.`;
        break;
      default:
        message = `Your appointment status with Dr. ${doctorName} for ${appointmentDate} at ${startTimeFormatted} has been updated to: ${status}`;
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

// Helper function to send report upload notification SMS
const sendReportUploadSMS = async (
  appointment,
  patientDetails,
  doctorDetails
) => {
  try {
    if (!hasPatientConsentedToSMS(patientDetails)) {
      return {
        success: false,
        error: "Patient has not consented to SMS notifications",
      };
    }

    const phoneNumber = patientDetails.phone;
    if (!phoneNumber) {
      return { success: false, error: "No phone number available" };
    }

    const appointmentDate = formatDate(new Date(appointment.date));
    const patientName = `${patientDetails.name.first} ${patientDetails.name.last}`;
    const doctorName = `${doctorDetails.name.first} ${doctorDetails.name.last}`;

    const message = `New medical report(s) have been uploaded for your appointment with Dr. ${doctorName} on ${appointmentDate}. Please check your patient portal.`;

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
    console.error("Error sending report upload SMS:", error);
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
    const appointmentDate = formatDate(new Date(appointment.date));
    const startTimeFormatted = formatTime(appointment.startTime);

    const patientName = `${patientDetails.name.first} ${patientDetails.name.last}`;
    const doctorName = `${doctorDetails.name.first} ${doctorDetails.name.last}`;
    // Create SMS content
    const message = `
Hello ${patientName},

Your appointment with Dr. ${doctorName} has been successfully booked for ${appointmentDate} at ${startTimeFormatted}.

Please arrive 15 minutes before your scheduled time. For rescheduling or cancellations, please contact us at least 24 hours in advance.

Thank you for choosing our services - Regards,Centrum Medyczne.
    `.trim();

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

      // If patient not found, create new patient
      if (!patient) {
        const newPatient = new user({
          name: {
            first: firstName,
            last: lastName,
          },
          email: emailToSave,
          phone: phoneNumber,
          password: temporaryPassword,
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

    // Determine who created the appointment
    let createdBy = "online";
    if (req.user && req.user.role === "receptionist") {
      createdBy = "receptionist";
    } else if (req.user && req.user.role === "doctor") {
      createdBy = "doctor";
    }

    // Create appointment with new fields
    const appointment = new Appointment({
      doctor: doctorId,
      patient: patient._id,
      bookedBy: patient._id,
      date: appointmentDate,
      startTime: time,
      endTime: endTime,
      duration: duration,
      customDuration: customDuration || null, // Set custom duration if provided
      isBackdated: isBackdated, // Set backdated flag
      createdBy: createdBy, // Set who created the appointment
      mode: consultationType.toLowerCase(),
      notes: message || "",
      metadata: {
        ...(req.body.metadata || {}),
        overrideConflicts: overrideConflicts,
        receptionistOverride: req.user && req.user.role === "receptionist",
      }
    });

    await appointment.save();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // Send email only if valid email is provided
    let emailSent = false;
    if (emailRegex.test(patient.email) && patient.email) {
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");

        // Email data
        const emailData = {
          patientName: `${patient.name.first} ${patient.name.last}`,
          doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
          date: formattedDate,
          time: `${time} - ${endTime}`,
          department: doctorDetails.specialization || "General",
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
          } została zaplanowana na ${formattedDate} o godz ${time}. ${
            false
              ? `Dołącz do spotkania pod adresem: ${false}`
              : "Rejestracja skontaktuje się z Panem/Panią w celu przekazania dalszych instrukcji."
          }`,
        });

        console.log(`Appointment confirmation email sent to ${patient.email}`);
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send appointment email:", emailError);
      }
    }

    if (patient.smsConsentAgreed) {
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");
        const message =
          appointment.mode === "online"
            ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${time}. Link do wizyty otrzymaja Panstwo na adres e-mail.`
            : `Twoja wizyta u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${time} w naszej placowce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;

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
    const responseData = {
      appointment,
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
      smsConsentAgreed,
      patientId,
      customDuration, // New field for custom appointment duration
      isBackdated = false, // New field to indicate if appointment is for past date
      overrideConflicts = false, // New field to allow overriding time conflicts
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

    console.log("patientId", patientId);
    // If patient ID is provided, use that
    if (patientId) {
      patient = await user.findById(patientId);
      if (!patient || patient.role !== "patient") {
        return res.status(404).json({
          success: false,
          message: "Pacjent nie znaleziony",
        });
      }
      
      // Handle SMS consent for existing patient with patientId
      console.log("Handling SMS consent for existing patient with patientId");
      
      // Only update SMS consent if smsConsentAgreed is provided
      if (smsConsentAgreed !== undefined) {
        const SMS_CONSENT_TEXT = "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).";
        
        let existingConsents = [];
        try {
          existingConsents = patient.consents
            ? Array.isArray(patient.consents) ? patient.consents : JSON.parse(patient.consents)
            : [];
        } catch (e) {
          console.log("Error parsing consents:", e);
          existingConsents = [];
        }

        console.log("Current smsConsentAgreed value:", smsConsentAgreed);
        console.log("Existing consents:", existingConsents);

        // Find the SMS consent
        const consentIndex = existingConsents.findIndex(
          (c) => c.text === SMS_CONSENT_TEXT
        );

        console.log("Consent index found:", consentIndex);
        console.log("SMS consent text to match:", SMS_CONSENT_TEXT);

        if (consentIndex === -1) {
          // Consent doesn't exist, add it
          console.log("Adding new SMS consent");
          existingConsents.push({
            id: Date.now(),
            text: SMS_CONSENT_TEXT,
            agreed: smsConsentAgreed,
          });
        } else {
          // Update existing consent's agreed status
          console.log("Updating existing SMS consent at index:", consentIndex);
          console.log("Before update - consent:", existingConsents[consentIndex]);
          existingConsents[consentIndex].agreed = smsConsentAgreed;
          console.log("After update - consent:", existingConsents[consentIndex]);
        }

        // Update patient's smsConsentAgreed field and consents
        patient.smsConsentAgreed = smsConsentAgreed;
        patient.consents = existingConsents; // Save as array, not stringified
        
        // Mark the consents array as modified to ensure Mongoose saves it
        patient.markModified('consents');
        
        console.log("Before save - patient.smsConsentAgreed:", patient.smsConsentAgreed);
        console.log("Before save - patient.consents:", patient.consents);
        
        await patient.save();
        
        console.log("After save - Updated consents:", existingConsents);
        
        // Verify the save worked by fetching the patient again
        const savedPatient = await user.findById(patientId);
        console.log("Verification - saved patient.smsConsentAgreed:", savedPatient.smsConsentAgreed);
        console.log("Verification - saved patient.consents:", savedPatient.consents);
      }
      
    } else {
      // Handle new patient creation
      if (!name || !phone) {

        console.log("whats missing", name, phone);
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

      // If patient not found, create new patient
      if (!patient) {
        const newPatient = new user({
          name: {
            first: firstName,
            last: lastName,
          },
          email: emailToSave,
          phone: phoneNumber,
          password: temporaryPassword,
          role: "patient",
          signupMethod: "email",
          patientId:`P-${new Date().getTime()}`,
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

      console.log("is new user",isNewUser);
      // Handle consents for existing user
      if (!isNewUser) {
        console.log("ntoi a new uyser")
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

        console.log("consent to be created",smsConsent )

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
        console.log("consnet to be",smsConsentAgreed)

        patient.smsConsentAgreed = smsConsentAgreed;
        patient.consents = JSON.stringify(existingConsents);
        await patient.save();
      }
    }

    // Determine who created the appointment

    // Create appointment with new fields
    const appointment = new Appointment({
      doctor: doctorId,
      patient: patient._id,
      bookedBy: patient._id,
      date: appointmentDate,
      startTime: time,
      endTime: endTime,
      duration: duration,
      customDuration: customDuration || null, // Set custom duration if provided
      isBackdated: isBackdated, // Set backdated flag
      createdBy: req.user._id, // Set who created the appointment
      mode: consultationType.toLowerCase(),
      notes: message || "",
      metadata: {
        ...(req.body.metadata || {}),
        overrideConflicts: overrideConflicts,
        receptionistOverride: req.user && req.user.role === "receptionist",
      }
    });

    await appointment.save();

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // Send email only if valid email is provided
    let emailSent = false;
    if (emailRegex.test(patient.email) && patient.email) {
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");

        // Email data
        const emailData = {
          patientName: `${patient.name.first} ${patient.name.last}`,
          doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
          date: formattedDate,
          time: `${time} - ${endTime}`,
          department: doctorDetails.specialization || "General",
          meetingLink:
            consultationType.toLowerCase() === "online" ? false : null,
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
          } została zaplanowana na ${formattedDate} o godz ${time}. ${
            false
              ? `Dołącz do spotkania pod adresem: ${false}`
              : "Rejestracja skontaktuje się z Panem/Panią w celu przekazania dalszych instrukcji."
          }`,
        });

        console.log(`Reception appointment confirmation email sent to ${patient.email}`);
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send reception appointment email:", emailError);
      }
    }

    if (patient.smsConsentAgreed) {
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");
        const message =
          appointment.mode === "online"
            ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${time}. Link do wizyty otrzymaja Panstwo na adres e-mail.`
            : `Twoja wizyta u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${time} w naszej placowce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;

        const batchId = uuidv4();
        await MessageReceipt.create({
          content: message,
          batchId,
          recipient: {
            userId: patient._id.toString(),
            phone: patient.phone,
          },
          status: "PENDING",
        });

        await sendSMS(patient.phone, message);
      } catch (smsError) {
        console.error(
          "Wystąpił błąd podczas wysyłania powiadomienia SMS:",
          smsError
        );
      }
    }

    // Prepare response data
    const responseData = {
      appointment,
      isNewUser,
      temporaryPassword: isNewUser ? temporaryPassword : undefined,
      emailSent,
      overrideInfo: {
        customDuration: customDuration ? `${customDuration} minutes` : null,
        isBackdated: isBackdated,
        overrideConflicts: overrideConflicts,
        createdBy: req.user.role,
      }
    };

    res.status(201).json({
      success: true,
      message: "Wizyta została umówiona pomyślnie przez recepcję",
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

  // Use the Cloudinary logo URL
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1757666023/hospital_app/images/a8qfdccxpi0aipcavki2.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: left; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="Centrum Medyczne 7" style="height: 50px;" />
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 5px;"> Potwierdzenie Wizyty</h2>
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
            <p style="margin: 0;">Link do spotkania zostanie przesłany w osobnej wiadomości e-mail. Jeśli nie otrzymasz wiadomości najpóźniej godzinę przed planowanym spotkaniem, skontaktuj się z Recepcją – nasz zespół udzieli Ci niezbędnych instrukcji i pomoże w dostępie do konsultacji.</p>
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
        <p style="color: #666; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Centrum Medyczne 7 - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
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

  // Use the Cloudinary logo URL
  const logoUrl = 'https://res.cloudinary.com/dca740eqo/image/upload/v1757666023/hospital_app/images/a8qfdccxpi0aipcavki2.png';

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: left; margin-bottom: 20px;">
        <img src="${logoUrl}" alt="Centrum Medyczne 7" style="height: 50px;" />
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 5px;">Zmiana Terminu Wizyty</h2>
        <p style="color: #666; font-size: 16px; margin-top: 0;">Twoja wizyta została przełożona.</p>
      </div>
      
      <div style="background-color: #fff3cd; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
        <h3 style="color: #856404; margin-top: 0;">Stary Termin:</h3>
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${oldDate}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${oldTime}</p>
        </div>
      </div>
      
      <div style="background-color: #d4edda; padding: 20px; border-radius: 5px; margin-bottom: 20px; border-left: 4px solid #28a745;">
        <h3 style="color: #155724; margin-top: 0;">Nowy Termin:</h3>
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${newDate}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${newTime}</p>
          <p style="margin: 5px 0;"><strong>Typ konsultacji:</strong> ${
            mode === "online" ? "Online" : "Stacjonarna"
          }</p>
        </div>
      </div>
      
      ${
        mode === "online"
          ? `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0;">Link do spotkania zostanie przesłany w osobnej wiadomości e-mail. Jeśli nie otrzymasz wiadomości najpóźniej godzinę przed planowanym spotkaniem, skontaktuj się z Recepcją – nasz zespół udzieli Ci niezbędnych instrukcji i pomoże w dostępie do konsultacji.</p>
        </div>
      `
          : `
      `
      }
      

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #666; margin-bottom: 10px;">W przypadku potrzeby zmiany terminu lub odwołania wizyty prosimy o kontakt telefoniczny co najmniej 24 godziny przed planowaną wizytą.</p>
        <p style="color: #666; margin-bottom: 10px;">Dziękujemy za zaufanie!</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Centrum Medyczne 7 - Wszelkie prawa zastrzeżone</p>
      </div>
    </div>
  `;
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
      .populate("patient", "name email profilePicture sex dob")
      .populate("doctor", "name email")
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Appointment.countDocuments(query);

    const transformed = appointments.map((appt, index) => ({
      id: appt._id.toString(),
      name: `${appt.patient?.name.first || ""} ${
        appt.patient?.name.last || ""
      }`,
      patient_id: appt.patient?._id || null,
      username: `@${appt.patient?.name.first?.toLowerCase() || "user"}`,
      avatar: appt.patient?.profilePicture || null,
      sex: appt.patient?.sex || "Unknown",
      mode: appt.mode || "offline",
      joining_link: appt.joining_link || null,
      age: calculateAge(appt.patient?.date),
      status: appt.status || "Unknown",
      date: formatDateToYYYYMMDD(appt.date),
    }));

    res.status(200).json({
      success: true,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
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
      data: appointments,
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
    const { status } = req.body;

    if (!["booked", "cancelled", "completed"].includes(status)) {
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

    // Get doctor and patient details for SMS
    const doctorDetails = await doctor.findById(appointment.doctor._id);
    const patientDetails = await user.findById(appointment.patient._id);

    if (!doctorDetails || !patientDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor or patient details not found",
      });
    }

    // Update appointment status
    appointment.status = status;
    await appointment.save();

    // Send SMS notification
    let smsResult = null;
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

    res.status(200).json({
      success: true,
      data: appointment,
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

// Reschedule appointment
exports.rescheduleAppointment = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newStartTime, newEndTime, consultationType, smsToBeSent } = req.body;

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

    // Check if the new date is in the past
    const now = new Date();
    if (appointmentDate <= now) {
      return res.status(400).json({
        success: false,
        message: "Nie można przełożyć wizyty na przeszłą datę/godzinę",
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

    // Get doctor and patient details
    const doctorDetails = await doctor.findById(appointment.doctor._id);
    const patientDetails = await user.findById(appointment.patient._id);

    if (!doctorDetails || !patientDetails) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono szczegółów lekarza lub pacjenta",
      });
    }

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

    // Check for existing appointments at the new time
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointment = await Appointment.findOne({
      doctor: appointment.doctor._id,
      date: { $gte: startOfDay, $lte: endOfDay },
      startTime: newStartTime,
      status: "booked",
      _id: { $ne: appointmentId }, // Exclude current appointment
    });

    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: "Jest już umówiona wizyta u tego lekarza w tym czasie.",
        conflict: true,
      });
    }

    // Store old appointment details for notification
    const oldDate = appointment.date;
    const oldStartTime = appointment.startTime;
    const oldEndTime = appointment.endTime;

    // Update appointment with new details
    appointment.date = appointmentDate;
    appointment.startTime = newStartTime;
    appointment.endTime = finalNewEndTime;
    appointment.mode = consultationType || appointment.mode;
    appointment.status = "booked"; // Ensure status is booked after rescheduling

    await appointment.save();

    // Send email notification if patient has email
    let emailSent = false;
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (false) {
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");
        const oldFormattedDate = format(oldDate, "dd.MM.yyyy");

        const emailData = {
          patientName: `${patientDetails.name.first} ${patientDetails.name.last}`,
          doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
          oldDate: oldFormattedDate,
          oldTime: `${oldStartTime} - ${oldEndTime}`,
          newDate: formattedDate,
          newTime: `${newStartTime} - ${finalNewEndTime}`,
          department: doctorDetails.specialization || "General",
          mode: appointment.mode,
        };

        await sendEmail({
          to: patientDetails.email,
          subject: "Zmiana Terminu Wizyty",
          html: createRescheduleEmailHtml(emailData),
          text: `Twoja wizyta u dr ${doctorDetails.name.first} ${doctorDetails.name.last} została przełożona z ${oldFormattedDate} o godz ${oldStartTime} na ${formattedDate} o godz ${newStartTime}.`,
        });

        console.log(`Reschedule confirmation email sent to ${patientDetails.email}`);
        emailSent = true;
      } catch (emailError) {
        console.error("Failed to send reschedule email:", emailError);
      }
    }

    // Send SMS notification if smsToBeSent is true and patient has consented
    let smsResult = null;
    console.log("SMS sending check - smsToBeSent:", smsToBeSent, "patientConsent:", patientDetails.smsConsentAgreed);
    
    if (smsToBeSent && patientDetails.smsConsentAgreed) {
      console.log("Sending SMS notification for rescheduled appointment");
      try {
        const formattedDate = format(appointmentDate, "dd.MM.yyyy");
        const message = `Twoja wizyta u dr ${doctorDetails.name.last} została przełożona na ${formattedDate} o godz.${newStartTime} w naszej placówce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;

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
      console.log("SMS not sent - smsToBeSent:", smsToBeSent, "or patient consent:", patientDetails.smsConsentAgreed);
    }

    res.status(200).json({
      success: true,
      message: "Wizyta została pomyślnie przełożona",
      data: {
        appointment,
        oldDate: oldDate,
        oldStartTime: oldStartTime,
        oldEndTime: oldEndTime,
        newDate: appointmentDate,
        newStartTime: newStartTime,
        newEndTime: finalNewEndTime,
        emailSent,
        smsSent: smsResult ? true : false,
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
    // Authorization check for doctors - they can only see their own appointments
    if (req.user && req.user.role === "doctor") {
      // Add doctor filter to only show appointments for the authenticated doctor
      req.query.doctor = req.user.id || req.user.d_id;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "date";
    const order = req.query.order === "desc" ? -1 : 1;

    const skip = (page - 1) * limit;

    // Get today's date at 00:00:00 in Poland timezone
    const todayUTC = new Date();
    const todayInPoland = toZonedTime(todayUTC, "Europe/Warsaw");
    const today = new Date(todayInPoland);
    today.setHours(0, 0, 0, 0);

    // Query only upcoming appointments
    const filter = {
      status: { $nin: ["cancelled"] },
      date: { $gte: today },
    };

    // Add doctor filter if provided (for doctor authorization)
    if (req.query.doctor) {
      filter.doctor = req.query.doctor;
    }

    const appointments = await Appointment.find(filter)
      .sort({ [sortBy]: order })
      .skip(skip)
      .limit(limit)
      .populate("doctor patient bookedBy");

    const total = await Appointment.countDocuments(filter);

    const formattedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        const doctorUser = appt.doctor;
        console.log(doctorUser, "doctorUser");
        const doctorProfile = await doctor
          .findOne({
            _id: doctorUser._id,
          })
          .populate("specialization");
        console.log(doctorProfile, "doctorProfile");

        return {
          id: appt._id,
          name: `Dr. ${doctorUser.name.first} ${doctorUser.name.last}`,
          specialty: doctorProfile?.specialization?.[0]?.name || "General",
          avatar: doctorUser.profilePicture || `/api/placeholder/40/40`,
          date: new Date(appt.date).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          time: `${appt.startTime} - ${appt.endTime}`,
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

    // Get doctor and patient details for SMS
    const doctorDetails = await doctor.findById(appointment.doctor._id);
    const patientDetails = await user.findById(appointment.patient?._id);

    if (!doctorDetails || !patientDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor or patient details not found",
      });
    }

    // Update appointment status
    appointment.status = "cancelled";
    await appointment.save();

    // Send SMS notification
    let smsResult = null;
    try {
      smsResult = await sendAppointmentStatusSMS(
        appointment,
        patientDetails,
        doctorDetails,
        "cancelled"
      );
    } catch (smsError) {
      console.error("Error sending cancellation SMS:", smsError);
    }

    res.status(200).json({
      success: true,
      message: "Appointment cancelled successfully",
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
    console.error("Error cancelling appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.completeCheckIn = async (req, res) => {
  try {
    const { id } = req.params;
    const { patientId } = req.body; // Assuming you want to update the patientId as well

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

    appointment.status = "completed";
    await appointment.save();

    res.status(200).json({ message: "Appointment completed successfully" });
  } catch (error) {
    console.error("Error completing appointment:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update appointment details including health data and reports
exports.updateAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      consultationData,
      patientData,
      medications,
      tests,
      healthData,
      reports,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
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
          },
          { new: true }
        );
      } catch (error) {
        console.error("Error updating patient:", error);
      }
    }

    // Handle consultation data if provided
    if (consultationData) {
      const consultDate = new Date(consultationData.date);
      updateData.consultation = {
        consultationType: consultationData.consultationType,
        consultationNotes: consultationData.notes,
        description: consultationData.description,
        treatmentCategory: consultationData?.treatmentCategory || "",
        consultationDate: !isNaN(consultDate.getTime())
          ? consultDate
          : new Date(),
        consultationStatus: consultationData.status || "Scheduled",
        isOnline: consultationData.isOnline || false,
        interview: consultationData.interview || "",
        physicalExamination: consultationData.physicalExamination || "",
        treatment: consultationData.treatment || "",
        recommendations: consultationData.recommendations || "",
        roomNumber: consultationData.roomNumber || null,
        isRisky: consultationData.isRisky || false,
        time: consultationData.time || "",
      };
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

    res.status(200).json({
      success: true,
      data: updatedAppointment,
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

    // Get doctor and patient details for SMS
    const doctorDetails = await doctor.findById(appointment.doctor._id);
    const patientDetails = await user.findById(appointment.patient._id);

    if (!doctorDetails || !patientDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor or patient details not found",
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

    // Send SMS notification
    let smsResult = null;
    try {
      smsResult = await sendReportUploadSMS(
        appointment,
        patientDetails,
        doctorDetails
      );
    } catch (smsError) {
      console.error("Error sending report upload SMS:", smsError);
    }

    res.status(200).json({
      success: true,
      message: "Report uploaded successfully",
      data: {
        report,
        appointment,
      },
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

    // Get appointment with basic population
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

    // Manually fetch patient data to get govtId and other fields
    const patientData = await patient.findById(appointment.patient._id).lean();
    
    // Create appointmentData object with all required fields
    const appointmentData = {
      ...appointment,
      patient: {
        _id: appointment.patient._id,
        name: appointment.patient.name,
        patientId: patientData?.patientId || null,
        age: patientData?.age || null,
        dateOfBirth: patientData?.dateOfBirth || null,
        height: patientData?.height || null,
        weight: patientData?.weight || null,
        bloodPressure: patientData?.bloodPressure || null,
        temperature: patientData?.temperature || null,
        riskStatus: patientData?.riskStatus || null,
        treatmentStatus: patientData?.treatmentStatus || null,
        roomNumber: patientData?.roomNumber || null,
        govtId: patientData?.govtId || null
      }
    };

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
      data: appointmentData,
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
      data: appointments,
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
    const { date, startTime, endTime, doctorId } = req.body;

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

    // Removed check for existing appointments at the new time to allow double-booking

    // Update the appointment
    appointment.date = appointmentDate;
    appointment.startTime = startTime;
    appointment.endTime = finalEndTime;
    
    // Update doctor if provided
    if (doctorId) {
      appointment.doctor = doctorToAssign;
    }
    
    console.log("Before save - appointment date:", appointment.date);
    
    // Use updateOne instead of save() to ensure date is properly updated
    await Appointment.updateOne(
      { _id: id },
      { 
        $set: { 
          date: appointmentDate,
          startTime: startTime,
          endTime: finalEndTime,
          ...(doctorId ? { doctor: doctorToAssign } : {})
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
    const consultationUpdate = {
      consultationType:
        consultationData.consultationType ||
        appointment.consultation?.consultationType,
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

    // Update the appointment
    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      { consultation: consultationUpdate },
      { new: true, runValidators: true }
    );

    // Add start time to the response
    if (!updatedAppointment.consultation.time && updatedAppointment.startTime) {
      updatedAppointment.consultation.time = updatedAppointment.startTime;
    }

    res.status(200).json({
      success: true,
      message: "Consultation updated successfully",
      data: {
        consultation: updatedAppointment.consultation,
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
    } = req.query;

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



    // Date range filter - support single dates and date ranges
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const startDateObj = new Date(startDate);
        if (isNaN(startDateObj.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid start date format"
          });
        }
        query.date.$gte = startDateObj;
      }
      if (endDate) {
        const endDateObj = new Date(endDate);
        if (isNaN(endDateObj.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid end date format"
          });
        }
        query.date.$lte = endDateObj;
      }
    }

    // Doctor filter
    if (doctorId) {
      // Validate doctorId format
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid doctor ID format"
        });
      }
      query.doctor = new mongoose.Types.ObjectId(doctorId);
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
      // Get appointments using aggregation pipeline for better search
      let appointmentsPipeline = [
        // First lookup to get patient details
        {
          $lookup: {
            from: "users",
            localField: "patient",
            foreignField: "_id",
            as: "patientData",
          },
        },
        // Unwind the patient data array
        {
          $unwind: "$patientData",
        },
        // Filter out deleted patients
        {
          $match: {
            "patientData.deleted": { $ne: true }
          }
        },
        // Lookup to get doctor details
        {
          $lookup: {
            from: "users",
            localField: "doctor",
            foreignField: "_id",
            as: "doctorData",
          },
        },
        {
          $unwind: "$doctorData",
        },
      ];

      // Build the match conditions for the clinic case
      const matchConditions = {};
      
      // Add base query conditions (status, date range, doctorId)
      if (status && status !== "all") {
        if (status === "checkedIn") {
          matchConditions.status = status;
        } else {
          matchConditions.status = status.toLowerCase();
        }
      }

      if (startDate || endDate) {
        matchConditions.date = {};
        if (startDate) {
          const startDateObj = new Date(startDate);
          if (isNaN(startDateObj.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid start date format"
            });
          }
          matchConditions.date.$gte = startDateObj;
        }
        if (endDate) {
          const endDateObj = new Date(endDate);
          if (isNaN(endDateObj.getTime())) {
            return res.status(400).json({
              success: false,
              message: "Invalid end date format"
            });
          }
          matchConditions.date.$lte = endDateObj;
        }
      }

      if (doctorId) {
        // Validate doctorId format
        if (!mongoose.Types.ObjectId.isValid(doctorId)) {
          return res.status(400).json({
            success: false,
            message: "Invalid doctor ID format"
          });
        }
        matchConditions.doctor = new mongoose.Types.ObjectId(doctorId);
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

      // Add base conditions if they exist
      if (Object.keys(matchConditions).length > 0) {
        appointmentsPipeline.push({
          $match: matchConditions,
        });
      }

      // Add search conditions if searchTerm exists
      if (searchTerm) {
        appointmentsPipeline.push({
          $match: {
            $or: [
              // Patient name search (first and last)
              {
                "patientData.name.first": { $regex: searchTerm, $options: "i" },
              },
              {
                "patientData.name.last": { $regex: searchTerm, $options: "i" },
              },
              // Full name search (combined first and last)
              {
                $expr: {
                  $regexMatch: {
                    input: {
                      $concat: [
                        "$patientData.name.first",
                        " ",
                        "$patientData.name.last",
                      ],
                    },
                    regex: searchTerm,
                    options: "i",
                  },
                },
              },
              // Patient contact details
              { "patientData.email": { $regex: searchTerm, $options: "i" } },
              { "patientData.phone": { $regex: searchTerm, $options: "i" } },
              // Patient ID
              {
                "patientData.patientId": { $regex: searchTerm, $options: "i" },
              },
              // Appointment details
              { notes: { $regex: searchTerm, $options: "i" } },
              {
                "consultation.consultationNotes": {
                  $regex: searchTerm,
                  $options: "i",
                },
              },
              {
                "consultation.description": {
                  $regex: searchTerm,
                  $options: "i",
                },
              },
              {
                "consultation.interview": { $regex: searchTerm, $options: "i" },
              },
              {
                "consultation.physicalExamination": {
                  $regex: searchTerm,
                  $options: "i",
                },
              },
              {
                "consultation.treatment": { $regex: searchTerm, $options: "i" },
              },
              {
                "consultation.recommendations": {
                  $regex: searchTerm,
                  $options: "i",
                },
              },
            ],
          },
        });
      }

      // Add sorting
      appointmentsPipeline.push({ $sort: sortObject });

      let appointments = await Appointment.aggregate(appointmentsPipeline);

      // Process appointments data
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

        return {
          id: appointment._id,
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          meetLink: appointment?.joining_link || "",
          status: appointment.status,
          mode: appointment.mode,
          checkIn: appointment.checkedIn,
          checkInDate: appointment.checkInDate,
          patient: {
            patient_status: patientData?.status,
            id: patientData?._id,
            patientId: patientData?.patientId,
            name: patientData
              ? `${patientData.name.first} ${patientData.name.last}`
              : null,
            sex: patientData?.sex,
            age: age,
            phoneNumber: patientData?.phone,
            profilePicture: patientData?.profilePicture || null,
            email: patientData?.email,
          },
          doctor: appointment.doctorData
            ? {
                id: appointment.doctorData._id,
                name: `${appointment.doctorData.name.first} ${appointment.doctorData.name.last}`,
                email: appointment.doctorData.email,
              }
            : null,
          metadata: appointment.metadata || {},
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
      const patientQuery = doctorId
        ? {
            $or: [
              { consultingDoctor: new mongoose.Types.ObjectId(doctorId) },
              { attendingPhysician: new mongoose.Types.ObjectId(doctorId) },
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
          "name email profilePicture sex dateOfBirth patientId status phone consultingDoctor"
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
            (patient.patientId && patient.patientId.toLowerCase().includes(searchLower))
          );
        });
      }

      console.log("status at this point ",status && status !== "all" && status !== "no_appointment" ? 
        status === "checkedIn" ? { status: status } : { status: status.toLowerCase() }
      : {})
      
      // Build appointment query with all filters (but without search term for now)
      let appointmentQuery;
      try {
        appointmentQuery = {
        ...(doctorId ? { doctor: new mongoose.Types.ObjectId(doctorId) } : {}),
        ...(appointmentId ? { _id: new mongoose.Types.ObjectId(appointmentId) } : {}),
        ...(status && status !== "all" && status !== "no_appointment" ? 
          status === "checkedIn" ? { status: status } : { status: status.toLowerCase() }
        : {}),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { 
                  $gte: (() => {
                    const startDateObj = new Date(startDate);
                    if (isNaN(startDateObj.getTime())) {
                      throw new Error("Invalid start date format");
                    }
                    return startDateObj;
                  })()
                } : {}),
                ...(endDate ? { 
                  $lte: (() => {
                    const endDateObj = new Date(endDate);
                    if (isNaN(endDateObj.getTime())) {
                      throw new Error("Invalid end date format");
                    }
                    return endDateObj;
                  })()
                } : {}),
              },
            }
          : {}),
        };
      } catch (dateError) {
        return res.status(400).json({
          success: false,
          message: dateError.message
        });
      }

      console.log("appointment query", appointmentQuery);

      // Get all appointments for these patients
      const allAppointments = await Appointment.find({
        ...appointmentQuery,
        patient: { $in: allPatients.map(p => p._id) }
      })
        .populate("doctor", "name email")
        .populate("patient", "name email phone patientId status sex dateOfBirth profilePicture")
        .sort({ date: 1 }) // Sort by date in ascending order
        .lean();

      console.log("allAppointments", allAppointments);

      // Create a map of patient ID to their latest appointment
      const patientAppointmentMap = new Map();
      allAppointments.forEach((appointment) => {
        const patientId = appointment.patient?._id.toString();
        if (patientId && !patientAppointmentMap.has(patientId)) {
          patientAppointmentMap.set(patientId, appointment);
        }
      });

      console.log("patientAppointmentMap", patientAppointmentMap);

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

      // Process all patients
      const processedPatients = allPatients.map((patient) => {
        const patientId = patient._id.toString();
        const latestAppointment = patientAppointmentMap.get(patientId);
        const age = calculatePatientAge(patient.dateOfBirth);

        if (latestAppointment) {
          // Patient has appointments - use appointment data
          return {
            id: latestAppointment._id,
            date: latestAppointment.date || new Date(),
            startTime: latestAppointment.startTime || "00:00",
            endTime: latestAppointment.endTime || "00:00",
            meetLink: latestAppointment.joining_link || "",
            status: latestAppointment.status || "zaplanowane",
            mode: latestAppointment.mode || "klinika",
            checkIn: latestAppointment.checkedIn || false,
            checkInDate: latestAppointment.checkInDate || null,
            isAppointment: true,
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
            doctor: latestAppointment.doctor
              ? {
                  id: latestAppointment.doctor._id,
                  name: `${latestAppointment.doctor.name.first} ${latestAppointment.doctor.name.last}`,
                  email: latestAppointment.doctor.email,
                }
              : null,
            metadata: latestAppointment.metadata || {},
          };
        } else {
          // Patient has no appointments - create entry with no_appointment status
          return {
            id: null, // No appointment ID
            date: new Date(), // Current date as placeholder
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
            metadata: {},
          };
        }
      });

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