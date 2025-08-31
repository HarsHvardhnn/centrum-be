const mongoose = require("mongoose");
const Patient = require("../models/user-entity/patient");
const Appointment = require("../models/appointment");
const { generateSignedUrl } = require("../utils/generateSignedUrl");

/**
 * Generate a fresh signed URL for a document using its public ID
 * @param {Object} req - Request object with publicId in query
 * @param {Object} res - Response object
 */
exports.getSignedUrl = async (req, res) => {
  try {
    const { publicId } = req.query;
    
    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required as a query parameter"
      });
    }

    // Optional: Specify expiration time in minutes through query param (default: 60 minutes)
    const expirationMinutes = req.query.expiration ? parseInt(req.query.expiration) : 60;
    
    // Generate a signed URL with the specified expiration
    const expiresAt = Math.floor(Date.now() / 1000) + (expirationMinutes * 60);
    
    // Remove file extension from publicId if present (Cloudinary doesn't want it in the publicId)
    let cleanPublicId = publicId;
    const commonExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.txt'];
    for (const ext of commonExtensions) {
      if (cleanPublicId.endsWith(ext)) {
        cleanPublicId = cleanPublicId.substring(0, cleanPublicId.length - ext.length);
        break;
      }
    }
    
    // Determine resource type based on the public ID or original extension
    const resourceType = publicId.includes('/secure_documents/') || 
                        publicId.endsWith('.pdf') || 
                        publicId.endsWith('.doc') || 
                        publicId.endsWith('.docx') || 
                        publicId.endsWith('.txt') 
                        ? 'raw' : 'image';
    
    const signedUrl = generateSignedUrl(cleanPublicId, { 
      expiresAt,
      resourceType
    });

    return res.status(200).json({
      success: true,
      data: {
        url: signedUrl,
        publicId,
        expiresAt
      }
    });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate signed URL",
      error: error.message
    });
  }
};

/**
 * Get a patient document with a fresh signed URL
 * @param {Object} req - Request object with patientId and documentId in params
 * @param {Object} res - Response object
 */
exports.getPatientDocument = async (req, res) => {
  try {
    const { patientId, documentId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid patient ID format"
      });
    }

    // Find the patient and the specific document
    const patient = await Patient.findById(patientId);
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Find the document in the patient's documents array
    const document = patient.documents.find(doc => 
      doc._id.toString() === documentId || doc.documentId?.toString() === documentId
    );

    if (!document) {
      return res.status(404).json({
        success: false,
        message: "Document not found"
      });
    }

    // If the document requires a signed URL and has a public ID, generate a fresh one
    if (document.requiresSignedUrl && document.publicId) {
      // Default to 60 minutes expiration
      const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60);
      const signedUrl = generateSignedUrl(document.publicId, { expiresAt });
      
      // Return the document with the fresh signed URL
      return res.status(200).json({
        success: true,
        data: {
          ...document.toObject(),
          url: signedUrl,
          downloadUrl: signedUrl,
          preview: signedUrl,
          urlExpiresAt: expiresAt
        }
      });
    }
    
    // If it's a public document or doesn't have a public ID, return as is
    return res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error("Error retrieving patient document:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve document",
      error: error.message
    });
  }
};

/**
 * Get a visit card or other report from an appointment with a fresh signed URL
 * @param {Object} req - Request object with appointmentId and reportId in params
 * @param {Object} res - Response object
 */
exports.getAppointmentReport = async (req, res) => {
  try {
    const { appointmentId, reportId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid appointment ID format"
      });
    }

    // Find the appointment and the specific report
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found"
      });
    }

    // Find the report in the appointment's reports array
    const report = appointment.reports?.find(rep => 
      rep._id.toString() === reportId || rep.documentId?.toString() === reportId
    );

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found"
      });
    }

    // If the report requires a signed URL and has a public ID, generate a fresh one
    if (report.requiresSignedUrl && report.publicId) {
      // Default to 60 minutes expiration
      const expiresAt = Math.floor(Date.now() / 1000) + (60 * 60);
      const signedUrl = generateSignedUrl(report.publicId, { expiresAt });
      
      // Return the report with the fresh signed URL
      return res.status(200).json({
        success: true,
        data: {
          ...report.toObject(),
          url: signedUrl,
          downloadUrl: signedUrl,
          preview: signedUrl,
          urlExpiresAt: expiresAt
        }
      });
    }
    
    // If it's a public report or doesn't have a public ID, return as is
    return res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error("Error retrieving appointment report:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve report",
      error: error.message
    });
  }
};
