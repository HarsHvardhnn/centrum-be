// routes/userRoutes.js

const express = require("express");
const router = express.Router();
const {
  addReceptionist,
  markUserDeleted,
  getAllNonAdminUsers,
  unMarkDeleted,
  getUserById,
  chatHistory,
} = require("../controllers/adminController");
const {
  getSpecializations,
  getSpecialization,
  createSpecialization,
  updateSpecialization,
  deleteSpecialization,
} = require("../controllers/specializationController");

const authorizeRoles = require("../middlewares/authenticateRole");
const {upload} = require("../middlewares/cloudinaryUpload");

router.post("/receptionists", authorizeRoles(["admin"]), addReceptionist);

router.patch(
  "/users/:userId/delete",
  authorizeRoles(["admin"]),
  markUserDeleted
);
router.patch("/users/:userId/revive", authorizeRoles(["admin"]), unMarkDeleted);

router.get("/users/non-admins", authorizeRoles(["admin"]), getAllNonAdminUsers);
router.get("/users/:id", authorizeRoles(["admin"]), getUserById);
router.get(
  "/history/chats",
  authorizeRoles(["admin", "doctor", "receptionist"]),
  chatHistory
);

router.get("/specs", getSpecializations);
router.post("/specs", authorizeRoles(["admin"]), createSpecialization);

router.get("/specs/:id", authorizeRoles(["admin"]), getSpecialization);
router.put("/specs/:id", authorizeRoles(["admin"]), updateSpecialization);
router.delete("/specs/:id", authorizeRoles(["admin"]), deleteSpecialization);


router.post("/upload-file", authorizeRoles(["admin","doctor","receptionist"]), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileInfo = {
      filename: file.filename || file.public_id || "", // fallback
      originalName: file.originalname,
      path: file.path,
      mimetype: file.mimetype,
      size: file.size,
      uploadDate: Date.now(), // or new Date()
    };

    res.status(200).json({ success: true, file: fileInfo });
  } catch (error) {
    console.error("Upload error:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "File upload failed",
        error: error.message,
      });
  }
});

module.exports = router;
