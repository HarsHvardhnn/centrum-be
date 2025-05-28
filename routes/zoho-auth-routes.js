const express = require("express");
const router = express.Router();
const zohoAuthController = require("../controllers/zohoAuthController");
const { refreshAccessToken } = require("../config/zoho");
const { getMeetingsClient } = require("../utils/zohoMeetings");
const User = require("../models/user-entity/user");
// const authMiddleware = require("../middleware/authMiddleware");

// Route to get Zoho OAuth URL
router.get("/auth-url",  zohoAuthController.getZohoAuthUrl);

// Route to handle Zoho OAuth callback
router.get(
  "/oauth2callback",
  zohoAuthController.handleZohoCallback
);

// Test route to refresh access token
router.post("/test-refresh-token", async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: "Refresh token is required in request body"
      });
    }

    const tokens = await refreshAccessToken(refresh_token);
    
    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        access_token: tokens.access_token,
        expiry_date: new Date(tokens.expiry_date).toISOString()
      }
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to refresh token",
      error: error.message
    });
  }
});

// Test route to create a Zoho meeting
router.post("/test-create-meeting", async (req, res) => {
  try {
    const {
      topic = "Test Meeting",
      agenda = "Medical Consultation",
      startTime,
      duration = 3600000, // 1 hour in milliseconds
      timezone = "Europe/Warsaw",
      patientEmail,
      doctorEmail
    } = req.body;

    if (!startTime || !patientEmail || !doctorEmail) {
      return res.status(400).json({
        success: false,
        message: "startTime, patientEmail, and doctorEmail are required in request body"
      });
    }

    const admin = await   User.findOne({role: "admin"});

    const meetingsClient = await getMeetingsClient(admin._id);
    
    const meetingDetails = {
      session: {
        topic,
        agenda,
        presenter: 20105821462,
        startTime,
        // duration,
        timezone,
        participants: [
          {
            email: patientEmail
          },
          {
            email: doctorEmail
          }
        ]
      }
    };

    const meetingResponse = await meetingsClient.createMeeting(meetingDetails);
    
    if (!meetingResponse?.session?.joinLink) {
      throw new Error('Failed to get meeting join link from response');
    }

    return res.status(200).json({
      success: true,
      message: "Meeting created successfully",
      data: {
        joinLink: meetingResponse.session.joinLink,
        startLink: meetingResponse.session.startLink,
        meetingKey: meetingResponse.session.meetingKey,
        password: meetingResponse.session.pwd,
        startTime: meetingResponse.session.startTime,
        endTime: meetingResponse.session.endTime,
        topic: meetingResponse.session.topic
      }
    });
  } catch (error) {
    console.error("Error creating meeting:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create meeting",
      error: error.message
    });
  }
});

module.exports = router; 