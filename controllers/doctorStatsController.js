const Appointment = require("../models/appointment");
const PatientBill = require("../models/patientBill");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const User = require("../models/user-entity/user");


// Get appointment statistics for a doctor by month/timeline
exports.getDoctorAppointmentStats = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { 
      startDate, 
      endDate, 
      timeframe, // New parameter: 'today', 'week', 'month', 'year'
      groupBy = 'month',  // Default grouping by month
      includeRevenue = 'false' // Whether to include revenue statistics
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID lekarza"
      });
    }

    // Validate dates
    let start, end;
    
    // If timeframe is provided and no explicit dates, calculate start and end dates based on timeframe
    if (timeframe && !startDate && !endDate) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (timeframe.toLowerCase()) {
        case 'today':
          start = new Date(today);
          start.setHours(0, 0, 0, 0);
          end = new Date(today);
          end.setHours(23, 59, 59, 999);
          break;
        case 'week':
          // This week (Monday to Sunday)
          const dayOfWeek = now.getDay();
          const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
          start = new Date(now);
          start.setDate(diff);
          start.setHours(0, 0, 0, 0);
          end = new Date(start);
          end.setDate(end.getDate() + 6);
          end.setHours(23, 59, 59, 999);
          break;
        case 'month':
          // Current month
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          end.setHours(23, 59, 59, 999);
          break;
        case 'year':
          // Current year
          start = new Date(now.getFullYear(), 0, 1);
          start.setHours(0, 0, 0, 0);
          end = new Date(now.getFullYear(), 11, 31);
          end.setHours(23, 59, 59, 999);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: "Nieprawidłowy parametr timeframe. Dozwolone wartości: today, week, month, year"
          });
      }
    } else {
      // Use provided dates or defaults (startDate/endDate take precedence over timeframe)
      if (startDate) {
        start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Nieprawidłowy format daty początkowej. Proszę użyć YYYY-MM-DD"
          });
        }
        // Set time to beginning of day
        start.setHours(0, 0, 0, 0);
      } else {
        // Default to 6 months ago if no startDate
        start = new Date();
        start.setMonth(start.getMonth() - 6);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
      }

      if (endDate) {
        end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Nieprawidłowy format daty końcowej. Proszę użyć YYYY-MM-DD"
          });
        }
        // Set time to end of day
        end.setHours(23, 59, 59, 999);
      } else {
        // Default to current date if no endDate
        end = new Date();
        end.setHours(23, 59, 59, 999);
      }
    }

    // Validate dates are in order
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Data początkowa nie może być po dacie końcowej"
      });
    }

    // Auto-set groupBy based on timeframe if not explicitly provided
    let finalGroupBy = groupBy;
    if (timeframe && groupBy === 'month') {
      switch (timeframe.toLowerCase()) {
        case 'today':
          finalGroupBy = 'day';
          break;
        case 'week':
          finalGroupBy = 'day';
          break;
        case 'month':
          finalGroupBy = 'day';
          break;
        case 'year':
          finalGroupBy = 'month';
          break;
      }
    }

    // Define the date grouping format based on groupBy parameter
    let dateGroupFormat;
    let dateFormat; // For formatting the response
    
    switch(finalGroupBy.toLowerCase()) {
      case 'day':
        dateGroupFormat = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
        dateFormat = "YYYY-MM-DD";
        break;
      case 'week':
        dateGroupFormat = { 
          $dateToString: { 
            format: "%Y-W%U", 
            date: "$date"
          }
        };
        dateFormat = "YYYY-WW";
        break;
      case 'year':
        dateGroupFormat = { $dateToString: { format: "%Y", date: "$date" } };
        dateFormat = "YYYY";
        break;
      case 'month':
      default:
        dateGroupFormat = { $dateToString: { format: "%Y-%m", date: "$date" } };
        dateFormat = "YYYY-MM";
    }

    // Basic aggregation pipeline for appointment statistics
    const aggregationPipeline = [
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: dateGroupFormat,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
          booked: { $sum: { $cond: [{ $eq: ["$status", "booked"] }, 1, 0] } },
          online: { $sum: { $cond: [{ $eq: ["$mode", "online"] }, 1, 0] } },
          offline: { $sum: { $cond: [{ $eq: ["$mode", "offline"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } } // Sort by date
    ];

    // Execute the aggregation
    const appointmentStats = await Appointment.aggregate(aggregationPipeline);

    // If revenue is requested, get revenue statistics
    let revenueStats = [];
    if (includeRevenue === 'true') {
      const revenuePipeline = [
        {
          $match: {
            appointment: { $exists: true },
            isDeleted: false
          }
        },
        {
          $lookup: {
            from: "appointments",
            localField: "appointment",
            foreignField: "_id",
            as: "appointmentData"
          }
        },
        { $unwind: "$appointmentData" },
        {
          $match: {
            "appointmentData.doctor": new mongoose.Types.ObjectId(doctorId),
            "appointmentData.date": { $gte: start, $lte: end }
          }
        },
        {
          $group: {
            _id: dateGroupFormat,
            totalRevenue: { $sum: { $toDouble: "$totalAmount" } },
            billCount: { $sum: 1 },
            avgRevenue: { $avg: { $toDouble: "$totalAmount" } }
          }
        },
        { $sort: { _id: 1 } }
      ];

      revenueStats = await PatientBill.aggregate(revenuePipeline);
    }

    // Fill in gaps in the date range
    const stats = fillDateGaps(appointmentStats, revenueStats, start, end, finalGroupBy);

    // Add metadata to response
    const response = {
      success: true,
      data: {
        doctorId,
        timeframe: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          groupBy: finalGroupBy,
          ...(timeframe && { timeframe: timeframe.toLowerCase() })
        },
        dateFormat,
        stats
      }
    };

    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching doctor statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać statystyk lekarza",
      error: error.message
    });
  }
};

