/**
 * Visit procedure (ICD-9). Links a visit (appointment) to a procedure.
 * Stores code + name so history remains intact if ICD-9 master data changes.
 */
const mongoose = require("mongoose");

const visitProcedureSchema = new mongoose.Schema(
  {
    visit_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    icd9_code: { type: String, required: true, trim: true },
    icd9_name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

visitProcedureSchema.index({ visit_id: 1 });

module.exports = mongoose.model("VisitProcedure", visitProcedureSchema);
