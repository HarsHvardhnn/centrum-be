const AllowedIp = require("../models/allowedIp");
const IpRestrictionSettings = require("../models/ipRestrictionSettings");

/**
 * Middleware do sprawdzania czy żądający IP jest dozwolony
 * Zwraca 401 jeśli IP nie znajduje się na liście dozwolonych
 */
const ipRestrictionMiddleware = async (req, res, next) => {
  try {
    // Sprawdź czy ograniczenia IP są włączone
    const restrictionStatus = await IpRestrictionSettings.isRestrictionActive();
    
    if (!restrictionStatus || restrictionStatus === false) {
      console.log("🔓 Ograniczenia IP wyłączone - dozwalanie dostępu");
      return next();
    }

    // Pobierz adres IP klienta z odpowiednią obsługą proxy
    const clientIp = getClientIp(req);
    
    if (!clientIp) {
      console.warn("Nie można określić adresu IP klienta");
      return res.status(401).json({
        success: false,
        message: "Dostęp zabroniony: Nie można określić adresu IP",
        code: "IP_UNDETERMINED"
      });
    }

    // Obsługa trybu development
    if (restrictionStatus === 'development' || (process.env.NODE_ENV === 'development' && isLocalhost(clientIp))) {
      console.log(`Tryb deweloperski: Zezwalanie na dostęp z localhost ${clientIp}`);
      return next();
    }

    // Sprawdź czy IP znajduje się na liście dozwolonych
    const allowedIp = await AllowedIp.findMatchingIp(clientIp);
    
    if (!allowedIp) {
      console.warn(`Dostęp zabroniony dla IP: ${clientIp}`);
      
      // Loguj próbę nieautoryzowanego dostępu
      logUnauthorizedAccess(req, clientIp);
      
      return res.status(401).json({
        success: false,
        message: "Dostęp zabroniony: Twój adres IP nie jest autoryzowany do dostępu do tego zasobu",
        code: "IP_NOT_ALLOWED",
        clientIp: process.env.NODE_ENV === 'development' ? clientIp : undefined
      });
    }

    console.log(`Dostęp przyznany dla IP: ${clientIp} (${allowedIp.description})`);
    
    // Dodaj informacje o IP do żądania do potencjalnego użycia w kontrolerach
    req.allowedIp = allowedIp;
    req.clientIp = clientIp;
    
    next();
  } catch (error) {
    console.error("Błąd w middleware ograniczeń IP:", error);
    return res.status(500).json({
      success: false,
      message: "Wewnętrzny błąd serwera podczas walidacji IP",
      code: "IP_VALIDATION_ERROR"
    });
  }
};

/**
 * Pobierz adres IP klienta z odpowiednią obsługą proxy
 * @param {Object} req - Obiekt żądania Express
 * @returns {string} - Adres IP klienta
 */
const getClientIp = (req) => {
  // Sprawdź IP z różnych nagłówków (typowe w konfiguracjach proxy)
  const possibleHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-client-ip',
    'cf-connecting-ip', // Cloudflare
    'x-cluster-client-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of possibleHeaders) {
    const value = req.headers[header];
    if (value) {
      // x-forwarded-for może zawierać wiele IP, weź pierwsze
      const ip = value.split(',')[0].trim();
      if (isValidIp(ip)) {
        return ip;
      }
    }
  }

  // Fallback do wbudowanych metod express
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.connection?.socket?.remoteAddress ||
         null;
};

/**
 * Sprawdź czy IP to localhost
 * @param {string} ip - Adres IP do sprawdzenia
 * @returns {boolean} - True jeśli localhost
 */
const isLocalhost = (ip) => {
  const localhostPatterns = [
    '127.0.0.1',
    '::1',
    'localhost',
    '0.0.0.0',
    '::ffff:127.0.0.1'
  ];
  
  return localhostPatterns.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.');
};

/**
 * Podstawowa walidacja IP
 * @param {string} ip - Adres IP do walidacji
 * @returns {boolean} - True jeśli prawidłowy format IP
 */
