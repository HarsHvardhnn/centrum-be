# Check document number exists (international patient)

API to check whether an international patient document (by document key or document number) already exists in the system—both at **patient** level and in **appointment metadata** (e.g. visit-only / temp data). Use this like the PESEL-exists check, for duplicate handling and prefill.

---

## Endpoint

**GET** `/patients/by-document`

Query parameters (use **one or both**):

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `internationalPatientDocumentKey` | string | No* | Canonical unique key (e.g. `"country\|Passport\|number"`). Prefer this when you have it. |
| `documentKey` | string | No* | Alias for `internationalPatientDocumentKey`. |
| `documentNumber` | string | No* | Raw document number. Checked in both patient and appointment metadata. |

\* At least one of `internationalPatientDocumentKey` / `documentKey` or `documentNumber` is required.

---

## Responses

### 200 – Document **not** found

```json
{
  "success": true,
  "exists": false,
  "message": "Dokument o podanych danych nie występuje w systemie.",
  "foundIn": { "patient": false, "appointmentMetadata": false }
}
```

### 200 – Document **found**

When found in **patient** and/or **appointment metadata**:

```json
{
  "success": true,
  "exists": true,
  "message": "Dokument o podanych danych występuje w systemie.",
  "foundIn": { "patient": true, "appointmentMetadata": true },
  "patientId": "P-1234567890",
  "patient": {
    "_id": "...",
    "patientId": "P-1234567890",
    "name": { "first": "...", "last": "..." },
    "documentNumber": "...",
    "internationalPatientDocumentKey": "...",
    "documentCountry": "...",
    "documentType": "..."
  },
  "appointmentMetadataMatches": 2
}
```

- `foundIn.patient`: `true` if a **patient** exists with this document (key or number).
- `foundIn.appointmentMetadata`: `true` if any **appointment** has this in `metadata` (e.g. online booking / visit-only).
- `patient` is present only when a patient record was found.
- `appointmentMetadataMatches` is the count of appointments whose metadata contains this document (key or number).

### 400 – Bad request

Missing or invalid input:

```json
{
  "success": false,
  "message": "Podaj internationalPatientDocumentKey lub documentNumber."
}
```

or validation message for key/number (e.g. invalid format/length).

### 500 – Server error

```json
{
  "success": false,
  "message": "Błąd serwera"
}
```

---

## Frontend integration

1. **When to call**  
   - Before creating/registering an international patient (same idea as “check PESEL” for Polish patients).  
   - When you have either the full `internationalPatientDocumentKey` (e.g. from `documentCountry|documentType|documentNumber`) or only the `documentNumber`.

2. **How to call**  
   - If you have the canonical key (recommended):  
     `GET /patients/by-document?internationalPatientDocumentKey=<key>`  
   - If you only have the document number:  
     `GET /patients/by-document?documentNumber=<number>`  
   - Send the request with the same auth (e.g. Bearer) as other patient APIs if your backend requires it.

3. **Using the result**  
   - `exists === false`: safe to create a new patient with this document.  
   - `exists === true`:  
     - If `foundIn.patient` and you have `patientId` / `patient`: consider loading existing patient (e.g. “Załaduj dane istniejącego pacjenta”) or show “Document already registered”.  
     - If only `foundIn.appointmentMetadata`: document exists in a visit-only appointment; you can still use it for complete-registration or show a warning as needed.

4. **Validation**  
   - Key and number are validated (length, format). On 400, show `message` to the user.

---

## Summary

| Method | URL | Purpose |
|--------|-----|--------|
| GET | `/patients/by-document?internationalPatientDocumentKey=...` | Check by canonical document key (patient + metadata). |
| GET | `/patients/by-document?documentNumber=...` | Check by document number (patient + metadata). |

Same base URL as your backend (e.g. `https://centrum-be.onrender.com/patients/by-document?...`).
