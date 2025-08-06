const DoctorSchedule = require("../models/doctorSchedule");
const ScheduleException = require("../models/scheduleException");
const User = require("../models/user-entity/user");
const { startOfDay, endOfDay, format, addDays } = require("date-fns");
const { toZonedTime } = require("date-fns-tz");

// Poland timezone
const POLAND_TIMEZONE = "Europe/Warsaw";

// Create or update doctor schedule for a specific date
const createOrUpdateSchedule = async (req, res) => {
  try {
    const { doctorId, date, timeBlocks, notes } = req.body;
    
    if (!doctorId || !date || !timeBlocks) {
      return res.status(400).json({
        success: false,
        message: "doctorId, date, and timeBlocks are required"
      });
    }

    // Validate doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }

    // Check if user has permission to modify this doctor's schedule
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only modify your own schedule"
      });
    }

    // Validate date is not in the past
    const scheduleDate = new Date(date);
    const todayInPoland = toZonedTime(new Date(), POLAND_TIMEZONE);
    const todayStart = startOfDay(todayInPoland);
    
    if (scheduleDate < todayStart) {
      return res.status(400).json({
        success: false,
        message: "Cannot create schedule for past dates"
      });
    }

    // Validate time blocks
    for (let block of timeBlocks) {
      if (!block.startTime || !block.endTime) {
        return res.status(400).json({
          success: false,
          message: "Each time block must have startTime and endTime"
        });
      }
      
      const startMinutes = timeToMinutes(block.startTime);
      const endMinutes = timeToMinutes(block.endTime);
      
      if (startMinutes >= endMinutes) {
        return res.status(400).json({
          success: false,
          message: "Start time must be before end time"
        });
      }
    }

    // Create or update schedule
    const scheduleData = {
      doctorId,
      date: scheduleDate,
      timeBlocks,
      notes,
      updatedBy: req.user.id
    };

    const schedule = await DoctorSchedule.findOneAndUpdate(
      { doctorId, date: scheduleDate },
      scheduleData,
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Schedule updated successfully",
      data: schedule
    });

  } catch (error) {
    console.error("Error creating/updating schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get doctor schedule for a date range
const getSchedule = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "doctorId is required"
      });
    }

    // Check if user has permission to view this doctor's schedule
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own schedule"
      });
    }

    // Validate doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }

    // Build query
    const query = { doctorId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const schedules = await DoctorSchedule.find(query)
      .sort({ date: 1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    return res.status(200).json({
      success: true,
      data: schedules
    });

  } catch (error) {
    console.error("Error fetching schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Delete doctor schedule for a specific date
const deleteSchedule = async (req, res) => {
  try {
    const { doctorId, date } = req.params;

    if (!doctorId || !date) {
      return res.status(400).json({
        success: false,
        message: "doctorId and date are required"
      });
    }

    // Check if user has permission to delete this doctor's schedule
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own schedule"
      });
    }

    const schedule = await DoctorSchedule.findOneAndDelete({
      doctorId,
      date: new Date(date)
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Schedule deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting schedule:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Create schedule exception
const createException = async (req, res) => {
  try {
    const { doctorId, date, type, title, description, isFullDay, timeRanges } = req.body;

    if (!doctorId || !date || !type || !title) {
      return res.status(400).json({
        success: false,
        message: "doctorId, date, type, and title are required"
      });
    }

    // Validate doctor exists
    const doctor = await User.findById(doctorId);
    if (!doctor || doctor.role !== "doctor") {
      return res.status(404).json({
        success: false,
        message: "Doctor not found"
      });
    }

    // Check if user has permission to create exception for this doctor
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only create exceptions for your own schedule"
      });
    }

    const exceptionData = {
      doctorId,
      date: new Date(date),
      type,
      title,
      description,
      isFullDay: isFullDay !== undefined ? isFullDay : true,
      timeRanges: isFullDay ? [] : timeRanges || [],
      createdBy: req.user.id
    };

    const exception = await ScheduleException.create(exceptionData);

    return res.status(201).json({
      success: true,
      message: "Schedule exception created successfully",
      data: exception
    });

  } catch (error) {
    console.error("Error creating schedule exception:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Get schedule exceptions for a doctor
const getExceptions = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "doctorId is required"
      });
    }

    // Check if user has permission to view this doctor's exceptions
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only view your own exceptions"
      });
    }

    // Build query
    const query = { doctorId };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const exceptions = await ScheduleException.find(query)
      .sort({ date: 1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    return res.status(200).json({
      success: true,
      data: exceptions
    });

  } catch (error) {
    console.error("Error fetching exceptions:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Delete schedule exception
const deleteException = async (req, res) => {
  try {
    const { exceptionId } = req.params;

    if (!exceptionId) {
      return res.status(400).json({
        success: false,
        message: "exceptionId is required"
      });
    }

    const exception = await ScheduleException.findById(exceptionId);
    
    if (!exception) {
      return res.status(404).json({
        success: false,
        message: "Exception not found"
      });
    }

    // Check if user has permission to delete this exception
    if (req.user.role === "doctor" && req.user.id !== exception.doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own exceptions"
      });
    }

    await ScheduleException.findByIdAndDelete(exceptionId);

    return res.status(200).json({
      success: true,
      message: "Exception deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting exception:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Helper function to convert time string to minutes
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

module.exports = {
  createOrUpdateSchedule,
  getSchedule,
  deleteSchedule,
  createException,
  getExceptions,
  deleteException
}; 