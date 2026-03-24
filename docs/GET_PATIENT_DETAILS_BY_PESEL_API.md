# Get patient details by PESEL – API contract

**Endpoint:** `GET /patients/by-pesel/details`  
**Purpose:** Return full patient details when the patient is identified by PESEL (11-digit Polish national ID). Use this after “check PESEL exists” to load the full record for “Załaduj dane istniejącego pacjenta” or for any screen that needs full patient data by PESEL.

---

## Request

**Method:** `GET`  
**URL:** `/patients/by-pesel/details`

### Query parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `pesel`   | string | Yes      | PESEL (11 digits). Non-digits are stripped; leading zeros allowed. |

### Example

```http
GET /patients/by-pesel/details?pesel=99010101234
```

With base URL:

```text
https://your-api.com/patients/by-pesel/details?pesel=99010101234
```

---

## Response

### 200 OK – Patient found

Returns the **same shape as GET /patients/:id**: full patient document (excluding `password`), with consents parsed and contact-person fields normalized.

**Example (main fields):**

```json
{
  "_id": "...",
  "name": { "first": "Anna", "last": "Kowalska" },
  "email": "anna@example.com",
  "phone": "123456789",
  "phoneCode": "+48",
  "govtId": "99010101234",
  "patientId": "P-1234567890",
  "dateOfBirth": "1999-01-01T00:00:00.000Z",
  "sex": "Female",
  "role": "patient",
  "consents": [...],
  "contactPerson1PhoneCode": "",
  "contactPerson1Phone": "",
  "contactPerson1PhoneFull": "",
  "contactPerson1Relationship": "",
  "contactPerson2PhoneCode": "",
  "contactPerson2Phone": "",
  "contactPerson2PhoneFull": "",
  "contactPerson2Relationship": "",
  "isWalkin": false,
  "needsAttention": false,
  "isBackdated": false,
  "overrideConflicts": false,
  "isEmergency": false,
  "documents": [...],
  "smsConsentAgreed": true,
  "consultingDoctor": "...",
  "consultingSpecialization": "...",
  "address": "...",
  "city": "...",
  "dateOfBirth": "...",
  "status": "...",
  ...other patient schema fields
}
```

- **No `password`** in the response.
- **`consents`** is an array (parsed from DB if stored as string).
- Use this object the same way as the response from **GET /patients/:id** (e.g. for forms, display, or “load existing patient” flow).

---

### 400 Bad Request – Invalid PESEL

When `pesel` is missing or not 11 digits after stripping non-digits:

```json
{
  "success": false,
  "message": "Podaj prawidłowy numer PESEL (11 cyfr)."
}
```

---

### 404 Not Found – No patient with this PESEL

When PESEL is valid but no (non-deleted) patient exists:

```json
{
  "success": false,
  "message": "Pacjent o podanym numerze PESEL nie istnieje w systemie."
}
```

---

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Błąd serwera podczas pobierania danych pacjenta."
}
```

---

## Frontend integration

1. **Optional: Check first**  
   Call `GET /patients/by-pesel?pesel=...` to get `exists: true/false` and optional minimal `patient` (e.g. for “load existing” button).

2. **Load full details**  
   Call `GET /patients/by-pesel/details?pesel=...` when the user confirms “Załaduj dane istniejącego pacjenta” or when you need the full record by PESEL.

3. **Handle responses**  
   - **200:** Use the JSON as the single source of truth for patient (same as after GET /patients/:id).  
   - **404:** Show “Pacjent o podanym numerze PESEL nie istnieje w systemie.” and do not prefill.  
   - **400:** Show validation message and ask for a valid 11-digit PESEL.

4. **PESEL format**  
   Send digits only or with spaces/dashes; backend strips non-digits. Length must be 11.

---

## Summary

| Item        | Value |
|------------|--------|
| **Method** | GET |
| **URL**    | `/patients/by-pesel/details?pesel=<11 digits>` |
| **200**    | Full patient details (same shape as GET /patients/:id), no password |
| **400**    | Invalid or missing PESEL |
| **404**    | Valid PESEL but no patient in system |
| **500**    | Server error |
