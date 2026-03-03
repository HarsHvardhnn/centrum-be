/**
 * Visit (appointment) procedures: add, list, delete.
 * visitId = appointment _id.
 */
const mongoose = require("mongoose");
const Appointment = require("../models/appointment");
const VisitProcedure = require("../models/visitProcedure");

/**
 * POST /appointments/:visitId/procedures
 * Body: { code, name }
 */
exports.addProcedure = async (req, res) => {
  try {
    const { visitId } = req.params;
    const { code, name } = req.body || {};
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
    const doc = await VisitProcedure.create({
      visit_id: visitId,
      icd9_code: codeStr,
      icd9_name: nameStr,
    });
    res.status(201).json({
      success: true,
      data: {
        id: doc._id,
        visitId: doc.visit_id,
        code: doc.icd9_code,
        name: doc.icd9_name,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    console.error("Add visit procedure error:", err);
    res.status(500).json({ success: false, message: "Failed to add procedure", error: err.message });
  }
};

/**
 * GET /appointments/:visitId/procedures
 */
exports.getProcedures = async (req, res) => {
  try {
    const { visitId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(visitId)) {
      return res.status(400).json({ success: false, message: "Invalid visit ID" });
    }
    const list = await VisitProcedure.find({ visit_id: visitId })
      .sort({ createdAt: 1 })
      .lean();
    const data = list.map((d) => ({
      id: d._id,
      visitId: d.visit_id,
      code: d.icd9_code,
      name: d.icd9_name,
      createdAt: d.createdAt,
    }));
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Get visit procedures error:", err);
    res.status(500).json({ success: false, message: "Failed to get procedures", error: err.message });
  }
};

/**
 * DELETE /appointments/:visitId/procedures/:procedureId
 */
exports.deleteProcedure = async (req, res) => {
  try {
    const { visitId, procedureId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(visitId) || !mongoose.Types.ObjectId.isValid(procedureId)) {
      return res.status(400).json({ success: false, message: "Invalid ID" });
    }
    const doc = await VisitProcedure.findOneAndDelete({
      _id: procedureId,
      visit_id: visitId,
    });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Procedure not found" });
    }
    res.status(200).json({ success: true, message: "Procedure removed" });
  } catch (err) {
    console.error("Delete visit procedure error:", err);
    res.status(500).json({ success: false, message: "Failed to delete procedure", error: err.message });
  }
};
