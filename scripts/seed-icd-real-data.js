/**
 * Populate ICD-10 and/or ICD-9 master tables with real-life data from CSV or JSON files.
 *
 * Usage:
 *   node scripts/seed-icd-real-data.js --icd10=path/to/icd10.csv
 *   node scripts/seed-icd-real-data.js --icd9=path/to/icd9.csv
 *   node scripts/seed-icd-real-data.js --icd10=icd10.csv --icd9=icd9.csv
 *
 * CSV format: first line = header. Supported column names (case-insensitive):
 *   - code / Code
 *   - full_name / fullName / name / Long Description / description / title
 *   If your file uses different headers, use "code" and "full_name" for compatibility.
 *
 * JSON format: either { "items": [ { "code": "...", "full_name": "..." }, ... ] }
 *   or a plain array [ { "code", "full_name" }, ... ]. Keys "fullName" / "name" accepted.
 *
 * Duplicates by code are skipped (existing codes in DB are not overwritten).
 * Requires: MONGODB_URI or MONGO_URI in .env (or set in environment).
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Icd10Master = require("../models/icd10Master");
const Icd9Master = require("../models/icd9Master");

const BATCH_SIZE = 1000;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { icd10: null, icd9: null };
  for (const a of args) {
    if (a.startsWith("--icd10=")) out.icd10 = a.slice("--icd10=".length).trim();
    if (a.startsWith("--icd9=")) out.icd9 = a.slice("--icd9=".length).trim();
  }
  return out;
}

function normalizeRow(row) {
  const code = (row.code || row.Code || "").toString().trim();
  const full_name = (row.full_name ?? row.fullName ?? row.name ?? row.Long_Description ?? row["Long Description"] ?? row.description ?? row.title ?? "").toString().trim();
  return { code, full_name };
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headerLine = lines[0];
  const sep = headerLine.includes("\t") ? "\t" : ",";
  const headers = headerLine.split(sep).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(sep).map((v) => v.trim());
    const row = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    const code = row.code ?? row.code_number ?? row.icd_code ?? "";
    const full_name = row.full_name ?? row.fullname ?? row.name ?? row.long_description ?? row.description ?? row.title ?? "";
    if (code && full_name) rows.push({ code, full_name });
  }
  return rows;
}

function loadFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, "utf8");
  const ext = path.extname(resolved).toLowerCase();
  if (ext === ".json") {
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : (data.items || []);
    return items.map((row) => {
      const { code, full_name } = normalizeRow(row);
      return { code, full_name };
    }).filter((r) => r.code && r.full_name);
  }
  return parseCsv(content);
}

async function loadExistingCodes(Model) {
  const docs = await Model.find({}).select("code").lean();
  return new Set(docs.map((d) => d.code));
}

async function importIcd10(filePath) {
  const rows = loadFile(filePath);
  console.log(`ICD-10: loaded ${rows.length} rows from ${filePath}`);
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    unique.push(r);
  }
  const existing = await loadExistingCodes(Icd10Master);
  const toInsert = unique.filter((r) => !existing.has(r.code));
  console.log(`ICD-10: ${toInsert.length} new codes to insert (${existing.size} already in DB)`);
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await Icd10Master.insertMany(batch);
    inserted += batch.length;
    console.log(`ICD-10: inserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total ${inserted}`);
  }
  return inserted;
}

async function importIcd9(filePath) {
  const rows = loadFile(filePath);
  console.log(`ICD-9: loaded ${rows.length} rows from ${filePath}`);
  const seen = new Set();
  const unique = [];
  for (const r of rows) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    unique.push(r);
  }
  const existing = await loadExistingCodes(Icd9Master);
  const toInsert = unique.filter((r) => !existing.has(r.code));
  console.log(`ICD-9: ${toInsert.length} new codes to insert (${existing.size} already in DB)`);
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await Icd9Master.insertMany(batch);
    inserted += batch.length;
    console.log(`ICD-9: inserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total ${inserted}`);
  }
  return inserted;
}

async function run() {
  const { icd10, icd9 } = parseArgs();
  if (!icd10 && !icd9) {
    console.error("Usage: node scripts/seed-icd-real-data.js --icd10=<file> [--icd9=<file>]");
    console.error("  Files can be .csv or .json. CSV header: code, full_name (or similar).");
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI in .env");
    process.exit(1);
  }

  await connectDB();

  try {
    if (icd10) await importIcd10(icd10);
    if (icd9) await importIcd9(icd9);
    console.log("Done.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await require("mongoose").disconnect();
  }
}

run();
