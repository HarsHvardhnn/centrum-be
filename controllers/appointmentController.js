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
const { sendEmail } = require("../utils/mailer");
const { format } = require("date-fns");

// Helper function to check if patient has consented to SMS notifications
const hasPatientConsentedToSMS = (patientDetails) => {
  if (!patientDetails.consents || patientDetails.consents.length === 0) {
    return false;
  }
  
  try {
    const parsedConsents = JSON.parse(patientDetails.consents);
    return parsedConsents.some(
      (consent) =>
        consent.text.toLowerCase().includes("sms notifications") &&
        consent.agreed === true
    );
  } catch (error) {
    console.error("Error parsing patient consents:", error);
    return false;
  }
};

// Helper function to send appointment status SMS
const sendAppointmentStatusSMS = async (appointment, patientDetails, doctorDetails, status) => {
  try {
    if (!hasPatientConsentedToSMS(patientDetails)) {
      console.log("Patient has not consented to SMS notifications");
      return { success: false, error: "Patient has not consented to SMS notifications" };
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
        message = `Your appointment with Dr. ${doctorName} scheduled for ${appointmentDate} at ${startTimeFormatted} has been cancelled. Contact us for rescheduling.`;
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
const sendReportUploadSMS = async (appointment, patientDetails, doctorDetails) => {
  try {
    if (!hasPatientConsentedToSMS(patientDetails)) {
      return { success: false, error: "Patient has not consented to SMS notifications" };
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
  return crypto.randomBytes(8).toString('hex');
};

const sendAppointmentConfirmationSMS = async (
  appointment,
  patientDetails,
  doctorDetails
) => {
  try {
    // Get patient's phone number
    const phoneNumber =
      patientDetails.phone;
  
 let smsConsentAgreed = false;

 if (patientDetails.consents && patientDetails.consents.length > 0) {
   const parsedConsents = JSON.parse(patientDetails.consents);
   smsConsentAgreed = parsedConsents.some(
     (consent) =>
       consent.text.toLowerCase().includes("sms notifications") &&
       consent.agreed === true
   );
 }

    if (!smsConsentAgreed) { 
      return;
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

exports.createAppointment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      doctor: doctorId,
      patient,
      date,
      startTime,
      endTime,
      patientSource,
      visitType,
      isInternational,
      isWalkin,
      needsAttention,
      markAsArrived,
      notes,
      enableRepeats,
      isNewPatient,
      newPatient,
      mode,
      services
    } = req.body;

    let patientId = patient;
    let patientDetails;
    let isNewlyCreated = false;
    let temporaryPassword = null;

    // Get doctor details for SMS
    const doctorDetails = await doctor.findById(doctorId);
    if (!doctorDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }

    // HANDLE NEW PATIENT CREATION
    if (isNewPatient && newPatient) {
      try {
        // Check if patient with this email already exists
        const existingPatient = await user.findOne({ email: newPatient.email });
        
        if (existingPatient) {
          patientDetails = existingPatient;
          patientId = existingPatient._id;
        } else {
          // Create new patient
          temporaryPassword = generateTemporaryPassword();
          const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
          
          patientDetails = new user({
            name: {
              first: newPatient.firstName,
              last: newPatient.lastName || "",
            },
            email: newPatient.email,
            phone: newPatient.phone,
            password: hashedPassword,
            role: "patient",
            patientId: `P-${new Date().getTime()}`,
            signupMethod: "email",
            profilePicture: "",
            isVerified: false,
            sex: newPatient.sex || "",
          });
          
          await patientDetails.save();
          patientId = patientDetails._id;
          isNewlyCreated = true;

          // Send welcome email with temporary credentials
          try {
            await sendEmail({
              to: patientDetails.email,
              subject: "Welcome to Centrum Medyczne",
              html: createWelcomeEmailHtml({
                name: `${patientDetails.name.first} ${patientDetails.name.last}`,
                email: patientDetails.email,
                temporaryPassword
              }),
              text: `Welcome to Centrum Medyczne! Your temporary password is: ${temporaryPassword}. Please change it after your first login.`
            });
          } catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
          }
        }
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: "Failed to create new patient",
          error: error.message,
        });
      }
    } else {
      // Get existing patient details
      patientDetails = await user.findById(patientId);
      if (!patientDetails) {
        return res.status(404).json({
          success: false,
          message: "Patient not found"
        });
      }
    }

    // Get the consultation fee based on appointment mode
    const doctorModel = await doctor.findById(doctorId);
    const consultationFee = mode === "online" 
      ? doctorModel?.consultationFee || 0 
      : doctorModel?.offlineConsultationFee || 0;

    // Check if appointment already exists at the same time
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: new Date(date),
      $or: [
        {
          startTime: { $lt: endTime },
          endTime: { $gt: startTime },
        },
      ],
      status: { $ne: "cancelled" }
    });

    if (existingAppointment) {
      return res.status(400).json({
        success: false,
        message: "Appointment slot is already booked at this time",
      });
    }

    // Calculate duration
    const calculateDuration = (start, end) => {
      const [startHour, startMinute] = start.split(":").map(Number);
      const [endHour, endMinute] = end.split(":").map(Number);
      return endHour * 60 + endMinute - (startHour * 60 + startMinute);
    };

    const duration = calculateDuration(startTime, endTime);

    // Create new appointment
    const newAppointment = new Appointment({
      doctor: doctorId,
      patient: patientId,
      bookedBy: req.user.id,
      date: new Date(date),
      startTime,
      endTime,
      duration,
      mode: mode || "offline",
      notes,
      status: markAsArrived ? "completed" : "booked",
      metadata: {
        patientSource,
        visitType,
        isInternational,
        isWalkin,
        needsAttention,
        enableRepeats,
        isNewPatient: isNewPatient || false,
        consultationFee
      },
    });

    // Update patient consulting doctor
    patientDetails.consultingDoctor = doctorId;
    await patientDetails.save();

    await newAppointment.save();

    // Handle services if provided
    if (services && Array.isArray(services) && services.length > 0) {
      try {
        const serviceIds = services.map(s => s.serviceId);
        const existingServices = await Service.find({ 
          _id: { $in: serviceIds },
          isDeleted: false
        });

        if (existingServices.length === serviceIds.length) {
          const formattedServices = services.map(s => ({
            service: s.serviceId,
            notes: s.notes || "",
            status: s.status || "active",
            assignedDate: new Date(),
          }));

          await PatientService.create({
            patient: patientId,
            appointment: newAppointment._id,
            services: formattedServices,
            assignedBy: req.user.id,
            isDeleted: false
          });
        }
      } catch (serviceError) {
        console.error("Error creating patient services:", serviceError);
      }
    }

    // Send SMS notification
    let smsResult = null;
    try {
      const formattedDate = format(new Date(date), "dd.MM.yyyy");
      const message = mode === "online" 
        ? `Twoja wizyta online u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${startTime}. Link do wizyty otrzymaja Panstwo na adres e-mail.`
        : `Twoja wizyta u dr ${doctorDetails.name.last} zostala zaplanowana na ${formattedDate} o godz ${startTime} w naszej placowce. Prosimy o kontakt telefoniczny w celu zmiany terminu.`;
      
      // Add temporary password to SMS if new patient
      // if (isNewlyCreated && temporaryPassword) {
      //   message += ` Your temporary password is: ${temporaryPassword}. Please change it after login.`;
      // }
      
      if (hasPatientConsentedToSMS(patientDetails)) {
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
      }
    } catch (smsError) {
      console.error("Error sending appointment confirmation SMS:", smsError);
    }

    // Populate and return response
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate("doctor", "name email")
      .populate("patient", "name email phone mobile")
      .populate("bookedBy", "name email");

    res.status(201).json({
      success: true,
      data: populatedAppointment,
      notifications: {
        sms: smsResult ? {
          sent: smsResult.success,
          error: smsResult.error
        } : {
          sent: false,
          error: "SMS notification not sent - patient consent not given"
        }
      },
      newPatientCreated: isNewlyCreated,
      temporaryPassword: isNewlyCreated ? temporaryPassword : undefined
    });

  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error.message,
    });
  }
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

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
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
      avatar: appt.patient?.profilePicture || "https://i.pravatar.cc/150",
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
      .sort({ date: -1, startTime: 1 });

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

    const appointment = await Appointment.findById(appointmentId)
      .populate("doctor patient", "name email phone");

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
        sms: smsResult ? {
          sent: smsResult.success,
          error: smsResult.error
        } : {
          sent: false,
          error: "SMS notification not sent - patient consent not given"
        }
      }
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

