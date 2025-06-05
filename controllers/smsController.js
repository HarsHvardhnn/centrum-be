const MessageReceipt = require("../models/smsData");

/**
 * Get all SMS data with pagination, sorting, and filtering
 * @route GET /api/sms
 * @access Admin, Receptionist
 */
exports.getAllSmsData = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    // Build filter object based on query parameters
    const filter = {};

    // Filter by status
    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    // Filter by batchId
    if (req.query.batchId) {
      filter.batchId = req.query.batchId;
    }

    // Filter by recipient userId
    if (req.query.userId) {
      filter["recipient.userId"] = req.query.userId;
    }

    // Filter by recipient phone
    if (req.query.phone) {
      filter["recipient.phone"] = { $regex: req.query.phone, $options: "i" };
    }

    // Filter by date range
    if (req.query.startDate && req.query.endDate) {
      filter.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate),
      };
    } else if (req.query.startDate) {
      filter.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      filter.createdAt = { $lte: new Date(req.query.endDate) };
    }

    // Text search in content
    if (req.query.search) {
      filter.content = { $regex: req.query.search, $options: "i" };
    }

    // Count total documents for pagination metadata
    const total = await MessageReceipt.countDocuments(filter);

    // Execute query with pagination and sorting
    const smsData = await MessageReceipt.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      count: smsData.length,
      data: smsData,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching SMS data:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać danych SMS",
      error: error.message,
    });
  }
};

/**
 * Get SMS data by ID
 * @route GET /api/sms/:id
 * @access Admin, Receptionist
 */
exports.getSmsDataById = async (req, res) => {
  try {
    const smsData = await MessageReceipt.findById(req.params.id);

    if (!smsData) {
      return res.status(404).json({
        success: false,
        message: "Dane SMS nie znalezione",
      });
    }

    return res.status(200).json({
      success: true,
      data: smsData,
    });
  } catch (error) {
    console.error("Error fetching SMS data:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać danych SMS",
      error: error.message,
    });
  }
};

/**
 * Get SMS data by Batch ID
 * @route GET /api/sms/batch/:batchId
 * @access Admin, Receptionist
 */
exports.getSmsDataByBatchId = async (req, res) => {
  try {
    const smsData = await MessageReceipt.find({ batchId: req.params.batchId });

    return res.status(200).json({
      success: true,
      count: smsData.length,
      data: smsData,
    });
  } catch (error) {
    console.error("Error fetching SMS data by batch ID:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać danych SMS",
      error: error.message,
    });
  }
};

/**
 * Get SMS data by user ID
 * @route GET /api/sms/user/:userId
 * @access Admin, Receptionist
 */
exports.getSmsDataByUserId = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting parameters
    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = {};
    sort[sortField] = sortOrder;

    const filter = { "recipient.userId": req.params.userId };

    // Filter by status if provided
    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    // Count total documents for pagination metadata
    const total = await MessageReceipt.countDocuments(filter);

    // Execute query with pagination and sorting
    const smsData = await MessageReceipt.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(200).json({
      success: true,
      count: smsData.length,
      data: smsData,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null,
      },
    });
  } catch (error) {
    console.error("Error fetching SMS data by user ID:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać danych SMS",
      error: error.message,
    });
  }
}; 