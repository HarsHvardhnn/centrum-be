const path = require("path");

function fixPossiblyMisencodedFilename(name) {
  const raw = String(name || "");
  if (!raw) return "";
  try {
    // Browser/multipart stacks can pass UTF-8 bytes interpreted as latin1.
    const repaired = Buffer.from(raw, "latin1").toString("utf8");
    // Prefer repaired version when it clearly contains Polish diacritics.
    if (/[ąćęłńóśżźĄĆĘŁŃÓŚŻŹ]/.test(repaired)) return repaired;
  } catch (_) {
    // no-op; keep raw
  }
  return raw;
}

function normalizeDisplayFilename(name) {
  const fixed = fixPossiblyMisencodedFilename(name);
  // Remove controls, normalize unicode composition.
  return fixed
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

function getFileExtensionFromName(name, fallback = "bin") {
  const normalized = normalizeDisplayFilename(name);
  const ext = path.extname(normalized || "").replace(".", "").toLowerCase();
  return ext || fallback;
}

function buildSafeStorageBaseName(name, fallback = "file") {
  const normalized = normalizeDisplayFilename(name);
  const parsed = path.parse(normalized);
  const base = (parsed.name || fallback)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  return base || fallback;
}

module.exports = {
  normalizeDisplayFilename,
  getFileExtensionFromName,
  buildSafeStorageBaseName,
};

