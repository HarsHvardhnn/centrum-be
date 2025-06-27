const axios = require("axios");
const CaptchaAttempt = require("../models/captcha");

/**
 * Middleware do weryfikacji reCAPTCHA v3 z obsługą rate limiting i fallback
 */
const verifyRecaptcha = (options = {}) => {
  const {
    formType = 'contact',
    minScore = 0.3,
    maxAttemptsPerHour = 10,
    requireConsent = true,
    allowFallbackV2 = true,
    skipInDevelopment = true
  } = options;

  return async (req, res, next) => {
    try {
      // Pobierz IP klienta
      const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
      
      // W trybie development, pomiń weryfikację jeśli skonfigurowane
      if (skipInDevelopment && process.env.NODE_ENV === 'development') {
        console.log(`🔧 Tryb deweloperski: Pomijanie weryfikacji reCAPTCHA dla ${formType}`);
        return next();
      }

      // Sprawdź rate limiting
      const rateLimitResult = await CaptchaAttempt.checkRateLimit(
        clientIp, 
        formType, 
        1, // 1 godzina
        maxAttemptsPerHour
      );

      if (rateLimitResult.isLimitExceeded) {
        await CaptchaAttempt.logAttempt({
          ipAddress: clientIp,
          formType,
          captchaScore: 0,
          captchaToken: 'rate_limited',
          isAccepted: false,
          rejectionReason: 'rate_limit',
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          userId: req.user?.id
        });

        return res.status(429).json({
          success: false,
          message: `Za dużo prób. Spróbuj ponownie za godzinę.`,
          code: 'RATE_LIMIT_EXCEEDED',
          rateLimitInfo: rateLimitResult
        });
      }

      // Sprawdź zgodę (jeśli wymagana)
      if (requireConsent && !req.body.consent) {
        return res.status(400).json({
          success: false,
          message: 'Wymagana jest zgoda na przetwarzanie danych osobowych',
          code: 'CONSENT_REQUIRED'
        });
      }

      // Pobierz token reCAPTCHA z request body
      const recaptchaToken = req.body.recaptchaToken || req.body.captchaToken;
      const isV2Fallback = req.body.isV2Fallback === true;

      if (!recaptchaToken) {
        return res.status(400).json({
          success: false,
          message: 'Brak tokenu reCAPTCHA',
          code: 'RECAPTCHA_MISSING'
        });
      }

      // Weryfikuj z Google
      const verificationResult = await verifyWithGoogle(recaptchaToken, clientIp, isV2Fallback);
      
      if (!verificationResult.success) {
        await CaptchaAttempt.logAttempt({
          ipAddress: clientIp,
          formType,
          captchaScore: 0,
          captchaToken: recaptchaToken,
          isAccepted: false,
          rejectionReason: 'invalid_token',
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          usedFallback: isV2Fallback,
          userId: req.user?.id
        });

        return res.status(400).json({
          success: false,
          message: 'Weryfikacja reCAPTCHA nie powiodła się',
          code: 'RECAPTCHA_FAILED',
          details: verificationResult.error
        });
      }

      // Sprawdź score dla reCAPTCHA v3
      if (!isV2Fallback && verificationResult.score < minScore) {
        await CaptchaAttempt.logAttempt({
          ipAddress: clientIp,
          formType,
          captchaScore: verificationResult.score,
          captchaToken: recaptchaToken,
          isAccepted: false,
          rejectionReason: 'low_score',
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          captchaHostname: verificationResult.hostname,
          captchaAction: verificationResult.action,
          captchaChallengeTs: verificationResult.challenge_ts,
          userId: req.user?.id
        });

        // Jeśli dozwolony fallback, zwróć informację o potrzebie v2
        if (allowFallbackV2) {
          return res.status(200).json({
            success: false,
            requiresV2: true,
            message: 'Wymagana dodatkowa weryfikacja',
            code: 'RECAPTCHA_V2_REQUIRED',
            score: verificationResult.score,
            minScore
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'Weryfikacja bezpieczeństwa nie powiodła się',
            code: 'RECAPTCHA_SCORE_TOO_LOW',
            score: verificationResult.score,
            minScore
          });
        }
      }

      // Sukces - zaloguj próbę
      await CaptchaAttempt.logAttempt({
        ipAddress: clientIp,
        formType,
        captchaScore: verificationResult.score || 1, // v2 nie ma score
        captchaToken: recaptchaToken,
        isAccepted: true,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer,
        captchaHostname: verificationResult.hostname,
        captchaAction: verificationResult.action,
        captchaChallengeTs: verificationResult.challenge_ts,
        usedFallback: isV2Fallback,
        userId: req.user?.id
      });

      // Dodaj informacje o CAPTCHA do request
      req.captchaInfo = {
        score: verificationResult.score,
        action: verificationResult.action,
        hostname: verificationResult.hostname,
        isV2Fallback,
        clientIp
      };

      console.log(`✅ reCAPTCHA zweryfikowana pomyślnie: ${formType}, score: ${verificationResult.score}, IP: ${clientIp}`);
      
      next();
    } catch (error) {
      console.error('Błąd podczas weryfikacji reCAPTCHA:', error);
      
      // Zaloguj błąd
      try {
        await CaptchaAttempt.logAttempt({
          ipAddress: req.ip || 'unknown',
          formType,
          captchaScore: 0,
          captchaToken: req.body.recaptchaToken || 'error',
          isAccepted: false,
          rejectionReason: 'server_error',
          userAgent: req.headers['user-agent'],
          referer: req.headers.referer,
          userId: req.user?.id
        });
      } catch (logError) {
        console.error('Błąd podczas logowania błędu CAPTCHA:', logError);
      }

      return res.status(500).json({
        success: false,
        message: 'Błąd serwera podczas weryfikacji bezpieczeństwa',
        code: 'RECAPTCHA_SERVER_ERROR'
      });
    }
  };
};

