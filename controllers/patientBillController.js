const PatientBill = require("../models/patientBill");
const Appointment = require("../models/appointment");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const cloudinary = require("../utils/cloudinary");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/user-entity/user");
const { generateNextInvoiceId } = require("./invoiceName");
const patientServices = require("../models/patientServices");
const puppeteer = require('puppeteer-core');
// const path = require('path');
// const fs = require('fs');
// const puppeteer=require("puppeteer");

// Generate a new bill for an appointment
exports.generateBill = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      subtotal,
      taxPercentage,
      taxAmount,
      discount,
      additionalCharges,
      additionalChargeNote,
      totalAmount,
      paymentMethod,
      notes,
    } = req.body;

    const pat_services = await patientServices
    .find({ appointment: appointmentId, isDeleted: false })
    .populate("services.service")
    .lean();
  
   let services_temp = pat_services.reduce((allServices, doc) => {
      return allServices.concat(doc.services || []);
    }, []);
  // Extract all services from all documents
  const services = (services_temp || []).map(serviceItem => ({
    serviceId: serviceItem.service._id,
    title: serviceItem.service?.title || "", // assuming 'name' field in Service model
    price: serviceItem.service.price,
    status: serviceItem.status
  }));
  console.log(services,"services")
    // Find appointment and check if it exists
    const appointment = await Appointment.findById(appointmentId).populate({
      path: "doctor",
      model: "User", // <-- Make sure this matches your Doctor model name
      select: "onlineConsultationFee offlineConsultationFee"
    });
    
    // SAFETY CHEC
    // K
    if (!appointment || !appointment.doctor) {
      throw new Error("Appointment or associated doctor not found.");
    }

    const copiedDoctor = appointment.doctor.toObject();
    console.log(copiedDoctor,"copiedDoctor");
    console.log(copiedDoctor.onlineConsultationFee,"charges");
    console.log(copiedDoctor.offlineConsultationFee,"charges");
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono wizyty",
      });
    }

    // Check if bill already exists for this appointment
    const existingBill = await PatientBill.findOne({ appointment: appointmentId });
    if (existingBill) {
      return res.status(400).json({
        success: false,
        message: "Faktura już istnieje dla tej wizyty",
      });
    }

    const invoiceId=await generateNextInvoiceId();
 
    // Get consultation charges
    let consultationCharges = 0;
    
    if (appointment.mode === "online") {
      consultationCharges = copiedDoctor.onlineConsultationFee || 0;
    } 
    console.log(consultationCharges,"consultationCharges");

    // Create new bill
    const newBill = new PatientBill({
      patient: appointment.patient,
      appointment: appointmentId,
      services,
      consultationCharges,
      subtotal,
      taxPercentage,
      taxAmount,
      discount,
      additionalCharges,
      invoiceId,
      additionalChargeNote,
      totalAmount: parseFloat(totalAmount),
      paymentMethod,
      billedAt: new Date(),
      billedBy: req.user._id,
      notes,
    });

    // Save the bill
    await newBill.save();

    // Update appointment status to completed
    appointment.status = "completed";
    await appointment.save();

    return res.status(201).json({
      success: true,
      message: "Faktura została wygenerowana pomyślnie",
      data: newBill,
    });
  } catch (error) {
    console.error("Error generating bill:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się wygenerować faktury",
      error: error.message,
    });
  }
};

