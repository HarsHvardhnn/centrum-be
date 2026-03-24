/**
 * PESEL validation (Polish national ID).
 * Format: 11 digits only. Checksum is soft validation (warning only, do not block registration).
 */

const WEIGHTS = [1, 3, 7, 9];

/**
 * Validate PESEL format (exactly 11 digits) and optionally checksum.
 * @param {string} pesel - Raw PESEL (will be stripped to digits only for length check)
 * @returns {{ valid: boolean, warning?: string }}
 */
function validatePesel(pesel) {
  if (pesel == null || typeof pesel !== "string") {
    return { valid: false, warning: "PESEL jest wymagany." };
  }
  const digits = pesel.replace(/\D/g, "");
  if (digits.length !== 11) {
    return { valid: false, warning: "PESEL musi składać się z 11 cyfr." };
  }
  if (!/^\d{11}$/.test(digits)) {
    return { valid: false, warning: "PESEL może zawierać tylko cyfry 0-9." };
  }

  const sum = digits
    .slice(0, 10)
    .split("")
    .reduce((acc, d, i) => acc + parseInt(d, 10) * WEIGHTS[i % 4], 0);
  const expectedChecksum = (10 - (sum % 10)) % 10;
  const actualChecksum = parseInt(digits[10], 10);
  if (expectedChecksum !== actualChecksum) {
    return {
      valid: true,
      warning: "Ostrzeżenie: numer PESEL może być nieprawidłowy (błąd sumy kontrolnej).",
    };
  }
  return { valid: true };
}

module.exports = { validatePesel };
