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
const { upload, cloudinaryCategory } = require("../middlewares/cloudinaryUpload");
const User = require("../models/user-entity/user");

router.post("/receptionists", authorizeRoles(["admin"]), addReceptionist);

router.patch(
  "/users/:userId/delete",
  authorizeRoles(["admin","receptionist","doctor"]),
  markUserDeleted
);
router.patch("/users/:userId/revive", authorizeRoles(["admin","receptionist","doctor"]), unMarkDeleted);

router.get("/users/non-admins",   authorizeRoles(["admin", "receptionist","doctor"]), getAllNonAdminUsers);
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


router.post("/upload-file", authorizeRoles(["admin","doctor","receptionist"]), cloudinaryCategory("admin"), upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "Nie udało się przesłać pliku" });
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
        message: "Nie udało się przesłać pliku",
        error: error.message,
      });
  }
});



router.get("/users", authorizeRoles(["admin","receptionist","doctor"]), async (req, res) => {
  try {
    // Parse query parameters with defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || "createdAt";
    console.log("soqieryt",req.query)
    const order = req.query.order === "asc" ? 1 : -1;
    const search = req.query.search || "";
    const role = req.query.role || "";

    // Validate page and limit values
    if (page < 1 || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Nieprawidłowe parametry stronicowania. Strona musi być >= 1 i limit musi być między 1 a 100.",
      });
    }

    // Build query filter
    const filter = { deleted: false };

    // Add role filter if provided
    if (role) {
      filter.role = role;
    }

    // Helper function to escape regex special characters
    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Add search filter if provided
    if (search) {
      const searchTerm = search.trim();
      const escapedSearch = escapeRegex(searchTerm.toLowerCase());
      
      filter.$or = [
        { 
          $expr: {
            $regexMatch: {
              input: { $toLower: { $concat: ["$name.first", " ", "$name.last"] } },
              regex: escapedSearch,
              options: "i"
            }
          }
        },
        { email: { $regex: escapedSearch, $options: "i" } },
        { phone: { $regex: escapedSearch, $options: "i" } }
      ];
    }

    // Set up sort options
    const sortOptions = {};
    sortOptions[sort] = order;

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and only select needed fields
    const users = await User.find(filter)
      .select("name email phone role smsConsentAgreed")
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance as we don't need full document instances

    // Count total documents for pagination metadata
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    // Return formatted users with pagination metadata
    return res.status(200).json({
      success: true,
      data: {
        users: users.map((user) => ({
          id: user._id,
          name: `${user.name.first} ${user.name.last}`,
          email: user.email,
          phone: user.phone || "Not provided",
          role: user.role,
          smsConsentAgreed: user.smsConsentAgreed,
        })),
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format danych wyszukiwania",
      });
    }
    
    if (error.message && error.message.includes('regex')) {
      return res.status(400).json({
        success: false,
        message: "Nieprawidłowy format wyszukiwania. Sprawdź wprowadzone dane.",
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Wystąpił błąd serwera podczas pobierania użytkowników. Spróbuj ponownie.",
    });
  }
});


module.exports = router;