// Helper function to fill in gaps in date series
function fillDateGaps(appointmentStats, revenueStats, startDate, endDate, groupBy) {
  const result = [];
  const revenueMap = {};
  
  // Create a map of revenue data by date key
  revenueStats.forEach(item => {
    revenueMap[item._id] = {
      totalRevenue: item.totalRevenue || 0,
      billCount: item.billCount || 0,
      avgRevenue: item.avgRevenue || 0
    };
  });

  // Create map of appointment data
  const appointmentMap = {};
  appointmentStats.forEach(item => {
    appointmentMap[item._id] = item;
  });

  // Generate all date periods in the range based on groupBy
  const current = new Date(startDate);
  
  while (current <= endDate) {
    let dateKey;
    
    switch(groupBy.toLowerCase()) {
      case 'day':
        dateKey = current.toISOString().split('T')[0]; // YYYY-MM-DD
        current.setDate(current.getDate() + 1);
        break;
      case 'week':
        // Get week number (0-51)
        const weekNum = Math.floor((current - new Date(current.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        dateKey = `${current.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
        current.setDate(current.getDate() + 7);
        break;
      case 'year':
        dateKey = current.getFullYear().toString();
        current.setFullYear(current.getFullYear() + 1);
        break;
      case 'month':
      default:
        dateKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        current.setMonth(current.getMonth() + 1);
    }
    
    // Get data for this date period or use defaults
    const appointmentData = appointmentMap[dateKey] || {
      _id: dateKey,
      total: 0,
      completed: 0,
      cancelled: 0,
      booked: 0,
      online: 0,
      offline: 0
    };
    
    // Create entry with appointment and revenue data
    const entry = {
      datePeriod: dateKey,
      appointments: {
        total: appointmentData.total,
        completed: appointmentData.completed,
        cancelled: appointmentData.cancelled,
        booked: appointmentData.booked,
        online: appointmentData.online,
        offline: appointmentData.offline
      }
    };
    
    // Add revenue data if available
    if (Object.keys(revenueMap).length > 0) {
      entry.revenue = revenueMap[dateKey] || {
        totalRevenue: 0,
        billCount: 0,
        avgRevenue: 0
      };
    }
    
    result.push(entry);
  }
  
  return result;
}

// Get appointment distribution statistics for a doctor
exports.getDoctorDistributionStats = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate } = req.query;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID lekarza"
      });
    }

    // Validate and prepare date range
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Nieprawidłowy format daty. Proszę użyć YYYY-MM-DD"
        });
      }
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (start > end) {
        return res.status(400).json({
          success: false,
          message: "Data początkowa nie może być po dacie końcowej"
        });
      }
      
      dateFilter = { date: { $gte: start, $lte: end } };
    }

    // Get day of week distribution
    const dayOfWeekPipeline = [
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          ...dateFilter
        }
      },
      {
        $group: {
          _id: { $dayOfWeek: "$date" }, // 1 for Sunday, 2 for Monday, etc.
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    
    // Get time of day distribution
    const timeOfDayPipeline = [
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $lt: [{ $hour: { $toDate: "$startTime" } }, 12] },
              "morning",
              { $cond: [{ $lt: [{ $hour: { $toDate: "$startTime" } }, 17] }, "afternoon", "evening"] }
            ]
          },
          count: { $sum: 1 }
        }
      }
    ];

    // Get consultation type distribution
    const consultationTypePipeline = [
      {
        $match: {
          doctor: new mongoose.Types.ObjectId(doctorId),
          "consultation.consultationType": { $exists: true },
          ...dateFilter
        }
      },
      {
        $group: {
          _id: "$consultation.consultationType",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];

    // Run all aggregations in parallel
    const [dayOfWeekDistribution, timeOfDayDistribution, consultationTypeDistribution] = await Promise.all([
      Appointment.aggregate(dayOfWeekPipeline),
      Appointment.aggregate(timeOfDayPipeline),
      Appointment.aggregate(consultationTypePipeline)
    ]);

    // Convert day of week numbers to names and ensure all days are included
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const formattedDayDistribution = dayNames.map((day, index) => {
      const dayData = dayOfWeekDistribution.find(d => d._id === index + 1);
      return {
        day,
        count: dayData ? dayData.count : 0
      };
    });

    // Ensure all time periods are included
    const timePeriods = ["morning", "afternoon", "evening"];
    const formattedTimeDistribution = timePeriods.map(period => {
      const timeData = timeOfDayDistribution.find(t => t._id === period);
      return {
        period,
        count: timeData ? timeData.count : 0
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        doctorId,
        dayOfWeekDistribution: formattedDayDistribution,
        timeOfDayDistribution: formattedTimeDistribution,
        consultationTypeDistribution
      }
    });
  } catch (error) {
    console.error("Error fetching doctor distribution statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać statystyk rozkładu lekarza",
      error: error.message
    });
  }
};

// Get performance metrics for a doctor
exports.getDoctorPerformanceMetrics = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { startDate, endDate, compareWithPrevious = 'false' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID lekarza"
      });
    }

    // Validate and prepare date range
    let start, end, previousStart, previousEnd;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Nieprawidłowy format daty. Proszę użyć YYYY-MM-DD"
        });
      }
      
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (start > end) {
        return res.status(400).json({
          success: false,
          message: "Data początkowa nie może być po dacie końcowej"
        });
      }
    } else {
      // Default to last 30 days
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }
    
    // Calculate previous period for comparison
    if (compareWithPrevious === 'true') {
      const periodDuration = end - start;
      previousEnd = new Date(start);
      previousEnd.setTime(previousEnd.getTime() - 1); // 1ms before start
      previousStart = new Date(previousEnd);
      previousStart.setTime(previousStart.getTime() - periodDuration);
    }

    // Get current period metrics
    const currentMetrics = await calculatePerformanceMetrics(doctorId, start, end);
    
    // Get previous period metrics if requested
    let previousMetrics = null;
    if (compareWithPrevious === 'true') {
      previousMetrics = await calculatePerformanceMetrics(doctorId, previousStart, previousEnd);
    }
    
    // Calculate performance changes if requested
    let performanceChanges = null;
    if (compareWithPrevious === 'true' && previousMetrics) {
      performanceChanges = {
        appointmentChange: calculatePercentageChange(
          previousMetrics.totalAppointments, 
          currentMetrics.totalAppointments
        ),
        completionRateChange: currentMetrics.completionRate - previousMetrics.completionRate,
        cancellationRateChange: currentMetrics.cancellationRate - previousMetrics.cancellationRate,
        avgRevenueChange: calculatePercentageChange(
          previousMetrics.avgRevenuePerAppointment, 
          currentMetrics.avgRevenuePerAppointment
        ),
        totalRevenueChange: calculatePercentageChange(
          previousMetrics.totalRevenue, 
          currentMetrics.totalRevenue
        )
      };
    }

    return res.status(200).json({
      success: true,
      data: {
        doctorId,
        currentPeriod: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0],
          metrics: currentMetrics
        },
        ...(previousMetrics && {
          previousPeriod: {
            startDate: previousStart.toISOString().split('T')[0],
            endDate: previousEnd.toISOString().split('T')[0],
            metrics: previousMetrics
          }
        }),
        ...(performanceChanges && { performanceChanges })
      }
    });
  } catch (error) {
    console.error("Error fetching doctor performance metrics:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać statystyk wydajności lekarza",
      error: error.message
    });
  }
};

// Helper function to calculate performance metrics
async function calculatePerformanceMetrics(doctorId, startDate, endDate) {
  // Get appointment metrics
  const appointmentMetrics = await Appointment.aggregate([
    {
      $match: {
        doctor: new mongoose.Types.ObjectId(doctorId),
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalAppointments: { $sum: 1 },
        completedAppointments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        cancelledAppointments: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } }
      }
    }
  ]);

  // Get revenue metrics
  const revenueMetrics = await PatientBill.aggregate([
    {
      $match: {
        isDeleted: false
      }
    },
    {
      $lookup: {
        from: "appointments",
        localField: "appointment",
        foreignField: "_id",
        as: "appointmentData"
      }
    },
    { $unwind: "$appointmentData" },
    {
      $match: {
        "appointmentData.doctor": new mongoose.Types.ObjectId(doctorId),
        "appointmentData.date": { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: { $toDouble: "$totalAmount" } },
        billCount: { $sum: 1 }
      }
    }
  ]);

  const metrics = appointmentMetrics[0] || { 
    totalAppointments: 0, 
    completedAppointments: 0, 
    cancelledAppointments: 0 
  };
  
  const revenue = revenueMetrics[0] || { totalRevenue: 0, billCount: 0 };
  
  // Calculate derived metrics
  const completionRate = metrics.totalAppointments > 0 
    ? (metrics.completedAppointments / metrics.totalAppointments) * 100 
    : 0;
    
  const cancellationRate = metrics.totalAppointments > 0 
    ? (metrics.cancelledAppointments / metrics.totalAppointments) * 100 
    : 0;
    
  const avgRevenuePerAppointment = metrics.completedAppointments > 0 
    ? revenue.totalRevenue / metrics.completedAppointments 
    : 0;

  return {
    totalAppointments: metrics.totalAppointments,
    completedAppointments: metrics.completedAppointments,
    cancelledAppointments: metrics.cancelledAppointments,
    completionRate,
    cancellationRate,
    totalRevenue: revenue.totalRevenue,
    billCount: revenue.billCount,
    avgRevenuePerAppointment
  };
}

// Helper function to calculate percentage change
function calculatePercentageChange(previousValue, currentValue) {
  if (previousValue === 0) {
    return currentValue > 0 ? 100 : 0;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
}

// Get a simplified list of doctors (id and name only)
exports.getDoctorsList = async (req, res) => {
  try {
    
    const doctors = await User.find(
      { role: "doctor", deleted: false },
      { _id: 1,name: 1 }
    ).sort({ name: 1 });
    
    const formattedDoctors = doctors.map(doctor => ({
      _id: doctor._id,
      name: `${doctor.name.first} ${doctor.name.last}`.trim()
    }));

    console.log("formattedDoctors",formattedDoctors);
    return res.status(200).json({
      success: true,
      count: formattedDoctors.length,
      data: formattedDoctors
    });
  } catch (error) {
    console.error("Error fetching doctors list:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać listy lekarzy",
      error: error.message
    });
  }
}; 