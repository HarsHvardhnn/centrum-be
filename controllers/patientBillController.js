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

// Generate a new bill for an appointment
exports.generateBill = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const {
      services,
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
        message: "Appointment not found",
      });
    }

    // Check if bill already exists for this appointment
    const existingBill = await PatientBill.findOne({ appointment: appointmentId });
    if (existingBill) {
      return res.status(400).json({
        success: false,
        message: "Bill already exists for this appointment",
      });
    }

 
    // Get consultation charges
    let consultationCharges = 0;
    
    if (appointment.mode === "online") {
      consultationCharges = copiedDoctor.onlineConsultationFee || 0;
    } else {
      consultationCharges = copiedDoctor.offlineConsultationFee || 0;
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
      additionalChargeNote,
      totalAmount:parseFloat(totalAmount) + parseFloat(consultationCharges),
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
      message: "Bill generated successfully",
      data: newBill,
    });
  } catch (error) {
    console.error("Error generating bill:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate bill",
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

 
    if (startDate && endDate) {
      query.billedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      query.billedAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.billedAt = { $lte: new Date(endDate) };
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Get bills with pagination
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
      console.log("total bills",bills)

          if (req.user.role=="doctor") {
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
      message: "Failed to get bills",
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
      message: "Failed to get patient bills",
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
        message: "Invalid bill ID format",
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
        message: "Bill not found",
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
      message: "Failed to get bill details",
      error: error.message,
    });
  }
};

// Update bill payment status
exports.updateBillPaymentStatus = async (req, res) => {
  try {
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

    return res.status(200).json({
      success: true,
      message: "Bill payment status updated successfully",
      data: bill,
    });
  } catch (error) {
    console.error("Error updating bill payment status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update bill payment status",
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
        message: "Bill not found",
      });
    }

    // Soft delete
    bill.isDeleted = true;
    await bill.save();

    return res.status(200).json({
      success: true,
      message: "Bill deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting bill:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete bill",
      error: error.message,
    });
  }
};

// Get bill statistics
exports.getBillStatistics = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.billedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      dateFilter.billedAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      dateFilter.billedAt = { $lte: new Date(endDate) };
    }

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
      message: "Failed to get bill statistics",
      error: error.message,
    });
  }
};

