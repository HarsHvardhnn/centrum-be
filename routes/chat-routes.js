// In your routes file (e.g., chatRoutes.js)
const express = require("express");
const router = express.Router();
const authorizeRoles = require("../middlewares/authenticateRole");
const user = require("../models/user-entity/user");
const chatRoom = require("../models/chatRoom");
const { upload } = require("../middlewares/cloudinaryUpload");

// Get chat for regular user
router.get("/user-chat", authorizeRoles(["admin","doctor","receptionist"]), async (req, res) => {
  try {
    const userId = req.user.id;

    // Find admin user
    const admin = await user.findOne({ role: "admin" });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Find or create chat room
    let chat = await chatRoom.findOne({ user: userId, admin: admin._id })
      .populate("admin", "name profilePicture")
      // .populate("messages.sender", "name");

    if (!chat) {
      chat = new chatRoom({
        user: userId,
        admin: admin._id,
        messages: [],
      });
      await chat.save();
    }

    res.json({ chat });
  } catch (error) {
    console.error("Error fetching user chat:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all chats for admin
router.get(
  "/admin-chats",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Check if user is admin
      const adminUser = await user.findOne({ _id: userId, role: "admin" });
      if (!adminUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all chats where this user is the admin
    const chats = await chatRoom.find({ 
    admin: userId, 
    user: { $ne: userId } // exclude chats where user and admin are the same
})
.populate("user", "name profilePicture")
.sort({ updatedAt: -1 }); 

      res.json({ chats });
    } catch (error) {
      console.error("Error fetching admin chats:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);


router.post("/upload", authorizeRoles(["admin","doctor","receptionist"]), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Cloudinary automatically uploads the file through the multer-storage-cloudinary middleware
    // The file URL is available at req.file.path
    return res.status(200).json({
      message: "File uploaded successfully",
      fileUrl: req.file.path,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
    });
  } catch (error) {
    console.error("File upload error:", error);
    return res
      .status(500)
      .json({ message: "File upload failed", error: error.message });
  }
});
module.exports = router;

// In your main app.js or server.js

