/**
 * Simplified visit-type label for frontend (lists, cards, bills).
 * - Online mode → "Konsultacja online"
 * - First visit → "Konsultacja pierwszorazowa"
 * - Otherwise → "Konsultacja lekarska"
 *
 * Priority:
 * 1) mode === online → always online label
 * 2) metadata.visitType slug: first-visit* → pierwszorazowa; any other non-empty slug → lekarska
 *    (so "re-visit" wins over stale consultation.visitReason still saying pierwszorazowa)
 * 3) No slug: legacy — isNewPatient / consultation text with "pierwszorazowa"
 */

const LABEL_ONLINE = "Konsultacja online";
const LABEL_FIRST = "Konsultacja pierwszorazowa";
const LABEL_FOLLOWUP = "Konsultacja lekarska";

const FIRST_VISIT_SLUGS = new Set([
  "first-visit",
  "first_visit",
  "firstvisit",
  "pierwszorazowa",
]);

/** Explicit follow-up slugs (optional; any non-first non-empty slug already maps to lekarska). */
const REVISIT_SLUGS = new Set([
  "re-visit",
  "re_visit",
  "revisit",
  "return-visit",
  "return_visit",
  "follow-up",
  "followup",
  "follow_up",
]);

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function legacyFirstVisitIndicators(appointment) {
  if (!appointment || typeof appointment !== "object") return false;

  const meta = appointment.metadata || {};
  if (meta.isNewPatient === true) return true;

  const reason = norm(appointment.consultation?.visitReason);
  const ctype = norm(appointment.consultation?.consultationType);
  if (reason.includes("pierwszorazowa") || ctype.includes("pierwszorazowa")) return true;
  if (reason === "konsultacja pierwszorazowa" || ctype === "konsultacja pierwszorazowa")
    return true;

  return false;
}

/**
 * True only when we would show "first" without relying on metadata.visitType slug
 * (exported for callers that need the same rule).
 */
function isFirstVisitAppointment(appointment) {
  if (!appointment || typeof appointment !== "object") return false;
  const metaSlug = norm(appointment.metadata?.visitType);
  if (metaSlug) {
    return FIRST_VISIT_SLUGS.has(metaSlug);
  }
  return legacyFirstVisitIndicators(appointment);
}

/**
 * @param {object|null|undefined} appointment - Lean/populated appointment (mode, consultation, metadata)
 * @returns {string}
 */
function getVisitTypeDisplayForFe(appointment) {
  if (!appointment || typeof appointment !== "object") return LABEL_FOLLOWUP;

  if (norm(appointment.mode) === "online") {
    return LABEL_ONLINE;
  }

  const metaSlug = norm(appointment.metadata?.visitType);

  if (metaSlug) {
    if (FIRST_VISIT_SLUGS.has(metaSlug)) {
      return LABEL_FIRST;
    }
    if (REVISIT_SLUGS.has(metaSlug)) {
      return LABEL_FOLLOWUP;
    }
    // Any other explicit FE slug (e.g. "re-visit" variants, procedure keys) → simplified "lekarska"
    return LABEL_FOLLOWUP;
  }

  if (legacyFirstVisitIndicators(appointment)) {
    return LABEL_FIRST;
  }

  return LABEL_FOLLOWUP;
}

module.exports = {
  getVisitTypeDisplayForFe,
  isFirstVisitAppointment,
  VISIT_TYPE_LABELS: {
    online: LABEL_ONLINE,
    first: LABEL_FIRST,
    followup: LABEL_FOLLOWUP,
  },
};