// Generate invoice PDF for a bill
exports.generateInvoice = async (req, res) => {
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
        select: "name email phone dateOfBirth patientId address city pinCode",
      })
      .populate({
        path: "appointment",
        select: "date startTime endTime doctor consultation",
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

    // Create a unique filename
    const filename = `faktura_${bill._id}_${uuidv4()}.pdf`;
    const tempFilePath = path.join(__dirname, "..", "temp", filename);

    // Make sure temp directory exists
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create a PDF document with proper font support
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Faktura #${bill._id}`,
        Author: "Centrum Medyczne",
      },
    });

    // Register a font that supports Polish characters (you'll need to add this font file)
    // For now, we'll use built-in fonts and handle encoding properly
    const fontPath = path.join(__dirname, "../fonts/DejaVuSans.ttf");
    let customFont = null;
    
    // Check if custom font exists, otherwise use built-in fonts
    if (fs.existsSync(fontPath)) {
      doc.registerFont('DejaVuSans', fontPath);
      doc.registerFont('DejaVuSans-Bold', path.join(__dirname, "../fonts/DejaVuSans-Bold.ttf"));
      customFont = 'DejaVuSans';
    }

    // Function to safely add text with proper encoding
    const addText = (text, x, y, options = {}) => {
      // Ensure text is properly encoded
      const safeText = Buffer.from(text, 'utf8').toString('utf8');
      if (customFont) {
        doc.font(customFont);
      }
      return doc.text(safeText, x, y, options);
    };

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    // Load logo
    const logoPath = path.join(__dirname, "../public/logo_teal.png");
    
    // Add content to PDF
    // Header with logo and title
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, 30, { width: 80 });
    }
    
    doc.fontSize(20);
    if (customFont) doc.font(customFont);
    addText("FAKTURA", 350, 40, { align: "right" });
    
    doc.fontSize(10);
    addText(`Faktura Nr: ${bill._id}`, 350, 65, { align: "right" });
    addText(`Data: ${new Date(bill.billedAt).toLocaleDateString('pl-PL')}`, 350, 80, { align: "right" });

    // Move to next section
    doc.y = 120;
    
    // Add horizontal line
    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    // Hospital and billing info
    doc.fontSize(10);
    if (customFont) doc.font(customFont);
    doc.y += 15;
    let currentY = doc.y;
    
    addText("Centrum Medyczne", 50, currentY);
    addText("Powstańców Warszawy 7/1.5", 50, currentY + 12);
    addText("26-110 Skarżysko-Kamienna", 50, currentY + 24);
    addText("Nagłe przypadki: (+48) 797 097 487, (+48) 797 127 487", 50, currentY + 36);
    addText("Telefon: (+48) 797 097 487", 50, currentY + 48);
    addText("Email: kontakt@centrummedyczne7.pl", 50, currentY + 60);

    // Patient information
    doc.y = currentY + 85;
    doc.fontSize(12);
    if (customFont) {
      doc.font(customFont + '-Bold');
    } else {
      doc.font('Helvetica-Bold');
    }
    addText("DANE PACJENTA:", 50, doc.y, { underline: true });
    
    doc.fontSize(10);
    if (customFont) {
      doc.font(customFont);
    } else {
      doc.font('Helvetica');
    }
    
    currentY = doc.y + 20;
    addText(`Imię i Nazwisko: ${bill.patient?.name?.first || ""} ${bill.patient?.name?.last || ""}`, 50, currentY);
    addText(`ID Pacjenta: ${bill.patient?.patientId || ""}`, 50, currentY + 12);
    addText(`Email: ${bill.patient?.email || ""}`, 50, currentY + 24);
    addText(`Telefon: ${bill.patient?.phone || ""}`, 50, currentY + 36);

    // Appointment details
    const appointmentDate = bill.appointment?.date ? 
      new Date(bill.appointment.date).toLocaleDateString('pl-PL') : "Brak danych";
    
    doc.y = currentY + 60;
    doc.fontSize(12);
    if (customFont) {
      doc.font(customFont + '-Bold');
    } else {
      doc.font('Helvetica-Bold');
    }
    addText("SZCZEGÓŁY WIZYTY:", 50, doc.y, { underline: true });
    
    doc.fontSize(10);
    if (customFont) {
      doc.font(customFont);
    } else {
      doc.font('Helvetica');
    }
    
    currentY = doc.y + 20;
    addText(`Data: ${appointmentDate}`, 50, currentY);
    addText(`Godzina: ${bill.appointment?.startTime || "Brak danych"}`, 50, currentY + 12);
    addText(`Lekarz: ${bill.appointment?.doctor?.name?.first || ""} ${bill.appointment?.doctor?.name?.last || ""}`, 50, currentY + 24);
    addText(`Typ konsultacji: ${bill.appointment?.consultation?.consultationType || "Konsultacja ogólna"}`, 50, currentY + 36);

    // Bill items table header
    doc.y = currentY + 60;
    doc.fontSize(12);
    if (customFont) {
      doc.font(customFont + '-Bold');
    } else {
      doc.font('Helvetica-Bold');
    }
    addText("SZCZEGÓŁY PŁATNOŚCI:", 50, doc.y, { underline: true });
    
    // Table headers
    doc.fontSize(10);
    doc.y += 20;
    
    const tableTop = doc.y;
    if (customFont) {
      doc.font(customFont + '-Bold');
    } else {
      doc.font('Helvetica-Bold');
    }
    addText("Pozycja", 50, tableTop);
    addText("Cena", 350, tableTop, { width: 90, align: "right" });
    addText("Status", 450, tableTop, { width: 90, align: "right" });
    
    // Add horizontal line
    doc.y = tableTop + 15;
    doc.moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    // Table rows for services
    if (customFont) {
      doc.font(customFont);
    } else {
      doc.font('Helvetica');
    }
    let y = doc.y + 10;
    
    // Translate service status
    const translateStatus = (status) => {
      const statusMap = {
        'active': 'aktywny',
        'completed': 'zakończony',
        'cancelled': 'anulowany'
      };
      return statusMap[status] || status;
    };
    
    // Add consultation charge as first item if present
    if (bill.consultationCharges > 0) {
      const consultationType = bill.appointment?.mode === "online" ? "Konsultacja online" : "Konsultacja w przychodni";
      addText(consultationType, 50, y);
      addText(`${bill.consultationCharges.toFixed(2)} PLN`, 350, y, { width: 90, align: "right" });
      addText("zakończony", 450, y, { width: 90, align: "right" });
      y += 20;
    }
    
    bill.services.forEach((service) => {
      addText(service.title, 50, y);
      addText(`${service.price} PLN`, 350, y, { width: 90, align: "right" });
      addText(translateStatus(service.status), 450, y, { width: 90, align: "right" });
      y += 20;
    });

    // Add horizontal line
    doc.moveTo(50, y + 10)
      .lineTo(550, y + 10)
      .stroke();

    // Billing summary
    y += 30;
    addText("Suma częściowa:", 350, y, { width: 90, align: "right" });
    addText(`${bill.subtotal.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
    
    y += 20;
    if (bill.taxPercentage > 0) {
      addText(`Podatek VAT (${bill.taxPercentage}%):`, 350, y, { width: 90, align: "right" });
      addText(`${bill.taxAmount.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
      y += 20;
    }
    
    if (bill.discount > 0) {
      addText("Zniżka:", 350, y, { width: 90, align: "right" });
      addText(`-${bill.discount.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
      y += 20;
    }
    
    if (bill.additionalCharges > 0) {
      addText("Dodatkowe opłaty:", 350, y, { width: 90, align: "right" });
      addText(`${bill.additionalCharges.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
      
      if (bill.additionalChargeNote) {
        y += 15;
        doc.fontSize(8);
        addText(`(${bill.additionalChargeNote})`, 350, y, { width: 180, align: "right" });
      }
      y += 20;
    }

    // Total amount
    doc.fontSize(12);
    if (customFont) {
      doc.font(customFont + '-Bold');
    } else {
      doc.font('Helvetica-Bold');
    }
    addText("RAZEM DO ZAPŁATY:", 350, y, { width: 90, align: "right" });
    addText(`${bill.totalAmount} PLN`, 450, y, { width: 90, align: "right" });

    // Payment information
    // Translate payment status and method
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
        'other': 'INNE'
      };
      return methodMap[method] || method.toUpperCase();
    };
    
    doc.fontSize(10);
    if (customFont) {
      doc.font(customFont);
    } else {
      doc.font('Helvetica');
    }
    y += 30;
    addText(`Status płatności: ${translatePaymentStatus(bill.paymentStatus)}`, 50, y);
    addText(`Metoda płatności: ${translatePaymentMethod(bill.paymentMethod)}`, 50, y + 12);

    // Notes if any
    if (bill.notes) {
      y += 30;
      addText(`Uwagi: ${bill.notes}`, 50, y);
    }

    // Footer
    doc.fontSize(10);
    addText("Dziękujemy za wybór Centrum Medycznego dla Twoich potrzeb zdrowotnych.", 50, 750, { align: "center" });
    addText("W sprawie płatności, prosimy o kontakt: kontakt@centrummedyczne7.pl", 50, 765, { align: "center" });

    // Finalize the PDF
    doc.end();

    // Wait for the PDF to be created
    stream.on("finish", async () => {
      try {
        // Upload to cloudinary
        const result = await cloudinary.uploader.upload(tempFilePath, {
          folder: "invoices",
          resource_type: "raw",
        });

        // Remove the temp file
        fs.unlinkSync(tempFilePath);

        // Update bill with invoice URL if it doesn't have one yet
        if (!bill.invoiceUrl) {
          bill.invoiceUrl = result.secure_url;
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
      } catch (error) {
        console.error("Error uploading invoice to Cloudinary:", error);
        
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
    });

    // Handle errors during PDF creation
    stream.on("error", (error) => {
      console.error("Error generating invoice PDF:", error);
      return res.status(500).json({
        success: false,
        message: "Nie udało się wygenerować faktury",
        error: error.message,
      });
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
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
        message: "Invalid bill ID format"
      });
    }

    // Find the bill
    const bill = await PatientBill.findById(billId);

    if (!bill || bill.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Bill not found"
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
      message: "Bill details updated successfully",
      data: updatedBill
    });
  } catch (error) {
    console.error("Error updating bill details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update bill details",
      error: error.message
    });
  }
}; 