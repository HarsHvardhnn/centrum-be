// controllers/doctorController.js
const User = require("../models/user-entity/user");
const Doctor = require("../models/user-entity/doctor"); // This is the discriminator model
const { format, startOfDay, endOfDay } = require("date-fns");
const appointment = require("../models/appointment");
const user = require("../models/user-entity/user");
const mongoose = require("mongoose");
const { generateUniqueSlug } = require("../utils/slugUtils");
const UserService = require("../models/userServices");

// Helper function to generate default shifts
const generateDefaultShifts = () => {
  const defaultStartTime = "09:00";
  const defaultEndTime = "17:00";
  
  const days = [
    "Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek"
  ];

  return days.map(day => ({
    dayOfWeek: day,
    startTime: defaultStartTime,
    endTime: defaultEndTime,
    status: "approved"
  }));
};

/**
 * Add a new doctor to the database
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const addDoctor = async (req, res) => {
  try {
    const doctorData = req.body;

    // Remove leading zeros from phone number
    const phoneNumber = doctorData.phone?.replace(/^0+/, '') || '';
    
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Telefon jest wymagany",
      });
    }

    // Check for existing doctor with same phone number
    const existingDoctorByPhone = await User.findOne({ phone: phoneNumber });
    if (existingDoctorByPhone) {
      return res.status(409).json({
        success: false,
        message: "Lekarz z tym numerem telefonu już istnieje.",
      });
    }

    // Email validation regex
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    // Handle email - check if it's actually provided and not "undefined"
    const emailToSave = doctorData.email && doctorData.email !== "undefined" ? doctorData.email.trim() : "";
    
    if (!emailToSave) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Validate email format
    if (!emailRegex.test(emailToSave)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // Check for existing doctor with same email
    const existingDoctor = await User.findOne({ email: emailToSave });
    if (existingDoctor) {
      return res.status(409).json({
        success: false,
        message: "Lekarz z tym emailem już istnieje",
      });
    }

    // Create the base user document
    const userData = {
      name: {
        first: doctorData.name?.first || "",
        last: doctorData.name?.last || "",
      },
      email: emailToSave,
      phone: phoneNumber,
      specializations: doctorData.specializations,
      password: doctorData.password, // In production, this should be hashed
      role: "doctor", // This triggers the discriminator
      signupMethod: doctorData.signupMethod || "email",
      profilePicture: req.file?.path || "",
      singleSessionMode: doctorData.singleSessionMode || false,
    };

    // Generate default shifts for all days
    const defaultShifts = generateDefaultShifts();

    // Generate unique slug for the doctor
    const tempDoctor = { name: userData.name };
    const slug = await generateUniqueSlug(tempDoctor, Doctor);

    // Doctor-specific fields
    const doctorFields = {
      d_id: `dr-${Date.now()}`, // Generate unique ID
      slug: slug, // Add generated slug
      specialization: doctorData.specialization || [],
      qualifications: doctorData.qualifications || [],
      experience: doctorData.experience || 0,
      bio: doctorData.bio || "",
      onlineConsultationFee: doctorData.onlineConsultationFee || 0,
      offlineConsultationFee: doctorData.offlineConsultationFee || 0,
      weeklyShifts: doctorData.weeklyShifts || defaultShifts, // Use provided shifts or default ones
      offSchedule: doctorData.offSchedule || [],
    };

    // Combine user and doctor fields
    const newDoctorData = { ...userData, ...doctorFields };

    // Create the doctor using the discriminator model
    const newDoctor = await Doctor.create(newDoctorData);

    // Format response object according to the required structure
    const responseDoctor = {
      id: newDoctor.d_id,
      name: `${newDoctor.name.first} ${newDoctor.name.last}`,
      specialty: newDoctor.specialization[0] || "",
      available: newDoctor.isAvailable,
      status: newDoctor.isAvailable ? "Available" : "Unavailable",
      experience: `${newDoctor.experience} years`,
      image: newDoctor.profilePicture,
      visitType: "Consultation",
      date: new Date().toISOString().split("T")[0],
      email: newDoctor.email,
      phone: newDoctor.phone,
      qualifications: newDoctor.qualifications,
      specializations: newDoctor.specialization,
      bio: newDoctor.bio,
      consultationFee: newDoctor.consultationFee,
      offlineConsultationFee: newDoctor.offlineConsultationFee,
      weeklyShifts: newDoctor.weeklyShifts
    };

    res.status(201).json({
      success: true,
      message: "Lekarz utworzony pomyślnie",
      doctor: responseDoctor,
    });
  } catch (error) {
    console.error("Error adding doctor:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się dodać lekarza",
      error: error.message,
    });
  }
};

/**
 * Get all doctors
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getAllDoctors = async (req, res) => {
  try {
    // Extract query parameters
    const {
      specialization,
      page = 1,
      limit = 10,
      sortBy = "name.first",
      sortOrder = "asc",
    } = req.query;

    // Convert page and limit to integers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    // Calculate skip value for pagination
    const skip = (pageNum - 1) * limitNum;

    // Create base query for doctors
    let query = { role: "doctor" };

    // Add department filter if provided
    if (specialization) {
    
        query = {
          role: "doctor",
          specialization: { $in: [specialization] },
        };}

    // Create sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Count total documents for pagination metadata
    const totalDocs = await User.countDocuments(query);

    // Find doctors based on query with pagination and sorting
    const doctors = await User.find({ ...query, deleted: false })
      .populate("specialization")
      .select('name specialization experience profilePicture bio onlineConsultationFee offlineConsultationFee qualifications slug d_id ratings averageRating')
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum)
      .lean();

      console.log("doctor",doctors[0].bio)

    const formattedDoctors = doctors.map((doc) => ({
      _id: doc._id,
      id: doc.d_id,
      slug: doc.slug, // Add slug for SEO URLs
      name: `${doc.name.first} ${doc.name.last}`,
      nameObj: {
        first: doc.name.first,
        last: doc.name.last
      },
      specialty:
        doc.specialization && doc.specialization[0]
          ? doc.specialization[0]
          : "General",
      department: doc.department || "", // Include the department in the response
      available: doc.isAvailable,
      status: doc.isAvailable ? "Available" : "Unavailable",
      experience: doc.experience || 0,
      experienceText: doc.experience ? `${doc.experience} years` : "0 years",
      image: doc.profilePicture,
      visitType: "Consultation",
      date: new Date().toISOString().split("T")[0],
      qualifications: doc.qualifications || [],
      specializations: doc.specialization || [],
      bio: doc?.bio || "",
      consultationFee: doc.consultationFee || 0,
      offlineConsultationFee: doc.offlineConsultationFee || 0,
      onlineConsultationFee: doc.onlineConsultationFee || 0,
      ratings: {
        average: doc.averageRating || 0,
        total: doc.ratings || 0
      }
    }));

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalDocs / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.status(200).json({
      success: true,
      count: doctors.length,
      doctors: formattedDoctors,
      pagination: {
        total: totalDocs,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? pageNum + 1 : null,
        prevPage: hasPrevPage ? pageNum - 1 : null,
      },
    });
  } catch (error) {
    console.error("Błąd podczas pobierania lekarzy:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać lekarzy",
      error: error.message,
    });
  }
};

/**
 * Get doctor by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { d_id: id }] };
    } else {
      query = { d_id: id };
    }

    const doctor = await Doctor.findOne(query)
      .select("-password -refreshTokens -__v")
      .populate("hospital specialization");
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Lekarz nie znaleziony",
      });
    }

    res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error) {
    console.error("Error fetching doctor:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać lekarza",
      error: error.message,
    });
  }
};

const getWeeklyShifts = async (req, res) => {
  try {
    const doctorId = req.query.doctorId || req.user.id;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    return res.status(200).json({
      success: true,
      data: doctor.weeklyShifts || [],
    });
  } catch (error) {
    console.error("Error fetching weekly shifts:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas pobierania tygodniowych zmian",
    });
  }
};

// Update doctor's weekly shifts
const updateWeeklyShifts = async (req, res) => {
  try {
    const doctorId = req.query.doctorId || req.user.id;
    const isAdminApproval = req.user.role === "admin";

    const { shifts } = req.body;

    if (!Array.isArray(shifts)) {
      return res.status(400).json({
        success: false,
        message: "Zmiany muszą być podane jako tablica",
      });
    }

    // Validate and enrich shifts
    const enrichedShifts = shifts.map((shift) => {
      if (!shift.dayOfWeek || !shift.startTime || !shift.endTime) {
        throw new Error(
          "Każda zmiana musi zawierać dayOfWeek, startTime i endTime"
        );
      }
      return {
        ...shift,
        status: isAdminApproval ? "approved" : "pending",
      };
    });

    const doctor = await Doctor.findByIdAndUpdate(
      doctorId,
      { $set: { weeklyShifts: enrichedShifts } },
      { new: true, runValidators: true }
    );

    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    return res.status(200).json({
      success: true,
      message: "Tygodniowe zmiany zaktualizowane pomyślnie",
      data: doctor.weeklyShifts,
    });
  } catch (error) {
    console.error("Error updating weekly shifts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Błąd podczas aktualizacji tygodniowych zmian",
    });
  }
};

// Get doctor's off schedule
const getOffSchedule = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.user.id;

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    return res.status(200).json({
      success: true,
      data: doctor.offSchedule || [],
    });
  } catch (error) {
    console.error("Error fetching off schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas pobierania harmonogramu",
    });
  }
};

// Add off time to doctor's schedule
const addOffTime = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.user.id;
    const { date, timeRanges } = req.body;

    if (
      !date ||
      !timeRanges ||
      !Array.isArray(timeRanges) ||
      timeRanges.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Data i co najmniej jeden zakres czasu muszą być podane",
      });
    }

    // Validate time ranges
    for (const range of timeRanges) {
      if (!range.startTime || !range.endTime) {
        return res.status(400).json({
          success: false,
          message: "Każdy zakres czasu musi zawierać startTime i endTime",
        });
      }
    }

    const parsedDate = new Date(date);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    // Check if there's already an off schedule for this date
    const existingOffDayIndex = doctor.offSchedule.findIndex(
      (off) =>
        off.date.toISOString().slice(0, 10) ===
        parsedDate.toISOString().slice(0, 10)
    );

    if (existingOffDayIndex >= 0) {
      // Update existing off day
      doctor.offSchedule[existingOffDayIndex].timeRanges = timeRanges;
    } else {
      // Add new off day
      doctor.offSchedule.push({
        date: parsedDate,
        timeRanges,
      });
    }

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: "Czas wolny dodany pomyślnie",
      data: doctor.offSchedule,
    });
  } catch (error) {
    console.error("Error adding off time:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas dodawania czasu wolnego",
      error: error.message,
    });
  }
};

// Remove off time from doctor's schedule
const removeOffTime = async (req, res) => {
  try {
    const doctorId = req.params.doctorId || req.user.id;
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Data musi być podana",
      });
    }

    const parsedDate = new Date(date);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    // Remove the off schedule for this date
    doctor.offSchedule = doctor.offSchedule.filter(
      (off) =>
        off.date.toISOString().slice(0, 10) !==
        parsedDate.toISOString().slice(0, 10)
    );

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: "Czas wolny usunięty pomyślnie",
      data: doctor.offSchedule,
    });
  } catch (error) {
    console.error("Error removing off time:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas usuwania czasu wolnego",
      error: error.message,
    });
  }
};

// Get available slots for a specific date
const getAvailableSlots = async (req, res) => {
  try {
    const doctorId = req.params.id;
    console.log("doctor", doctorId);
    const date = req.query.date || new Date();

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Parametr data jest wymagany",
      });
    }

    const doctor = await user.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    const requestedDate = new Date(date);
    
    // Get both English and Polish day names
    const englishDayOfWeek = format(requestedDate, "EEEE"); // Monday, Tuesday, etc.
    
    // Map of English day names to Polish day names
    const dayNameMap = {
      'Monday': 'Poniedziałek',
      'Tuesday': 'Wtorek',
      'Wednesday': 'Środa',
      'Thursday': 'Czwartek',
      'Friday': 'Piątek',
      'Saturday': 'Sobota',
      'Sunday': 'Niedziela'
    };
    
    const polishDayOfWeek = dayNameMap[englishDayOfWeek];

    // Check if doctor works on this day (check both English and Polish day names)
    let shift = doctor.weeklyShifts.find(
      (s) => s.dayOfWeek === englishDayOfWeek || s.dayOfWeek === polishDayOfWeek
    );
    
    if (!shift) {
      return res.status(200).json({
        success: true,
        message: `Lekarz nie pracuje w ${englishDayOfWeek} (${polishDayOfWeek})`,
        data: [],
      });
    }

    // Get doctor's off time for the requested date
    const offDay = doctor.offSchedule.find(
      (off) =>
        off.date.toISOString().slice(0, 10) ===
        requestedDate.toISOString().slice(0, 10)
    );

    // Get booked appointments for the requested date
    const appointments = await appointment
      .find({
        doctor: doctorId,
        date: {
          $gte: startOfDay(requestedDate),
          $lte: endOfDay(requestedDate),
        },
        status: "booked",
      })
      .sort({ startTime: 1 });

    // Generate all slots based on shift time (using 30-minute intervals as default)
    const slotDuration = 30; // in minutes
    const slots = [];

    // Parse shift times
    const [shiftStartHour, shiftStartMinute] = shift.startTime
      .split(":")
      .map(Number);
    const [shiftEndHour, shiftEndMinute] = shift.endTime.split(":").map(Number);

    // Convert to minutes since midnight
    const shiftStartMinutes = shiftStartHour * 60 + shiftStartMinute;
    const shiftEndMinutes = shiftEndHour * 60 + shiftEndMinute;

    // Generate all possible slots
    for (
      let time = shiftStartMinutes;
      time < shiftEndMinutes;
      time += slotDuration
    ) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;

      const slotStartTime = `${hour.toString().padStart(2, "0")}:${minute
        .toString()
        .padStart(2, "0")}`;

      const slotEndMinutes = time + slotDuration;
      const endHour = Math.floor(slotEndMinutes / 60);
      const endMinute = slotEndMinutes % 60;

      const slotEndTime = `${endHour.toString().padStart(2, "0")}:${endMinute
        .toString()
        .padStart(2, "0")}`;

      if (slotEndMinutes <= shiftEndMinutes) {
        slots.push({
          startTime: slotStartTime,
          endTime: slotEndTime,
          available: true,
        });
      }
    }

    // Mark slots as unavailable if they overlap with an appointment
    appointments.forEach((appointment) => {
      const [appStartHour, appStartMinute] = appointment.startTime
        .split(":")
        .map(Number);
      const [appEndHour, appEndMinute] = appointment.endTime
        .split(":")
        .map(Number);

      const appStartMinutes = appStartHour * 60 + appStartMinute;
      const appEndMinutes = appEndHour * 60 + appEndMinute;

      slots.forEach((slot) => {
        const [slotStartHour, slotStartMinute] = slot.startTime
          .split(":")
          .map(Number);
        const [slotEndHour, slotEndMinute] = slot.endTime
          .split(":")
          .map(Number);

        const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
        const slotEndMinutes = slotEndHour * 60 + slotEndMinute;

        // Check if there's an overlap
        if (
          (slotStartMinutes < appEndMinutes &&
            slotEndMinutes > appStartMinutes) ||
          (slotStartMinutes === appStartMinutes &&
            slotEndMinutes === appEndMinutes)
        ) {
          slot.available = false;
        }
      });
    });

    // Mark slots as unavailable if they overlap with doctor's off time
    if (offDay && offDay.timeRanges.length > 0) {
      offDay.timeRanges.forEach((range) => {
        const [rangeStartHour, rangeStartMinute] = range.startTime
          .split(":")
          .map(Number);
        const [rangeEndHour, rangeEndMinute] = range.endTime
          .split(":")
          .map(Number);

        const rangeStartMinutes = rangeStartHour * 60 + rangeStartMinute;
        const rangeEndMinutes = rangeEndHour * 60 + rangeEndMinute;

        slots.forEach((slot) => {
          const [slotStartHour, slotStartMinute] = slot.startTime
            .split(":")
            .map(Number);
          const [slotEndHour, slotEndMinute] = slot.endTime
            .split(":")
            .map(Number);

          const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
          const slotEndMinutes = slotEndHour * 60 + slotEndMinute;

          // Check if there's an overlap
          if (
            (slotStartMinutes < rangeEndMinutes &&
              slotEndMinutes > rangeStartMinutes) ||
            (slotStartMinutes === rangeStartMinutes &&
              slotEndMinutes === rangeEndMinutes)
          ) {
            slot.available = false;
          }
        });
      });
    }

    return res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (error) {
    console.error("Error generating available slots:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas generowania dostępnych slotów",
      error: error.message,
    });
  }
};

/**
 * Get doctor profile information
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @returns {Object} Doctor profile data
 */
