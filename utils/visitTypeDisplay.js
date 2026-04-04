/**
 * Simplified visit-type label for frontend (lists, cards, bills).
 * - Online mode → "Konsultacja online"
 * - First visit → "Konsultacja pierwszorazowa"
 * - Otherwise → "Konsultacja lekarska"
 *
 * First visit is detected from metadata slug, isNewPatient, or Polish/display strings.
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

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function isFirstVisitAppointment(appointment) {
  if (!appointment || typeof appointment !== "object") return false;

  const meta = appointment.metadata || {};
  const slug = norm(meta.visitType);
  if (FIRST_VISIT_SLUGS.has(slug)) return true;
  if (meta.isNewPatient === true) return true;

  const reason = norm(appointment.consultation?.visitReason);
  const ctype = norm(appointment.consultation?.consultationType);
  if (reason.includes("pierwszorazowa") || ctype.includes("pierwszorazowa")) return true;
  if (slug.includes("pierwszorazowa")) return true;
  if (reason === "konsultacja pierwszorazowa" || ctype === "konsultacja pierwszorazowa")
    return true;

  return false;
}

/**
 * @param {object|null|undefined} appointment - Lean/populated appointment (mode, consultation, metadata)
 * @returns {string}
 */
function getVisitTypeDisplayForFe(appointment) {
  if (!appointment || typeof appointment !== "object") return LABEL_FOLLOWUP;

  const mode = norm(appointment.mode);
  if (mode === "online") {
    return LABEL_ONLINE;
  }

  if (isFirstVisitAppointment(appointment)) {
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