// Get all bills with pagination, sorting, and filtering
exports.getAllBills = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      sortBy = "billedAt",
      sortOrder = -1,
      patientId,
      startDate,
      endDate,
      paymentStatus,
      search
    } = req.query;

    // Convert to numbers
    page = parseInt(page);
    limit = parseInt(limit);
    sortOrder = parseInt(sortOrder);

    const skip = (page - 1) * limit;
    const sortObject = { [sortBy]: sortOrder };

    // Build query
    const query = { isDeleted: false };

    // Add filters if provided
    if (patientId) {
      query.patient = patientId;
    }

    // Date filtering - support single dates and date ranges
    if (startDate || endDate) {
      query.billedAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        query.billedAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.billedAt.$lte = end;
      }
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Debug logging (can be removed after testing)
    console.log("Date filters:", { startDate, endDate });
    console.log("Final query:", JSON.stringify(query, null, 2));

    // Handle search parameter for both patient name and invoiceId
    if (search) {
      const trimmedSearch = search.trim();
      if (trimmedSearch) { // Only proceed if there's non-whitespace content
        const searchRegex = new RegExp(trimmedSearch, 'i');
        const searchWords = trimmedSearch.split(/\s+/); // Split by spaces
        
        // Build patient search conditions
        let patientSearchConditions = [
          // Search in individual name fields
          { 'name.first': { $regex: searchRegex } },
          { 'name.last': { $regex: searchRegex } }
        ];

        // If multiple words, also search for full name combinations
        if (searchWords.length >= 2) {
          const firstWord = new RegExp(searchWords[0], 'i');
          const lastWord = new RegExp(searchWords[searchWords.length - 1], 'i');
          
          patientSearchConditions.push(
            // First word matches first name AND last word matches last name
            {
              $and: [
                { 'name.first': { $regex: firstWord } },
                { 'name.last': { $regex: lastWord } }
              ]
            }
          );

          // Also try reverse order (last name first, first name last)
          patientSearchConditions.push(
            {
              $and: [
                { 'name.first': { $regex: lastWord } },
                { 'name.last': { $regex: firstWord } }
              ]
            }
          );
        }

        // Find matching patients
        const matchingPatients = await User.find({
          $or: patientSearchConditions
        }).select('_id');

        // Combine patient search and invoiceId search in the main query
        // Use $and to combine search with other filters
        const searchConditions = [
          { patient: { $in: matchingPatients.map(p => p._id) } },
          { invoiceId: { $regex: searchRegex } }
        ];
        
        // If we already have other conditions, use $and to combine them
        if (Object.keys(query).length > 1) {
          const existingConditions = { ...query };
          delete existingConditions.$or; // Remove any existing $or
          query.$and = [
            existingConditions,
            { $or: searchConditions }
          ];
        } else {
          query.$or = searchConditions;
        }
      }
    }

    // Get bills with search and filters
    console.log("Executing query with:", JSON.stringify(query, null, 2));
    
    let bills = await PatientBill.find(query)
      .populate({
        path: "patient",
        select: "name email profilePicture patientId",
      })
      .populate({
        path: "appointment",
        select: "date startTime endTime doctor",
      })
      .populate({
        path: "billedBy",
        select: "name email role",
      })
      .sort(sortObject)
      .skip(skip)
      .limit(limit);

    console.log(`Found ${bills.length} bills`);

    if (req.user.role == "doctor") {
      bills = bills.filter((bill) => bill.appointment.doctor == req.user.id);
    }

    // Get total count for pagination
    const totalBills = await PatientBill.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        totalBills,
        totalPages: Math.ceil(totalBills / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error getting bills:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać faktur",
      error: error.message,
    });
  }
};

// Get bills for a specific patient
exports.getPatientBills = async (req, res) => {
  try {
    const { patientId } = req.params;
    let { page = 1, limit = 10, sortBy = "billedAt", sortOrder = -1 } = req.query;

    // Convert to numbers
    page = parseInt(page);
    limit = parseInt(limit);
    sortOrder = parseInt(sortOrder);

    const skip = (page - 1) * limit;
    const sortObject = { [sortBy]: sortOrder };

    // Get bills with pagination
    const bills = await PatientBill.find({ patient: patientId, isDeleted: false })
      .populate({
        path: "appointment",
        select: "date startTime endTime",
      })
      .populate({
        path: "billedBy",
        select: "name email role",
      })
      .sort(sortObject)
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalBills = await PatientBill.countDocuments({
      patient: patientId,
      isDeleted: false,
    });

    return res.status(200).json({
      success: true,
      data: bills,
      pagination: {
        totalBills,
        totalPages: Math.ceil(totalBills / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    console.error("Error getting patient bills:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać faktur pacjenta",
      error: error.message,
    });
  }
};

// Get a single bill by ID
exports.getBillById = async (req, res) => {
  try {
    const { billId } = req.params;

    // Validate if billId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID faktury",
      });
    }

    // Find bill and populate all relevant fields
    const bill = await PatientBill.findById(billId)
      .populate({
        path: "patient",
        select: "name email profilePicture patientId phoneNumber",
      })
      .populate({
        path: "appointment",
        select: "date startTime endTime mode status",
        populate: {
          path: "doctor",
          select: "name email profilePicture specialization qualifications",
        },
      })
      .populate({
        path: "services.serviceId",
        select: "name description category",
      })
      .populate({
        path: "billedBy",
        select: "name email role",
      });

    if (!bill || bill.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono faktury",
      });
    }

    return res.status(200).json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error("Error getting bill details:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać szczegółów faktury",
      error: error.message,
    });
  }
};

