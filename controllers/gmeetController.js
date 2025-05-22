const User = require("../models/user-entity/user");
const Appointment = require("../models/appointment");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const sendEmail = require("../utils/mailer");
const { format } = require("date-fns");
const MessageReceipt = require("../models/smsData");
const {sendSMS} = require("../utils/smsapi");
const { getCalendarClient } = require("../config/googleCalendar");
const path = require('path');
const fs = require('fs');
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

  const logoPath = path.join(__dirname, '../public', 'logo_new.png');
  console.log(logoPath,"logoPath");
  
  // Read and convert logo to base64
  const logoBase64 = fs.readFileSync(logoPath, { encoding: 'base64' });

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: left; margin-bottom: 20px;">
        <img src="data:image/png;base64,${logoBase64}" alt="Centrum Medyczne 7" style="height: 50px;" />
      </div>
      
      <div style="margin-bottom: 30px;">
        <h2 style="color: #333; margin-bottom: 5px;">Appointment Confirmation | Potwierdzenie Wizyty</h2>
        <p style="color: #666; font-size: 16px; margin-top: 0;">Twoja wizyta została umówiona pomyślnie.</p>
      </div>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #333; margin-top: 0;">Szczegóły Wizyty:</h3>
        
        <div style="margin-bottom: 15px;">
          <p style="margin: 5px 0;"><strong>Pacjent:</strong> ${patientName}</p>
          <p style="margin: 5px 0;"><strong>Specjalista:</strong> ${doctorName}</p>
          <p style="margin: 5px 0;"><strong>Data:</strong> ${date}</p>
          <p style="margin: 5px 0;"><strong>Godzina:</strong> ${time}</p>
          <p style="margin: 5px 0;"><strong>Typ konsultacji:</strong> ${mode === 'online' ? 'Online' : 'Stacjonarna'}</p>
          ${notes ? `<p style="margin: 5px 0;"><strong>Uwagi pacjenta:</strong> ${notes}</p>` : ''}
        </div>
      </div>
      
      ${mode === 'online' ? `
        ${meetingLink ? `
          <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0;">To jest wizyta online. Osobne spotkanie na Google Meet zostanie zorganizowane w późniejszym czasie.</p>
          </div>
        ` : `
          <div style="background-color: #fff3e0; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 0;">To jest wizyta online, ale link do spotkania nie został automatycznie wygenerowany. Rejestracja skontaktuje się z Tobą w celu przekazania dalszych instrukcji.</p>
          </div>
        `}
      ` : `
        <div style="background-color: #e8f5e9; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0;">To jest wizyta stacjonarna. Nie wysyłaj tej wiadomości, jeśli spotkanie nie odbywa się online.</p>
        </div>
      `}
      

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
        <p style="color: #666; margin-bottom: 10px;">W przypadku potrzeby zmiany terminu lub odwołania wizyty prosimy o kontakt telefoniczny co najmniej 24 godziny przed planowaną wizytą.</p>
        <p style="color: #666; margin-bottom: 10px;">Dziękujemy za zaufanie!</p>
        <p style="color: #666; font-size: 12px; margin-top: 20px;">© ${new Date().getFullYear()} Centrum Medyczne 7 - All rights reserved</p>
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
      smsConsentAgreed,
      consultationType,
      time,
    } = req.body;

    // Validate required fields
    if (!date || !doctorId || !email || !name || !phone || !time || !consultationType) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Validate consultationType
    if (!['online', 'offline'].includes(consultationType.toLowerCase())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid consultation type. Must be either 'online' or 'offline'" });
    }

    // Parse name into first and last
    const nameParts = name.trim().split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    // Find the doctor
    const doctorDetails = await User.findById(doctorId);
    if (!doctorDetails || doctorDetails.role !== "doctor") {
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
    
    // Check for existing appointments
    const startOfDay = new Date(appointmentDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(appointmentDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const existingAppointment = await Appointment.findOne({
      doctor: doctorId,
      date: { $gte: startOfDay, $lte: endOfDay },
      startTime: time,
      status: "booked"
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
    const temporaryPassword = "centrum123";

    // If patient doesn't exist, create a new one
    if (!patient) {
      isNewUser = true;
      patient = await User.findOne({
        email: email.toLowerCase()
      });
      
      if (!patient) {
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        patient = new User({
          name: {
            first: firstName,
            last: lastName || "",
          },
          email: email.toLowerCase(),
          sex: gender === "Male" ? "Male" : gender === "Female" ? "Female" : "Others",
          phone,
          password: hashedPassword,
          role: "patient",
          signupMethod: "email",
          smsConsentAgreed: smsConsentAgreed,
        });

        try {
          await patient.save();
        } catch (saveError) {
          if (saveError.code === 11000) {
            patient = await User.findOne({
              email: email.toLowerCase()
            });
            if (!patient) {
              throw saveError;
            }
            isNewUser = false;
          } else {
            throw saveError;
          }
        }
      } else {
        isNewUser = false;
      }
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
    
    // Create Google Meet event only for online consultations
    if (consultationType.toLowerCase() === 'online') {
      try {
        // Get calendar client with fresh token
        const calendar = await getCalendarClient();

        // Convert appointment time to Polish timezone
        const appointmentDateTime = new Date(appointmentDate);
        const [hours, minutes] = time.split(':').map(Number);
        appointmentDateTime.setHours(hours, minutes, 0, 0);

        // Calculate end time
        const endDateTime = new Date(appointmentDateTime);
        endDateTime.setMinutes(endDateTime.getMinutes() + duration);

        // Create the calendar event
        const event = {
          summary: `Medical Appointment: ${department || "Consultation"}`,
          description: `
Patient: ${patient.name.first} ${patient.name.last}
Doctor: Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}
Department: ${department || "General"}
Mode: ${appointment.mode} Consultation
${message ? `\nNotes: ${message}` : ""}
          `.trim(),
          start: {
            dateTime: appointmentDateTime.toISOString(),
            timeZone: "Europe/Warsaw",
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: "Europe/Warsaw",
          },
          attendees: [
            { email: doctorDetails.email, displayName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}` }, 
            { email: patient.email, displayName: `${patient.name.first} ${patient.name.last}` }
          ],
          conferenceData: {
            createRequest: {
              requestId: uuidv4(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 30 }
            ]
          }
        };

        const calendarResponse = await calendar.events.insert({
          calendarId: 'primary',
          resource: event,
          conferenceDataVersion: 1,
          sendNotifications: true,
        });

        if (!calendarResponse?.data?.hangoutLink) {
          throw new Error("Failed to get Google Meet link from calendar response");
        }

        // Update appointment with the meeting link
        meetingLink = calendarResponse.data.hangoutLink;
        appointment.joining_link = meetingLink;
        await appointment.save();
        
        console.log("Successfully created Google Meet link:", meetingLink);
        
      } catch (googleError) {
        console.error("Google Calendar error:", googleError);
        calendarSetupNeeded = true;
      }
    }

    // Send SMS notification without checking consent
    let smsResult = null;
if(smsConsentAgreed){    try {
      const formattedDate = format(appointmentDate, "dd.MM.yyyy");
      const message = appointment.mode === "online" 
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
      console.error("Error sending appointment confirmation SMS:", smsError);
    }}
    
    // Send email to patient regardless of Google Calendar success/failure
    try {
      const formattedDate = format(appointmentDate, "EEEE, MMMM dd, yyyy");
      
      // Email data
      const emailData = {
        patientName: `${patient.name.first} ${patient.name.last}`,
        doctorName: `Dr. ${doctorDetails.name.first} ${doctorDetails.name.last}`,
        date: formattedDate,
        time: `${time} - ${endTime}`,
        department: department || "General",
        meetingLink: consultationType.toLowerCase() === 'online' ? meetingLink : null,
        notes: message || "",
        mode: consultationType.toLowerCase(),
        isNewUser,
        temporaryPassword: isNewUser ? temporaryPassword : null,
      };
      
      // Send email
      await sendEmail({
        to: patient.email,
        subject: "Your Appointment Confirmation",
        html: createAppointmentEmailHtml(emailData),
        text: `Your appointment with Dr. ${doctorDetails.name.first} ${doctorDetails.name.last} has been scheduled for ${formattedDate} at ${time}. ${meetingLink ? `Join the meeting at: ${meetingLink}` : "The doctor's office will contact you with further instructions."}`
      });
      
      console.log(`Appointment confirmation email sent to ${patient.email}`);
    } catch (emailError) {
      console.error("Failed to send appointment email:", emailError);
      // Continue with the response - don't fail the whole appointment just because email failed
    }

    // Return appropriate response based on consultation type and Google Meet creation result
    if (consultationType.toLowerCase() === 'online') {
      if (meetingLink) {
        return res.status(201).json({
          success: true,
          message: "Online appointment booked successfully with Google Meet",
          data: appointment,
          meetLink: meetingLink,
          isNewUser,
          emailSent: true,
          notifications: {
            sms: smsResult ? {
              sent: smsResult.success,
              error: smsResult.error
            } : {
              sent: false,
              error: "Failed to send SMS notification"
            }
          }
        });
      } else if (calendarSetupNeeded) {
        return res.status(201).json({
          success: true,
          message: "Online appointment booked but Google Calendar integration needs to be set up",
          data: appointment,
          isNewUser,
          calendarSetupNeeded: true,
          emailSent: true,
          notifications: {
            sms: smsResult ? {
              sent: smsResult.success,
              error: smsResult.error
            } : {
              sent: false,
              error: "Failed to send SMS notification"
            }
          }
        });
      } else {
        return res.status(201).json({
          success: true,
          message: "Online appointment booked but failed to create Google Meet event",
          data: appointment,
          isNewUser,
          emailSent: true,
          notifications: {
            sms: smsResult ? {
              sent: smsResult.success,
              error: smsResult.error
            } : {
              sent: false,
              error: "Failed to send SMS notification"
            }
          }
        });
      }
    } else {
      return res.status(201).json({
        success: true,
        message: "Offline appointment booked successfully",
        data: appointment,
        isNewUser,
        emailSent: true,
        notifications: {
          sms: smsResult ? {
            sent: smsResult.success,
            error: smsResult.error
          } : {
            sent: false,
            error: "Failed to send SMS notification"
          }
        }
      });
    }

  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({
      success: false,
      message: "Failed to book appointment",
      error: error.message
    });
  }
};
