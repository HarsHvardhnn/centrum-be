const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const authenticateRole = require("../middlewares/authenticateRole");
const {
  createSmsTemplate,
  getAllSmsTemplates,
  getSmsTemplateById,
  updateSmsTemplate,
  deleteSmsTemplate,
  getActiveSmsTemplates,
  toggleSmsTemplateStatus,
} = require("../controllers/smsTemplateController");

// Validation middleware
const validateSmsTemplate = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Tytuł jest wymagany i musi mieć od 1 do 100 znaków"),
  body("description")
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage("Opis jest wymagany i musi mieć od 1 do 500 znaków"),
];

// Create SMS Template (Admin only)
router.post(
  "/",
  authenticateRole(["admin"]),
  validateSmsTemplate,
  createSmsTemplate
);

// Get All SMS Templates (Admin only)
router.get("/", authenticateRole(["admin"]), getAllSmsTemplates);

// Get Active SMS Templates (Available to all authenticated users)
router.get("/active", authenticateRole(["admin", "doctor", "receptionist"]), getActiveSmsTemplates);

// Get SMS Template by ID (Admin only)
router.get("/:id", authenticateRole(["admin"]), getSmsTemplateById);

// Update SMS Template (Admin only)
router.put(
  "/:id",
  authenticateRole(["admin"]),
  validateSmsTemplate,
  updateSmsTemplate
);

// Delete SMS Template (Admin only)
router.delete("/:id", authenticateRole(["admin"]), deleteSmsTemplate);

// Toggle SMS Template Status (Admin only)
router.patch("/:id/toggle", authenticateRole(["admin"]), toggleSmsTemplateStatus);

module.exports = router; 