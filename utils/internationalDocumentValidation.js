/**
 * International patient document validation.
 * Document number and document key must be validated everywhere (same rigor as PESEL).
 * internationalPatientDocumentKey is the unique identifier (like govtId for Polish patients).
 */

const MIN_DOCUMENT_NUMBER_LENGTH = 2;
const MAX_DOCUMENT_NUMBER_LENGTH = 50;
const MIN_DOCUMENT_KEY_LENGTH = 2;
const MAX_DOCUMENT_KEY_LENGTH = 100;

/**
 * Normalize document number: trim, collapse internal spaces.
 * @param {*} raw
 * @returns {string}
 */
function normalizeDocumentNumber(raw) {
  if (raw == null) return "";
  const s = String(raw).trim().replace(/\s+/g, " ");
  return s;
}

/**
 * Normalize document key (internationalPatientDocumentKey): trim.
 * @param {*} raw
 * @returns {string}
 */
function normalizeDocumentKey(raw) {
  if (raw == null) return "";
  return String(raw).trim();
}

/**
 * Validate document number (required, length, no invalid chars).
 * @param {string} documentNumber - Raw document number
 * @returns {{ valid: boolean, warning?: string, normalized: string }}
 */
function validateDocumentNumber(documentNumber) {
  const normalized = normalizeDocumentNumber(documentNumber);
  if (!normalized) {
    return { valid: false, warning: "Numer dokumentu jest wymagany dla pacjenta międzynarodowego.", normalized: "" };
  }
  if (normalized.length < MIN_DOCUMENT_NUMBER_LENGTH) {
    return {
      valid: false,
      warning: `Numer dokumentu musi mieć co najmniej ${MIN_DOCUMENT_NUMBER_LENGTH} znaki.`,
      normalized: "",
    };
  }
  if (normalized.length > MAX_DOCUMENT_NUMBER_LENGTH) {
    return {
      valid: false,
      warning: `Numer dokumentu nie może przekraczać ${MAX_DOCUMENT_NUMBER_LENGTH} znaków.`,
      normalized: "",
    };
  }
  return { valid: true, normalized };
}

/**
 * Validate document key (internationalPatientDocumentKey) – unique ID for international patients.
 * @param {string} internationalPatientDocumentKey - Raw document key
 * @returns {{ valid: boolean, warning?: string, normalized: string }}
 */
function validateDocumentKey(internationalPatientDocumentKey) {
  const normalized = normalizeDocumentKey(internationalPatientDocumentKey);
  if (!normalized) {
    return {
      valid: false,
      warning: "Klucz dokumentu (internationalPatientDocumentKey) jest wymagany dla pacjenta międzynarodowego.",
      normalized: "",
    };
  }
  if (normalized.length < MIN_DOCUMENT_KEY_LENGTH) {
    return {
      valid: false,
      warning: `Klucz dokumentu musi mieć co najmniej ${MIN_DOCUMENT_KEY_LENGTH} znaki.`,
      normalized: "",
    };
  }
  if (normalized.length > MAX_DOCUMENT_KEY_LENGTH) {
    return {
      valid: false,
      warning: `Klucz dokumentu nie może przekraczać ${MAX_DOCUMENT_KEY_LENGTH} znaków.`,
      normalized: "",
    };
  }
  return { valid: true, normalized };
}

/**
 * Validate both document number and document key for international patients.
 * Use wherever international patient identity is set (create/update).
 * @param {{ documentNumber?: string, internationalPatientDocumentKey?: string }} params
 * @returns {{ valid: boolean, warning?: string, documentNumber: string, internationalPatientDocumentKey: string }}
 */
function validateInternationalDocument(params = {}) {
  const docNumResult = validateDocumentNumber(params.documentNumber);
  const keyResult = validateDocumentKey(params.internationalPatientDocumentKey);
  if (!docNumResult.valid) {
    return {
      valid: false,
      warning: docNumResult.warning,
      documentNumber: docNumResult.normalized,
      internationalPatientDocumentKey: keyResult.normalized,
    };
  }
  if (!keyResult.valid) {
    return {
      valid: false,
      warning: keyResult.warning,
      documentNumber: docNumResult.normalized,
      internationalPatientDocumentKey: keyResult.normalized,
    };
  }
  return {
    valid: true,
    documentNumber: docNumResult.normalized,
    internationalPatientDocumentKey: keyResult.normalized,
  };
}

module.exports = {
  normalizeDocumentNumber,
  normalizeDocumentKey,
  validateDocumentNumber,
  validateDocumentKey,
  validateInternationalDocument,
  MIN_DOCUMENT_NUMBER_LENGTH,
  MIN_DOCUMENT_KEY_LENGTH,
};
