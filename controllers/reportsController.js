const Appointment = require('../models/appointment');
const PatientBill = require('../models/patientBill');
const User = require('../models/user-entity/user');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate dynamic report from existing appointment and billing data
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const generateReport = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    const {
      startDate,
      endDate,
      doctorId,
      patientId,
      status = 'all',
      serviceType = 'all'
    } = req.query;

    // Validate required fields
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Data początkowa i końcowa są wymagane'
      });
    }

    // Validate date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include full end date
    
    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: 'Data początkowa musi być wcześniejsza niż końcowa'
      });
    }

    // Access control - doctors can only see their own data
    let finalDoctorId = doctorId;
    if (userRole === 'doctor') {
      finalDoctorId = userId;
    }

    // Build appointment query
    let appointmentQuery = {
      date: {
        $gte: start,
        $lte: end
      }
    };

    if (finalDoctorId) {
      appointmentQuery.doctor = finalDoctorId;
    }

    if (patientId) {
      appointmentQuery.patient = patientId;
    }

    if (status !== 'all') {
      appointmentQuery.status = status;
    }

    if (serviceType !== 'all') {
      appointmentQuery.mode = serviceType;
    }

    // Fetch appointments with populated data
    const appointments = await Appointment.find(appointmentQuery)
      .populate('doctor', 'name onlineConsultationFee offlineConsultationFee')
      .populate('patient', 'name phone email')
      .populate('bookedBy', 'name')
      .sort({ date: -1, startTime: 1 });

    // Get appointment IDs for billing data
    const appointmentIds = appointments.map(apt => apt._id);

    // Fetch corresponding billing data
    const bills = await PatientBill.find({
      appointment: { $in: appointmentIds },
      isDeleted: false
    }).populate('services.serviceId', 'title price');

    // Create a map of appointment ID to bill for easy lookup
    const billMap = {};
    bills.forEach(bill => {
      billMap[bill.appointment.toString()] = bill;
    });

    // Transform data for report
    const reportData = appointments.map(apt => {
      const doctorName = `${apt.doctor?.name?.first || ''} ${apt.doctor?.name?.last || ''}`.trim();
      const patientName = `${apt.patient?.name?.first || ''} ${apt.patient?.name?.last || ''}`.trim();
      
      const bill = billMap[apt._id.toString()];
      
      // Calculate earnings
      let earnings = 0;
      let services = [];
      
      if (bill) {
        // Use actual bill total
        earnings = parseFloat(bill.totalAmount) || 0;
        
        // Get service details from bill
        services = bill.services.map(service => ({
          title: service.title,
          price: parseFloat(service.price) || 0,
          status: service.status
        }));
      } else if (apt.status === 'completed') {
        // Fallback to consultation fees if no bill exists
        if (apt.mode === 'online') {
          earnings = apt.metadata?.consultationFee || apt.doctor?.onlineConsultationFee || 0;
        } else {
          earnings = apt.metadata?.consultationFee || apt.doctor?.offlineConsultationFee || 0;
        }
        
        services = [{
          title: `Konsultacja ${apt.mode === 'online' ? 'online' : 'w przychodni'}`,
          price: earnings,
          status: 'completed'
        }];
      }

      return {
        appointmentId: apt._id,
        patientName: patientName || 'Nieznany pacjent',
        patientPhone: apt.patient?.phone || '',
        patientEmail: apt.patient?.email || '',
        doctorName: doctorName || 'Nieznany lekarz',
        appointmentDate: apt.date,
        appointmentTime: apt.startTime,
        endTime: apt.endTime,
        duration: apt.duration,
        mode: apt.mode,
        status: apt.status,
        services: services,
        totalEarnings: earnings,
        paymentStatus: bill?.paymentStatus || 'N/A',
        paymentMethod: bill?.paymentMethod || 'N/A',
        billId: bill?._id || null,
        invoiceId: bill?.invoiceId || null,
        notes: apt.notes || '',
        checkedIn: apt.checkedIn,
        checkInDate: apt.checkInDate
      };
    });

    // Calculate summary statistics
    const summary = {
      totalAppointments: reportData.length,
      completedAppointments: reportData.filter(apt => apt.status === 'completed').length,
      cancelledAppointments: reportData.filter(apt => apt.status === 'cancelled').length,
      bookedAppointments: reportData.filter(apt => apt.status === 'booked').length,
      checkedInAppointments: reportData.filter(apt => apt.status === 'checkedIn').length,
      onlineAppointments: reportData.filter(apt => apt.mode === 'online').length,
      offlineAppointments: reportData.filter(apt => apt.mode === 'offline').length,
      totalEarnings: reportData.reduce((sum, apt) => sum + apt.totalEarnings, 0),
      onlineEarnings: reportData.filter(apt => apt.mode === 'online').reduce((sum, apt) => sum + apt.totalEarnings, 0),
      offlineEarnings: reportData.filter(apt => apt.mode === 'offline').reduce((sum, apt) => sum + apt.totalEarnings, 0),
      averageAppointmentValue: reportData.length > 0 ? reportData.reduce((sum, apt) => sum + apt.totalEarnings, 0) / reportData.length : 0,
      paidBills: reportData.filter(apt => apt.paymentStatus === 'paid').length,
      pendingBills: reportData.filter(apt => apt.paymentStatus === 'pending').length
    };

    res.status(200).json({
      success: true,
      message: 'Raport wygenerowany pomyślnie',
      data: {
        reportMetadata: {
          generatedAt: new Date(),
          generatedBy: `${req.user.name?.first || ''} ${req.user.name?.last || ''}`.trim(),
          dateRange: { startDate: start, endDate: end },
          filters: {
            doctorId: finalDoctorId,
            patientId,
            status,
            serviceType
          }
        },
        summary,
        appointments: reportData
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas generowania raportu',
      error: error.message
    });
  }
};

