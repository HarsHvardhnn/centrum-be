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
      mode
    } = req.body;

    let patientId = patient;
    let patientDetails;
    let isNewlyCreated = false;

    // HANDLE NEW PATIENT CREATION
    if (isNewPatient && newPatient) {
      try {
        // Check if patient with this email already exists
        const existingPatient = await user.findOne({ email: newPatient.email });
        
        if (existingPatient) {
          patientDetails = existingPatient;
          patientId = existingPatient._id;
          isNewlyCreated = false;
        } else {
          // Create a new patient user
          const tempPassword = generateTemporaryPassword();
          
          const newPatientUser = new user({
            name: {
              first: newPatient.firstName,
              last: newPatient.lastName
            },
            email: newPatient.email,
            phone: newPatient.phone || "",
            role: "patient",
            patientId: `P-${new Date().getTime()}`,
            password: tempPassword, // Temporary password - should be hashed in production
            signupMethod: "email",
            profilePicture: "",
            isVerified: false,
            sex: newPatient.sex || "",
            // Add any other required fields with defaults
          });
  
          patientDetails = await newPatientUser.save();
          patientId = patientDetails._id;
          isNewlyCreated = true;
          
          // TODO: Send welcome email with temporary credentials
          console.log(`New patient created with temporary password: ${tempPassword}`);
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Failed to create new patient",
          error: error.message
        });
      }
    } else {
      // EXISTING PATIENT FLOW
      patientDetails = await user.findById(patientId);
      if (!patientDetails) {
        return res
          .status(404)
          .json({ success: false, message: "Patient not found" });
      }
    }

    // Get doctor details for SMS
    const doctorDetails = await user.findById(doctorId);
    if (!doctorDetails) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
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

    // Populate doctor and patient details
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate("doctor", "name email")
      .populate("patient", "name email phone mobile")
      .populate("bookedBy", "name email");

    // Send confirmation SMS to patient
    let smsResult = null;
    try {
      smsResult = await sendAppointmentConfirmationSMS(
        newAppointment,
        patientDetails,
        doctorDetails
      );

      const notificationInfo = {
        smsNotification: {
          sent: smsResult.success,
          receiptId: smsResult.receiptId,
        },
      };

      if (!smsResult.success) {
        notificationInfo.smsNotification.error = smsResult.error;
        console.warn(
          "Failed to send appointment confirmation SMS:",
          smsResult.error
        );
      }

      res.status(201).json({
        success: true,
        data: populatedAppointment,
        notifications: notificationInfo,
        newPatientCreated: isNewlyCreated
      });
    } catch (smsError) {
      console.error("SMS sending error:", smsError);
      res.status(201).json({
        success: true,
        data: populatedAppointment,
        notifications: {
          smsNotification: {
            sent: false,
            error: smsError.message || "Failed to send SMS notification",
          },
        },
        newPatientCreated: isNewlyCreated
      });
    }
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

    const appointment = await Appointment.findByIdAndUpdate(
      appointmentId,
      { status },
      { new: true }
    ).populate("doctor patient bookedBy", "name email");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: appointment,
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

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "cancelled") {
      return res
        .status(400)
        .json({ message: "Appointment is already cancelled" });
    }

    appointment.status = "cancelled";
    await appointment.save();

    res.status(200).json({ message: "Appointment cancelled successfully" });
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
