/**
 * Simplified visit-type label for frontend (lists, cards, bills).
 * - Online mode → "Konsultacja online"
 * - First visit → "Konsultacja pierwszorazowa"
 * - Otherwise → "Konsultacja lekarska"
 *
 * Slugs are read in order: metadata.visitType → consultation.visitType → consultation.consultationType
 * (legacy fallback for consultation.visitReason is kept for old records).
 *
 * metadata.visitType: any non-empty value not in first-visit slugs → lekarska (unchanged).
 * visitType / consultationType: first-visit / re-visit slugs, or short hyphenated technical slugs → mapped;
 *   Polish sentences fall through to legacy (pierwszorazowa in text, isNewPatient).
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

/** Technical slug on visitType / consultationType (not Polish sentence). */
function isHyphenTechnicalSlug(s) {
  if (!s || s.length >= 60) return false;
  if (s.includes("konsultacja")) return false;
  return s.includes("-");
}

/**
 * @returns {"first"|"followup"|null} null = no structured decision, use legacy text
 */
function resolveStructuredSlugs(appointment) {
  if (!appointment || typeof appointment !== "object") return null;

  const m = norm(appointment.metadata?.visitType);
  if (m) {
    if (FIRST_VISIT_SLUGS.has(m)) return "first";
    return "followup";
  }

  const visitType = norm(
    appointment.consultation?.visitType ?? appointment.consultation?.visitReason
  );
  if (visitType) {
    if (FIRST_VISIT_SLUGS.has(visitType)) return "first";
    if (REVISIT_SLUGS.has(visitType)) return "followup";
    if (isHyphenTechnicalSlug(visitType)) return "followup";
  }

  const ctype = norm(appointment.consultation?.consultationType);
  if (ctype) {
    if (FIRST_VISIT_SLUGS.has(ctype)) return "first";
    if (REVISIT_SLUGS.has(ctype)) return "followup";
    if (isHyphenTechnicalSlug(ctype)) return "followup";
  }

  return null;
}

function legacyFirstVisitIndicators(appointment) {
  if (!appointment || typeof appointment !== "object") return false;

  const meta = appointment.metadata || {};
  if (meta.isNewPatient === true) return true;

  const reason = norm(
    appointment.consultation?.visitType ?? appointment.consultation?.visitReason
  );
  const ctype = norm(appointment.consultation?.consultationType);
  if (reason.includes("pierwszorazowa") || ctype.includes("pierwszorazowa")) return true;
  if (reason === "konsultacja pierwszorazowa" || ctype === "konsultacja pierwszorazowa")
    return true;

  return false;
}

function isFirstVisitAppointment(appointment) {
  const resolved = resolveStructuredSlugs(appointment);
  if (resolved === "first") return true;
  if (resolved === "followup") return false;
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

  const resolved = resolveStructuredSlugs(appointment);
  if (resolved === "first") return LABEL_FIRST;
  if (resolved === "followup") return LABEL_FOLLOWUP;

  if (legacyFirstVisitIndicators(appointment)) {
    return LABEL_FIRST;
  }

  return LABEL_FOLLOWUP;
}

/**
 * Shapes a plain appointment object for JSON responses: sets visitType and
 * consultation.visitType to the same display label as getVisitTypeDisplayForFe.
 * Does not persist; safe for API output only.
 *
 * @param {object|null|undefined} plain - toObject() / lean appointment
 * @returns {object}
 */
function decorateAppointmentResponseForFe(plain) {
  if (!plain || typeof plain !== "object") return plain;
  const label = getVisitTypeDisplayForFe(plain);
  const out = { ...plain, visitType: label };
  if (plain.consultation != null && typeof plain.consultation === "object") {
    out.consultation = { ...plain.consultation, visitType: label };
  }
  return out;
}

module.exports = {
  getVisitTypeDisplayForFe,
  decorateAppointmentResponseForFe,
  isFirstVisitAppointment,
  VISIT_TYPE_LABELS: {
    online: LABEL_ONLINE,
    first: LABEL_FIRST,
    followup: LABEL_FOLLOWUP,
  },
};
