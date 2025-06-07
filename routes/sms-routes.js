const express = require("express");
const router = express.Router();

const { v4: uuidv4 } = require("uuid");
const { sendSMS } = require("../utils/smsapi");
const MessageReceipt = require("../models/smsData");
const User = require("../models/user-entity/user");

// Route to send SMS
router.post("/send-sms", async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    // Validate input
    if (!phoneNumber || !message) {
      return res
        .status(400)
        .json({ error: "Telefon i wiadomość są wymagane" });
    }

    // Send SMS
    const result = await sendSMS(phoneNumber, message);

    if (result.success) {
      return res
        .status(200)
        .json({ success: true, messageId: result.messageId });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error("Error in send-sms route:", error);
    return res.status(500).json({ error: "Błąd serwera wewnętrznego" });
  }
});

// Route to send bulk SMS


// Helper function to create receipt records
async function createMessageReceipt(recipient, content, batchId) {
  try {
    return await MessageReceipt.create({
      content,
      batchId,
      recipient: {
        userId: recipient.userId || null,
        phone: recipient.phone
      },
      status: 'PENDING'
    });
  } catch (error) {
    console.error('Error creating message receipt:', error);
    // We'll continue even if receipt creation fails
    return null;
  }
}

// Helper function to update receipt status
async function updateReceiptStatus(receipt, status, result = {}) {
  try {
    if (!receipt) return;
    
    const update = { status };
    
    if (status === 'DELIVERED') {
      update.messageId = result.messageId;
      update.sentAt = new Date();
      update.deliveredAt = new Date();
      update.providerResponse = result.providerResponse || null;
    } else if (status === 'FAILED') {
      update.failedAt = new Date();
      update.error = {
        code: result.errorCode || 'UNKNOWN',
        message: result.error?.message || result.error || 'Unknown error'
      };
      update.providerResponse = result.providerResponse || null;
    }
    
    await MessageReceipt.findByIdAndUpdate(receipt._id, update);
  } catch (error) {
    console.error('Błąd aktualizacji reklamacji wiadomości:', error);
    // We'll continue even if receipt update fails
  }
}

// Updated bulk SMS endpoint with receipt tracking
router.post("/send-bulk-sms", async (req, res) => {
  try {
    const { recipients, content } = req.body;
    console.log("recipients", recipients, content);

    // Validate input
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Co najmniej jeden odbiorca jest wymagany",
        sent: [],
        failed: [],
      });
    }

    if (!content || content.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Treść wiadomości jest wymagana",
        sent: [],
        failed: [],
      });
    }

    // Generate a batch ID for this group of messages
    const batchId = uuidv4();
    
    // Arrays to track results
    const sent = [];
    const failed = [];

    // Send SMS to each recipient
    for (const recipient of recipients) {
      let receipt = null;
      
      try {
        receipt = await createMessageReceipt(recipient, content, batchId);
        console.log("receipt", receipt);
        
        // Validate phone number
        if (!recipient.phone || recipient.phone.trim() === "") {
          await updateReceiptStatus(receipt, 'FAILED', {
            error: 'Nieprawidłowy numer telefonu: pusty lub brakujący'
          });
          
          failed.push({
            userId: recipient.userId,
            phone: recipient.phone || "Unknown",
            reason: "Nieprawidłowy numer telefonu: pusty lub brakujący",
          });
          continue;
        }

        let smsConsentAgreed = false;
        if (recipient.userId) {
          try {
            const user = await User.findById(recipient.userId);
            if (user) {
              console.log("user", user);
              smsConsentAgreed = user.smsConsentAgreed || false;
              console.log("smsConsentAgreed", smsConsentAgreed);
            }
          } catch (userFetchError) {
            console.error("Error fetching user:", userFetchError);
            smsConsentAgreed = false;
          }
        }
        console.log("smsConsentAgreed", smsConsentAgreed);

        // Check SMS consent
        if (!smsConsentAgreed) {
          await updateReceiptStatus(receipt, 'FAILED', {
            error: 'Użytkownik nie wyraził zgody na otrzymywanie wiadomości SMS'
          });
          
          failed.push({
            userId: recipient.userId,
            phone: recipient.phone,
            reason: "Użytkownik nie wyraził zgody na otrzymywanie wiadomości SMS",
          });
          continue;
        }

        const result = await sendSMS(recipient.phone, content);

        if (result.success) {
          await updateReceiptStatus(receipt, 'DELIVERED', {
            messageId: result.messageId,
            providerResponse: result.providerResponse
          });
          
          sent.push({
            userId: recipient.userId,
            phone: recipient.phone,
            messageId: result.messageId,
          });
        } else {
          await updateReceiptStatus(receipt, 'FAILED', {
            error: result.error?.message || result.error || "Unknown error",
            providerResponse: result.providerResponse
          });
          
          failed.push({
            userId: recipient.userId,
            phone: recipient.phone,
            reason: result.error?.message || result.error || "Unknown error",
          });
        }
      } catch (recipientError) {
        // Handle errors for individual recipients
        await updateReceiptStatus(receipt, 'FAILED', {
          error: recipientError.message || "Unknown error during processing"
        });
        
        failed.push({
          userId: recipient.userId,
          phone: recipient.phone || "Unknown",
          reason: recipientError.message || "Unknown error during processing",
        });
      }
    }

    // Return comprehensive results
    return res.status(200).json({
      success: true,
      message: `Pomyślnie wysłano ${sent.length} wiadomości, nie udało się wysłać ${failed.length} wiadomości`,
      batchId, // Return the batch ID for reference
      stats: {
        total: recipients.length,
        sent: sent.length,
        failed: failed.length,
      },
      sent,
      failed,
    });
  } catch (error) {
    console.error("Error in send-bulk-sms route:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd serwera wewnętrznego podczas przetwarzania partii SMS",
      error: error.message,
      sent: [],
      failed: [],
    });
  }
});

// New endpoint to query message receipts
router.get("/message-receipts", async (req, res) => {
  try {
    const { 
      batchId, 
      userId, 
      phone, 
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = req.query;
    
    const query = {};
    
    // Apply filters
    if (batchId) query.batchId = batchId;
    if (userId) query['recipient.userId'] = userId;
    if (phone) query['recipient.phone'] = phone;
    if (status) query.status = status.toUpperCase();
    
    // Date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const receipts = await MessageReceipt.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
    const total = await MessageReceipt.countDocuments(query);
    
    return res.status(200).json({
      success: true,
      data: {
        receipts,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error("Error fetching message receipts:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd serwera wewnętrznego podczas pobierania reklamacji wiadomości",
      error: error.message
    });
  }
});

// Get receipt details by ID
router.get("/message-receipts/:id", async (req, res) => {
  try {
    const receipt = await MessageReceipt.findById(req.params.id);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        message: "Reklamacja wiadomości nie znaleziona"
      });
    }
    
    return res.status(200).json({
      success: true,
      data: receipt
    });
  } catch (error) {
    console.error("Error fetching message receipt:", error);
    return res.status(500).json({
      success: false,
      message: "Błąd serwera wewnętrznego podczas pobierania reklamacji wiadomości",
      error: error.message
    });
  }
});


// Improved SMS sending function with better error handling

module.exports = router;
