const mongoose = require("mongoose");
const DoctorSchedule = require("../models/doctorSchedule");
const ScheduleException = require("../models/scheduleException");
const User = require("../models/user-entity/user");
const { startOfDay, endOfDay, format, addDays, startOfWeek } = require("date-fns");
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

// Delete doctor schedule for a specific date (permanent delete from DB)
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
      message: "Schedule deleted permanently",
      data: { deletedId: schedule._id }
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

// Permanently delete a doctor schedule by its document ID (for use from Edit Schedule modal when you have the schedule _id)
const deleteScheduleById = async (req, res) => {
  try {
    const { scheduleId } = req.params;

    if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: "Valid scheduleId is required"
      });
    }

    const schedule = await DoctorSchedule.findById(scheduleId);
    if (!schedule) {
      return res.status(404).json({
        success: false,
        message: "Schedule not found"
      });
    }

    // Check if user has permission to delete this doctor's schedule
    if (req.user.role === "doctor" && req.user.id !== schedule.doctorId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own schedule"
      });
    }

    await DoctorSchedule.findByIdAndDelete(scheduleId);

    return res.status(200).json({
      success: true,
      message: "Schedule deleted permanently",
      data: { deletedId: schedule._id }
    });

  } catch (error) {
    console.error("Error deleting schedule by id:", error);
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

// Copy last week's schedule to current week
const copyLastWeekSchedule = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { targetWeekStart } = req.body; // Optional: specific week to copy to

    if (!doctorId) {
      return res.status(400).json({
        success: false,
        message: "doctorId is required"
      });
    }

    // Check if user has permission to modify this doctor's schedule
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only modify your own schedule"
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

    // Calculate date ranges
    const now = new Date();
    const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const lastWeekStart = addDays(currentWeekStart, -7);
    const lastWeekEnd = addDays(lastWeekStart, 6);
    
    // If target week is specified, use it instead of current week
    let targetWeekStartDate = currentWeekStart;
    if (targetWeekStart) {
      targetWeekStartDate = new Date(targetWeekStart);
      // Ensure it's a Monday
      const dayOfWeek = targetWeekStartDate.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      targetWeekStartDate = addDays(targetWeekStartDate, -daysToMonday);
    }

    // Get last week's schedules
    const lastWeekSchedules = await DoctorSchedule.find({
      doctorId,
      date: {
        $gte: lastWeekStart,
        $lte: lastWeekEnd
      }
    }).sort({ date: 1 });

    if (lastWeekSchedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No schedules found for last week to copy"
      });
    }

    // Copy schedules to current week
    const copiedSchedules = [];
    const errors = [];

    for (let i = 0; i < 7; i++) {
      const sourceDate = addDays(lastWeekStart, i);
      const targetDate = addDays(targetWeekStartDate, i);
      
      // Find the corresponding schedule for this day of the week
      const sourceSchedule = lastWeekSchedules.find(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate.getDay() === sourceDate.getDay();
      });

      if (sourceSchedule && sourceSchedule.timeBlocks && sourceSchedule.timeBlocks.length > 0) {
        try {
          // Create new schedule for target week
          const newScheduleData = {
            doctorId,
            date: targetDate,
            timeBlocks: sourceSchedule.timeBlocks.map(block => ({
              startTime: block.startTime,
              endTime: block.endTime,
              isActive: block.isActive
            })),
            notes: `Copied from ${format(sourceDate, 'yyyy-MM-dd')} - ${sourceSchedule.notes || 'Previous week schedule'}`,
            createdBy: req.user.id,
            updatedBy: req.user.id
          };

          // Upsert the schedule
          const newSchedule = await DoctorSchedule.findOneAndUpdate(
            { doctorId, date: targetDate },
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
        message: "Schedule copy completed with some errors",
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
      message: "Last week's schedule copied successfully to current week",
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
      message: "Internal server error",
      error: error.message
    });
  }
};

// Copy schedule from custom date range to target date range
const copyScheduleFromDateRange = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { sourceStartDate, sourceEndDate, targetStartDate } = req.body;

    if (!doctorId || !sourceStartDate || !sourceEndDate || !targetStartDate) {
      return res.status(400).json({
        success: false,
        message: "doctorId, sourceStartDate, sourceEndDate, and targetStartDate are required"
      });
    }

    // Check if user has permission to modify this doctor's schedule
    if (req.user.role === "doctor" && req.user.id !== doctorId) {
      return res.status(403).json({
        success: false,
        message: "You can only modify your own schedule"
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
      doctorId,
      date: {
        $gte: sourceStart,
        $lte: sourceEnd
      }
    }).sort({ date: 1 });

    if (sourceSchedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No schedules found for the specified source date range"
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
            doctorId,
            date: targetDate,
            timeBlocks: sourceSchedule.timeBlocks.map(block => ({
              startTime: block.startTime,
              endTime: block.endTime,
              isActive: block.isActive
            })),
            notes: `Copied from ${format(sourceDate, 'yyyy-MM-dd')} - ${sourceSchedule.notes || 'Schedule from date range'}`,
            createdBy: req.user.id,
            updatedBy: req.user.id
          };

          // Upsert the schedule
          const newSchedule = await DoctorSchedule.findOneAndUpdate(
            { doctorId, date: targetDate },
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
        message: "Schedule copy completed with some errors",
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
      message: `Schedule copied successfully from ${format(sourceStart, 'yyyy-MM-dd')} to ${format(sourceEnd, 'yyyy-MM-dd')} to target range starting ${format(targetStart, 'yyyy-MM-dd')}`,
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
  deleteScheduleById,
  createException,
  getExceptions,
  deleteException,
  copyLastWeekSchedule,
  copyScheduleFromDateRange
}; 