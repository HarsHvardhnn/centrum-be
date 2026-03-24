/**
 * Visit documentation templates API.
 * - Section templates: one field (e.g. Wywiad, Badanie przedmiotowe). "Wybierz szablon…" per section.
 * - Global templates: full visit structure. "Załaduj szablon globalny" at top of visit card.
 * Auth: doctor (own) or admin (optional ?doctorId= for admin).
 */
const express = require("express");
const router = express.Router();
const visitTemplatesController = require("../controllers/visitTemplatesController");
const authorizeRoles = require("../middlewares/authenticateRole");

const doctorOrAdmin = authorizeRoles(["doctor", "admin"]);

router.get("/sections/keys", doctorOrAdmin, visitTemplatesController.getSectionKeys);

router.get("/sections", doctorOrAdmin, visitTemplatesController.listSectionTemplates);
router.post("/sections", doctorOrAdmin, visitTemplatesController.createSectionTemplate);
router.patch("/sections/:id", doctorOrAdmin, visitTemplatesController.updateSectionTemplate);
router.delete("/sections/:id", doctorOrAdmin, visitTemplatesController.deleteSectionTemplate);

router.get("/global", doctorOrAdmin, visitTemplatesController.listGlobalTemplates);
router.post("/global", doctorOrAdmin, visitTemplatesController.createGlobalTemplate);
router.patch("/global/:id", doctorOrAdmin, visitTemplatesController.updateGlobalTemplate);
router.delete("/global/:id", doctorOrAdmin, visitTemplatesController.deleteGlobalTemplate);

module.exports = router;
