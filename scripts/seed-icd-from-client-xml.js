/**
 * Seed ICD-10 and ICD-9 master tables from the client's official XML files.
 *
 * Usage (from project root):
 *   node scripts/seed-icd-from-client-xml.js
 *   node scripts/seed-icd-from-client-xml.js --replace
 *
 * Default paths (relative to project root):
 *   - ICD-10: icd/ICD10_2008_PL_v2024_03_12.xml
 *   - ICD-9:  icd/ICD9_85_20260108_100054.xml
 *
 * Options:
 *   --replace   Delete all existing Icd10Master and Icd9Master documents before inserting.
 *
 * Requires: MONGODB_URI or MONGO_URI in .env
 * Requires: npm package fast-xml-parser (for ICD-10 XML)
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const connectDB = require("../config/db");
const Icd10Master = require("../models/icd10Master");
const Icd9Master = require("../models/icd9Master");
const { XMLParser } = require("fast-xml-parser");

const BATCH_SIZE = 2000;

const DEFAULT_ICD10_PATH = path.join(__dirname, "..", "icd", "ICD10_2008_PL_v2024_03_12.xml");
const DEFAULT_ICD9_PATH = path.join(__dirname, "..", "icd", "ICD9_85_20260108_100054.xml");

function parseArgs() {
  const args = process.argv.slice(2);
  return { replace: args.includes("--replace") };
}

// ---- ICD-9: flat XML (pozycja_slownika with kod, nazwa) ----
function parseIcd9Xml(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rows = [];
  const re = /<pozycja_slownika\s+kod="([^"]*)"\s+nazwa="([^"]*)"[^>]*>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const code = (m[1] || "").trim();
    const full_name = (m[2] || "").trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
    if (code && full_name) rows.push({ code, full_name });
  }
  return rows;
}

// ---- ICD-10: nested XML (node with code, name; default namespace) ----
function getCode(item) {
  return (item["@_code"] ?? item["@code"] ?? item.code ?? "").toString().trim();
}

function getName(item) {
  const nameEl = item.name;
  if (typeof nameEl === "string") return nameEl.trim();
  if (nameEl && typeof nameEl === "object" && nameEl["#text"] !== undefined) return String(nameEl["#text"]).trim();
  return "";
}

function getChildNodes(item) {
  const nodes = item.nodes || item.node;
  if (!nodes) return [];
  const n = nodes.node !== undefined ? nodes.node : nodes;
  return Array.isArray(n) ? n : (n ? [n] : []);
}

function flattenIcd10Nodes(nodeList, out) {
  if (!nodeList) return;
  const list = Array.isArray(nodeList) ? nodeList : (nodeList ? [nodeList] : []);
  for (const item of list) {
    const code = getCode(item);
    const name = getName(item);
    if (code && name) out.push({ code, full_name: name });
    flattenIcd10Nodes(getChildNodes(item), out);
  }
}

function parseIcd10Xml(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    ignoreDeclaration: true,
    parseTagValue: false,
  });
  const doc = parser.parse(content);
  const out = [];
  const hcd = doc.hcd || doc;
  const nodesWrapper = hcd.nodes;
  const rootNodeList = nodesWrapper?.node ?? (nodesWrapper ? [nodesWrapper] : []);
  flattenIcd10Nodes(rootNodeList, out);
  return out;
}

async function loadExistingCodes(Model) {
  const docs = await Model.find({}).select("code").lean();
  return new Set(docs.map((d) => d.code));
}

async function importIcd10(filePath, replace) {
  if (replace) {
    const deleted = await Icd10Master.deleteMany({});
    console.log(`ICD-10: deleted ${deleted.deletedCount} existing documents`);
  }
  const rows = parseIcd10Xml(filePath);
  console.log(`ICD-10: parsed ${rows.length} entries from ${filePath}`);
  const existing = replace ? new Set() : await loadExistingCodes(Icd10Master);
  const seen = new Set();
  const toInsert = [];
  for (const r of rows) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    if (!existing.has(r.code)) toInsert.push(r);
  }
  console.log(`ICD-10: inserting ${toInsert.length} new codes`);
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await Icd10Master.insertMany(batch);
    console.log(`ICD-10: inserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total ${Math.min(i + BATCH_SIZE, toInsert.length)}`);
  }
  return toInsert.length;
}

async function importIcd9(filePath, replace) {
  if (replace) {
    const deleted = await Icd9Master.deleteMany({});
    console.log(`ICD-9: deleted ${deleted.deletedCount} existing documents`);
  }
  const rows = parseIcd9Xml(filePath);
  console.log(`ICD-9: parsed ${rows.length} entries from ${filePath}`);
  const existing = replace ? new Set() : await loadExistingCodes(Icd9Master);
  const seen = new Set();
  const toInsert = [];
  for (const r of rows) {
    if (seen.has(r.code)) continue;
    seen.add(r.code);
    if (!existing.has(r.code)) toInsert.push(r);
  }
  console.log(`ICD-9: inserting ${toInsert.length} new codes`);
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    await Icd9Master.insertMany(batch);
    console.log(`ICD-9: inserted batch ${Math.floor(i / BATCH_SIZE) + 1}, total ${Math.min(i + BATCH_SIZE, toInsert.length)}`);
  }
  return toInsert.length;
}

async function run() {
  const { replace } = parseArgs();
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("Set MONGODB_URI or MONGO_URI in .env");
    process.exit(1);
  }

  if (!fs.existsSync(DEFAULT_ICD10_PATH)) {
    console.error(`ICD-10 file not found: ${DEFAULT_ICD10_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(DEFAULT_ICD9_PATH)) {
    console.error(`ICD-9 file not found: ${DEFAULT_ICD9_PATH}`);
    process.exit(1);
  }

  await connectDB();

  try {
    await importIcd10(DEFAULT_ICD10_PATH, replace);
    await importIcd9(DEFAULT_ICD9_PATH, replace);
    console.log("Done.");
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await require("mongoose").disconnect();
  }
}

run();
