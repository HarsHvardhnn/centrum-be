/**
 * Visit (appointment) diagnoses: add, list, delete.
 * visitId = appointment _id.
 */
const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const VisitDiagnosis = require("../models/visitDiagnosis");
const { getVisitMedicalCodes } = require("../services/visitMedicalCodesService");

/**
 * POST /appointments/:visitId/diagnoses
 * Body: { code, name, isPrimary }
 * If isPrimary true, unset previous primary for this visit.
 */
exports.addDiagnosis = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { code, name, isPrimary } = req.body || {};
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return res.status(400).json({ success: false, message: "Invalid visit ID" });
    }
    const visit = await Appointment.findById(visitId).lean();
    if (!visit) {
      return res.status(404).json({ success: false, message: "Visit not found" });
    }
    const codeStr = (code || "").toString().trim();
    const nameStr = (name || "").toString().trim();
    if (!codeStr || !nameStr) {
      return res.status(400).json({ success: false, message: "code and name are required" });
    }
    if (isPrimary === true) {
      await VisitDiagnosis.updateMany(
        { visit_id: visitId },
        { $set: { is_primary: false } }
      );
    }
    const doc = await VisitDiagnosis.create({
      visit_id: visitId,
      icd10_code: codeStr,
      icd10_name: nameStr,
      is_primary: !!isPrimary,
    });
    res.status(201).json({
      success: true,
      data: {
        id: doc._id,
        visitId: doc.visit_id,
        code: doc.icd10_code,
        name: doc.icd10_name,
        isPrimary: doc.is_primary,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    console.error("Add visit diagnosis error:", err);
    res.status(500).json({ success: false, message: "Failed to add diagnosis", error: err.message });
  }
};

/**
 * GET /appointments/:visitId/diagnoses
 */
exports.getDiagnoses = async (req, res) => {
  try {
    const { visitId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return res.status(400).json({ success: false, message: "Invalid visit ID" });
    }
    const list = await VisitDiagnosis.find({ visit_id: visitId })
      .sort({ is_primary: -1, createdAt: 1 })
      .lean();
    const data = list.map((d) => ({
      id: d._id,
      visitId: d.visit_id,
      code: d.icd10_code,
      name: d.icd10_name,
      isPrimary: d.is_primary,
      createdAt: d.createdAt,
    }));
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get visit diagnoses error:", err);
    res.status(500).json({ success: false, message: "Failed to get diagnoses", error: err.message });
  }
};

/**
 * DELETE /appointments/:visitId/diagnoses/:diagnosisId
 */
exports.deleteDiagnosis = async (req, res) => {
  try {
    const { visitId, diagnosisId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(visitId) || !mongoose.Types.ObjectId.isValid(diagnosisId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const doc = await VisitDiagnosis.findOneAndDelete({
      _id: diagnosisId,
      visit_id: visitId,
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Diagnosis not found" });
    }
    res.status(200).json({ success: true, message: "Diagnosis removed" });
  } catch (err) {
    console.error("Delete visit diagnosis error:", err);
    res.status(500).json({ success: false, message: "Failed to delete diagnosis", error: err.message });
  }
};

/**
 * GET /appointments/:visitId/medical-codes
 * Returns { diagnoses: [...], procedures: [...] } for PDF export / display.
 */
exports.getMedicalCodes = async (req, res) => {
  try {
    const { visitId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return res.status(400).json({ success: false, message: "Invalid visit ID" });
    }
    const data = await getVisitMedicalCodes(visitId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get visit medical codes error:", err);
    res.status(500).json({ success: false, message: "Failed to get medical codes", error: err.message });
  }
};