const isValidIp = (ip) => {
  if (!ip) return false;
  
  // Regex dla IPv4
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // Podstawowe sprawdzenie IPv6 (uproszczone)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Loguj próby nieautoryzowanego dostępu
 * @param {Object} req - Obiekt żądania Express
 * @param {string} clientIp - Adres IP klienta
 */
const logUnauthorizedAccess = (req, clientIp) => {
  const logData = {
    timestamp: new Date().toISOString(),
    ip: clientIp,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer || 'Dostęp bezpośredni',
    headers: {
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'cf-connecting-ip': req.headers['cf-connecting-ip']
    }
  };
  
  console.warn('PRÓBA NIEAUTORYZOWANEGO DOSTĘPU:', JSON.stringify(logData, null, 2));
  
  // Możesz rozszerzyć to o zapis do bazy danych lub zewnętrznego serwisu logowania
  // Przykład: zapis do MongoDB, wysłanie do serwisu logowania, itp.
};

/**
 * Fabryka middleware do warunkowych ograniczeń IP
 * @param {Object} options - Opcje konfiguracji
 * @returns {Function} - Funkcja middleware
 */
const createIpRestrictionMiddleware = (options = {}) => {
  const {
    skipInDevelopment = true,
    allowLocalhost = true,
    customErrorMessage = "Dostęp zabroniony: Twój adres IP nie jest autoryzowany do dostępu do tego zasobu"
  } = options;

  return async (req, res, next) => {
    try {
      // Sprawdź czy ograniczenia IP są włączone
      const restrictionStatus = await IpRestrictionSettings.isRestrictionActive();
      
      if (!restrictionStatus || restrictionStatus === false) {
        console.log("🔓 Ograniczenia IP wyłączone - dozwalanie dostępu");
        return next();
      }

      const clientIp = getClientIp(req);
      console.log("clientIp", clientIp);
      
      if (!clientIp) {
        return res.status(401).json({
          success: false,
          message: "Dostęp zabroniony: Nie można określić adresu IP",
          code: "IP_UNDETERMINED"
        });
      }

      // Pomiń w trybie deweloperskim jeśli skonfigurowane
      if (skipInDevelopment && (restrictionStatus === 'development' || (process.env.NODE_ENV === 'development' && allowLocalhost && isLocalhost(clientIp)))) {
        return next();
      }

      const allowedIp = await AllowedIp.findMatchingIp(clientIp);
      
      if (!allowedIp) {
        logUnauthorizedAccess(req, clientIp);
        
        return res.status(401).json({
          success: false,
          message: customErrorMessage,
          code: "IP_NOT_ALLOWED"
        });
      }

      req.allowedIp = allowedIp;
      req.clientIp = clientIp;
      next();
    } catch (error) {
      console.error("Błąd w middleware ograniczeń IP:", error);
      return res.status(500).json({
        success: false,
        message: "Wewnętrzny błąd serwera podczas walidacji IP",
        code: "IP_VALIDATION_ERROR"
      });
    }
  };
};

/**
 * Ograniczenie IP tylko dla admina (bardziej restrykcyjne)
 */
const adminIpRestriction = createIpRestrictionMiddleware({
  skipInDevelopment: false, // Zawsze wymuszaj dla tras admina
  allowLocalhost: false,
  customErrorMessage: "Dostęp zabroniony: Dostęp administratora wymaga autoryzowanego adresu IP"
});

/**
 * Ogólne ograniczenie IP (z omijaniem deweloperskim)
 */
const generalIpRestriction = createIpRestrictionMiddleware({
  skipInDevelopment: true,
  allowLocalhost: true,
  customErrorMessage: "Dostęp zabroniony: Twój adres IP nie jest autoryzowany"
});

module.exports = {
  ipRestrictionMiddleware,
  createIpRestrictionMiddleware,
  adminIpRestriction,
  generalIpRestriction,
  getClientIp,
  isLocalhost,
  isValidIp
}; 