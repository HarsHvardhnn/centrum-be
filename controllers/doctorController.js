// controllers/doctorController.js
const User = require("../models/user-entity/user");
const Doctor = require("../models/user-entity/doctor"); // This is the discriminator model
const { format, startOfDay, endOfDay } = require("date-fns");
const appointment = require("../models/appointment");
const user = require("../models/user-entity/user");

/**
 * Add a new doctor to the database
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const addDoctor = async (req, res) => {
  try {
    const doctorData = req.body;

    // Create the base user document
    const userData = {
      name: {
        first: doctorData.name?.first || "",
        last: doctorData.name?.last || "",
      },
      email: doctorData.email,
      phone: doctorData.phone,
      specializations: doctorData.specializations,
      password: doctorData.password, // In production, this should be hashed
      role: "doctor", // This triggers the discriminator
      signupMethod: doctorData.signupMethod || "email",
      profilePicture: req.file.path,
      singleSessionMode: doctorData.singleSessionMode || false,
    };

    // Doctor-specific fields
    const doctorFields = {
      d_id: `dr-${Date.now()}`, // Generate unique ID
      specialization: doctorData.specialization || [],
      qualifications: doctorData.qualifications || [],
      experience: doctorData.experience || 0,
      bio: doctorData.bio || "",
      consultationFee: doctorData.consultationFee || 0,
      weeklyShifts: doctorData.weeklyShifts || [],
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
      available: newDoctor.isAvailable, // This uses the virtual property from your schema
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
    };

    res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      doctor: responseDoctor,
    });
  } catch (error) {
    console.error("Error adding doctor:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add doctor",
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
    const doctors = await User.find(query).populate("specialization")
      .sort(sortConfig)
      .skip(skip)
      .limit(limitNum);

    const formattedDoctors = doctors.map((doc) => ({
      _id: doc._id,
      id: doc.d_id,
      name: `${doc.name.first} ${doc.name.last}`,
      specialty:
        doc.specialization && doc.specialization[0]
          ? doc.specialization[0]
          : "General",
      department: doc.department || "", // Include the department in the response
      available: doc.isAvailable,
      status: doc.isAvailable ? "Available" : "Unavailable",
      experience: doc.experience ? `${doc.experience} years` : "0 years",
      image: doc.profilePicture,
      visitType: "Consultation",
      date: new Date().toISOString().split("T")[0],
      qualifications: doc.qualifications || [],
      specializations: doc.specialization || [],
      bio: doc.bio || "",
      consultationFee: doc.consultationFee || 0,
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
    console.error("Error fetching doctors:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
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

    const doctor = await Doctor.findOne({ d_id: id })
      .select("-password -refreshTokens -__v")
      .populate("hospital specialization");
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
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
      message: "Failed to fetch doctor",
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
        .json({ success: false, message: "Doctor not found" });
    }

    return res.status(200).json({
      success: true,
      data: doctor.weeklyShifts || [],
    });
  } catch (error) {
    console.error("Error fetching weekly shifts:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching weekly shifts",
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
        message: "Shifts must be provided as an array",
      });
    }

    // Validate and enrich shifts
    const enrichedShifts = shifts.map((shift) => {
      if (!shift.dayOfWeek || !shift.startTime || !shift.endTime) {
        throw new Error(
          "Each shift must include dayOfWeek, startTime, and endTime"
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
        .json({ success: false, message: "Doctor not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Weekly shifts updated successfully",
      data: doctor.weeklyShifts,
    });
  } catch (error) {
    console.error("Error updating weekly shifts:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error while updating weekly shifts",
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
        .json({ success: false, message: "Doctor not found" });
    }

    return res.status(200).json({
      success: true,
      data: doctor.offSchedule || [],
    });
  } catch (error) {
    console.error("Error fetching off schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching off schedule",
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
        message: "Date and at least one time range must be provided",
      });
    }

    // Validate time ranges
    for (const range of timeRanges) {
      if (!range.startTime || !range.endTime) {
        return res.status(400).json({
          success: false,
          message: "Each time range must include startTime and endTime",
        });
      }
    }

    const parsedDate = new Date(date);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
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
      message: "Off time added successfully",
      data: doctor.offSchedule,
    });
  } catch (error) {
    console.error("Error adding off time:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding off time",
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
        message: "Date must be provided",
      });
    }

    const parsedDate = new Date(date);

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
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
      message: "Off time removed successfully",
      data: doctor.offSchedule,
    });
  } catch (error) {
    console.error("Error removing off time:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while removing off time",
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
        message: "Date parameter is required",
      });
    }

    const doctor = await user.findById(doctorId);
    if (!doctor) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }

    const requestedDate = new Date(date);
    const dayOfWeek = format(requestedDate, "EEEE"); // Monday, Tuesday, etc.

    // Check if doctor works on this day
    const shift = doctor.weeklyShifts.find((s) => s.dayOfWeek === dayOfWeek);
    if (!shift) {
      return res.status(200).json({
        success: true,
        message: `Doctor does not work on ${dayOfWeek}`,
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
      message: "Server error while generating available slots",
      error: error.message,
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
};
