/**
 * Global visit template: predefined structure of an entire visit (multiple sections).
 * Used by "Załaduj szablon globalny" to fill all sections at once.
 * All user-facing names (name) must be stored in Polish.
 */
const mongoose = require("mongoose");

const SECTION_KEYS = ["interview", "physicalExamination", "treatment", "recommendations", "notes"];

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
  },
  { timestamps: true }
);

globalVisitTemplateSchema.index({ doctorId: 1 });

module.exports = mongoose.model("GlobalVisitTemplate", globalVisitTemplateSchema);
module.exports.SECTION_KEYS = SECTION_KEYS;
