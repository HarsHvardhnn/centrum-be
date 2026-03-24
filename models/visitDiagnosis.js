/**
 * Visit diagnosis (ICD-10). Links a visit (appointment) to a diagnosis.
 * Stores code + name so history remains intact if ICD-10 master data changes.
 */
const mongoose = require("mongoose");

const visitDiagnosisSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    icd10_code: { type: String, required: true, trim: true },
    icd10_name: { type: String, required: true, trim: true },
    is_primary: { type: Boolean, default: false },
  },
  { timestamps: true }
);

visitDiagnosisSchema.index({ visit_id: 1 });

module.exports = mongoose.model("VisitDiagnosis", visitDiagnosisSchema);
