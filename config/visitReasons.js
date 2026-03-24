/**
 * Visit Reason Dictionary (Rodzaj wizyty)
 * All values are in Polish. Used across registration, dashboard, visit card, doctor view.
 * Reception: select category → then type → system stores displayName.
 * Rule: Online registration auto-assigns "Konsultacja online".
 */

const VISIT_REASONS = [
  {
    id: "Konsultacja",
    label: "Konsultacja",
    types: [
      { id: "pierwszorazowa", displayName: "Konsultacja pierwszorazowa" },
      { id: "kontrolna", displayName: "Konsultacja kontrolna" },
      { id: "po zabiegu", displayName: "Konsultacja po zabiegu" },
      { id: "pilna", displayName: "Konsultacja pilna" },
      { id: "online", displayName: "Konsultacja online" },
      { id: "lekarska", displayName: "Konsultacja lekarska" },
    ],
  },
  {
    id: "Badania",
    label: "Badania",
    types: [
      { id: "badanie USG", displayName: "Badanie USG" },
      { id: "badanie EKG", displayName: "Badanie EKG" },
      { id: "Holter EKG – założenie", displayName: "Holter EKG – założenie" },
      { id: "Holter EKG – zdjęcie", displayName: "Holter EKG – zdjęcie" },
      { id: "Holter ciśnieniowy – założenie", displayName: "Holter ciśnieniowy – założenie" },
      { id: "Holter ciśnieniowy – zdjęcie", displayName: "Holter ciśnieniowy – zdjęcie" },
    ],
  },
  {
    id: "Procedury",
    label: "Procedury",
    types: [
      { id: "usunięcie szwów", displayName: "Usunięcie szwów" },
      { id: "zmiana opatrunku", displayName: "Zmiana opatrunku" },
      { id: "iniekcja", displayName: "Iniekcja" },
      { id: "pobranie materiału", displayName: "Pobranie materiału" },
    ],
  },
  {
    id: "Zabieg",
    label: "Zabieg",
    types: [
      { id: "zabieg chirurgiczny", displayName: "Zabieg chirurgiczny" },
      { id: "usunięcie zmiany", displayName: "Usunięcie zmiany" },
      { id: "nacięcie ropnia", displayName: "Nacięcie ropnia" },
    ],
  },
  {
    id: "Administracyjne",
    label: "Administracyjne",
    types: [
      { id: "odbiór wyników", displayName: "Odbiór wyników" },
      { id: "omówienie wyników", displayName: "Omówienie wyników" },
      { id: "recepta", displayName: "Recepta" },
      { id: "zaświadczenie", displayName: "Zaświadczenie" },
      { id: "skierowanie", displayName: "Skierowanie" },
      { id: "zwolnienie", displayName: "Zwolnienie" },
      { id: "wydanie dokumentacji medycznej", displayName: "Wydanie dokumentacji medycznej" },
      { id: "sprawa administracyjna", displayName: "Sprawa administracyjna" },
    ],
  },
];

/** Display name used when patient registers online (patient portal). */
const ONLINE_REGISTRATION_VISIT_REASON = "Konsultacja online";

/** All valid display names (for validation). */
const ALL_DISPLAY_NAMES = VISIT_REASONS.flatMap((cat) =>
  cat.types.map((t) => t.displayName)
);

function getVisitReasons() {
  return VISIT_REASONS;
}

function getOnlineRegistrationVisitReason() {
  return ONLINE_REGISTRATION_VISIT_REASON;
}

function isValidVisitReason(displayName) {
  if (!displayName || typeof displayName !== "string") return false;
  return ALL_DISPLAY_NAMES.includes(displayName.trim());
}

module.exports = {
  VISIT_REASONS,
  ONLINE_REGISTRATION_VISIT_REASON,
  ALL_DISPLAY_NAMES,
  getVisitReasons,
  getOnlineRegistrationVisitReason,
  isValidVisitReason,
};