// Update bill payment status
exports.updateBillPaymentStatus = async (req, res) => {
  try {
    console.log(req.body,"req.body")
    const { billId } = req.params;
    const { paymentStatus, paymentMethod, notes } = req.body;

    const bill = await PatientBill.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    // Update bill
    bill.paymentStatus = paymentStatus || bill.paymentStatus;
    if (paymentMethod) bill.paymentMethod = paymentMethod;
    if (notes) bill.notes = notes;

    await bill.save();

    console.log(bill,"bill")
    console.log(bill.invoiceUrl,"bill.invoiceUrl")
    // If bill is marked as paid and doesn't have an invoice, generate one
    if (paymentStatus === 'paid' && !bill.invoiceUrl) {
      try {
        // Create a mock request object for generateInvoice
        const mockReq = {
          params: { billId: bill._id }
        };
        const mockRes = {
          status: (code) => ({
            json: (data) => {
              if (data.success && data.data?.invoiceUrl) {
                bill.invoiceUrl = data.data.invoiceUrl;
                // bill.invoiceId = data.data.billId;
                bill.save();
              }
            }
          })
        };
        
        // Call generateInvoice
        await exports.generateInvoice(mockReq, mockRes);
      } catch (invoiceError) {
        console.error("Error auto-generating invoice:", invoiceError);
        // Don't fail the payment status update if invoice generation fails
      }
    }

    return res.status(200).json({
      success: true,
      message: "Status płatności faktury został zaktualizowany pomyślnie",
      data: bill,
    });
  } catch (error) {
    console.error("Error updating bill payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować statusu płatności faktury",
      error: error.message,
    });
  }
};

// Delete a bill (soft delete)
exports.deleteBill = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await PatientBill.findById(billId);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono faktury",
      });
    }

    // Soft delete
    bill.isDeleted = true;
    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Faktura została usunięta pomyślnie",
    });
  } catch (error) {
    console.error("Error deleting bill:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się usunąć faktury",
      error: error.message,
    });
  }
};

// Get bill statistics
exports.getBillStatistics = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.billedAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.billedAt.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.billedAt.$lte = end;
      }
    }

    console.log("Statistics date filter:", dateFilter);
    
    // Get total revenue
    const totalRevenue = await PatientBill.aggregate([
      { $match: { ...dateFilter, isDeleted: false } },
      { $group: { _id: null, total: { $sum: { $toDouble: "$totalAmount" } } } },
    ]);

    // Get payment status counts
    const paymentStatusCounts = await PatientBill.aggregate([
      { $match: { ...dateFilter, isDeleted: false } },
      { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
    ]);

    // Format payment status counts
    const formattedPaymentStatusCounts = paymentStatusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
        paymentStatusCounts: formattedPaymentStatusCounts,
      },
    });
  } catch (error) {
    console.error("Error getting bill statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się pobrać statystyk faktur",
      error: error.message,
    });
  }
};

// Generate invoice PDF for a bill