const getDoctorProfile = async (req, res) => {
  try {
    const { doctorId } = req.params;
    
    // If no doctorId is provided, use the logged-in user's ID (if they are a doctor)
    const id = doctorId || req.user?.id;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "ID lekarza jest wymagane",
      });
    }

    // Find doctor by ID or d_id
    let query = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      query.d_id = id;
    }
    query.role = "doctor";

    const doctor = await Doctor.findOne(query)
      .select("name email experience profilePicture onlineConsultationFee offlineConsultationFee bio qualifications specialization")
      .populate("specialization", "name");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Lekarz nie znaleziony",
      });
    }

    // Format response
    const response = {
      id: doctor._id,
      name: `${doctor.name.first} ${doctor.name.last}`.trim(),
      email: doctor.email,
      experience: doctor.experience || 0,
      profilePicture: doctor.profilePicture,
      onlineConsultationPrice: doctor.onlineConsultationFee || 0,
      offlineConsultationPrice: doctor.offlineConsultationFee || 0,
      bio: doctor.bio || "",
      qualifications: doctor.qualifications || [],
      specializations: doctor.specialization.map(spec => spec.name || spec) || []
    };

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching doctor profile:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać profilu lekarza",
      error: error.message,
    });
  }
};

// Get next available date for a doctor
const getNextAvailableDate = async (req, res) => {
  try {
    const doctorId = req.params.id;
    const doctor = await user.findById(doctorId);
    
    if (!doctor) {
      return res.status(404).json({ 
        success: false, 
        message: "Lekarz nie znaleziony" 
      });
    }

    // Start checking from tomorrow
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Maximum number of days to check (e.g., 30 days)
    const maxDaysToCheck = 30;
    let daysChecked = 0;

    while (daysChecked < maxDaysToCheck) {
      // Get English and Polish day names
      const englishDayOfWeek = format(currentDate, "EEEE");
      const dayNameMap = {
        'Monday': 'Poniedziałek',
        'Tuesday': 'Wtorek',
        'Wednesday': 'Środa',
        'Thursday': 'Czwartek',
        'Friday': 'Piątek',
        'Saturday': 'Sobota',
        'Sunday': 'Niedziela'
      };
      const polishDayOfWeek = dayNameMap[englishDayOfWeek];

      // Check if doctor works on this day
      const shift = doctor.weeklyShifts.find(
        (s) => s.dayOfWeek === englishDayOfWeek || s.dayOfWeek === polishDayOfWeek
      );

      if (shift) {
        // Check if doctor has any off time on this day
        const offDay = doctor.offSchedule.find(
          (off) => off.date.toISOString().slice(0, 10) === currentDate.toISOString().slice(0, 10)
        );

        // If no off time or off time doesn't cover entire day
        if (!offDay || offDay.timeRanges.length === 0) {
          // Get available slots for this date
          const appointments = await appointment.find({
            doctor: doctorId,
            date: {
              $gte: startOfDay(currentDate),
              $lte: endOfDay(currentDate),
            },
            status: "booked",
          }).sort({ startTime: 1 });

          // Generate slots for this day
          const slotDuration = 30;
          const slots = [];
          const [shiftStartHour, shiftStartMinute] = shift.startTime.split(":").map(Number);
          const [shiftEndHour, shiftEndMinute] = shift.endTime.split(":").map(Number);
          const shiftStartMinutes = shiftStartHour * 60 + shiftStartMinute;
          const shiftEndMinutes = shiftEndHour * 60 + shiftEndMinute;

          // Generate all possible slots
          for (let time = shiftStartMinutes; time < shiftEndMinutes; time += slotDuration) {
            const hour = Math.floor(time / 60);
            const minute = time % 60;
            const slotStartTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
            const slotEndMinutes = time + slotDuration;
            const endHour = Math.floor(slotEndMinutes / 60);
            const endMinute = slotEndMinutes % 60;
            const slotEndTime = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;

            if (slotEndMinutes <= shiftEndMinutes) {
              slots.push({
                startTime: slotStartTime,
                endTime: slotEndTime,
                available: true,
              });
            }
          }

          // Mark slots as unavailable if they overlap with appointments
          appointments.forEach((appointment) => {
            const [appStartHour, appStartMinute] = appointment.startTime.split(":").map(Number);
            const [appEndHour, appEndMinute] = appointment.endTime.split(":").map(Number);
            const appStartMinutes = appStartHour * 60 + appStartMinute;
            const appEndMinutes = appEndHour * 60 + appEndMinute;

            slots.forEach((slot) => {
              const [slotStartHour, slotStartMinute] = slot.startTime.split(":").map(Number);
              const [slotEndHour, slotEndMinute] = slot.endTime.split(":").map(Number);
              const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
              const slotEndMinutes = slotEndHour * 60 + slotEndMinute;

              if (
                (slotStartMinutes < appEndMinutes && slotEndMinutes > appStartMinutes) ||
                (slotStartMinutes === appStartMinutes && slotEndMinutes === appEndMinutes)
              ) {
                slot.available = false;
              }
            });
          });

          // Check if there's at least one available slot
          const hasAvailableSlot = slots.some(slot => slot.available);
          if (hasAvailableSlot) {
            return res.status(200).json({
              success: true,
              data: {
                nextAvailableDate: currentDate.toISOString().split('T')[0],
                availableSlots: slots.filter(slot => slot.available)
              }
            });
          }
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      daysChecked++;
    }

    // If no available date found within the search period
    return res.status(200).json({
      success: true,
      message: "Nie znaleziono dostępnych dat w ciągu 30 dni",
      data: null
    });

  } catch (error) {
    console.error("Error finding next available date:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas znajdowania następnej dostępnej daty",
      error: error.message
    });
  }
};

/**
 * Get detailed information about a doctor
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getDoctorDetails = async (req, res) => {
  try {
    const { id } = req.params;


    const doctor = await Doctor.findOne({ _id: id })
      .select("-password -refreshTokens -__v")
      .populate("specialization");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Lekarz nie znaleziony",
      });
    }

    // Format response object
    const responseDoctor = {
      id: doctor._id,
      name: {
        first: doctor.name.first,
        last: doctor.name.last
      },
      email: doctor.email,
      phone: doctor.phone,
      specializations: doctor.specialization,
      qualifications: doctor.qualifications,
      experience: doctor.experience,
      bio: doctor.bio,
      onlineConsultationFee: doctor.onlineConsultationFee,
      offlineConsultationFee: doctor.offlineConsultationFee,
      weeklyShifts: doctor.weeklyShifts,
      offSchedule: doctor.offSchedule,
      profilePicture: doctor.profilePicture,
      singleSessionMode: doctor.singleSessionMode,
      signupMethod: doctor.signupMethod,
      isAvailable: doctor.isAvailable
    };

    res.status(200).json({
      success: true,
      data: responseDoctor,
    });
  } catch (error) {
    console.error("Error fetching doctor details:", error);
    res.status(500).json({
      success: false,
      message: "Nie udało się pobrać szczegółów lekarza",
      error: error.message,
    });
  }
};

/**
 * Update doctor information
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Find the doctor first
    const doctor = await Doctor.findOne({ _id: id });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Lekarz nie znaleziony",
      });
    }

    // Handle phone number update if provided
    if (updateData.phone) {
      // Remove leading zeros from phone number
      const phoneNumber = updateData.phone.replace(/^0+/, '');
      
      // Check for uniqueness if phone is being changed
      if (phoneNumber !== doctor.phone) {
        const existingDoctorByPhone = await User.findOne({
          phone: phoneNumber,
          _id: { $ne: id }
        });
        if (existingDoctorByPhone) {
          return res.status(409).json({
            success: false,
            message: "Innym lekarzem z tym numerem telefonu już istnieje.",
          });
        }
        updateData.phone = phoneNumber;
      }
    }

    // Handle email update if provided
    if (updateData.email) {
      // Email validation regex
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      
      // Handle email - check if it's actually provided and not "undefined"
      const emailToSave = updateData.email !== "undefined" ? updateData.email.trim() : doctor.email;
      
      // Validate email format
      if (!emailRegex.test(emailToSave)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Check for uniqueness if email is being changed
      if (emailToSave !== doctor.email) {
        const existingDoctorByEmail = await User.findOne({
          email: emailToSave,
          _id: { $ne: id }
        });
        if (existingDoctorByEmail) {
          return res.status(409).json({
            success: false,
            message: "Innym lekarzem z tym adresem email już istnieje.",
          });
        }
        updateData.email = emailToSave;
      }
    }

    // Update fields
    const allowedUpdates = [
      'name',
      'phone',
      'email',
      'specialization',
      'qualifications',
      'experience',
      'bio',
      'onlineConsultationFee',
      'offlineConsultationFee',
      'weeklyShifts',
      'offSchedule',
      'singleSessionMode'
    ];

    // Filter out fields that are not allowed to be updated
    const filteredUpdates = Object.keys(updateData)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = updateData[key];
        return obj;
      }, {});

    // Only add profilePicture to updates if a new file was uploaded
    if (req.file?.path) {
      filteredUpdates.profilePicture = req.file.path;
    }

    // Update the doctor
    const updatedDoctor = await Doctor.findOneAndUpdate(
      { _id: id },
      { $set: filteredUpdates },
      { new: true, runValidators: true }
    ).select("-password -refreshTokens -__v");

    // Format response object
    const responseDoctor = {
      id: updatedDoctor.d_id,
      name: {
        first: updatedDoctor.name.first,
        last: updatedDoctor.name.last
      },
      email: updatedDoctor.email,
      phone: updatedDoctor.phone,
      specializations: updatedDoctor.specialization,
      qualifications: updatedDoctor.qualifications,
      experience: updatedDoctor.experience,
      bio: updatedDoctor.bio,
      onlineConsultationFee: updatedDoctor.onlineConsultationFee,
      offlineConsultationFee: updatedDoctor.offlineConsultationFee,
      weeklyShifts: updatedDoctor.weeklyShifts,
      offSchedule: updatedDoctor.offSchedule,
      profilePicture: updatedDoctor.profilePicture,
      singleSessionMode: updatedDoctor.singleSessionMode,
      signupMethod: updatedDoctor.signupMethod,
      isAvailable: updatedDoctor.isAvailable
    };

    res.status(200).json({
      success: true,
      message: "Lekarz zaktualizowany pomyślnie",
      data: responseDoctor,
    });
  } catch (error) {
    console.error("Error updating doctor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update doctor",
      error: error.message,
    });
  }
};

/**
 * Get doctor by slug for SEO-optimized profile pages
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getDoctorBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Validate slug
    if (!slug || slug.trim() === '' || slug === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Nieprawidłowy slug'
      });
    }
    
    // Find doctor by slug
    const doctor = await Doctor.findOne({ slug: slug.toLowerCase() })
      .populate('specialization', 'name description')
      .select('name specialization experience profilePicture bio onlineConsultationFee offlineConsultationFee qualifications slug createdAt updatedAt ratings averageRating reviews d_id');
    
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Lekarz nie znaleziony'
      });
    }

    // Fetch doctor's services
    const doctorServices = await UserService.findOne({
      user: doctor._id,
      userType: 'doctor',
      isDeleted: false
    }).populate({
      path: 'services.service',
      select: 'title shortDescription description price'
    });
    
    // Format response for SEO optimization
    const response = {
      id: doctor._id,
      d_id: doctor.d_id,
      name: {
        first: doctor.name?.first || '',
        last: doctor.name?.last || '',
        full: `${doctor.name?.first || ''} ${doctor.name?.last || ''}`.trim()
      },
      slug: doctor.slug,
      specializations: doctor.specialization.map(spec => ({
        name: spec.name,
        description: spec.description || ''
      })),
      experience: doctor.experience || 0,
      image: doctor.profilePicture || '',
      bio: doctor.bio || '',
      qualifications: doctor.qualifications || [],
      onlineConsultationPrice: doctor.onlineConsultationFee || 0,
      offlineConsultationPrice: doctor.offlineConsultationFee || 0,
      ratings: {
        average: doctor.averageRating || 0,
        count: doctor.reviews?.length || 0,
        total: doctor.ratings || 0
      },
      doctorServices: doctorServices ?? [],
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt
    };
    
    res.status(200).json({
      success: true,
      data: response
    });
    
  } catch (error) {
    console.error('Error fetching doctor by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd serwera podczas pobierania profilu lekarza'
    });
  }
};

module.exports = {
  addDoctor,
  getAllDoctors,
  getDoctorById,
  getAvailableSlots,
  removeOffTime,
  addOffTime,
  getOffSchedule,
  updateWeeklyShifts,
  getWeeklyShifts,
  getDoctorProfile,
  getNextAvailableDate,
  getDoctorDetails,
  updateDoctor,
  getDoctorBySlug,
};
