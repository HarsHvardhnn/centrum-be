const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/db");
const seedAdmin = require("./utils/adminSeeder");
const authRoutes = require("./routes/auth");
const doctorRoutes = require("./routes/doctor-routes");
const patientRoutes = require("./routes/patient-routes");
const adminRoutes = require("./routes/admin-routes");
const chatRoutes = require("./routes/chat-routes");
const appRoutes = require("./routes/appointment-routes");
const servicesRoutes = require("./routes/service-routes")
const newsRoutes = require("./routes/news-routes");
const visitCardRoutes = require("./routes/visit-card")
const smsRoutes = require("./routes/sms-routes");
const patientServicesRoutes = require("./routes/patient-services-routes");
const userServicesRoutes = require("./routes/user-services-routes");
const smsDataRoutes = require("./routes/sms-data-routes");
const smsTemplateRoutes = require("./routes/sms-template-routes");
const patientBillRoutes = require("./routes/patientBillRoutes");
const doctorStatsRoutes = require("./routes/doctor-stats-routes");
const contactRoutes = require("./routes/contactRoutes");
const googleAuthRoutes = require("./utils/googleAccessToken");
const invoiceRoutes = require("./routes/invoice-routes");
const emailTestRoutes = require("./routes/email-test-routes");
const zohoAuthRoutes = require("./routes/zoho-auth-routes");
const cookieConsentRoutes = require("./routes/cookie-consent-routes");
const ipRestrictionRoutes = require("./routes/ip-restriction-routes");
const captchaRoutes = require("./routes/captcha-routes");
const reportsRoutes = require("./routes/reports-routes");
const imageUploadRoutes = require("./routes/image-upload-routes");
const scheduleRoutes = require("./routes/schedule-routes");
const appointmentConfigRoutes = require("./routes/appointment-config-routes");
const smsConsentRoutes = require("./routes/sms-consent-routes");

// Import SEO middleware
const { seoMiddleware } = require("./backend-seo-implementation");

// Import IP restriction middleware
const { generalIpRestriction, adminIpRestriction } = require("./middlewares/ipRestriction");

dotenv.config();

// Initialize database and seed admin
const initializeApp = async () => {
  try {
    await connectDB();
    console.log('Database connected successfully');
    
    // Seed admin user
    await seedAdmin();
    
    // Initialize appointment reminder cron job
    const { initializeAppointmentReminders } = require('./scripts/appointmentReminderCron');
    await initializeAppointmentReminders();
    console.log('Appointment reminder cron job initialized');
  } catch (error) {
    console.error('Error during initialization:', error);
    process.exit(1);
  }
};

// Call initialization
initializeApp();

console.log(
  "process.env",
  process.env.NODE_ENV,
  process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : "http://localhost:5173");
const app = express();
app.set('trust proxy', true);
const server = http.createServer(app); // Create HTTP server with Express

// Helper function to normalize origin URL
const normalizeOrigin = (url) => {
  if (!url) return url;
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

// Get production URLs
const frontendOrigins = process.env.NODE_ENV === 'production'
  ? [
      normalizeOrigin(process.env.FRONTEND_URL),
      normalizeOrigin(process.env.FRONTEND_URL_ADMIN),
      normalizeOrigin(process.env.FROTEND_ADMIN_1),
      normalizeOrigin(process.env.FRONTEND_URL_WWW),
      normalizeOrigin(process.env.FRONTEND_ADMIN_2),
    ].filter(Boolean) // Remove any undefined/null values
  : ["http://localhost:5173"];

console.log("frontendOrigins", frontendOrigins);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? frontendOrigins
      : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
    credentials: true
  },
});

// Configure CORS for Express
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = normalizeOrigin(origin);
    console.log("normalizedOrigin", normalizedOrigin);
    
    // In development, allow both localhost origins
    if (process.env.NODE_ENV !== 'production') {
      if (normalizedOrigin === 'http://localhost:3000' || 
          normalizedOrigin === 'https://centrum-pl.netlify.app' || 
          normalizedOrigin === 'http://localhost:5173' || 
          normalizedOrigin === 'http://127.0.0.1:3000' || 
          normalizedOrigin === 'http://127.0.0.1:5173') {
        return callback(null, true);
      }
    }
    
    // In production, check against both frontend URLs
    if (frontendOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked:', normalizedOrigin, 'expected one of:', frontendOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization",
    "strict-transport-security",
    "content-security-policy",
    "X-Requested-With",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "X-XSS-Protection",
    "X-Permitted-Cross-Domain-Policies",
    "X-Content-Security-Policy",
    "X-WebKit-CSP",
    "X-Content-Security-Policy-Report-Only",
    "Accept",
    "Accept-Encoding",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Embedder-Policy",
    "Cross-Origin-Resource-Policy",
    "Cross-Origin-Embedder-Policy-Report-Only",
    "Cross-Origin-Resource-Policy-Report-Only",
    "Origin"
  ],
  exposedHeaders: [
    "strict-transport-security",
    "content-security-policy"
  ]
}));

app.use(express.json());
app.use(cookieParser());

// Add SEO middleware BEFORE routes (for crawler detection)
app.use(seoMiddleware);

// Add IP restriction management routes BEFORE applying IP restriction middleware
// This allows admins to manage IPs even when restrictions are active
app.use("/api/ip-restrictions", ipRestrictionRoutes);

// Apply IP restriction middleware to all other routes
// Note: Apply this AFTER SEO middleware but BEFORE authentication routes
// 
app.use("/auth",generalIpRestriction, authRoutes);
app.use("/docs", doctorRoutes);
app.use("/patients", patientRoutes);
app.use("/admin", adminRoutes);
app.use("/api/chat", chatRoutes);
app.use("/appointments", appRoutes);
app.use("/services", servicesRoutes);
app.use("/news", newsRoutes);
app.use("/sms", smsRoutes);
app.use("/visit-cards", visitCardRoutes);
app.use("/patient-services", patientServicesRoutes);
app.use("/user-services", userServicesRoutes);
app.use("/sms-data", smsDataRoutes);
app.use("/api/sms-templates", smsTemplateRoutes);
app.use("/patient-bills", patientBillRoutes);
app.use("/doctor-stats", doctorStatsRoutes);
app.use("/api/contact", contactRoutes);
app.use("/auth/google", googleAuthRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/email", emailTestRoutes);
app.use("/zoho", zohoAuthRoutes);
app.use("/api/cookie-consent", cookieConsentRoutes);
app.use("/api/captcha", captchaRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/images", imageUploadRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/appointment-config", appointmentConfigRoutes);
app.use("/api/sms-consent", smsConsentRoutes);

// Test route for SEO (can be removed later)
app.get("/seo-test", (req, res) => {
  res.json({ 
    message: "SEO middleware is active",
    userAgent: req.headers['user-agent'],
    isCrawler: require("./backend-seo-implementation").isCrawler(req.headers['user-agent'])
  });
});

// Import socket handler and pass io
const socketHandler = require("./config/socketHandler");
socketHandler(io);

const PORT =
  process.env.NODE_ENV === "production"
    ? process.env.PORT_PROD
    : process.env.PORT_DEV;

// Use server.listen instead of app.listen
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
