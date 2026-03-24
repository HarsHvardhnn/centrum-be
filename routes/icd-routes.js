/**
 * ICD-10 / ICD-9 search and admin import.
 * - GET /icd10/search?q=...
 * - GET /icd9/search?q=...
 * - POST /api/icd/seed (unprotected – batch seed from JSON or CSV files)
 * - POST /admin/icd10/import (admin only)
 * - POST /admin/icd9/import (admin only)
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");
const icdController = require("../controllers/icdController");
const authorizeRoles = require("../middlewares/authenticateRole");

const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get("/icd10/search", authorizeRoles(["admin", "doctor", "receptionist"]), icdController.searchIcd10);
router.get("/icd9/search", authorizeRoles(["admin", "doctor", "receptionist"]), icdController.searchIcd9);

// Unprotected: batch seed ICD-10/ICD-9 from JSON body or CSV file uploads
router.post(
  "/icd/seed",
  memoryUpload.fields([{ name: "icd10", maxCount: 1 }, { name: "icd9", maxCount: 1 }]),
  icdController.seedIcdRealData
);

module.exports = router;
