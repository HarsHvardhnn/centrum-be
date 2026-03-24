/**
 * ICD-10 Master (diagnoses). Dataset imported via admin import; used for autocomplete search.
 * ~70k rows expected. Indexes on code and full_name for fast prefix/substring search.
 */
const mongoose = require("mongoose");

const icd10MasterSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    full_name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

icd10MasterSchema.index({ code: 1 });
icd10MasterSchema.index({ full_name: 1 });
// Optional: compound for "starts with code or name contains query" in one query
icd10MasterSchema.index({ code: 1, full_name: 1 });

module.exports = mongoose.model("Icd10Master", icd10MasterSchema);