/**
 * Get appointment details by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getAppointmentDetails = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Build query with access control
    let query = { _id: appointmentId };
    
    // Doctors can only see their own appointments
    if (userRole === 'doctor') {
      query.doctor = userId;
    }

    const appointment = await Appointment.findOne(query)
      .populate('doctor', 'name onlineConsultationFee offlineConsultationFee email phone')
      .populate('patient', 'name phone email address')
      .populate('bookedBy', 'name role');

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Wizyta nie znaleziona lub brak uprawnień'
      });
    }

    // Get billing information
    const bill = await PatientBill.findOne({ 
      appointment: appointmentId,
      isDeleted: false 
    }).populate('services.serviceId', 'title price description')
     .populate('billedBy', 'name');

    // Format response
    const appointmentDetails = {
      id: appointment._id,
      patient: {
        name: `${appointment.patient?.name?.first || ''} ${appointment.patient?.name?.last || ''}`.trim(),
        phone: appointment.patient?.phone,
        email: appointment.patient?.email,
        address: appointment.patient?.address
      },
      doctor: {
        name: `${appointment.doctor?.name?.first || ''} ${appointment.doctor?.name?.last || ''}`.trim(),
        email: appointment.doctor?.email,
        phone: appointment.doctor?.phone,
        onlineConsultationFee: appointment.doctor?.onlineConsultationFee,
        offlineConsultationFee: appointment.doctor?.offlineConsultationFee
      },
      appointment: {
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        duration: appointment.duration,
        mode: appointment.mode,
        status: appointment.status,
        checkedIn: appointment.checkedIn,
        checkInDate: appointment.checkInDate,
        notes: appointment.notes,
        joiningLink: appointment.joining_link
      },
      consultation: appointment.consultation,
      healthData: appointment.healthData,
      tests: appointment.tests,
      medications: appointment.medications,
      reports: appointment.reports,
      billing: bill ? {
        id: bill._id,
        invoiceId: bill.invoiceId,
        services: bill.services,
        consultationCharges: bill.consultationCharges,
        subtotal: bill.subtotal,
        taxPercentage: bill.taxPercentage,
        taxAmount: bill.taxAmount,
        discount: bill.discount,
        additionalCharges: bill.additionalCharges,
        additionalChargeNote: bill.additionalChargeNote,
        totalAmount: bill.totalAmount,
        paymentStatus: bill.paymentStatus,
        paymentMethod: bill.paymentMethod,
        billedAt: bill.billedAt,
        billedBy: bill.billedBy ? `${bill.billedBy.name?.first || ''} ${bill.billedBy.name?.last || ''}`.trim() : null,
        notes: bill.notes,
        invoiceUrl: bill.invoiceUrl
      } : null,
      bookedBy: {
        name: `${appointment.bookedBy?.name?.first || ''} ${appointment.bookedBy?.name?.last || ''}`.trim(),
        role: appointment.bookedBy?.role
      },
      metadata: appointment.metadata
    };

    res.status(200).json({
      success: true,
      data: appointmentDetails
    });

  } catch (error) {
    console.error('Error fetching appointment details:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas pobierania szczegółów wizyty',
      error: error.message
    });
  }
};

/**
 * Export report to PDF
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const exportReportToPDF = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Generate report data (reuse the same logic)
    const reportResponse = await generateReportData(req.query, userId, userRole);
    const { summary, appointments, reportMetadata } = reportResponse;

    // Debug log
    console.log('Starting PDF generation with data:', {
      summaryStats: {
        totalAppointments: summary.totalAppointments,
        totalEarnings: summary.totalEarnings
      },
      appointmentsCount: appointments.length,
      dateRange: reportMetadata.dateRange
    });

    // 1. Generate HTML for the report (replace PDFKit table with HTML table)
    const statusMap = {
      booked: 'Zarezerwowana',
      checkedIn: 'Zameldowana',
      completed: 'Zrealizowana',
      cancelled: 'Anulowana'
    };

    function generateReportHTML({ summary, appointments, reportMetadata, user }) {
      return `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
        <meta charset="UTF-8">
        <title>Raport wizyt i rozliczeń</title>
        <style>
          body { font-family: 'DejaVu Sans', Arial, sans-serif; margin: 40px; }
          h2 { text-align: center; }
          table {
            border-collapse: collapse;
            width: 100%;
            font-size: 12px;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
            white-space: normal;
            max-width: 120px;
          }
          th { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <h2>Szczegóły wizyt:</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Godz.</th>
              <th>Pacjent</th>
              <th>Lekarz</th>
              <th>Typ</th>
              <th>Status</th>
              <th>Przychód</th>
            </tr>
          </thead>
          <tbody>
            ${appointments.map(apt => `
              <tr>
                <td>${new Date(apt.appointmentDate).toLocaleDateString('pl-PL')}</td>
                <td>${apt.appointmentTime}</td>
                <td>${apt.patientName}</td>
                <td>${apt.doctorName}</td>
                <td>${apt.mode === 'online' ? 'Online' : 'W przychodni'}</td>
                <td>${statusMap[apt.status] || apt.status}</td>
                <td>${apt.totalEarnings.toLocaleString('pl-PL')} PLN</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
      `;
    }

    // Instead of PDFKit, use Puppeteer to generate PDF from HTML
    const html = generateReportHTML({ summary, appointments, reportMetadata, user: req.user });
    const puppeteer = require('puppeteer-core');

    // Function to find Chrome executable (copied from visit-card.js)
    const findChrome = () => {
      const possiblePaths = [
        process.env.CHROME_EXECUTABLE_PATH,
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ];

      for (const chromePath of possiblePaths) {
        if (chromePath && fs.existsSync(chromePath)) {
          return chromePath;
        }
      }

      throw new Error(
        "Chrome executable not found. Please install Chrome or set CHROME_EXECUTABLE_PATH environment variable."
      );
    };

    const browser = await puppeteer.launch({ headless: true, executablePath: findChrome() });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="raport-${Date.now()}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error exporting PDF:', error);
    
    // If headers haven't been sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Błąd podczas eksportu do PDF',
        error: error.message
      });
    } else {
      // If headers were sent, end the response
      res.end();
    }
  }
};

/**
 * Export report to CSV
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const exportReportToCSV = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Generate report data
    const reportResponse = await generateReportData(req.query, userId, userRole);
    const { appointments } = reportResponse;

    // Create CSV content
    const csvHeaders = [
      'Pacjent',
      'Telefon pacjenta',
      'Email pacjenta',
      'Lekarz',
      'Data wizyty',
      'Godzina rozpoczęcia',
      'Godzina zakończenia',
      'Czas trwania (min)',
      'Typ wizyty',
      'Status',
      'Usługi',
      'Łączny koszt (PLN)',
      'Status płatności',
      'Metoda płatności',
      'ID faktury',
      'Uwagi'
    ];

    const csvRows = appointments.map(apt => [
      apt.patientName,
      apt.patientPhone,
      apt.patientEmail,
      apt.doctorName,
      apt.appointmentDate.toLocaleDateString('pl-PL'),
      apt.appointmentTime,
      apt.endTime,
      apt.duration,
      apt.mode === 'online' ? 'Online' : 'Przychodnia',
      apt.status,
      apt.services.map(s => `${s.title} (${s.price} PLN)`).join('; '),
      apt.totalEarnings.toFixed(2),
      apt.paymentStatus,
      apt.paymentMethod,
      apt.invoiceId || '',
      apt.notes || ''
    ]);

    // Combine headers and rows
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Set response headers for CSV download
    const fileName = `raport-${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // Add BOM for proper UTF-8 encoding in Excel
    res.write('\ufeff');
    res.write(csvContent);
    res.end();

  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Błąd podczas eksportu do CSV',
      error: error.message
    });
  }
};

/**
 * Helper function to generate report data (reusable for exports)
 */
