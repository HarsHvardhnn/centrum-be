# ICD-10 (Diagnoses) and ICD-9 (Procedures) – API and Integration

Backend integration for ICD-10 diagnoses and ICD-9 procedures on **visits** (appointments). Visit = one appointment document (`Appointment` model); `visitId` in APIs is the appointment `_id`.

---

## 1. Database schema (MongoDB / Mongoose)

| Collection (model) | Purpose |
|--------------------|--------|
| **Icd10Master** | ICD-10 code list (~70k). Imported via admin; used for autocomplete. |
| **Icd9Master** | ICD-9 procedure list (~4k). Imported via admin. |
| **VisitDiagnosis** | Diagnoses linked to a visit. Stores `icd10_code`, `icd10_name`, `is_primary`. |
| **VisitProcedure** | Procedures linked to a visit. Stores `icd9_code`, `icd9_name`. |

**Indexes**

- `Icd10Master`: `code`, `full_name` (and compound) for fast search.
- `Icd9Master`: `code`, `full_name`.
- `VisitDiagnosis` / `VisitProcedure`: `visit_id`.

Visit tables store **both code and name** so history stays correct if master data changes later.

---

## 2. Search APIs (autocomplete)

**ICD-10**

- `GET /api/icd10/search?q={query}`
- Case-insensitive; matches **code** or **full_name** (substring/prefix).
- Max **10** results.
- Response: `[{ "code": "E11", "name": "Type 2 diabetes mellitus" }, ...]`

**ICD-9**

- `GET /api/icd9/search?q={query}`
- Same behaviour.
- Response: `[{ "code": "45.13", "name": "Colonoscopy" }, ...]`

Auth: Bearer token; roles `admin`, `doctor`, `receptionist`.

---

## 3. Admin import

- `POST /admin/icd10/import`
- `POST /admin/icd9/import`

**Auth:** admin only.

**Body (JSON)**

```json
{
  "items": [
    { "code": "E11", "full_name": "Type 2 diabetes mellitus" },
    { "code": "I10", "full_name": "Essential hypertension" }
  ]
}
```

**Or:** multipart form with a **file** (CSV). CSV format: first line `code,full_name`, then one row per code. Duplicates by `code` are skipped (first wins).

---

## 4. Visit diagnosis APIs

Base path: `/appointments/:visitId/...` where `visitId` = appointment `_id`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/appointments/:visitId/diagnoses` | Add diagnosis. Body: `{ "code", "name", "isPrimary" }`. Only one primary; adding a new primary clears the previous. |
| GET | `/appointments/:visitId/diagnoses` | List diagnoses for visit. |
| DELETE | `/appointments/:visitId/diagnoses/:diagnosisId` | Remove one diagnosis. |

**Add example**

```json
POST /appointments/6789abc.../diagnoses
{ "code": "E11", "name": "Type 2 diabetes mellitus", "isPrimary": true }
```

---

## 5. Visit procedure APIs

| Method | Path | Description |
|--------|------|-------------|
| POST | `/appointments/:visitId/procedures` | Add procedure. Body: `{ "code", "name" }`. |
| GET | `/appointments/:visitId/procedures` | List procedures. |
| DELETE | `/appointments/:visitId/procedures/:procedureId` | Remove one procedure. |

---

## 6. PDF export – medical codes for a visit

**REST**

- `GET /appointments/:visitId/medical-codes`

**Response**

```json
{
  "success": true,
  "data": {
    "diagnoses": [
      { "code": "E11", "name": "Type 2 diabetes mellitus", "isPrimary": true }
    ],
    "procedures": [
      { "code": "45.13", "name": "Colonoscopy" }
    ]
  }
}
```

**Backend helper (for server-side PDF)**

```js
const { getVisitMedicalCodes } = require("./services/visitMedicalCodesService");
const { diagnoses, procedures } = await getVisitMedicalCodes(appointmentId);
// Use in PDF generation.
```

---

## 7. Performance

- Search uses indexed fields and regex (case-insensitive) with limit 10; target &lt;100 ms for ~70k ICD-10 and ~4k ICD-9.
- If the dataset grows, consider:
  - **Trigram/indexed substring**: e.g. MongoDB Atlas Search or a trigram index on `full_name` for faster substring search.
  - **Full-text**: MongoDB text index on `full_name` + `code` if you need word-based search.

---

## 8. Integration with existing visit system

- **Visit** = one document in the existing **Appointment** collection. No change to the Appointment schema; diagnoses and procedures live in **VisitDiagnosis** and **VisitProcedure** with `visit_id` = `Appointment._id`.
- To show diagnoses/procedures on the visit screen: call `GET /appointments/:visitId/diagnoses` and `GET /appointments/:visitId/procedures` (or `GET .../medical-codes` once).
- For **visit PDF**: call `getVisitMedicalCodes(visitId)` in the backend or `GET /appointments/:visitId/medical-codes` and pass the result into your PDF template.

---

## 9. Test data

Optional seed script:

```bash
node scripts/seed-icd-test-data.js
```

Inserts a few ICD-10 (e.g. E11, I10, J20) and ICD-9 codes for testing.

---

## 10. Postman

Import **postman/ICD_Visit_Codes_Collection.postman_collection.json**. Set variables: `baseUrl`, `token`, `visitId`, and optionally `diagnosisId` / `procedureId` for delete requests.
