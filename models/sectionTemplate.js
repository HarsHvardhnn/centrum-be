/**
 * Section template: reusable content for a single visit documentation field.
 * Used by "Wybierz szablon…" per section (Wywiad, Badanie przedmiotowe, etc.).
 * All user-facing names (name) must be stored in Polish.
 */
const mongoose = require("mongoose");

const SECTION_KEYS = ["interview", "physicalExamination", "treatment", "recommendations", "notes"];
const SECTION_LABELS_PL = {
  interview: "Wywiad z pacjentem",
  physicalExamination: "Badanie przedmiotowe",
  treatment: "Zastosowane leczenie",
  recommendations: "Zalecenia",
  notes: "Notatki",
};

const sectionTemplateSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Section this template applies to. One of: interview | physicalExamination | treatment | recommendations | notes */
    sectionKey: { type: String, required: true, enum: SECTION_KEYS },
    /** Template name shown in UI (Polish), e.g. "Wywiad chirurgiczny" */
    name: { type: String, required: true, trim: true },
    /** Template body (plain or structured text). Inserted into the section when selected. */
    content: { type: String, default: "" },
  },
  { timestamps: true }
);

sectionTemplateSchema.index({ doctorId: 1, sectionKey: 1 });
sectionTemplateSchema.index({ doctorId: 1 });

module.exports = mongoose.model("SectionTemplate", sectionTemplateSchema);
module.exports.SECTION_KEYS = SECTION_KEYS;
module.exports.SECTION_LABELS_PL = SECTION_LABELS_PL;
