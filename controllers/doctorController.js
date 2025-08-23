// controllers/doctorController.js
const User = require("../models/user-entity/user");
const Doctor = require("../models/user-entity/doctor"); // This is the discriminator model
const { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek } = require("date-fns");
const { zonedTimeToUtc, toZonedTime } = require("date-fns-tz");
const appointment = require("../models/appointment");
const user = require("../models/user-entity/user");
const mongoose = require("mongoose");
const { generateUniqueSlug } = require("../utils/slugUtils");
const UserService = require("../models/userServices");
const DoctorSchedule = require("../models/doctorSchedule");
const ScheduleException = require("../models/scheduleException");

// Import centralized appointment configuration
const APPOINTMENT_CONFIG = require("../config/appointmentConfig");

// Poland timezone
const POLAND_TIMEZONE = "Europe/Warsaw";

// Helper function to generate default weekly schedule pattern
const generateDefaultWeeklyPattern = () => {
  const defaultStartTime = "09:00";
  const defaultEndTime = "17:00";
  
  return {
    monday: {
      timeBlocks: [
        { startTime: defaultStartTime, endTime: defaultEndTime, isActive: true }
      ]
    },
    tuesday: {
      timeBlocks: [
        { startTime: defaultStartTime, endTime: defaultEndTime, isActive: true }
      ]
    },
    wednesday: {
      timeBlocks: [
        { startTime: defaultStartTime, endTime: defaultEndTime, isActive: true }
      ]
    },
    thursday: {
      timeBlocks: [
        { startTime: defaultStartTime, endTime: defaultEndTime, isActive: true }
      ]
    },
    friday: {
      timeBlocks: [
        { startTime: defaultStartTime, endTime: defaultEndTime, isActive: true }
      ]
    },
    saturday: {
      timeBlocks: []
    },
    sunday: {
      timeBlocks: []
    }
  };
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
      shortDescription: doctorData.shortDescription || "",
      specializations: doctorData.specializations,
      password: doctorData.password, // In production, this should be hashed
      role: "doctor", // This triggers the discriminator
      signupMethod: doctorData.signupMethod || "email",
      profilePicture: req.file?.path || "",
      singleSessionMode: doctorData.singleSessionMode || false,
    };

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
      shortDescription: doctorData.shortDescription || "",
      onlineConsultationFee: doctorData.onlineConsultationFee || 0,
      offlineConsultationFee: doctorData.offlineConsultationFee || 0,
      // Remove old schedule fields - they are now handled by separate models
    };

    // Combine user and doctor fields
    const newDoctorData = { ...userData, ...doctorFields };

    // Create the doctor using the discriminator model
    const newDoctor = await Doctor.create(newDoctorData);

    // Create initial weekly schedule for the new doctor
    try {
      const defaultWeeklyPattern = generateDefaultWeeklyPattern();
      const currentDate = new Date();
      const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
      const endDate = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday end

      // Create schedules for the current week
      for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
        const dayOfWeek = format(date, 'EEEE').toLowerCase();
        const dayPattern = defaultWeeklyPattern[dayOfWeek];
        
        if (dayPattern && dayPattern.timeBlocks.length > 0) {
          await DoctorSchedule.create({
            doctorId: newDoctor._id,
            date: format(date, 'yyyy-MM-dd'),
            timeBlocks: dayPattern.timeBlocks,
            isActive: true,
            notes: `Default schedule for ${dayOfWeek}`,
            createdBy: req.user?.id || 'system'
          });
        }
      }

      console.log(`Initial schedule created for doctor ${newDoctor._id}`);
    } catch (scheduleError) {
      console.error("Error creating initial schedule:", scheduleError);
      // Don't fail the doctor creation if schedule creation fails
    }

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
      shortDescription: newDoctor?.shortDescription || "",
      phone: newDoctor.phone,
      qualifications: newDoctor.qualifications,
      specializations: newDoctor.specialization,
      bio: newDoctor.bio,
      consultationFee: newDoctor.consultationFee,
      offlineConsultationFee: newDoctor.offlineConsultationFee
      // Removed weeklyShifts as it's no longer part of the doctor model
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
      shortDescription: doc?.shortDescription || "",
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

    // Get current week's schedule from new system
    const currentDate = new Date();
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday end

    const schedules = await DoctorSchedule.find({
      doctorId: doctor._id,
      date: {
        $gte: format(startDate, 'yyyy-MM-dd'),
        $lte: format(endDate, 'yyyy-MM-dd')
      }
    }).sort({ date: 1 });

    // Convert to old format for backward compatibility
    const weeklyShifts = schedules.map(schedule => {
      const date = new Date(schedule.date);
      const dayOfWeek = format(date, 'EEEE');
      
      return schedule.timeBlocks.map(block => ({
        dayOfWeek: dayOfWeek,
        startTime: block.startTime,
        endTime: block.endTime,
        status: block.isActive ? "approved" : "pending"
      }));
    }).flat();

    return res.status(200).json({
      success: true,
      data: weeklyShifts,
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

    // Validate shifts
    shifts.forEach((shift) => {
      if (!shift.dayOfWeek || !shift.startTime || !shift.endTime) {
        throw new Error(
          "Każda zmiana musi zawierać dayOfWeek, startTime i endTime"
        );
      }
    });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    // Group shifts by day of week
    const shiftsByDay = {};
    shifts.forEach(shift => {
      const day = shift.dayOfWeek.toLowerCase();
      if (!shiftsByDay[day]) {
        shiftsByDay[day] = [];
      }
      shiftsByDay[day].push({
        startTime: shift.startTime,
        endTime: shift.endTime,
        isActive: shift.status === "approved" || isAdminApproval
      });
    });

    // Get current week dates
    const currentDate = new Date();
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday end

    // Update or create schedules for each day
    for (let date = new Date(startDate); date <= endDate; date = addDays(date, 1)) {
      const dayOfWeek = format(date, 'EEEE').toLowerCase();
      const dayShifts = shiftsByDay[dayOfWeek] || [];
      
      const scheduleData = {
        doctorId: doctor._id,
        date: format(date, 'yyyy-MM-dd'),
        timeBlocks: dayShifts,
        isActive: dayShifts.length > 0,
        notes: `Updated via weekly shifts API`,
        updatedBy: req.user?.id || 'system'
      };

      // Upsert the schedule
      await DoctorSchedule.findOneAndUpdate(
        { doctorId: doctor._id, date: format(date, 'yyyy-MM-dd') },
        scheduleData,
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Tygodniowe zmiany zaktualizowane pomyślnie",
      data: shifts,
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

    // Get exceptions from new system
    const exceptions = await ScheduleException.find({
      doctorId: doctor._id,
      isActive: true
    }).sort({ date: 1 });

    // Convert to old format for backward compatibility
    const offSchedule = exceptions.map(exception => ({
      date: new Date(exception.date),
      timeRanges: exception.timeRanges || [],
      type: exception.type,
      title: exception.title,
      description: exception.description,
      isFullDay: exception.isFullDay
    }));

    return res.status(200).json({
      success: true,
      data: offSchedule,
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
    const { date, timeRanges, type = "timeoff", title, description } = req.body;

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

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    // Check if there's already an exception for this date
    const existingException = await ScheduleException.findOne({
      doctorId: doctor._id,
      date: format(new Date(date), 'yyyy-MM-dd')
    });

    if (existingException) {
      // Update existing exception
      existingException.timeRanges = timeRanges;
      existingException.type = type;
      existingException.title = title || existingException.title;
      existingException.description = description || existingException.description;
      existingException.updatedBy = req.user?.id || 'system';
      await existingException.save();
    } else {
      // Create new exception
      await ScheduleException.create({
        doctorId: doctor._id,
        date: format(new Date(date), 'yyyy-MM-dd'),
        type: type,
        title: title || "Time Off",
        description: description || "Scheduled time off",
        isFullDay: false,
        timeRanges: timeRanges,
        isActive: true,
        createdBy: req.user?.id || 'system'
      });
    }

    // Get updated exceptions for response
    const exceptions = await ScheduleException.find({
      doctorId: doctor._id,
      isActive: true
    }).sort({ date: 1 });

    const offSchedule = exceptions.map(exception => ({
      date: new Date(exception.date),
      timeRanges: exception.timeRanges || [],
      type: exception.type,
      title: exception.title,
      description: exception.description,
      isFullDay: exception.isFullDay
    }));

    return res.status(200).json({
      success: true,
      message: "Czas wolny dodany pomyślnie",
      data: offSchedule,
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

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Lekarz nie znaleziony" });
    }

    // Remove the exception for this date
    const deletedException = await ScheduleException.findOneAndDelete({
      doctorId: doctor._id,
      date: format(new Date(date), 'yyyy-MM-dd')
    });

    if (!deletedException) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono czasu wolnego dla podanej daty",
      });
    }

    // Get updated exceptions for response
    const exceptions = await ScheduleException.find({
      doctorId: doctor._id,
      isActive: true
    }).sort({ date: 1 });

    const offSchedule = exceptions.map(exception => ({
      date: new Date(exception.date),
      timeRanges: exception.timeRanges || [],
      type: exception.type,
      title: exception.title,
      description: exception.description,
      isFullDay: exception.isFullDay
    }));

    return res.status(200).json({
      success: true,
      message: "Czas wolny usunięty pomyślnie",
      data: offSchedule,
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
    
    // Import the new schedule models
    const DoctorSchedule = require("../models/doctorSchedule");
    const ScheduleException = require("../models/scheduleException");
    
    // Check for schedule exception first
    const exception = await ScheduleException.findOne({
      doctorId,
      date: {
        $gte: startOfDay(requestedDate),
        $lte: endOfDay(requestedDate)
      },
      isActive: true
    });

    if (exception) {
      if (exception.isFullDay) {
        return res.status(200).json({
          success: true,
          message: `Lekarz nie jest dostępny w tym dniu: ${exception.title}`,
          data: [],
        });
      }
    }

    // Get doctor's schedule for the requested date
    const schedule = await DoctorSchedule.findOne({
      doctorId,
      date: {
        $gte: startOfDay(requestedDate),
        $lte: endOfDay(requestedDate)
      },
      isActive: true
    });

    if (!schedule || !schedule.timeBlocks || schedule.timeBlocks.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Lekarz nie ma zaplanowanych godzin pracy w tym dniu",
        data: [],
      });
    }

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

    // Generate slots based on time blocks
    const slotDuration = APPOINTMENT_CONFIG.DEFAULT_SLOT_DURATION; // in minutes
    const slots = [];

    // Generate slots for each time block
    for (let timeBlock of schedule.timeBlocks) {
      if (!timeBlock.isActive) continue;

      // Parse time block times
      const [blockStartHour, blockStartMinute] = timeBlock.startTime
        .split(":")
        .map(Number);
      const [blockEndHour, blockEndMinute] = timeBlock.endTime.split(":").map(Number);

      // Convert to minutes since midnight
      const blockStartMinutes = blockStartHour * 60 + blockStartMinute;
      const blockEndMinutes = blockEndHour * 60 + blockEndMinute;

      // Generate slots for this time block
      for (
        let time = blockStartMinutes;
        time < blockEndMinutes;
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

        if (slotEndMinutes <= blockEndMinutes) {
          slots.push({
            startTime: slotStartTime,
            endTime: slotEndTime,
            available: true,
          });
        }
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

    // Mark slots as unavailable if they overlap with schedule exceptions
    if (exception && !exception.isFullDay && exception.timeRanges.length > 0) {
      exception.timeRanges.forEach((range) => {
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

    // Filter out past slots based on current time in Poland timezone
    const currentTimeUTC = new Date();
    const currentTimeInPoland = toZonedTime(currentTimeUTC, POLAND_TIMEZONE);
    const requestedDateOnly = new Date(requestedDate);
    
    // Check if the requested date is today (in Poland timezone)
    const isToday = currentTimeInPoland.toDateString() === requestedDateOnly.toDateString();
    
    if (isToday) {
      // Get current time in minutes since midnight (Poland timezone)
      const currentHour = currentTimeInPoland.getHours();
      const currentMinute = currentTimeInPoland.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      
      // Add buffer time from configuration to allow for booking
      const bufferMinutes = APPOINTMENT_CONFIG.BOOKING_BUFFER_MINUTES;
      const minimumBookingTime = currentTimeInMinutes + bufferMinutes;
      
      // Filter out slots that are in the past or too close to current time
      slots.forEach((slot) => {
        const [slotStartHour, slotStartMinute] = slot.startTime
          .split(":")
          .map(Number);
        const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
        
        if (slotStartMinutes < minimumBookingTime) {
          slot.available = false;
        }
      });
    }

    return res.status(200).json({
      success: true,
      data: slots?.filter(slot => slot.available),
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
    console.log(`[DEBUG] Searching for doctor with ID: ${doctorId}`);
    
    const doctor = await user.findById(doctorId);
    
    if (!doctor) {
      console.log(`[DEBUG] Doctor not found with ID: ${doctorId}`);
      return res.status(404).json({ 
        success: false, 
        message: "Lekarz nie znaleziony" 
      });
    }

    // Import the new schedule models
    const DoctorSchedule = require("../models/doctorSchedule");
    const ScheduleException = require("../models/scheduleException");

    // Start checking from today
    let currentDate = new Date();
    
    // Maximum number of days to check
    const maxDaysToCheck = 30;
    let daysChecked = 0;

    console.log(`[DEBUG] Starting search from: ${currentDate.toISOString().split('T')[0]}`);
    console.log(`[DEBUG] Will check up to ${maxDaysToCheck} days`);

    while (daysChecked < maxDaysToCheck) {
      console.log(`\n[DEBUG] === Day ${daysChecked + 1} ===`);
      console.log(`[DEBUG] Checking date: ${currentDate.toISOString().split('T')[0]}`);
      
      // Check for schedule exception first
      const exception = await ScheduleException.findOne({
        doctorId,
        date: {
          $gte: startOfDay(currentDate),
          $lte: endOfDay(currentDate)
        },
        isActive: true
      });

      if (exception) {
        if (exception.isFullDay) {
          console.log(`[DEBUG] Doctor has full day exception: ${exception.title}`);
          currentDate.setDate(currentDate.getDate() + 1);
          daysChecked++;
          continue;
        }
      }

      // Get doctor's schedule for the current date
      const schedule = await DoctorSchedule.findOne({
        doctorId,
        date: {
          $gte: startOfDay(currentDate),
          $lte: endOfDay(currentDate)
        },
        isActive: true
      });

      if (!schedule || !schedule.timeBlocks || schedule.timeBlocks.length === 0) {
        console.log(`[DEBUG] No schedule found for this date`);
        currentDate.setDate(currentDate.getDate() + 1);
        daysChecked++;
        continue;
      }

      console.log(`[DEBUG] Found schedule with ${schedule.timeBlocks.length} time blocks`);

      // Get booked appointments for this date
      const appointments = await appointment.find({
        doctor: doctorId,
        date: {
          $gte: startOfDay(currentDate),
          $lte: endOfDay(currentDate),
        },
        status: "booked",
      }).sort({ startTime: 1 });

      console.log(`[DEBUG] Found ${appointments.length} existing appointments for this date`);

      // Generate slots for each time block
      const slotDuration = APPOINTMENT_CONFIG.DEFAULT_SLOT_DURATION;
      const slots = [];

      for (let timeBlock of schedule.timeBlocks) {
        if (!timeBlock.isActive) continue;

        console.log(`[DEBUG] Processing time block: ${timeBlock.startTime} - ${timeBlock.endTime}`);

        // Parse time block times
        const [blockStartHour, blockStartMinute] = timeBlock.startTime.split(":").map(Number);
        const [blockEndHour, blockEndMinute] = timeBlock.endTime.split(":").map(Number);
        const blockStartMinutes = blockStartHour * 60 + blockStartMinute;
        const blockEndMinutes = blockEndHour * 60 + blockEndMinute;

        // Generate slots for this time block
        for (let time = blockStartMinutes; time < blockEndMinutes; time += slotDuration) {
          const hour = Math.floor(time / 60);
          const minute = time % 60;
          const slotStartTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
          const slotEndMinutes = time + slotDuration;
          const endHour = Math.floor(slotEndMinutes / 60);
          const endMinute = slotEndMinutes % 60;
          const slotEndTime = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;

          if (slotEndMinutes <= blockEndMinutes) {
            slots.push({
              startTime: slotStartTime,
              endTime: slotEndTime,
              available: true,
            });
          }
        }
      }

      console.log(`[DEBUG] Generated ${slots.length} initial slots`);

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

      // Mark slots as unavailable if they overlap with schedule exceptions
      if (exception && !exception.isFullDay && exception.timeRanges.length > 0) {
        exception.timeRanges.forEach((timeRange) => {
          const [exceptionStartHour, exceptionStartMinute] = timeRange.startTime.split(":").map(Number);
          const [exceptionEndHour, exceptionEndMinute] = timeRange.endTime.split(":").map(Number);
          const exceptionStartMinutes = exceptionStartHour * 60 + exceptionStartMinute;
          const exceptionEndMinutes = exceptionEndHour * 60 + exceptionEndMinute;
          
          slots.forEach((slot) => {
            const [slotStartHour, slotStartMinute] = slot.startTime.split(":").map(Number);
            const [slotEndHour, slotEndMinute] = slot.endTime.split(":").map(Number);
            const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
            const slotEndMinutes = slotEndHour * 60 + slotEndMinute;

            if (
              (slotStartMinutes < exceptionEndMinutes && slotEndMinutes > exceptionStartMinutes) ||
              (slotStartMinutes === exceptionStartMinutes && slotEndMinutes === exceptionEndMinutes)
            ) {
              slot.available = false;
            }
          });
        });
      }

      // Filter out past slots if checking today's date (in Poland timezone)
      const currentTimeUTC = new Date();
      const currentTimeInPoland = toZonedTime(currentTimeUTC, POLAND_TIMEZONE);
      const currentDateOnly = new Date(currentDate);
      const isToday = currentTimeInPoland.toDateString() === currentDateOnly.toDateString();
      
      if (isToday) {
        const currentHour = currentTimeInPoland.getHours();
        const currentMinute = currentTimeInPoland.getMinutes();
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        const bufferMinutes = APPOINTMENT_CONFIG.BOOKING_BUFFER_MINUTES;
        const minimumBookingTime = currentTimeInMinutes + bufferMinutes;
        
        slots.forEach((slot) => {
          const [slotStartHour, slotStartMinute] = slot.startTime.split(":").map(Number);
          const slotStartMinutes = slotStartHour * 60 + slotStartMinute;
          
          if (slotStartMinutes < minimumBookingTime) {
            slot.available = false;
          }
        });
      }

      // Check if there's at least one available slot
      const availableSlots = slots.filter(slot => slot.available);
      console.log(`[DEBUG] Available slots after all checks: ${availableSlots.length}`);

      if (availableSlots.length > 0) {
        console.log(`[DEBUG] Found available date: ${currentDate.toISOString().split('T')[0]}`);
        return res.status(200).json({
          success: true,
          data: {
            nextAvailableDate: currentDate.toISOString().split('T')[0],
            availableSlots: availableSlots?.filter(slot => slot.available)
          }
        });
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
      daysChecked++;
    }

    // If no available date found within the search period
    console.log(`[DEBUG] No available date found within ${maxDaysToCheck} days`);
    return res.status(200).json({
      success: true,
      message: "Nie znaleziono dostępnych dat w ciągu 15 dni",
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

    console.log("doctor",doctor.shortDescription,doctor)

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
      shortDescription: doctor?.shortDescription || "",
      bio: doctor.bio,
      onlineConsultationFee: doctor.onlineConsultationFee,
      offlineConsultationFee: doctor.offlineConsultationFee,
      profilePicture: doctor.profilePicture,
      singleSessionMode: doctor.singleSessionMode,
      signupMethod: doctor.signupMethod,
      isAvailable: doctor.isAvailable
      // Removed weeklyShifts and offSchedule - now handled by separate schedule models
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
      'singleSessionMode',
      'shortDescription'
      // Removed weeklyShifts and offSchedule - now handled by separate schedule models
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
      profilePicture: updatedDoctor.profilePicture,
      shortDescription: updatedDoctor.shortDescription,
      singleSessionMode: updatedDoctor.singleSessionMode,
      signupMethod: updatedDoctor.signupMethod,
      isAvailable: updatedDoctor.isAvailable
      // Removed weeklyShifts and offSchedule - now handled by separate schedule models
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
      .select('name specialization shortDescription experience profilePicture bio onlineConsultationFee offlineConsultationFee qualifications slug createdAt updatedAt ratings averageRating reviews d_id');
    
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
      shortDescription: doctor.shortDescription || '',
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

// Copy last week's schedule to current week (convenience function)
const copyLastWeekSchedule = async (req, res) => {
  try {
    const doctorId = req.query.doctorId || req.user.id;

    // Check if user has permission
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only copy your own schedule"
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Lekarz nie znaleziony"
      });
    }

    // Calculate date ranges
    const currentDate = new Date();
    const currentWeekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
    const lastWeekStart = addDays(currentWeekStart, -7);
    const lastWeekEnd = addDays(lastWeekStart, 6);

    // Get last week's schedules
    const lastWeekSchedules = await DoctorSchedule.find({
      doctorId: doctor._id,
      date: {
        $gte: lastWeekStart,
        $lte: lastWeekEnd
      }
    }).sort({ date: 1 });

    if (lastWeekSchedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Brak harmonogramów z poprzedniego tygodnia do skopiowania"
      });
    }

    // Copy schedules to current week
    const copiedSchedules = [];
    const errors = [];

    for (let i = 0; i < 7; i++) {
      const sourceDate = addDays(lastWeekStart, i);
      const targetDate = addDays(currentWeekStart, i);
      
      // Find the corresponding schedule for this day of the week
      const sourceSchedule = lastWeekSchedules.find(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate.getDay() === sourceDate.getDay();
      });

      if (sourceSchedule && sourceSchedule.timeBlocks && sourceSchedule.timeBlocks.length > 0) {
        try {
          // Create new schedule for current week
          const newScheduleData = {
            doctorId: doctor._id,
            date: targetDate,
            timeBlocks: sourceSchedule.timeBlocks.map(block => ({
              startTime: block.startTime,
              endTime: block.endTime,
              isActive: block.isActive
            })),
            notes: `Skopiowano z ${format(sourceDate, 'yyyy-MM-dd')} - ${sourceSchedule.notes || 'Harmonogram z poprzedniego tygodnia'}`,
            createdBy: req.user?.id || 'system',
            updatedBy: req.user?.id || 'system'
          };

          // Upsert the schedule
          const newSchedule = await DoctorSchedule.findOneAndUpdate(
            { doctorId: doctor._id, date: targetDate },
            newScheduleData,
            { new: true, upsert: true, runValidators: true }
          );

          copiedSchedules.push({
            date: format(targetDate, 'yyyy-MM-dd'),
            dayOfWeek: format(targetDate, 'EEEE'),
            timeBlocks: newSchedule.timeBlocks
          });
        } catch (error) {
          errors.push({
            date: format(targetDate, 'yyyy-MM-dd'),
            error: error.message
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({
        success: false,
        message: "Kopiowanie harmonogramu zakończone z błędami",
        data: {
          copiedSchedules,
          errors,
          summary: {
            totalDays: 7,
            successfullyCopied: copiedSchedules.length,
            failedDays: errors.length
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Harmonogram z poprzedniego tygodnia został pomyślnie skopiowany na bieżący tydzień",
      data: {
        copiedSchedules,
        summary: {
          totalDays: 7,
          successfullyCopied: copiedSchedules.length,
          failedDays: 0
        }
      }
    });

  } catch (error) {
    console.error("Error copying last week's schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas kopiowania harmonogramu z poprzedniego tygodnia",
      error: error.message
    });
  }
};

// Copy schedule from custom date range to target date range (convenience function)
const copyScheduleFromDateRange = async (req, res) => {
  try {
    const { sourceStartDate, sourceEndDate, targetStartDate } = req.body;
    const doctorId = req.query.doctorId || req.user.id;

    if (!sourceStartDate || !sourceEndDate || !targetStartDate) {
      return res.status(400).json({
        success: false,
        message: "sourceStartDate, sourceEndDate, and targetStartDate are required"
      });
    }

    // Check if user has permission
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only copy your own schedule"
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Lekarz nie znaleziony"
      });
    }

    // Parse and validate dates
    const sourceStart = new Date(sourceStartDate);
    const sourceEnd = new Date(sourceEndDate);
    const targetStart = new Date(targetStartDate);

    if (isNaN(sourceStart.getTime()) || isNaN(sourceEnd.getTime()) || isNaN(targetStart.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD format"
      });
    }

    if (sourceStart > sourceEnd) {
      return res.status(400).json({
        success: false,
        message: "Source start date must be before or equal to source end date"
      });
    }

    // Calculate the number of days to copy
    const daysDiff = Math.ceil((sourceEnd - sourceStart) / (1000 * 60 * 60 * 24)) + 1;

    // Get source schedules
    const sourceSchedules = await DoctorSchedule.find({
      doctorId: doctor._id,
      date: {
        $gte: sourceStart,
        $lte: sourceEnd
      }
    }).sort({ date: 1 });

    if (sourceSchedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Brak harmonogramów dla określonego zakresu dat źródłowych"
      });
    }

    // Copy schedules to target date range
    const copiedSchedules = [];
    const errors = [];

    for (let i = 0; i < daysDiff; i++) {
      const sourceDate = addDays(sourceStart, i);
      const targetDate = addDays(targetStart, i);
      
      // Find the corresponding schedule for this day
      const sourceSchedule = sourceSchedules.find(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate.getTime() === sourceDate.getTime();
      });

      if (sourceSchedule && sourceSchedule.timeBlocks && sourceSchedule.timeBlocks.length > 0) {
        try {
          // Create new schedule for target date
          const newScheduleData = {
            doctorId: doctor._id,
            date: targetDate,
            timeBlocks: sourceSchedule.timeBlocks.map(block => ({
              startTime: block.startTime,
              endTime: block.endTime,
              isActive: block.isActive
            })),
            notes: `Skopiowano z ${format(sourceDate, 'yyyy-MM-dd')} - ${sourceSchedule.notes || 'Harmonogram z zakresu dat'}`,
            createdBy: req.user?.id || 'system',
            updatedBy: req.user?.id || 'system'
          };

          // Upsert the schedule
          const newSchedule = await DoctorSchedule.findOneAndUpdate(
            { doctorId: doctor._id, date: targetDate },
            newScheduleData,
            { new: true, upsert: true, runValidators: true }
          );

          copiedSchedules.push({
            date: format(targetDate, 'yyyy-MM-dd'),
            dayOfWeek: format(targetDate, 'EEEE'),
            timeBlocks: newSchedule.timeBlocks
          });
        } catch (error) {
          errors.push({
            date: format(targetDate, 'yyyy-MM-dd'),
            error: error.message
          });
        }
      }
    }

    if (errors.length > 0) {
      return res.status(207).json({
        success: false,
        message: "Kopiowanie harmonogramu zakończone z błędami",
        data: {
          copiedSchedules,
          errors,
          summary: {
            totalDays: daysDiff,
            successfullyCopied: copiedSchedules.length,
            failedDays: errors.length
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: `Harmonogram został pomyślnie skopiowany z ${format(sourceStart, 'yyyy-MM-dd')} do ${format(sourceEnd, 'yyyy-MM-dd')} do zakresu docelowego rozpoczynającego się ${format(targetStart, 'yyyy-MM-dd')}`,
      data: {
        copiedSchedules,
        summary: {
          totalDays: daysDiff,
          successfullyCopied: copiedSchedules.length,
          failedDays: 0
        }
      }
    });

  } catch (error) {
    console.error("Error copying schedule from date range:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd podczas kopiowania harmonogramu z zakresu dat",
      error: error.message
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
  copyLastWeekSchedule,
  copyScheduleFromDateRange
};
