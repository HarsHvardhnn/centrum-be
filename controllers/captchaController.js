const CaptchaAttempt = require("../models/captcha");
const { verifyWithGoogle } = require("../middlewares/recaptchaVerification");

/**
 * Pobierz statystyki CAPTCHA
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCaptchaStats = async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 24; // domyślnie 24 godziny
    
    const stats = await CaptchaAttempt.getStats(timeRange);
    
    // Dodaj dodatkowe informacje
    const successRate = stats.overall.totalAttempts > 0 
      ? ((stats.overall.acceptedAttempts / stats.overall.totalAttempts) * 100).toFixed(2)
      : 0;

    const lowScoreRate = stats.overall.totalAttempts > 0
      ? ((stats.overall.lowScoreAttempts / stats.overall.totalAttempts) * 100).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      message: "Statystyki CAPTCHA pobrane pomyślnie",
      data: {
        ...stats,
        metrics: {
          successRate: parseFloat(successRate),
          lowScoreRate: parseFloat(lowScoreRate),
          fallbackUsageRate: stats.overall.totalAttempts > 0
            ? ((stats.overall.fallbackUsed / stats.overall.totalAttempts) * 100).toFixed(2)
            : 0
        }
      }
    });
  } catch (error) {
    console.error("Błąd podczas pobierania statystyk CAPTCHA:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać statystyk CAPTCHA",
      error: error.message
    });
  }
};

/**
 * Pobierz szczegółowe logi CAPTCHA z paginacją
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 */
exports.getCaptchaLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Buduj filtr
    const filter = {};
    
    if (req.query.formType) {
      filter.formType = req.query.formType;
    }
    
    if (req.query.isAccepted !== undefined) {
      filter.isAccepted = req.query.isAccepted === 'true';
    }
    
    if (req.query.rejectionReason) {
      filter.rejectionReason = req.query.rejectionReason;
    }
    
    if (req.query.ipAddress) {
      filter.ipAddress = { $regex: req.query.ipAddress, $options: 'i' };
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) {
        filter.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.createdAt.$lte = new Date(req.query.dateTo);
      }
    }

    const logs = await CaptchaAttempt.find(filter)
      .populate('userId', 'name.first name.last email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CaptchaAttempt.countDocuments(filter);

    return res.status(200).json({
      success: true,
      message: "Logi CAPTCHA pobrane pomyślnie",
      data: {
        logs,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit
        },
        filters: {
          formType: req.query.formType,
          isAccepted: req.query.isAccepted,
          rejectionReason: req.query.rejectionReason,
          ipAddress: req.query.ipAddress,
          dateFrom: req.query.dateFrom,
          dateTo: req.query.dateTo
        }
      }
    });
  } catch (error) {
    console.error("Błąd podczas pobierania logów CAPTCHA:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać logów CAPTCHA",
      error: error.message
    });
  }
};

