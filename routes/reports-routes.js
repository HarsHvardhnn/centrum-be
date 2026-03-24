const express = require('express');
const router = express.Router();
const {
  generateReport,
  getAppointmentDetails,
  exportReportToPDF,
  exportReportToCSV
} = require('../controllers/reportsController');
const authorizeRoles = require('../middlewares/authenticateRole');

// Generate report from existing appointment and billing data
// Query params: startDate, endDate, doctorId?, patientId?, status?, serviceType?, patientLessVisitsOnly?
router.get('/generate', 
  authorizeRoles(['admin', 'receptionist', 'doctor']), 
  generateReport
);

// Get detailed appointment information (clickable entries)
router.get('/appointment/:appointmentId', 
  authorizeRoles(['admin', 'receptionist', 'doctor']), 
  getAppointmentDetails
);

// Export report to PDF
// Same query params as generate
router.get('/export/pdf', 
  authorizeRoles(['admin', 'receptionist', 'doctor']), 
  exportReportToPDF
);

// Export report to CSV
// Same query params as generate
router.get('/export/csv', 
  authorizeRoles(['admin', 'receptionist', 'doctor']), 
  exportReportToCSV
);

module.exports = router; 