const generateReportData = async (queryParams, userId, userRole) => {
  try {
    const {
      startDate,
      endDate,
      doctorId,
      patientId,
      status = 'all',
      serviceType = 'all'
    } = queryParams;

    console.log('Generating report with params:', { startDate, endDate, doctorId, patientId, status, serviceType });

    if (!startDate || !endDate) {
      throw new Error('Data początkowa i końcowa są wymagane');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start >= end) {
      throw new Error('Data początkowa musi być wcześniejsza niż końcowa');
    }

    let finalDoctorId = doctorId;
    if (userRole === 'doctor') {
      finalDoctorId = userId;
    }

    let appointmentQuery = {
      date: { $gte: start, $lte: end }
    };

    if (finalDoctorId) appointmentQuery.doctor = finalDoctorId;
    if (patientId) appointmentQuery.patient = patientId;
    if (status !== 'all') appointmentQuery.status = status;
    if (serviceType !== 'all') appointmentQuery.mode = serviceType;

    console.log('Appointment query:', appointmentQuery);

    const appointments = await Appointment.find(appointmentQuery)
      .populate('doctor', 'name onlineConsultationFee offlineConsultationFee')
      .populate('patient', 'name phone email')
      .populate('bookedBy', 'name')
      .sort({ date: -1, startTime: 1 });

    console.log(`Found ${appointments.length} appointments`);

    const appointmentIds = appointments.map(apt => apt._id);
    const bills = await PatientBill.find({
      appointment: { $in: appointmentIds },
      isDeleted: false
    }).populate('services.serviceId', 'title price');

    console.log(`Found ${bills.length} bills`);

    const billMap = {};
    bills.forEach(bill => {
      billMap[bill.appointment.toString()] = bill;
    });

    const reportData = appointments.map(apt => {
      const doctorName = apt.doctor?.name ? 
        `${apt.doctor.name.first || ''} ${apt.doctor.name.last || ''}`.trim() : 
        'Nieznany lekarz';
      
      const patientName = apt.patient?.name ? 
        `${apt.patient.name.first || ''} ${apt.patient.name.last || ''}`.trim() : 
        'Nieznany pacjent';
      
      const bill = billMap[apt._id.toString()];
      
      let earnings = 0;
      let services = [];
      
      if (bill) {
        earnings = parseFloat(bill.totalAmount) || 0;
        services = bill.services.map(service => ({
          title: service.serviceId?.title || service.title || 'Usługa',
          price: parseFloat(service.serviceId?.price || service.price) || 0,
          status: service.status
        }));
      } else if (apt.status === 'completed') {
        if (apt.mode === 'online') {
          earnings = parseFloat(apt.metadata?.consultationFee || apt.doctor?.onlineConsultationFee) || 0;
        } else {
          earnings = parseFloat(apt.metadata?.consultationFee || apt.doctor?.offlineConsultationFee) || 0;
        }
        services = [{
          title: `Konsultacja ${apt.mode === 'online' ? 'online' : 'w przychodni'}`,
          price: earnings,
          status: 'completed'
        }];
      }

      return {
        appointmentId: apt._id,
        patientName,
        patientPhone: apt.patient?.phone || '',
        patientEmail: apt.patient?.email || '',
        doctorName,
        appointmentDate: apt.date,
        appointmentTime: apt.startTime,
        endTime: apt.endTime,
        duration: apt.duration,
        mode: apt.mode,
        status: apt.status,
        services,
        totalEarnings: earnings,
        paymentStatus: bill?.paymentStatus || 'N/A',
        paymentMethod: bill?.paymentMethod || 'N/A',
        billId: bill?._id || null,
        invoiceId: bill?.invoiceId || null,
        notes: apt.notes || ''
      };
    });

    console.log('Generated report data:', {
      appointmentsCount: reportData.length,
      sampleAppointment: reportData[0]
    });

    const summary = {
      totalAppointments: reportData.length,
      completedAppointments: reportData.filter(apt => apt.status === 'completed').length,
      cancelledAppointments: reportData.filter(apt => apt.status === 'cancelled').length,
      bookedAppointments: reportData.filter(apt => apt.status === 'booked').length,
      onlineAppointments: reportData.filter(apt => apt.mode === 'online').length,
      offlineAppointments: reportData.filter(apt => apt.mode === 'offline').length,
      totalEarnings: reportData.reduce((sum, apt) => sum + apt.totalEarnings, 0),
      onlineEarnings: reportData.filter(apt => apt.mode === 'online')
        .reduce((sum, apt) => sum + apt.totalEarnings, 0),
      offlineEarnings: reportData.filter(apt => apt.mode === 'offline')
        .reduce((sum, apt) => sum + apt.totalEarnings, 0),
      averageAppointmentValue: reportData.length > 0 ? 
        reportData.reduce((sum, apt) => sum + apt.totalEarnings, 0) / reportData.length : 0,
      paidBills: reportData.filter(apt => apt.paymentStatus === 'paid').length,
      pendingBills: reportData.filter(apt => apt.paymentStatus === 'pending').length
    };

    console.log('Generated summary:', summary);

    return {
      summary,
      appointments: reportData,
      reportMetadata: {
        generatedAt: new Date(),
        dateRange: { startDate: start, endDate: end }
      }
    };
  } catch (error) {
    console.error('Error generating report data:', error);
    throw error;
  }
};

module.exports = {
  generateReport,
  getAppointmentDetails,
  exportReportToPDF,
  exportReportToCSV
}; 