/**
 * Weryfikacja tokenu z Google reCAPTCHA API
 */
const verifyWithGoogle = async (token, remoteip, isV2 = false) => {
  try {
    const secretKey = isV2 
      ? process.env.RECAPTCHA_V2_SECRET_KEY 
      : process.env.RECAPTCHA_V3_SECRET_KEY;

    if (!secretKey) {
      throw new Error(`Brak klucza ${isV2 ? 'reCAPTCHA v2' : 'reCAPTCHA v3'} w zmiennych środowiskowych`);
    }

    const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
      params: {
        secret: secretKey,
        response: token,
        remoteip
      },
      timeout: 10000 // 10 sekund timeout
    });

    const data = response.data;
    console.log("data", data);  

    if (!data.success) {
      return {
        success: false,
        error: data['error-codes'] || ['unknown-error'],
        errorCodes: data['error-codes']
      };
    }

    return {
      success: true,
      score: data.score, // tylko dla v3
      action: data.action, // tylko dla v3
      hostname: data.hostname,
      challenge_ts: data.challenge_ts ? new Date(data.challenge_ts) : null
    };
  } catch (error) {
    console.error('Błąd podczas komunikacji z Google reCAPTCHA API:', error);
    return {
      success: false,
      error: ['network-error'],
      details: error.message
    };
  }
};

/**
 * Middleware factory dla różnych typów formularzy
 */
const createRecaptchaMiddleware = {
  // Formularz rejestracji
  registration: () => verifyRecaptcha({
    formType: 'registration',
    minScore: 0.3,
    maxAttemptsPerHour: 5,
    requireConsent: true,
    allowFallbackV2: true
  }),

  // Formularz kontaktowy  
  contact: () => verifyRecaptcha({
    formType: 'contact',
    minScore: 0.3,
    maxAttemptsPerHour: 10,
    requireConsent: true,
    allowFallbackV2: true
  }),

  // Formularz logowania
  login: () => verifyRecaptcha({
    formType: 'login',
    minScore: 0.5, // Wyższy próg dla logowania
    maxAttemptsPerHour: 20,
    requireConsent: false,
    allowFallbackV2: true
  }),

  // Formularz umówienia wizyty
  appointment: () => verifyRecaptcha({
    formType: 'appointment',
    minScore: 0.4,
    maxAttemptsPerHour: 15,
    requireConsent: true,
    allowFallbackV2: true
  }),

  // Newsletter
  newsletter: () => verifyRecaptcha({
    formType: 'newsletter',
    minScore: 0.3,
    maxAttemptsPerHour: 3,
    requireConsent: true,
    allowFallbackV2: false // Newsletter nie wymaga fallback
  })
};

/**
 * Middleware do sprawdzania zgodny na przetwarzanie danych
 */
const requireConsent = (req, res, next) => {
  if (!req.body.consent) {
    return res.status(400).json({
      success: false,
      message: 'Wymagana jest zgoda na przetwarzanie danych osobowych',
      code: 'CONSENT_REQUIRED'
    });
  }
  next();
};

module.exports = {
  verifyRecaptcha,
  createRecaptchaMiddleware,
  requireConsent,
  verifyWithGoogle
}; 