// Function to find Chrome executable
const findChrome = () => {
  const possiblePaths = [
    process.env.CHROME_EXECUTABLE_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
  ];

  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  throw new Error('Chrome executable not found. Please install Chrome or set CHROME_EXECUTABLE_PATH environment variable.');
};

exports.generateInvoice = async (req, res) => {
  let browser = null;
  
  try {
    const { billId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bill ID format",
      });
    }

    // Find the bill with populated data
    const bill = await PatientBill.findById(billId)
      .populate({
        path: "patient",
        // Remove select to get all fields and see what's available
      })
      .populate({
        path: "appointment",
        select: "date startTime endTime doctor consultation mode",
        populate: {
          path: "doctor",
          select: "name email",
        },
      })
      .populate({
        path: "billedBy",
        select: "name email role",
      });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    // If the bill already has an invoice URL, return that instead of generating a new one
    if (bill.invoiceUrl) {
      return res.status(200).json({
        success: true,
        message: "Faktura jest już dostępna",
        data: {
          invoiceUrl: bill.invoiceUrl,
          billId: bill._id,
          isExisting: true
        },
      });
    }

    const nextId = bill?.invoiceId || await generateNextInvoiceId();
    const safeInvoiceId = nextId.replace(/\//g, '_');
    const filename = `faktura_${safeInvoiceId}.pdf`;
    const tempFilePath = path.join(__dirname, "..", "temp", filename);
    
    // Make sure temp directory exists
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Helper functions for translations
    const translateStatus = (status) => {
      const statusMap = {
        'active': 'aktywny',
        'completed': 'zakończony',
        'cancelled': 'anulowany'
      };
      return statusMap[status] || status;
    };

    const translatePaymentStatus = (status) => {
      const statusMap = {
        'pending': 'OCZEKUJĄCA',
        'paid': 'ZAPŁACONO',
        'partial': 'CZĘŚCIOWO ZAPŁACONO',
        'cancelled': 'ANULOWANO'
      };
      return statusMap[status] || status.toUpperCase();
    };
    
    const translatePaymentMethod = (method) => {
      const methodMap = {
        'cash': 'GOTÓWKA',
        'card': 'KARTA',
        'online': 'PRZELEW ONLINE',
        'insurance': 'UBEZPIECZENIE',
        'other': 'INNE',
        'bank_transfer': 'PRZELEW BANKOWY'
      };
      return methodMap[method] || method.toUpperCase();
    };

    // Construct patient address from available fields
    const constructPatientAddress = (patient) => {
      const addressParts = [];
      if (patient?.address) addressParts.push(patient.address);
      if (patient?.city) addressParts.push(patient.city);
      if (patient?.district) addressParts.push(patient.district);
      if (patient?.state) addressParts.push(patient.state);
      if (patient?.pinCode) addressParts.push(patient.pinCode);
      if (patient?.country) addressParts.push(patient.country);
      
      return addressParts.length > 0 ? addressParts.join(", ") : "";
    };

    const patientAddress = constructPatientAddress(bill.patient);
    console.log(patientAddress,"patientAddress")

    // Enhanced HTML content with better styling
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Faktura #${nextId}</title>
        <style>
            @page {
                margin: 20mm;
                size: A4;
            }
            
            body {
                font-family: 'DejaVu Sans', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                margin: 0;
                padding: 0;
                font-size: 11px;
                line-height: 1.4;
                color: #333;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 25px;
                border-bottom: 2px solid #2c5aa0;
                padding-bottom: 15px;
            }
            
            .company-info {
                flex: 1;
            }
            
            .company-name {
                font-size: 16px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 8px;
            }
            
            .invoice-info {
                text-align: right;
                flex: 1;
            }
            
            .invoice-title {
                font-size: 24px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 8px;
            }
            
            .invoice-number {
                font-size: 12px;
                font-weight: bold;
                margin-bottom: 4px;
            }
            
            .section-title {
                font-size: 13px;
                font-weight: bold;
                color: #2c5aa0;
                margin: 20px 0 10px 0;
                padding-bottom: 5px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 20px;
            }
            
            .info-row {
                margin-bottom: 6px;
                display: flex;
            }
            
            .info-label {
                font-weight: bold;
                min-width: 120px;
            }
            
            .services-table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                font-size: 10px;
            }
            
            .services-table th {
                background: linear-gradient(135deg, #2c5aa0, #3d6db0);
                color: white;
                padding: 10px 8px;
                text-align: left;
                font-weight: bold;
                border: none;
            }
            
            .services-table td {
                padding: 8px;
                border-bottom: 1px solid #e0e0e0;
            }
            
            .services-table tbody tr:hover {
                background-color: #f8f9fa;
            }
            
            .services-table td:nth-child(2), 
            .services-table td:nth-child(3) {
                text-align: right;
            }
            
            .summary {
                margin-top: 20px;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
                border-left: 4px solid #2c5aa0;
            }
            
            .summary-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                padding: 2px 0;
            }
            
            .total-row {
                font-weight: bold;
                font-size: 13px;
                color: #2c5aa0;
                border-top: 2px solid #2c5aa0;
                padding-top: 8px;
                margin-top: 10px;
            }
            
            .payment-info {
                margin-top: 20px;
                padding: 15px;
                background: linear-gradient(135deg, #e8f0fe, #f0f7ff);
                border-radius: 5px;
                border: 1px solid #d0e0f0;
            }
            
            .payment-status {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 15px;
                font-weight: bold;
                font-size: 10px;
            }
            
            .status-paid {
                background-color: #d4edda;
                color: #155724;
                border: 1px solid #c3e6cb;
            }
            
            .status-pending {
                background-color: #fff3cd;
                color: #856404;
                border: 1px solid #ffeaa7;
            }
            
            .notes {
                margin-top: 20px;
                padding: 12px;
                background-color: #fff8dc;
                border-left: 4px solid #ffd700;
                border-radius: 0 3px 3px 0;
            }
            
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 9px;
                color: #666;
                border-top: 1px solid #e0e0e0;
                padding-top: 15px;
            }
            
            .footer-line {
                margin-bottom: 5px;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="company-info">
                <div class="company-name">CM7 Sp. z o.o.</div>
                <div>ul. Powstańców Warszawy 7/1.5</div>
                <div>26-110 Skarżysko-Kamienna</div>
                <div>NIP : 6631891951</div>
                <div>REGON : 541934650</div>
                <div style="margin-top: 8px;">
                <div>Email: kontakt@centrummedyczne7.pl</div>
                    <div>Telefon kontaktowy: 797-097-487</div>
                </div>
            </div>
            <div class="invoice-info">
                <div class="invoice-title">FAKTURA</div>
                <div class="invoice-number">Nr: ${nextId}</div>
                <div>Data wystawienia: ${new Date(bill.billedAt).toLocaleDateString('pl-PL')}</div>
            </div>
        </div>

        <div class="info-grid">
            <div>
                <div class="section-title">DANE PACJENTA</div>
                <div class="info-row">
                    <span class="info-label">Imię i Nazwisko:</span>
                    <span>${bill.patient?.name?.first || ""} ${bill.patient?.name?.last || ""}</span>
                </div>
             <div class="info-row">
  <span class="info-label">Płeć:</span>
  <span>
    ${bill.patient?.sex === "Male" 
      ? "Mężczyzna" 
      : bill.patient?.sex === "Female" 
        ? "Kobieta" 
        : "Inna"}
  </span>
</div>

                <div class="info-row">
                    <span class="info-label">PESEL:</span>
                    <span>${bill.patient?.govtId || "Nieznany"}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Data urodzenia:</span>
                    <span>${bill.patient?.dateOfBirth ? new Date(bill.patient.dateOfBirth).toLocaleDateString('pl-PL') : ""}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Adres zamieszkania:</span>
                    <span>${patientAddress}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Numer Telefonu:</span>
                    <span>${bill.patient?.phone || ""}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">ID Pacjenta:</span>
                    <span>${bill.patient?.patientId || "P-129723"}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Adres E-mail:</span>
                    <span>${bill.patient?.email || ""}</span>
                </div>
            </div>
            
            <div>
                <div class="section-title">SZCZEGÓŁY WIZYTY</div>
                <div class="info-row">
                    <span class="info-label">Data:</span>
                    <span>${bill.appointment?.date ? new Date(bill.appointment.date).toLocaleDateString('pl-PL') : "Brak danych"}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Godzina:</span>
                    <span>${bill.appointment?.startTime || "Brak danych"}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Lekarz:</span>
                    <span>${bill.appointment?.doctor?.name?.first || ""} ${bill.appointment?.doctor?.name?.last || ""}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Typ konsultacji:</span>
                    <span>${bill.appointment?.consultation?.consultationType || "Konsultacja ogólna"}</span>
                </div>
            </div>
        </div>

        <div class="section-title">SZCZEGÓŁY PŁATNOŚCI</div>
        <table class="services-table">
            <thead>
                <tr>
                    <th style="width: 60%;">Opis usługi</th>
                    <th style="width: 20%;">Cena</th>
                    <th style="width: 20%;">Status</th>
                </tr>
            </thead>
            <tbody>
                ${bill.services.map(service => `
                    <tr>
                        <td>${service.title}</td>
                        <td>${Number(service.price).toFixed(2)} ZŁ</td>
                        <td>${translateStatus(service.status)}</td>
                    </tr>
                `).join('')}
                ${bill.appointment?.mode === "online" ? `
                    <tr>
                        <td>Konsultacja online</td>
                        <td>-</td>
                        <td><span class="payment-status status-paid">OPŁACONO</span></td>
                    </tr>
                ` : ''}
            </tbody>
        </table>

        <div class="summary">
            <div class="summary-row">
                <span>Suma częściowa:</span>
                <span><strong>${bill.subtotal.toFixed(2)} ZŁ</strong></span>
            </div>
            ${bill.taxPercentage > 0 ? `
            <div class="summary-row">
                <span>Podatek VAT (${bill.taxPercentage}%):</span>
                <span>${bill.taxAmount.toFixed(2)} ZŁ</span>
            </div>
            ` : `  <div class="summary-row">
                <span>Podatek VAT (ZW):</span>
                <span>${bill.taxAmount.toFixed(2)} ZŁ</span>
            </div>`}
            ${bill.discount > 0 ? `
            <div class="summary-row">
                <span>Zniżka:</span>
                <span style="color: #28a745;">-${bill.discount.toFixed(2)} ZŁ</span>
            </div>
            ` : ''}
            ${bill.additionalCharges > 0 ? `
            <div class="summary-row">
                <span>Dodatkowe opłaty:</span>
                <span>${bill.additionalCharges.toFixed(2)} ZŁ</span>
            </div>
            ${bill.additionalChargeNote ? `
            <div style="font-size: 9px; color: #666; margin-top: 3px; font-style: italic;">
                ${bill.additionalChargeNote}
            </div>
            ` : ''}
            ` : ''}
            
            <div class="summary-row total-row">
                <span>RAZEM DO ZAPŁATY:</span>
                <span>${Number(bill.totalAmount).toFixed(2)} ZŁ</span>
            </div>
        </div>

        ${bill.notes ? `
        <div class="notes">
            <strong>Uwagi:</strong><br>
            ${bill.notes}
        </div>
        ` : ''}

    </body>
    </html>
    `;
    // function translatePaymentMethod(method) {
    //   const translations = {
    //     cash: "Gotówka",
    //     card: "Karta",
    //     online: "Online",
    //     insurance: "Ubezpieczenie",
    //     other: "Inne",
    //     bank_transfer: "Przelew bankowy"
    //   };
    
    //   return translations[method] || "Nieznana metoda płatności";
    // }
    

    // Launch browser with puppeteer-core
    browser = await puppeteer.launch({
      headless: true,
      executablePath: findChrome(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-extensions'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set content and wait for it to load
    await page.setContent(htmlContent, { 
      waitUntil: ['networkidle0', 'domcontentloaded'],
      timeout: 30000 
    });
    
    // Generate PDF with high quality settings
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm'
      }
    });

    await browser.close();
    browser = null;

    // Save PDF to temp file
    fs.writeFileSync(tempFilePath, pdfBuffer);

    try {
      // Upload to cloudinary
      const result = await cloudinary.uploader.upload(tempFilePath, {
        folder: "invoices",
        resource_type: "raw",
        public_id: bill.invoiceId?.replace(/\//g, '_') || safeInvoiceId
      });

      // Remove the temp file
      fs.unlinkSync(tempFilePath);

      // Update bill with invoice URL if it doesn't have one yet
      if (!bill.invoiceUrl) {
        bill.invoiceUrl = result.secure_url;
        bill.invoiceId = nextId;
        await bill.save();
      }

      // Return the download URL
      return res.status(200).json({
        success: true,
        message: "Faktura wygenerowana pomyślnie",
        data: {
          invoiceUrl: result.secure_url,
          billId: bill._id,
        },
      });
    } catch (uploadError) {
      console.error("Error uploading invoice to Cloudinary:", uploadError);
      
      // Return local path as fallback
      return res.status(200).json({
        success: true,
        message: "Faktura wygenerowana, ale nie udało się przesłać do chmury",
        data: {
          invoiceUrl: `/temp/${filename}`,
          billId: bill._id,
        },
      });
    }

  } catch (error) {
    console.error("Error generating invoice:", error);
    
    // Ensure browser is closed even if there's an error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError);
      }
    }
    
    return res.status(500).json({
      success: false,
      message: "Nie udało się wygenerować faktury",
      error: error.message,
    });
  }
};
// Update bill details
exports.updateBillDetails = async (req, res) => {
  try {
    const { billId } = req.params;
    const {
      services,
      consultationCharges,
      subtotal,
      taxPercentage,
      taxAmount,
      discount,
      additionalCharges,
      additionalChargeNote,
      totalAmount,
      paymentMethod,
      paymentStatus,
      notes
    } = req.body;

    // Validate if billId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(billId)) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format ID faktury",
      });
    }

    // Find the bill
    const bill = await PatientBill.findById(billId);

    if (!bill || bill.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Nie znaleziono faktury",
      });
    }

    // Update fields if provided
    if (services) bill.services = services;
    if (consultationCharges !== undefined) bill.consultationCharges = consultationCharges;
    if (subtotal !== undefined) bill.subtotal = subtotal;
    if (taxPercentage !== undefined) bill.taxPercentage = taxPercentage;
    if (taxAmount !== undefined) bill.taxAmount = taxAmount;
    if (discount !== undefined) bill.discount = discount;
    if (additionalCharges !== undefined) bill.additionalCharges = additionalCharges;
    if (additionalChargeNote !== undefined) bill.additionalChargeNote = additionalChargeNote;
    if (totalAmount !== undefined) bill.totalAmount = totalAmount;
    if (paymentMethod) bill.paymentMethod = paymentMethod;
    if (paymentStatus) bill.paymentStatus = paymentStatus;
    if (notes !== undefined) bill.notes = notes;

    // Save the updated bill
    await bill.save();

    // Return the updated bill with populated fields
    const updatedBill = await PatientBill.findById(billId)
      .populate({
        path: "patient",
        select: "name email profilePicture patientId phoneNumber"
      })
      .populate({
        path: "appointment",
        select: "date startTime endTime mode status",
        populate: {
          path: "doctor",
          select: "name email profilePicture specialization qualifications"
        }
      })
      .populate({
        path: "services.serviceId",
        select: "name description category"
      })
      .populate({
        path: "billedBy",
        select: "name email role"
      });

    return res.status(200).json({
      success: true,
      message: "Szczegóły faktury zostały zaktualizowane pomyślnie",
      data: updatedBill
    });
  } catch (error) {
    console.error("Error updating bill details:", error);
    return res.status(500).json({
      success: false,
      message: "Nie udało się zaktualizować szczegółów faktury",
      error: error.message
    });
  }
}; 