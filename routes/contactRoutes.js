const express = require("express");
const router = express.Router();
const {
  createContact,
  getAllContacts,
  getContactById,
  updateContactStatus,
  deleteContact
} = require("../controllers/contactController");
const authorizeRoles = require("../middlewares/authenticateRole");

// Public route - anyone can create a contact message
router.post("/", createContact);

// Protected routes - only admin and receptionist can access
router.get("/", authorizeRoles(["admin", "receptionist"]), getAllContacts);
router.get("/:id", authorizeRoles(["admin", "receptionist"]), getContactById);
router.patch("/:id/status", authorizeRoles(["admin", "receptionist"]), updateContactStatus);
router.delete("/:id", authorizeRoles(["admin", "receptionist"]), deleteContact);

module.exports = router; 