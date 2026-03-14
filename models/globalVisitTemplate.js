/**
 * Global visit template: predefined structure of an entire visit (multiple sections).
 * Used by "Załaduj szablon globalny" to fill all sections at once.
 * All user-facing names (name) must be stored in Polish.
 * Includes optional ICD-10 diagnoses and ICD-9 procedures to pre-fill when loading the template.
 */
const mongoose = require("mongoose");

const SECTION_KEYS = ["interview", "physicalExamination", "treatment", "recommendations", "notes"];

/** ICD-10 diagnosis entry for template (Rozpoznanie) */
const diagnosisEntrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

/** ICD-9 procedure entry for template (Procedury) */
const procedureEntrySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const globalVisitTemplateSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Template name shown in UI (Polish), e.g. "Konsultacja chirurgiczna" */
    name: { type: String, required: true, trim: true },
    /** Content per section. Keys match Appointment.consultation + notes (consultationNotes). */
    sections: {
      interview: { type: String, default: "" },
      physicalExamination: { type: String, default: "" },
      treatment: { type: String, default: "" },
      recommendations: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
    /** ICD-10 diagnoses (Rozpoznanie) to apply when loading this template. */
    diagnoses: {
      type: [diagnosisEntrySchema],
      default: [],
    },
    /** ICD-9 procedures (Procedury) to apply when loading this template. */
    procedures: {
      type: [procedureEntrySchema],
      default: [],
    },
  },
  { timestamps: true }
);

globalVisitTemplateSchema.index({ doctorId: 1 });

module.exports = mongoose.model("GlobalVisitTemplate", globalVisitTemplateSchema);
module.exports.SECTION_KEYS = SECTION_KEYS;
