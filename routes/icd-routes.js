/**
 * ICD-10 / ICD-9 search and admin import.
 * - GET /icd10/search?q=...
 * - GET /icd9/search?q=...
 * - POST /admin/icd10/import (admin only)
 * - POST /admin/icd9/import (admin only)
 */
const express = require("express");
const router = express.Router();
const icdController = require("../controllers/icdController");
const authorizeRoles = require("../middlewares/authenticateRole");

router.get("/icd10/search", authorizeRoles(["admin", "doctor", "receptionist"]), icdController.searchIcd10);
router.get("/icd9/search", authorizeRoles(["admin", "doctor", "receptionist"]), icdController.searchIcd9);

module.exports = router;