exports.getAppointmentsDashboard = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sortBy || "date";
    const order = req.query.order === "desc" ? -1 : 1;

    const skip = (page - 1) * limit;

    // Get today's date at 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Query only upcoming appointments
    const filter = {
      status: { $nin: ["cancelled"] },
      date: { $gte: today },
    };

    const appointments = await Appointment.find(filter)
      .sort({ [sortBy]: order })
      .skip(skip)
      .limit(limit)
      .populate("doctor patient bookedBy");

    const total = await Appointment.countDocuments(filter);

    const formattedAppointments = await Promise.all(
      appointments.map(async (appt) => {
        const doctorUser = appt.doctor;
        const doctorProfile = await doctor.findOne({
          patients: doctorUser._id,
        });

        return {
          id: appt._id,
          name: `Dr. ${doctorUser.name.first} ${doctorUser.name.last}`,
          specialty: doctorProfile?.specialization?.[0] || "General",
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

    const appointment = await Appointment.findById(id)
      .populate("doctor patient", "name email phone");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "cancelled") {
      return res.status(400).json({ message: "Appointment is already cancelled" });
    }

    // Get doctor and patient details for SMS
    const doctorDetails = await doctor.findById(appointment.doctor._id);
    const patientDetails = await user.findById(appointment.patient._id);

    if (!doctorDetails || !patientDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor or patient details not found"
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
        sms: smsResult ? {
          sent: smsResult.success,
          error: smsResult.error
        } : {
          sent: false,
          error: "SMS notification not sent - patient consent not given"
        }
      }
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
      medications, 
      tests, 
      healthData,
      reports 
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid appointment ID format" 
      });
    }

    const updateData = {};

    // Handle consultation data if provided
    if (consultationData) {
      const consultDate = new Date(consultationData.date);
      updateData.consultation = {
        consultationType: consultationData.consultationType,
        consultationNotes: consultationData.notes,
        description: consultationData.description,
        treatmentCategory: consultationData?.treatmentCategory || "",
        consultationDate: !isNaN(consultDate.getTime()) ? consultDate : new Date(),
        consultationStatus: consultationData.status || "Scheduled",
        isOnline: consultationData.isOnline || false,
        interview: consultationData.interview || "",
        physicalExamination: consultationData.physicalExamination || "",
        treatment: consultationData.treatment || "",
        recommendations: consultationData.recommendations || "",
        roomNumber: consultationData.roomNumber || null,
        isRisky: consultationData.isRisky || false,
        time: consultationData.time || ""
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
        recordedAt: new Date()
      };
    }
    
    // Handle reports if provided
    if (reports && reports.length > 0) {
      // If we want to add to existing reports
      if (req.query.appendReports === 'true') {
        updateData.$push = { 
          reports: { 
            $each: reports.map(report => ({
              name: report.name,
              type: report.type, 
              fileUrl: report.fileUrl,
              fileType: report.fileType,
              description: report.description || "",
              uploadedAt: new Date(),
              metadata: report.metadata || {}
            }))
          }
        };
      } else {
        // Replace all reports
        updateData.reports = reports.map(report => ({
          name: report.name,
          type: report.type,
          fileUrl: report.fileUrl,
          fileType: report.fileType,
          description: report.description || "",
          uploadedAt: new Date(),
          metadata: report.metadata || {}
        }));
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
        message: "Invalid appointment ID format"
      });
    }

    if (!reportData.name || !reportData.fileUrl) {
      return res.status(400).json({
        success: false,
        message: "Report name and fileUrl are required"
      });
    }

    const report = {
      name: reportData.name,
      type: reportData.type || "Other",
      fileUrl: reportData.fileUrl,
      fileType: reportData.fileType || "pdf",
      description: reportData.description || "",
      uploadedAt: new Date(),
      metadata: reportData.metadata || {}
    };

    const updatedAppointment = await Appointment.findByIdAndUpdate(
      id,
      { $push: { reports: report } },
      { new: true }
    );

    if (!updatedAppointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    res.status(200).json({
      success: true,
      data: updatedAppointment.reports,
      message: "Report added successfully"
    });
  } catch (error) {
    console.error("Error adding report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add report",
      error: error.message
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
        message: "Invalid appointment ID format"
      });
    }

    // Check if appointment exists and get populated data
    const appointment = await Appointment.findById(id)
      .populate("doctor patient", "name email phone");
      
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Get doctor and patient details for SMS
    const doctorDetails = await doctor.findById(appointment.doctor._id);
    const patientDetails = await user.findById(appointment.patient._id);

    if (!doctorDetails || !patientDetails) {
      return res.status(404).json({
        success: false,
        message: "Doctor or patient details not found"
      });
    }

    // Process uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    // Create report object
    const report = {
      name: req.body.name || req.file.originalname,
      type: req.body.type || "Other",
      fileUrl: req.file.path,
      fileType: req.file.mimetype.split('/')[1] || "pdf",
      description: req.body.description || "",
      uploadedAt: new Date(),
      metadata: {
        originalName: req.file.originalname,
        size: req.file.size,
        cloudinaryId: req.file.filename || req.file.public_id
      }
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
        appointment
      },
      notifications: {
        sms: smsResult ? {
          sent: smsResult.success,
          error: smsResult.error
        } : {
          sent: false,
          error: "SMS notification not sent - patient consent not given"
        }
      }
    });
  } catch (error) {
    console.error("Error uploading report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload report",
      error: error.message
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
        message: "Invalid appointment ID format"
      });
    }

    // Find the appointment and verify it exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Find the report in the appointment
    const reportIndex = appointment.reports ? 
      appointment.reports.findIndex(r => r._id.toString() === reportId) : -1;

    if (reportIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Report not found in this appointment"
      });
    }

    // Get cloudinary ID to delete the file from cloud storage if available
    const cloudinaryId = appointment.reports[reportIndex].metadata?.cloudinaryId;

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
        remainingReports: appointment.reports
      }
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete report",
      error: error.message
    });
  }
};

