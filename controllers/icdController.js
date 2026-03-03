/**
 * ICD-10 and ICD-9: search (autocomplete) and admin import.
 * Search: case-insensitive, by code prefix or name substring, max 10 results.
 */
const Icd10Master = require("../models/icd10Master");
const Icd9Master = require("../models/icd9Master");

const MAX_SEARCH_RESULTS = 10;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /icd10/search?q=...
 * Returns [{ code, name }, ...] (name = full_name).
 */
exports.searchIcd10 = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.status(200).json([]);
    }
    const re = new RegExp(escapeRegex(q), "i");
    const items = await Icd10Master.find({
      $or: [
        { code: re },
        { full_name: re },
      ],
    })
      .select("code full_name")
      .limit(MAX_SEARCH_RESULTS)
      .lean();
    const result = items.map((doc) => ({
      code: doc.code,
      name: doc.full_name,
    }));
    res.status(200).json(result);
  } catch (err) {
    console.error("ICD-10 search error:", err);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
};

/**
 * GET /icd9/search?q=...
 * Returns [{ code, name }, ...].
 */
exports.searchIcd9 = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) {
      return res.status(200).json([]);
    }
    const re = new RegExp(escapeRegex(q), "i");
    const items = await Icd9Master.find({
      $or: [
        { code: re },
        { full_name: re },
      ],
    })
      .select("code full_name")
      .limit(MAX_SEARCH_RESULTS)
      .lean();
    const result = items.map((doc) => ({
      code: doc.code,
      name: doc.full_name,
    }));
    res.status(200).json(result);
  } catch (err) {
    console.error("ICD-9 search error:", err);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
};

/**
 * POST /admin/icd10/import
 * Body: CSV string (code,full_name) or JSON { items: [{ code, full_name }] } or multipart CSV file.
 * Duplicates by code are skipped (first wins).
 */
exports.importIcd10 = async (req, res) => {
  try {
    const rows = parseImportPayload(req);
    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows. Send JSON { items: [{ code, full_name }] } or CSV with header code,full_name",
      });
    }
    let inserted = 0;
    let skipped = 0;
    const seen = new Set();
    for (const row of rows) {
      const code = (row.code || row.Code || "").toString().trim();
      const full_name = (row.full_name ?? row.fullName ?? row.name ?? "").toString().trim();
      if (!code || !full_name) continue;
      if (seen.has(code)) {
        skipped++;
        continue;
      }
      const exists = await Icd10Master.findOne({ code }).lean();
      if (exists) {
        skipped++;
        seen.add(code);
        continue;
      }
      await Icd10Master.create({ code, full_name });
      inserted++;
      seen.add(code);
    }
    res.status(200).json({
      success: true,
      message: "ICD-10 import completed",
      inserted,
      skipped,
    });
  } catch (err) {
    console.error("ICD-10 import error:", err);
    res.status(500).json({
      success: false,
      message: "Import failed",
      error: err.message,
    });
  }
};

/**
 * POST /admin/icd9/import
 * Same as ICD-10; JSON keys code, full_name (or fullName/name).
 */
exports.importIcd9 = async (req, res) => {
  try {
    const rows = parseImportPayload(req);
    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "No valid rows. Send JSON { items: [{ code, full_name }] } or CSV with header code,full_name",
      });
    }
    let inserted = 0;
    let skipped = 0;
    const seen = new Set();
    for (const row of rows) {
      const code = (row.code || row.Code || "").toString().trim();
      const full_name = (row.full_name ?? row.fullName ?? row.name ?? "").toString().trim();
      if (!code || !full_name) continue;
      if (seen.has(code)) {
        skipped++;
        continue;
      }
      const exists = await Icd9Master.findOne({ code }).lean();
      if (exists) {
        skipped++;
        seen.add(code);
        continue;
      }
      await Icd9Master.create({ code, full_name });
      inserted++;
      seen.add(code);
    }
    res.status(200).json({
      success: true,
      message: "ICD-9 import completed",
      inserted,
      skipped,
    });
  } catch (err) {
    console.error("ICD-9 import error:", err);
    res.status(500).json({
      success: false,
      message: "Import failed",
      error: err.message,
    });
  }
};

/**
 * Parse request body: JSON { items: [...] } or CSV string (code,full_name).
 * req.body can be string (CSV) or object. Also support req.file if multer used.
 */
function parseImportPayload(req) {
  let rows = [];
  const body = req.body;
  const file = req.file;

  if (file && file.buffer) {
    const str = file.buffer.toString("utf8");
    rows = parseCsv(str);
  } else if (typeof body === "string") {
    rows = parseCsv(body);
  } else if (body && Array.isArray(body.items)) {
    rows = body.items;
  } else if (Array.isArray(body)) {
    rows = body;
  } else if (body && body.code && body.full_name) {
    rows = [body];
  }
  return rows;
}

function parseCsv(str) {
  const lines = str.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s/g, "_"));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row = {};
    header.forEach((h, j) => {
      row[h] = values[j] || "";
    });
    if (row.code || row.full_name) rows.push(row);
  }
  return rows;
}
