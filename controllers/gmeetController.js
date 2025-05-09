const User = require("../models/user-entity/user");
const Appointment = require("../models/appointment");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const { getServerManagedCalendarClient, getDirectCalendarClient, GOOGLE_CALENDAR_ID } = require("../utils/serverGoogleAuth");
const sendEmail = require("../utils/mailer");
const { format } = require("date-fns");

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

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #3f51b5;">Appointment Confirmation</h2>
        <p style="color: #666;">Your appointment has been scheduled successfully</p>
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #3f51b5;">Appointment Details</h3>
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Doctor:</strong> ${doctorName}</p>
        <p><strong>Date:</strong> ${date}</p>
        <p><strong>Time:</strong> ${time}</p>
        <p><strong>Department:</strong> ${department || 'Not specified'}</p>
        <p><strong>Mode:</strong> ${mode || 'Online'}</p>
        ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
      </div>
      
      ${meetingLink ? `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #e8f5e9; border-radius: 4px; text-align: center;">
          <h3 style="margin-top: 0; color: #2e7d32;">Google Meet Link</h3>
          <p>Click the button below to join your appointment at the scheduled time:</p>
          <a href="${meetingLink}" style="display: inline-block; padding: 10px 20px; background-color: #4caf50; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Join Meeting</a>
        </div>
      ` : `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #fff3e0; border-radius: 4px; text-align: center;">
          <h3 style="margin-top: 0; color: #e65100;">Note</h3>
          <p>This is an online appointment, but the meeting link could not be generated automatically. The doctor's office will contact you with further instructions.</p>
        </div>
      `}
      
      ${isNewUser ? `
        <div style="margin-bottom: 20px; padding: 15px; background-color: #e3f2fd; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1976d2;">Welcome to Our Platform</h3>
          <p>As a new user, we've created an account for you with the following credentials:</p>
          <p><strong>Email:</strong> Your provided email address</p>
          <p><strong>Temporary Password:</strong> ${temporaryPassword || 'harsh123'}</p>
          <p>We recommend changing your password after your first login for security reasons.</p>
        </div>
      ` : ''}
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 14px;">
        <p>Thank you for choosing our medical services.</p>
        <p>If you need to reschedule or cancel, please contact us at least 24 hours before your appointment.</p>
        <p>© ${new Date().getFullYear()} Centrum Medyczne - All rights reserved</p>
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

    // Calculate appointment dates and times
    const appointmentDate = new Date(`${date}T${time}:00`);
    const duration = 30; // Default duration in minutes
    const endTimeDate = new Date(appointmentDate.getTime() + duration * 60000);
    const endTimeHour = endTimeDate.getHours().toString().padStart(2, "0");
    const endTimeMinute = endTimeDate.getMinutes().toString().padStart(2, "0");
    const endTime = `${endTimeHour}:${endTimeMinute}`;
    
    // Check if there's already an appointment at the same date and time for this doctor
    // Format the date for MongoDB query
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Check for existing appointments with the same doctor, date and time that are still booked
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      startTime: time,
      status: "booked" // Only consider appointments that are still booked
    });
    
    if (existingAppointment) {
      return res.status(409).json({
        success: false,
        message: "There is already an appointment booked with this doctor at this time.",
        conflict: true
      });
    }

    // Look for existing patient by email
    let patient = await User.findOne({
      email: email.toLowerCase(),
      role: "patient",
    });
    let isNewUser = false;
    const temporaryPassword = "harsh123"; // Should be randomly generated in production

    // If patient doesn't exist, create a new one
    if (!patient) {
      isNewUser = true;
      // Generate a secure random password - should be sent to user in real application
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

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
      mode: "online",
      notes: message || "",
    });

    await appointment.save();

    // Prepare appointment data for email
    let meetingLink = "";
    let calendarSetupNeeded = false;
    
    // Create Google Meet event with service account authentication 
    try {
      // Use direct service account authentication which uses domain-wide delegation
      console.log("Attempting to create Google Calendar event for appointment...");
      let calendar;
      
      try {
        // This is our most reliable method - using domain-wide delegation
        calendar = await getDirectCalendarClient();
      } catch (serviceAuthError) {
        console.error("Direct service account authentication failed:", serviceAuthError.message);
        
        // Fallback to OAuth-based authentication if service account fails
        console.log("Falling back to OAuth-based authentication...");
        const admin = await getCalendarAdmin();
        calendar = await getServerManagedCalendarClient(admin._id);
      }

      // Create the calendar event
      const event = {
        summary: `Medical Appointment: ${department || "Consultation"}`,
        description: `Patient: ${patient.name.first} ${patient.name.last}\n${message || "Medical consultation"}`,
        start: {
          dateTime: appointmentDate.toISOString(),
          timeZone: "Asia/Kolkata", // Adjust for your timezone
        },
        end: {
          dateTime: endTimeDate.toISOString(),
          timeZone: "Asia/Kolkata", // Adjust for your timezone
        },
        attendees: [
          { email: doctor.email, displayName: `Dr. ${doctor.name.first} ${doctor.name.last}` }, 
          { email: patient.email, displayName: `${patient.name.first} ${patient.name.last}` }
        ],
        conferenceData: {
          createRequest: {
            requestId: uuidv4(),
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      };

      console.log(`Creating calendar event in calendar ID: ${GOOGLE_CALENDAR_ID || 'primary'}`);
      
      const calendarResponse = await calendar.events.insert({
        calendarId: GOOGLE_CALENDAR_ID || "primary",
        resource: event,
        conferenceDataVersion: 1,
        sendNotifications: true,
      });

      // Update appointment with the meeting link
      meetingLink = calendarResponse.data.hangoutLink;
      appointment.joining_link = meetingLink;
      await appointment.save();
      
      console.log("Successfully created Google Meet link:", meetingLink);
      
    } catch (googleError) {
      console.error("Google Calendar error:", googleError);

      // Check if error is due to missing or invalid token
      if (
        googleError.message.includes("auth") ||
        googleError.message.includes("token") ||
        googleError.message.includes("authorization required") ||
        googleError.message.includes("invalid_grant")
      ) {
        calendarSetupNeeded = true;
        console.log("Google Calendar needs authentication setup. Error:", googleError.message);
        
        // Log detailed error for debugging
        console.error("Detailed Google Calendar error:", JSON.stringify({
          message: googleError.message,
          stack: googleError.stack,
          response: googleError.response?.data
        }, null, 2));
      }
    }
    
    // Send email to patient regardless of Google Calendar success/failure
    try {
      const formattedDate = format(appointmentDate, "EEEE, MMMM dd, yyyy");
      
      // Email data
      const emailData = {
        patientName: `${patient.name.first} ${patient.name.last}`,
        doctorName: `Dr. ${doctor.name.first} ${doctor.name.last}`,
        date: formattedDate,
        time: `${time} - ${endTime}`,
        department: department || "General",
        meetingLink: meetingLink,
        notes: message || "",
        mode: "Online",
        isNewUser,
        temporaryPassword: isNewUser ? temporaryPassword : null,
      };
      
      // Send email
      await sendEmail({
        to: patient.email,
        subject: "Your Appointment Confirmation",
        html: createAppointmentEmailHtml(emailData),
        text: `Your appointment with Dr. ${doctor.name.first} ${doctor.name.last} has been scheduled for ${formattedDate} at ${time}. ${meetingLink ? `Join the meeting at: ${meetingLink}` : "The doctor's office will contact you with further instructions."}`,
      });
      
      console.log(`Appointment confirmation email sent to ${patient.email}`);
    } catch (emailError) {
      console.error("Failed to send appointment email:", emailError);
      // Continue with the response - don't fail the whole appointment just because email failed
    }

    // Return appropriate response based on Google Meet creation result
    if (meetingLink) {
      return res.status(201).json({
        success: true,
        message: "Appointment booked successfully with Google Meet",
        appointment,
        meetLink: meetingLink,
        isNewUser,
        emailSent: true,
      });
    } else if (calendarSetupNeeded) {
      return res.status(201).json({
        success: true,
        message: "Appointment booked but Google Calendar integration needs to be set up",
        appointment,
        isNewUser,
        calendarSetupNeeded: true,
        emailSent: true,
      });
    } else {
      return res.status(201).json({
        success: true,
        message: "Appointment booked but failed to create Google Meet event",
        appointment,
        isNewUser,
        emailSent: true,
      });
    }
    
  } catch (error) {
    console.error("Appointment booking error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to book appointment",
      error: error.message,
    });
  }
};
