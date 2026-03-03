/**
 * Admin ICD import (mount under /admin).
 * POST /admin/icd10/import
 * POST /admin/icd9/import
 * Body: JSON { items: [{ code, full_name }] } or CSV file (multipart).
 */
const express = require("express");
const router = express.Router();
const multer = require("multer");
const icdController = require("../controllers/icdController");
const authorizeRoles = require("../middlewares/authenticateRole");

const memoryUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post(
  "/icd10/import",
  authorizeRoles(["admin"]),
  memoryUpload.single("file"),
  icdController.importIcd10
);
router.post(
  "/icd9/import",
  authorizeRoles(["admin"]),
  memoryUpload.single("file"),
  icdController.importIcd9
);

module.exports = router;
