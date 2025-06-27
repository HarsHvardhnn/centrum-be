const express = require("express");
const router = express.Router();
const captchaController = require("../controllers/captchaController");
const  authorizeRoles  = require("../middlewares/authenticateRole");

// Wszystkie trasy wymagają uwierzytelnienia administratora (poza publicznymi)

/**
 * @route GET /api/captcha/config
 * @desc Pobierz publiczną konfigurację CAPTCHA (klucze publiczne, ustawienia)
 * @access Publiczny
 */
router.get("/config", captchaController.getCaptchaConfig);

/**
 * @route GET /api/captcha/stats
 * @desc Pobierz statystyki CAPTCHA z określonego przedziału czasowego
 * @access Admin
 * @query timeRange - liczba godzin wstecz (domyślnie 24)
 */
router.get("/stats", authorizeRoles("admin"), captchaController.getCaptchaStats);

/**
 * @route GET /api/captcha/logs
 * @desc Pobierz szczegółowe logi CAPTCHA z paginacją i filtrami
 * @access Admin
 * @query page - numer strony (domyślnie 1)
 * @query limit - liczba elementów na stronę (domyślnie 50)
 * @query formType - filtr według typu formularza
 * @query isAccepted - filtr według statusu akceptacji (true/false)
 * @query rejectionReason - filtr według powodu odrzucenia
 * @query ipAddress - filtr według adresu IP (regex)
 * @query dateFrom - filtr od daty (ISO string)
 * @query dateTo - filtr do daty (ISO string)
 */
router.get("/logs", authorizeRoles("admin"), captchaController.getCaptchaLogs);

/**
 * @route GET /api/captcha/ip-activity
 * @desc Pobierz aktywność według IP dla analizy bezpieczeństwa
 * @access Admin
 * @query timeRange - liczba godzin wstecz (domyślnie 24)
 * @query limit - liczba IP do zwrócenia (domyślnie 20)
 */
router.get("/ip-activity", authorizeRoles("admin"), captchaController.getIpActivity);

/**
 * @route GET /api/captcha/dashboard
 * @desc Pobierz dashboard z kluczowymi metrykami CAPTCHA
 * @access Admin
 */
router.get("/dashboard", authorizeRoles("admin"), captchaController.getCaptchaDashboard);

/**
 * @route POST /api/captcha/test
 * @desc Test weryfikacji CAPTCHA dla administratorów
 * @access Admin
 * @body token - token CAPTCHA do przetestowania
 * @body isV2 - czy to token reCAPTCHA v2 (boolean)
 * @body remoteip - opcjonalny IP do testowania
 */
router.post("/test", authorizeRoles("admin"), captchaController.testCaptchaVerification);

/**
 * @route DELETE /api/captcha/cleanup
 * @desc Wyczyść stare logi CAPTCHA
 * @access Admin
 * @body daysOld - liczba dni (starsze logi zostaną usunięte, domyślnie 30)
 */
router.delete("/cleanup", authorizeRoles("admin"), captchaController.cleanupCaptchaLogs);

module.exports = router; 