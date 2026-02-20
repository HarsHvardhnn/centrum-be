# Complete registration API – phone, address, existing patient, international

**Endpoint:** `POST /appointments/:visitId/complete-registration`  
**Purpose:** Assign a visit to a patient by PESEL (create/link), by existing patient ID, or by **international patient (no PESEL)** using document identification. Supports file uploads (documents) like the Create Patient API.

**Content-Type:** `application/json` (no files) or `multipart/form-data` with field name **`files`** (max 10 files) when uploading documents.

---

## Three ways to complete registration

1. **International patient (no PESEL)**  
   Send `isInternationalPatient: true` and **no** `pesel`. Required: `firstName`, `lastName`, `dateOfBirth`, `documentCountry`, `documentType`, `documentNumber`, `internationalPatientDocumentKey`. Backend creates patient with `npesei`, stores document key and document fields, saves uploaded files to `patient.documents`, and links the visit. If a patient with the same `internationalPatientDocumentKey` already exists → **409** with `existingPatientId`.
2. **New or find-by-PESEL**  
   Send `pesel` (required) plus optional patient data. Backend finds patient by PESEL or creates a new one, then links the visit.
3. **Existing patient by ID**  
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

### International patient only (when `isInternationalPatient: true`)

| Field name | Type   | Required | Description |
|------------|--------|----------|-------------|
| `isInternationalPatient` | boolean | Yes | Must be `true` for this path. |
| `firstName` | string | Yes | Patient first name. |
| `lastName` | string | Yes | Patient last name. |
| `dateOfBirth` | string | Yes | ISO or `YYYY-MM-DD`. |
| `documentCountry` | string | Yes | Country of document issuance (e.g. "Germany"). |
| `documentType` | string | Yes | One of: `"Passport"`, `"ID Card"`, `"Residence Card"`, `"Other"`. |
| `documentNumber` | string | Yes | Document number. |
| `internationalPatientDocumentKey` | string | Yes | Unique key for duplicate check. Format e.g. `"country|documentType|documentNumber"` (e.g. `"Germany|Passport|AB123456"`). |

Optional for international: `phone`, `phoneCode`, `mobileNumber`, `email`, `sex`, `street`, `zipCode`, `city`, `smsConsentAgreed`, `consents`.

**Document upload (international or PESEL new patient):** Send request as **`multipart/form-data`** with the same body fields and an additional field **`files`** (array of files). Files are saved to `patient.documents` (same structure as Create Patient API). Max 10 files.

---

## Response (200)

- `success`, `message`, `appointment`, `patient`, `existing`, optional `peselWarning`.
- **patient** object: `_id`, `patientId`, `name`, `govtId` (null for international), `npesei`, `phone`, `phoneCode`, **`street`**, **`zipCode`**, **`city`**, and for international: **`documentCountry`**, **`documentType`**, **`documentNumber`**, **`internationalPatientDocumentKey`**, **`documents`** (when populated).
- `appointment.patient` is populated with patient fields including address, document fields, and `documents` when present.
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
