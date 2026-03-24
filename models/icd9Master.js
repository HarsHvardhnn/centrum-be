/**
 * ICD-9 Master (procedures). Dataset imported via admin import; used for autocomplete search.
 * ~4k rows expected. Indexes on code and full_name for fast prefix/substring search.
 */
const mongoose = require("mongoose");

const icd9MasterSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    full_name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

icd9MasterSchema.index({ code: 1 });
icd9MasterSchema.index({ full_name: 1 });
icd9MasterSchema.index({ code: 1, full_name: 1 });

module.exports = mongoose.model("Icd9Master", icd9MasterSchema);
