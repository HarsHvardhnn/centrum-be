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
      totalAmount,
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

    // Create a PDF document
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Faktura #${bill._id}`,
        Author: "Centrum Medyczne",
      },
    });

    // Pipe the PDF into a file
    const stream = fs.createWriteStream(tempFilePath);
    doc.pipe(stream);

    // Load logo
    const logoPath = path.join(__dirname, "../public/logo_teal.png");
    
    // Add content to PDF
    // Header with logo and title
    doc.image(logoPath, 30, 20, { width: 100 }) 
      .fontSize(20)
      .text("FAKTURA", 350, 50, { align: "right" })
      .fontSize(10)
      .text(`Faktura Nr: ${bill._id}`, { align: "right" })
      .text(`Data: ${new Date(bill.billedAt).toLocaleDateString('pl-PL')}`, { align: "right" });

    // Add horizontal line
    doc.moveDown(2)
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    // Hospital and billing info with correct details
    doc.fontSize(10)
      .moveDown(1)
      .text("Centrum Medyczne", 50, doc.y)
      .text("Powstańców Warszawy 7/1.5")
      .text("26-110 Skarżysko-Kamienna")
      .text("Nagłe przypadki: (+48) 797 097 487, (+48) 797 127 487")
      .text("Telefon: (+48) 797 097 487")
      .text("Email: kontakt@centrummedyczne7.pl");

    // Patient information
    doc.fontSize(12)
      .moveDown(2)
      .text("DANE PACJENTA:", 50, doc.y, { underline: true });
    
    doc.fontSize(10)
      .moveDown(0.5)
      .text(`Imię i Nazwisko: ${bill.patient?.name?.first || ""} ${bill.patient?.name?.last || ""}`)
      .text(`ID Pacjenta: ${bill.patient?.patientId || ""}`)
      .text(`Email: ${bill.patient?.email || ""}`)
      .text(`Telefon: ${bill.patient?.phone || ""}`);

    // Appointment details
    const appointmentDate = bill.appointment?.date ? 
      new Date(bill.appointment.date).toLocaleDateString('pl-PL') : "Brak danych";
    
    doc.fontSize(12)
      .moveDown(2)
      .text("SZCZEGÓŁY WIZYTY:", 50, doc.y, { underline: true });
    
    doc.fontSize(10)
      .moveDown(0.5)
      .text(`Data: ${appointmentDate}`)
      .text(`Godzina: ${bill.appointment?.startTime || "Brak danych"}`)
      .text(`Lekarz: ${bill.appointment?.doctor?.name?.first || ""} ${bill.appointment?.doctor?.name?.last || ""}`)
      .text(`Typ konsultacji: ${bill.appointment?.consultation?.consultationType || "Konsultacja ogólna"}`);

    // Bill items table header
    doc.fontSize(12)
      .moveDown(2)
      .text("SZCZEGÓŁY PŁATNOŚCI:", 50, doc.y, { underline: true });
    
    // Table headers
    doc.fontSize(10)
      .moveDown(1);
    
    const tableTop = doc.y;
    doc.font('Helvetica-Bold')
      .text("Pozycja", 50, tableTop)
      .text("Cena", 350, tableTop, { width: 90, align: "right" })
      .text("Status", 450, tableTop, { width: 90, align: "right" });
    
    // Add horizontal line
    doc.moveDown(0.5)
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .stroke();

    // Table rows for services
    doc.font('Helvetica');
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
      doc.text(consultationType, 50, y)
        .text(`${bill.consultationCharges.toFixed(2)} PLN`, 350, y, { width: 90, align: "right" })
        .text("zakończony", 450, y, { width: 90, align: "right" });
      y += 20;
    }
    
    bill.services.forEach((service) => {
      doc.text(service.title, 50, y)
        .text(`${service.price} PLN`, 350, y, { width: 90, align: "right" })
        .text(translateStatus(service.status), 450, y, { width: 90, align: "right" });
      y += 20;
    });

    // Add horizontal line
    doc.moveTo(50, y + 10)
      .lineTo(550, y + 10)
      .stroke();

    // Billing summary
    y += 30;
    doc.text("Suma częściowa:", 350, y, { width: 90, align: "right" })
      .text(`${bill.subtotal.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
    
    y += 20;
    if (bill.taxPercentage > 0) {
      doc.text(`Podatek VAT (${bill.taxPercentage}%):`, 350, y, { width: 90, align: "right" })
        .text(`${bill.taxAmount.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
      y += 20;
    }
    
    if (bill.discount > 0) {
      doc.text("Zniżka:", 350, y, { width: 90, align: "right" })
        .text(`-${bill.discount.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
      y += 20;
    }
    
    if (bill.additionalCharges > 0) {
      doc.text("Dodatkowe opłaty:", 350, y, { width: 90, align: "right" })
        .text(`${bill.additionalCharges.toFixed(2)} PLN`, 450, y, { width: 90, align: "right" });
      
      if (bill.additionalChargeNote) {
        y += 15;
        doc.fontSize(8)
          .text(`(${bill.additionalChargeNote})`, 350, y, { width: 180, align: "right" });
      }
      y += 20;
    }

    // Total amount
    doc.fontSize(12)
      .font('Helvetica-Bold')
      .text("RAZEM DO ZAPŁATY:", 350, y, { width: 90, align: "right" })
      .text(`${bill.totalAmount} PLN`, 450, y, { width: 90, align: "right" });

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
    
    doc.fontSize(10)
      .font('Helvetica')
      .moveDown(3)
      .text(`Status płatności: ${translatePaymentStatus(bill.paymentStatus)}`, 50, doc.y)
      .text(`Metoda płatności: ${translatePaymentMethod(bill.paymentMethod)}`);

    // Notes if any
    if (bill.notes) {
      doc.moveDown(1)
        .text(`Uwagi: ${bill.notes}`);
    }

    // Footer
    doc.fontSize(10)
      .text("Dziękujemy za wybór Centrum Medycznego dla Twoich potrzeb zdrowotnych.", 50, 700, { align: "center" })
      .text("W sprawie płatności, prosimy o kontakt: kontakt@centrummedyczne7.pl", { align: "center" });

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