/**
 * Pobierz aktywność według IP (dla analizy bezpieczeństwa)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getIpActivity = async (req, res) => {
  try {
    const timeRange = parseInt(req.query.timeRange) || 24;
    const limit = parseInt(req.query.limit) || 20;
    const timeWindow = new Date(Date.now() - timeRange * 60 * 60 * 1000);

    const ipActivity = await CaptchaAttempt.aggregate([
      {
        $match: {
          createdAt: { $gte: timeWindow }
        }
      },
      {
        $group: {
          _id: '$ipAddress',
          totalAttempts: { $sum: 1 },
          acceptedAttempts: { $sum: { $cond: ['$isAccepted', 1, 0] } },
          averageScore: { $avg: '$captchaScore' },
          lowScoreAttempts: { 
            $sum: { $cond: [{ $lt: ['$captchaScore', 0.3] }, 1, 0] } 
          },
          formTypes: { $addToSet: '$formType' },
          lastAttempt: { $max: '$createdAt' },
          rejectionReasons: { $addToSet: '$rejectionReason' }
        }
      },
      {
        $addFields: {
          successRate: {
            $cond: {
              if: { $gt: ['$totalAttempts', 0] },
              then: { $multiply: [{ $divide: ['$acceptedAttempts', '$totalAttempts'] }, 100] },
              else: 0
            }
          },
          suspiciousActivity: {
            $or: [
              { $gt: ['$totalAttempts', 50] }, // Więcej niż 50 prób
              { $lt: ['$averageScore', 0.2] }, // Średni score poniżej 0.2
              { $gt: ['$lowScoreAttempts', 10] } // Więcej niż 10 niskich score
            ]
          }
        }
      },
      {
        $sort: { totalAttempts: -1, lastAttempt: -1 }
      },
      {
        $limit: limit
      }
    ]);

    return res.status(200).json({
      success: true,
      message: "Aktywność IP pobrana pomyślnie",
      data: {
        ipActivity,
        timeRange,
        analysisTime: new Date()
      }
    });
  } catch (error) {
    console.error("Błąd podczas pobierania aktywności IP:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać aktywności IP",
      error: error.message
    });
  }
};

/**
 * Test weryfikacji CAPTCHA (dla administratorów)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.testCaptchaVerification = async (req, res) => {
  try {
    const { token, isV2, remoteip } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token CAPTCHA jest wymagany"
      });
    }

    const clientIp = remoteip || req.ip || 'test';
    const result = await verifyWithGoogle(token, clientIp, isV2);

    return res.status(200).json({
      success: true,
      message: "Test weryfikacji CAPTCHA zakończony",
      data: {
        verification: result,
        testedToken: token,
        isV2: isV2,
        clientIp,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error("Błąd podczas testowania CAPTCHA:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się przetestować CAPTCHA",
      error: error.message
    });
  }
};

/**
 * Pobierz konfigurację CAPTCHA (publiczną)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCaptchaConfig = async (req, res) => {
  try {
    const config = {
      v3: {
        siteKey: process.env.RECAPTCHA_V3_SITE_KEY,
        enabled: !!process.env.RECAPTCHA_V3_SITE_KEY && !!process.env.RECAPTCHA_V3_SECRET_KEY
      },
      v2: {
        siteKey: process.env.RECAPTCHA_V2_SITE_KEY,
        enabled: !!process.env.RECAPTCHA_V2_SITE_KEY && !!process.env.RECAPTCHA_V2_SECRET_KEY
      },
      minScores: {
        registration: 0.3,
        contact: 0.3,
        login: 0.5,
        appointment: 0.4,
        newsletter: 0.3
      },
      rateLimits: {
        registration: 5,
        contact: 10,
        login: 20,
        appointment: 15,
        newsletter: 3
      },
      developmentMode: process.env.NODE_ENV === 'development'
    };

    return res.status(200).json({
      success: true,
      message: "Konfiguracja CAPTCHA pobrana pomyślnie",
      data: config
    });
  } catch (error) {
    console.error("Błąd podczas pobierania konfiguracji CAPTCHA:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać konfiguracji CAPTCHA",
      error: error.message
    });
  }
};

/**
 * Wyczyść stare logi CAPTCHA
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.cleanupCaptchaLogs = async (req, res) => {
  try {
    const daysOld = parseInt(req.body.daysOld) || 30;
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await CaptchaAttempt.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    return res.status(200).json({
      success: true,
      message: `Usunięto ${result.deletedCount} starych logów CAPTCHA`,
      data: {
        deletedCount: result.deletedCount,
        cutoffDate,
        daysOld
      }
    });
  } catch (error) {
    console.error("Błąd podczas czyszczenia logów CAPTCHA:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się wyczyścić logów CAPTCHA",
      error: error.message
    });
  }
};

/**
 * Pobierz dashboard z kluczowymi metrykami CAPTCHA
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCaptchaDashboard = async (req, res) => {
  try {
    // Ostatnie 24 godziny
    const last24h = await CaptchaAttempt.getStats(24);
    
    // Ostatnie 7 dni
    const last7d = await CaptchaAttempt.getStats(24 * 7);

    // Top odrzucone IP w ostatnich 24h
    const topRejectedIps = await CaptchaAttempt.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          isAccepted: false
        }
      },
      {
        $group: {
          _id: '$ipAddress',
          rejectedCount: { $sum: 1 },
          reasons: { $addToSet: '$rejectionReason' }
        }
      },
      {
        $sort: { rejectedCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // Trendy godzinowe dla ostatnich 24h
    const hourlyTrends = await CaptchaAttempt.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: { 
            hour: { $hour: { date: '$createdAt', timezone: 'Europe/Warsaw' } },
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Europe/Warsaw' } }
          },
          total: { $sum: 1 },
          accepted: { $sum: { $cond: ['$isAccepted', 1, 0] } },
          averageScore: { $avg: '$captchaScore' }
        }
      },
      {
        $sort: { '_id.date': 1, '_id.hour': 1 }
      }
    ]);

    return res.status(200).json({
      success: true,
      message: "Dashboard CAPTCHA pobrany pomyślnie",
      data: {
        last24h,
        last7d,
        topRejectedIps,
        hourlyTrends,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    console.error("Błąd podczas pobierania dashboardu CAPTCHA:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać dashboardu CAPTCHA",
      error: error.message
    });
  }
}; 