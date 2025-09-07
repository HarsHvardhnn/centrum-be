const patient = require("../models/user-entity/patient");
const mongoose = require("mongoose");

/**
 * Get SMS consent status for a patient
 * @route GET /api/sms-consent/:userId
 * @access Private
 */
exports.getSmsConsentStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate user ID format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Find the patient
    const patientData = await patient.findById(userId);
    
    if (!patientData) {
      return res.status(404).json({
        success: false,
        message: "Patient not found"
      });
    }

    // Return SMS consent status
    return res.status(200).json({
      success: true,
      smsConsentAgreed: patientData.smsConsentAgreed || false
    });
  } catch (error) {
    console.error("Error fetching SMS consent status:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching SMS consent status",
      error: error.message
    });
  }
};
