# Complete registration API – phone, phoneCode, mobileNumber

**Endpoint:** `POST /appointments/:visitId/complete-registration`  
**Purpose:** Assign a visit to a patient by PESEL (create new patient or link to existing). Supports the same phone fields as the create-appointment API.

---

## Phone fields (aligned with create-appointment)

When the user enters a phone number, the frontend can send any of:

| Field          | Type   | Description |
|----------------|--------|-------------|
| `phone`        | string | Full number with country code, e.g. `"+48123456789"`. Omitted when user leaves phone empty. |
| `phoneCode`    | string | Country code only, e.g. `"+48"`. Sent only when phone is present. |
| `mobileNumber` | string | Number without country code, e.g. `"123456789"`. Sent only when phone is present. |

- When the user **enters** a phone: send all three (or at least `phone` or `phoneCode` + `mobileNumber`).
- When the user **leaves phone empty**: omit all three (or backend treats them as optional and ignores).

Backend behaviour:

- If `phone` is provided: it is normalized (digits only, leading zeros removed) and stored; `phoneCode` is stored when provided (default `"+48"`).
- If only `phoneCode` and `mobileNumber` are provided: they are combined and stored as above; `phoneCode` is stored.
- When **no** phone is provided: no patient phone is required; backend uses an internal placeholder for DB uniqueness and returns empty phone in the response.

---

## Request body (main fields)

| Field           | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `pesel`        | string | Yes      | 11-digit PESEL (non-digits stripped). |
| `firstName`    | string | No       | First name (default if new patient). |
| `lastName`    | string | No       | Last name (default if new patient). |
| `dateOfBirth` | string | No       | Date of birth (ISO or parseable). |
| `phone`        | string | No       | Full number with country code. |
| `phoneCode`    | string | No       | Country code, e.g. `"+48"`. |
| `mobileNumber` | string | No       | Number without country code. |
| `email`        | string | No       | Email. |
| `sex`          | string | No       | Sex. |
| `smsConsentAgreed` | bool | No   | SMS consent. |
| `consents`     | array  | No       | Consent list. |

---

## Response (200)

- Same as before: `success`, `message`, `appointment`, `patient` (with `_id`, `patientId`, `name`, `govtId`, `phone`, `phoneCode`), `existing`, optional `peselWarning`.
- `patient.phone` is masked (empty string) when the patient has no real phone (placeholder used internally).
- `patient.phoneCode` is returned (e.g. `"+48"`) when stored.

---

## Example (with phone fields)

```json
POST /appointments/60d5ec49f1b2c72b8c8e4f1a/complete-registration
{
  "pesel": "99010101234",
  "firstName": "Anna",
  "lastName": "Kowalska",
  "dateOfBirth": "1999-01-01",
  "phone": "+48123456789",
  "phoneCode": "+48",
  "mobileNumber": "123456789",
  "email": "anna@example.com",
  "sex": "Female",
  "smsConsentAgreed": true
}
```

Without phone (all omitted or empty):

```json
{
  "pesel": "99010101234",
  "firstName": "Jan",
  "lastName": "Nowak",
  "email": "jan@example.com"
}
```
