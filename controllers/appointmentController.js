// controllers/appointmentController.js

const { validationResult } = require("express-validator");
const Appointment = require("../models/appointment");

exports.createAppointment = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      doctor,
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
    } = req.body;

    // Calculate duration in minutes
    const calculateDuration = (start, end) => {
      const [startHour, startMinute] = start.split(":").map(Number);
      const [endHour, endMinute] = end.split(":").map(Number);

      // Convert to minutes since midnight
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // Calculate duration
      return endMinutes - startMinutes;
    };

    const duration = calculateDuration(startTime, endTime);

    // Create new appointment
    const newAppointment = new Appointment({
      doctor,
      patient,
      bookedBy: req.user.id, 
      date: new Date(date),
      startTime,
      endTime,
      duration,
      notes,
      // Set initial status
      status: markAsArrived ? "completed" : "booked",
      // Additional fields can be added as metadata if needed
      metadata: {
        patientSource,
        visitType,
        isInternational,
        isWalkin,
        needsAttention,
        enableRepeats,
      },
    });

    await newAppointment.save();

    // Populate doctor and patient details for the response
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate("doctor", "name email")
      .populate("patient", "name email")
      .populate("bookedBy", "name email");

    res.status(201).json({
      success: true,
      data: populatedAppointment,
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

    const query = { doctor: doctorId };

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
      .populate("patient", "name email profilePicture sex dob") // assuming `sex` and `dob` are in user model
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
      username: `@${appt.patient?.name.first?.toLowerCase() || "user"}`,
      avatar: appt.patient?.profilePicture || "https://i.pravatar.cc/150",
      sex: appt.patient?.sex || "Unknown",
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