// Get appointment details including consultation, tests, and medications
exports.getAppointmentDetails = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format",
      });
    }

    const appointment = await Appointment.findById(id)
      .populate("doctor", "name.first name.last")
      .populate("patient", "name.first name.last patientId")
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    // Add doctor name to consultation
    if (appointment.consultation) {
      appointment.consultation.consultationDoctor = 
        `${appointment.doctor.name.first} ${appointment.doctor.name.last}`;
      
      // Ensure consultation fields exist
      appointment.consultation.interview = appointment.consultation.interview || "";
      appointment.consultation.physicalExamination = appointment.consultation.physicalExamination || "";
      appointment.consultation.treatment = appointment.consultation.treatment || "";
      appointment.consultation.recommendations = appointment.consultation.recommendations || "";
      
      // Add appointment start time to consultation data
      appointment.consultation.time = appointment.startTime || "";
      
      // Use appointment.date as fallback for consultationDate if it doesn't exist or is null
      if (!appointment.consultation.consultationDate) {
        appointment.consultation.consultationDate = appointment.date;
      }
    } else {
      appointment.consultation = {
        consultationDoctor: `${appointment.doctor.name.first} ${appointment.doctor.name.last}`,
        interview: "",
        physicalExamination: "",
        treatment: "",
        recommendations: "",
        time: appointment.startTime || "",
        consultationDate: appointment.date
      };
    }

    // Format reports if they exist
    if (appointment.reports && appointment.reports.length > 0) {
      appointment.reports = appointment.reports.map(report => ({
        ...report,
        uploadedAt: report.uploadedAt || new Date(),
        displayName: report.name || "Unnamed Report",
        url: report.fileUrl,
        type: report.fileType || "pdf"
      }));
    } else {
      appointment.reports = [];
    }

    res.status(200).json({
      success: true,
      data: appointment,
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

    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
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

// Get appointments with pagination, sorting and filtering
exports.getAppointments = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            sortBy = 'date',
            sortOrder = 'desc',
            status,
            startDate,
            endDate,
            doctorId,
            searchTerm
        } = req.query;

        // Build query
        const query = {};

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Date range filter
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // Doctor filter
        if (doctorId) {
            query.doctor = doctorId;
        }

        // Search by patient name or disease
        if (searchTerm) {
            query.$or = [
                { 'mainComplaint': { $regex: searchTerm, $options: 'i' } }
            ];
        }

        // Calculate skip for pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build sort object
        const sortObject = {};
        sortObject[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Get appointments with pagination
        const appointments = await Appointment.find(query)
            .populate({
                path: 'patient',
                select: 'name email profilePicture sex dateOfBirth mainComplaint patientId status'
            })
            .populate({
                path: 'doctor',
                select: 'name email'
            })
            .sort(sortObject)
            .skip(skip)
            .limit(parseInt(limit)).lean();

        // Get total count for pagination
        const total = await Appointment.countDocuments(query);

        // Calculate age for each patient
        const appointmentsWithAge = appointments.map(appointment => {
            const patientData = appointment.patient;
            let age = null;
            if (patientData?.dateOfBirth) {
                const today = new Date();
                const birthDate = new Date(patientData.dateOfBirth);
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            }

            console.log("patientData?.status",patientData);
            return {
                id: appointment._id,
                date: appointment.date,
                startTime: appointment.startTime,
                endTime: appointment.endTime,
                status: appointment.status,
                mode: appointment.mode,
                checkIn: appointment.checkedIn,
                checkInDate: appointment.checkInDate,
                patient: {
                    patient_status: patientData?.status,  
                    id: patientData?._id,
                    patientId: patientData?.patientId,
                    name: patientData ? `${patientData.name.first} ${patientData.name.last}` : null,
                    sex: patientData?.sex,
                    age: age,
                    disease: patientData?.mainComplaint,
                    profilePicture: patientData?.profilePicture || null,
                    email: patientData?.email
                },
                doctor: appointment.doctor ? {
                    id: appointment.doctor._id,
                    name: `${appointment.doctor.name.first} ${appointment.doctor.name.last}`,
                    email: appointment.doctor.email
                } : null,
                metadata: appointment.metadata || {}
            };
        });

        res.status(200).json({
            success: true,
            data: appointmentsWithAge,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch appointments',
            error: error.message
        });
    }
};

