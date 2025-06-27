const mongoose = require("mongoose");

const captchaAttemptSchema = new mongoose.Schema(
  {
    // Adres IP użytkownika
    ipAddress: {
      type: String,
      required: true,
      index: true
    },
    
    // Typ formularza
    formType: {
      type: String,
      required: true,
      enum: ['registration', 'contact', 'login', 'appointment', 'newsletter'],
      index: true
    },
    
    // Wynik reCAPTCHA
    captchaScore: {
      type: Number,
      required: true,
      min: 0,
      max: 1
    },
    
    // Token reCAPTCHA (dla debugowania)
    captchaToken: {
      type: String,
      required: true
    },
    
    // Czy próba została zaakceptowana
    isAccepted: {
      type: Boolean,
      required: true,
      default: false
    },
    
    // Powód odrzucenia (jeśli applicable)
    rejectionReason: {
      type: String,
      enum: ['low_score', 'invalid_token', 'rate_limit', 'missing_consent', 'server_error']
    },
    
    // User Agent dla analizy
    userAgent: {
      type: String,
      maxlength: 500
    },
    
    // Referer dla analizy
    referer: {
      type: String,
      maxlength: 500
    },
    
    // Dodatkowe dane z Google reCAPTCHA
    captchaHostname: String,
    captchaAction: String,
    captchaChallengeTs: Date,
    
    // Czy użyto fallback reCAPTCHA v2
    usedFallback: {
      type: Boolean,
      default: false
    },
    
    // ID użytkownika (jeśli zalogowany)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

// Indeksy dla wydajności i czyszczenia
captchaAttemptSchema.index({ ipAddress: 1, formType: 1, createdAt: 1 });
captchaAttemptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // Auto-delete po 7 dniach

// Statyczna metoda do sprawdzania rate limiting
captchaAttemptSchema.statics.checkRateLimit = async function(ipAddress, formType, timeWindowHours = 1, maxAttempts = 10) {
  const timeWindow = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
  
  const attemptCount = await this.countDocuments({
    ipAddress,
    formType,
    createdAt: { $gte: timeWindow }
  });
  
  return {
    isLimitExceeded: attemptCount >= maxAttempts,
    currentAttempts: attemptCount,
    maxAttempts,
    timeWindowHours
  };
};

// Statyczna metoda do logowania próby CAPTCHA
captchaAttemptSchema.statics.logAttempt = async function(attemptData) {
  try {
    const attempt = new this(attemptData);
    await attempt.save();
    return attempt;
  } catch (error) {
    console.error("Błąd podczas logowania próby CAPTCHA:", error);
    throw error;
  }
};

// Statyczna metoda do pobierania statystyk
captchaAttemptSchema.statics.getStats = async function(timeRange = 24) {
  const timeWindow = new Date(Date.now() - timeRange * 60 * 60 * 1000);
  
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: timeWindow }
      }
    },
    {
      $group: {
        _id: null,
        totalAttempts: { $sum: 1 },
        acceptedAttempts: { $sum: { $cond: ['$isAccepted', 1, 0] } },
        averageScore: { $avg: '$captchaScore' },
        lowScoreAttempts: { 
          $sum: { $cond: [{ $lt: ['$captchaScore', 0.3] }, 1, 0] } 
        },
        fallbackUsed: {
          $sum: { $cond: ['$usedFallback', 1, 0] }
        }
      }
    }
  ]);

  // Statystyki per typ formularza
  const formTypeStats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: timeWindow }
      }
    },
    {
      $group: {
        _id: '$formType',
        count: { $sum: 1 },
        accepted: { $sum: { $cond: ['$isAccepted', 1, 0] } },
        averageScore: { $avg: '$captchaScore' }
      }
    }
  ]);

  return {
    overall: stats[0] || {
      totalAttempts: 0,
      acceptedAttempts: 0,
      averageScore: 0,
      lowScoreAttempts: 0,
      fallbackUsed: 0
    },
    byFormType: formTypeStats,
    timeRange
  };
};

const CaptchaAttempt = mongoose.model("CaptchaAttempt", captchaAttemptSchema);

module.exports = CaptchaAttempt; 