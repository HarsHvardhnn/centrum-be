# Check PESEL exists – API documentation

Use this endpoint to check whether a patient with the given PESEL number already exists in the system (e.g. before "Complete registration" or to show "Załaduj dane istniejącego pacjenta").

---

## Endpoint

**GET** `/patients/by-pesel`

**Base URL:** Depends on deployment (e.g. `https://your-api.com/patients/by-pesel`).

---

## Authentication

Currently no authentication is required. If you need to restrict access (e.g. to staff only), add your auth middleware to this route in `routes/patient-routes.js`.

---

## Request

### Query parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|--------------|
| `pesel`   | string | Yes      | PESEL number (11 digits). Non-digits are stripped; leading zeros allowed. |

### Example

```http
GET /patients/by-pesel?pesel=99010101234
```

or with spaces/dashes (stripped by backend):

```http
GET /patients/by-pesel?pesel=99-01-01012-34
```

---

## Response

### 200 OK – PESEL does not exist

```json
{
  "success": true,
  "exists": false,
  "message": "Pacjent o podanym numerze PESEL nie istnieje w systemie.",
  "peselWarning": null
}
```

If the PESEL format is valid but the checksum is invalid (soft validation), the same 200 response can include a warning:

```json
{
  "success": true,
  "exists": false,
  "message": "Pacjent o podanym numerze PESEL nie istnieje w systemie.",
  "peselWarning": "Ostrzeżenie: numer PESEL może być nieprawidłowy (błąd sumy kontrolnej)."
}
```

---

### 200 OK – PESEL exists

```json
{
  "success": true,
  "exists": true,
  "message": "Pacjent o podanym numerze PESEL już istnieje w systemie.",
  "patientId": "P-1234567890",
  "patient": {
    "_id": "...",
    "patientId": "P-1234567890",
    "name": { "first": "Anna", "last": "Nowak" },
    "govtId": "99010101234",
    "dateOfBirth": "1999-01-01T00:00:00.000Z",
    "phone": "600111222",
    "email": "anna@example.com",
    "sex": "Female"
  },
  "peselWarning": null
}
```

Again, `peselWarning` may be set (same checksum warning text) when the number has a checksum issue; the backend still treats it as “exists” if a patient with that PESEL is found.

---

### 400 Bad Request – Invalid PESEL

When the value is missing or not 11 digits after stripping non-digits:

```json
{
  "success": false,
  "message": "Podaj prawidłowy numer PESEL (11 cyfr)."
}
```

or (format validation):

```json
{
  "success": false,
  "message": "Nieprawidłowy format PESEL (11 cyfr)."
}
```

---

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Błąd serwera"
}
```

---

## Behaviour summary

| Case              | HTTP | `exists` | `patient`   | `peselWarning` |
|-------------------|------|----------|-------------|----------------|
| Valid PESEL, none in DB | 200  | `false`  | absent      | optional       |
| Valid PESEL, found in DB| 200  | `true`   | object      | optional       |
| Invalid/missing PESEL   | 400  | absent   | absent      | absent         |

- **PESEL format:** Exactly 11 digits (non-digits stripped from query param).
- **Checksum:** Validated; if invalid, a **warning** is returned in `peselWarning` and the request is **not** blocked (same as Complete registration).
- **Deleted patients:** Patients with `deleted: true` are ignored; they are not considered “existing” for this check.

---

## Frontend usage

- **Before Complete registration:** Call `GET /patients/by-pesel?pesel=<value>`. If `exists === true`, show message *"Pacjent o podanym numerze PESEL już istnieje w systemie."* and the **[Załaduj dane istniejącego pacjenta]** button; use `patient` to prefill the form. If `exists === false`, allow creating a new patient.
- **Optional:** If `peselWarning` is present, show it as a non-blocking warning (e.g. under the PESEL field).

---

## cURL examples

**Check existing:**

```bash
curl -X GET "https://your-api.com/patients/by-pesel?pesel=99010101234"
```

**Check non-existing:**

```bash
curl -X GET "https://your-api.com/patients/by-pesel?pesel=12345678901"
```

**Invalid (e.g. too short):**

```bash
curl -X GET "https://your-api.com/patients/by-pesel?pesel=123"
```
