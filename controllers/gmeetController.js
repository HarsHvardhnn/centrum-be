const User = require("../models/user-entity/user");
const Appointment = require("../models/appointment");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const { getCalendarClient } = require("../utils/googleCalendar");

// Function to get admin user for Google Calendar auth
async function getCalendarAdmin() {
  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    throw new Error("Admin account not found for Google Calendar integration");
  }
  return admin;
}

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
      phone,
      time,
    } = req.body;

    // Validate required fields
    if (!date || !doctorId || !email || !name || !phone || !time) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Parse name into first and last
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    // Find the doctor
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    // Look for existing patient by email
    let patient = await User.findOne({
      email: email.toLowerCase(),
      role: "patient",
    });
    let isNewUser = false;

    // If patient doesn't exist, create a new one
    if (!patient) {
      isNewUser = true;
      const randomPassword =
        Math.random().toString(36).slice(-10) +
        Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      patient = new User({
        name: {
          first: firstName,
          last: lastName || "",
        },
        email: email.toLowerCase(),
        sex:
          gender === "Male"
            ? "Male"
            : gender === "Female"
            ? "Female"
            : "Others",
        phone,
        password: hashedPassword,
        role: "patient",
        signupMethod: "email",
      });

      await patient.save();

      // You would send the temporary password to the user here
      // Example: await sendPasswordEmail(patient.email, randomPassword);
    }

    // Calculate end time (assuming duration is in minutes)
    const duration = 30; // Default duration in minutes
    const appointmentDate = new Date(`${date}T${time}:00`);
    const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
    const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
    const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
    const endTime = `${endTimeHour}:${endTimeMinute}`;

    // Create appointment
    const appointment = new Appointment({
      doctor: doctorId,
      patient: patient._id,
      bookedBy: patient._id,
      date: appointmentDate,
      startTime: time,
      endTime: endTime,
      duration: duration,
      mode: "online",
      notes: message || "",
    });

    await appointment.save();

    // Create Google Meet event
    try {
      // Get admin user for Google Calendar integration
      const admin = await getCalendarAdmin();

      // Get Calendar client
      const calendar = await getCalendarClient(admin._id);

      const event = {
        summary: `Medical Appointment: ${department}`,
        description: message || "Medical consultation",
        start: {
          dateTime: appointmentDate.toISOString(),
          timeZone: "Asia/Kolkata", // Adjust for your timezone
        },
        end: {
          dateTime: endTimeDate.toISOString(),
          timeZone: "Asia/Kolkata", // Adjust for your timezone
        },
        attendees: [{ email: doctor.email }, { email: patient.email }],
        conferenceData: {
          createRequest: {
            requestId: uuidv4(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };

      const calendarResponse = await calendar.events.insert({
        calendarId: "primary",
        resource: event,
        conferenceDataVersion: 1,
        sendNotifications: true,
      });

      // Update appointment with the meeting link
      appointment.joining_link = calendarResponse.data.hangoutLink;
      await appointment.save();

      return res.status(201).json({
        success: true,
        message: "Appointment booked successfully",
        appointment,
        meetLink: calendarResponse.data.hangoutLink,
        isNewUser,
      });
    } catch (googleError) {
      console.error("Google Calendar error:", googleError);

      return res.status(201).json({
        success: true,
        message: "Appointment booked but failed to create Google Meet event",
        appointment,
        isNewUser,
      });
    }
  } catch (error) {
    console.error("Appointment booking error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to book appointment",
        error: error.message,
      });
  }
};
