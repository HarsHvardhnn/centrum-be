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

/** Parse one CSV line respecting quoted fields (commas inside quotes stay). */
function parseCsvLine(line, sep = ",") {
  const out = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let field = "";
      i++;
      while (i < line.length) {
        if (line[i] === '"') {
          i++;
          if (line[i] === '"') { field += '"'; i++; }
          else break;
        } else {
          field += line[i];
          i++;
        }
      }
      out.push(field.trim());
      while (i < line.length && line[i] !== sep) i++;
      if (line[i] === sep) i++;
    } else {
      let end = line.indexOf(sep, i);
      if (end === -1) end = line.length;
      out.push(line.slice(i, end).trim().replace(/^"|"$/g, ""));
      i = end + (line[end] === sep ? 1 : 0);
    }
  }
  return out;
}

function parseCsv(str) {
  const lines = str.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines[0].includes("\t") ? "\t" : ",";
  const header = parseCsvLine(lines[0], sep).map((h) => h.trim().toLowerCase().replace(/\s/g, "_"));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], sep);
    const row = {};
    header.forEach((h, j) => {
      row[h] = (values[j] || "").trim();
    });
    if (row.code || row.prcdrcd || row.full_name || row.longdesc) rows.push(row);
  }
  return rows;
}

const BATCH_SIZE = 1000;

function normalizeRow(row) {
  const code = (row.code || row.Code || row.prcdrcd || "").toString().trim();
  const full_name = (row.full_name ?? row.fullName ?? row.name ?? row.longdescription ?? row.long_description ?? row.longdesc ?? "").toString().trim();
  return { code, full_name };
}

/**
 * POST /api/icd/seed (unprotected)
 * Body: JSON { icd10: { items: [{ code, full_name }] }, icd9: { items: [...] } }
 * Or multipart: file fields "icd10" and/or "icd9" (CSV, header code,full_name).
 * Batch-inserts; skips codes that already exist. Use for initial load from main server.
 */
exports.seedIcdRealData = async (req, res) => {
  try {
    const result = { icd10: { inserted: 0 }, icd9: { inserted: 0 } };
    const body = req.body || {};
    const files = req.files || {};

    const getRows = (itemsOrFile) => {
      if (!itemsOrFile) return [];
      if (Array.isArray(itemsOrFile)) return itemsOrFile.map(normalizeRow).filter((r) => r.code && r.full_name);
      if (itemsOrFile.buffer) return parseCsv(itemsOrFile.buffer.toString("utf8")).map(normalizeRow).filter((r) => r.code && r.full_name);
      if (itemsOrFile.items && Array.isArray(itemsOrFile.items)) return itemsOrFile.items.map(normalizeRow).filter((r) => r.code && r.full_name);
      return [];
    };

    const icd10Input = body.icd10 || (files.icd10 && files.icd10[0]);
    const icd9Input = body.icd9 || (files.icd9 && files.icd9[0]);

    let icd10Rows = getRows(icd10Input);
    let icd9Rows = getRows(icd9Input);

    if (icd10Rows.length > 0) {
      const seen = new Set();
      icd10Rows = icd10Rows.filter((r) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      });
      const existing = new Set((await Icd10Master.find({}).select("code").lean()).map((d) => d.code));
      const toInsert = icd10Rows.filter((r) => !existing.has(r.code));
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        await Icd10Master.insertMany(batch);
        result.icd10.inserted += batch.length;
      }
    }

    if (icd9Rows.length > 0) {
      const seen = new Set();
      icd9Rows = icd9Rows.filter((r) => {
        if (seen.has(r.code)) return false;
        seen.add(r.code);
        return true;
      });
      const existing = new Set((await Icd9Master.find({}).select("code").lean()).map((d) => d.code));
      const toInsert = icd9Rows.filter((r) => !existing.has(r.code));
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        await Icd9Master.insertMany(batch);
        result.icd9.inserted += batch.length;
      }
    }

    res.status(200).json({
      success: true,
      message: "ICD seed completed",
      ...result,
    });
  } catch (err) {
    console.error("ICD seed error:", err);
    res.status(500).json({
      success: false,
      message: "Seed failed",
      error: err.message,
    });
  }
};
