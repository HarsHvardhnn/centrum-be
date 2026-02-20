# Complete registration API – phone, address, existing patient

**Endpoint:** `POST /appointments/:visitId/complete-registration`  
**Purpose:** Assign a visit to a patient by PESEL (create new patient or link to existing), or by existing patient ID. Supports phone fields, address fields (street, zip code, city), and linking an existing patient without PESEL.

---

## Two ways to complete registration

1. **New or find-by-PESEL**  
   Send `pesel` (required) plus optional patient data. Backend finds patient by PESEL or creates a new one, then links the visit.
2. **Existing patient by ID**  
   Send `isExisting: true` and `patientId` (MongoDB `_id` of the patient). No PESEL required. Backend links the visit to that patient (404 if patient not found or deleted).

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

When using **PESEL path** (new or find-by-PESEL), send `pesel` plus any optional fields. When using **existing-patient path**, send only `isExisting` and `patientId`; other fields are optional and can update the existing patient.

| Field           | Type   | Required | Description |
|----------------|--------|----------|-------------|
| `pesel`        | string | Yes*     | 11-digit PESEL (non-digits stripped). *Not required when `isExisting: true` and `patientId` are sent. |
| `isExisting`   | boolean| No       | If `true`, backend expects `patientId` and links visit to that patient (no PESEL). |
| `patientId`    | string | No       | Patient `_id` (MongoDB ObjectId). Required when `isExisting` is `true`. |
| `firstName`    | string | No       | First name (default if new patient). |
| `lastName`     | string | No       | Last name (default if new patient). |
| `dateOfBirth`  | string | No       | Date of birth (ISO or parseable). |
| `phone`        | string | No       | Full number with country code. |
| `phoneCode`    | string | No       | Country code, e.g. `"+48"`. |
| `mobileNumber` | string | No       | Number without country code. |
| `email`        | string | No       | Email. |
| `sex`          | string | No       | Sex. |
| **Address (optional)** | | | Stored in patient's address fields. |
| `street`       | string | No       | Street address (saved as patient `address`). |
| `zipCode`      | string | No       | Zip / postal code (saved as patient `pinCode`). |
| `city`         | string | No       | City (saved as patient `city`). |
| `smsConsentAgreed` | bool | No   | SMS consent. |
| `consents`     | array  | No       | Consent list. |

---

## Response (200)

- `success`, `message`, `appointment`, `patient`, `existing`, optional `peselWarning`.
- **patient** object: `_id`, `patientId`, `name`, `govtId`, `phone`, `phoneCode`, **`street`**, **`zipCode`**, **`city`** (address fields returned with these names; stored in DB as `address`, `pinCode`, `city`).
- `appointment.patient` is populated with patient fields including `address`, `pinCode`, `city` (DB names).
- `patient.phone` is masked (empty string) when the patient has no real phone (placeholder used internally).
- `patient.phoneCode` is returned (e.g. `"+48"`) when stored.

---

## Examples

**PESEL path with phone and address:**

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
  "street": "ul. Marszałkowska 1",
  "zipCode": "00-001",
  "city": "Warszawa",
  "smsConsentAgreed": true
}
```

**Existing patient (no PESEL):**

```json
POST /appointments/60d5ec49f1b2c72b8c8e4f1a/complete-registration
{
  "isExisting": true,
  "patientId": "6995bdc724b62fb4d6c0f39e"
}
```

Optional: you can still send address (or other) fields when linking existing patient to update their data:

```json
{
  "isExisting": true,
  "patientId": "6995bdc724b62fb4d6c0f39e",
  "street": "ul. Nowa 5",
  "zipCode": "00-100",
  "city": "Kraków"
}
```

**Minimal (PESEL only, no phone):**

```json
{
  "pesel": "99010101234",
  "firstName": "Jan",
  "lastName": "Nowak",
  "email": "jan@example.com"
}
```
