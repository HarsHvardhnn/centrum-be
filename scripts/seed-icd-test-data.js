/**
 * Optional seed: insert a few ICD-10 and ICD-9 codes for testing.
 * Run: node scripts/seed-icd-test-data.js
 * Requires MongoDB connection (e.g. MONGODB_URI in .env and connectDB).
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Icd10Master = require("../models/icd10Master");
const Icd9Master = require("../models/icd9Master");

const ICD10_SEED = [
  { code: "E11", full_name: "Type 2 diabetes mellitus" },
  { code: "I10", full_name: "Essential hypertension" },
  { code: "J20", full_name: "Acute bronchitis" },
];

const ICD9_SEED = [
  { code: "45.13", full_name: "Colonoscopy" },
  { code: "99.04", full_name: "Transfusion of packed cells" },
  { code: "38.93", full_name: "Venous catheterization, not elsewhere classified" },
];

async function run() {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) {
      console.error("Set MONGODB_URI or MONGO_URI in .env");
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");

    for (const row of ICD10_SEED) {
      const exists = await Icd10Master.findOne({ code: row.code }).lean();
      if (!exists) {
        await Icd10Master.create(row);
        console.log("ICD-10 inserted:", row.code);
      } else {
        console.log("ICD-10 skipped (exists):", row.code);
      }
    }

    for (const row of ICD9_SEED) {
      const exists = await Icd9Master.findOne({ code: row.code }).lean();
      if (!exists) {
        await Icd9Master.create(row);
        console.log("ICD-9 inserted:", row.code);
      } else {
        console.log("ICD-9 skipped (exists):", row.code);
      }
    }

    console.log("Seed done.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

run();
