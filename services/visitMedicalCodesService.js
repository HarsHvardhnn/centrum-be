/**
 * Helper for PDF export: get all diagnoses and procedures for a visit (appointment).
 * Used when generating visit PDF.
 * @param {string} visitId - Appointment _id
 * @returns { Promise<{ diagnoses: Array<{ code, name, isPrimary }>, procedures: Array<{ code, name }> }> }
 */
const VisitDiagnosis = require("../models/visitDiagnosis");
const VisitProcedure = require("../models/visitProcedure");
const mongoose = require("mongoose");

async function getVisitMedicalCodes(visitId) {
  if (!visitId || !mongoose.Types.ObjectId.isValid(visitId)) {
    return { diagnoses: [], procedures: [] };
  }
  const [diagnoses, procedures] = await Promise.all([
    VisitDiagnosis.find({ visit_id: visitId }).sort({ is_primary: -1, createdAt: 1 }).lean(),
    VisitProcedure.find({ visit_id: visitId }).sort({ createdAt: 1 }).lean(),
  ]);
  return {
    diagnoses: diagnoses.map((d) => ({
      code: d.icd10_code,
      name: d.icd10_name,
      isPrimary: !!d.is_primary,
    })),
    procedures: procedures.map((p) => ({
      code: p.icd9_code,
      name: p.icd9_name,
    })),
  };
}

module.exports = { getVisitMedicalCodes };