// Upload report files to appointment
exports.uploadAppointmentReports = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format"
      });
    }

    // Check if appointment exists
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Process uploaded files from req.files (Multer should attach this)
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded"
      });
    }

    // Create report objects from uploaded files
    const reports = req.files.map(file => ({
      name: req.body.name || file.originalname,
      type: req.body.type || "Other",
      fileUrl: file.path, // Cloudinary URL from your middleware
      fileType: file.mimetype.split('/')[1] || "pdf",
      description: req.body.description || "",
      uploadedAt: new Date(),
      metadata: {
        originalName: file.originalname,
        size: file.size,
        cloudinaryId: file.filename || file.public_id
      }
    }));

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
      message: `${reports.length} report(s) uploaded successfully`
    });

  } catch (error) {
    console.error("Error uploading reports:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload reports",
      error: error.message
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
        message: "Invalid appointment ID format" 
      });
    }

    // Get the current appointment
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Prepare consultation update data
    const consultationUpdate = {
      consultationType: consultationData.consultationType || appointment.consultation?.consultationType,
      consultationNotes: consultationData.notes || consultationData.consultationNotes || appointment.consultation?.consultationNotes,
      description: consultationData.description || appointment.consultation?.description,
      treatmentCategory: consultationData.treatmentCategory || appointment.consultation?.treatmentCategory,
      consultationStatus: consultationData.status || consultationData.consultationStatus || appointment.consultation?.consultationStatus || "Scheduled",
      isOnline: consultationData.isOnline !== undefined ? consultationData.isOnline : appointment.consultation?.isOnline,
      roomNumber: consultationData.roomNumber !== undefined ? consultationData.roomNumber : appointment.consultation?.roomNumber,
      isRisky: consultationData.isRisky !== undefined ? consultationData.isRisky : appointment.consultation?.isRisky,
      
      // Ensure the four required fields are included
      interview: consultationData.interview || appointment.consultation?.interview || "",
      physicalExamination: consultationData.physicalExamination || appointment.consultation?.physicalExamination || "",
      treatment: consultationData.treatment || appointment.consultation?.treatment || "",
      recommendations: consultationData.recommendations || appointment.consultation?.recommendations || "",
      
      // Add time from appointment's startTime if not provided
      time: consultationData.time || appointment.startTime || appointment.consultation?.time || ""
    };

    // Add consultation date if provided
    if (consultationData.date || consultationData.consultationDate) {
      const dateValue = consultationData.date || consultationData.consultationDate;
      const consultDate = new Date(dateValue);
      if (!isNaN(consultDate.getTime())) {
        consultationUpdate.consultationDate = consultDate;
      }
    } else if (appointment.consultation?.consultationDate) {
      consultationUpdate.consultationDate = appointment.consultation.consultationDate;
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
        consultation: updatedAppointment.consultation
      }
    });
  } catch (error) {
    console.error("Error updating consultation:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update consultation",
      error: error.message
    });
  }
};


