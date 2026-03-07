# Populating ICD-10 and ICD-9 with Real-Life Data

This document describes how to fill the **Icd10Master** and **Icd9Master** collections with real-life code lists (~70k ICD-10 diagnoses, ~4k ICD-9 procedures) using either the **admin import API** or the **seed script**.

---

## 1. Required format

Both import methods expect data in this shape:

- **ICD-10:** `code` (e.g. `E11`), `full_name` (e.g. `Type 2 diabetes mellitus`).
- **ICD-9:** same — `code` (e.g. `45.13`), `full_name` (e.g. `Colonoscopy`).

CSV must have a header row. Supported column names (case-insensitive): `code`, `full_name` (or `fullName`, `name`, `Long Description`, `description`, `title`). The seed script also accepts tab-separated files.

---

## 2. Where to get real-life data

### ICD-10 (diagnoses)

- **CMS (US):**  
  [CMS ICD-10-CM](https://www.cms.gov/medicare/coding-billing/icd-10-codes/2024-icd-10-cm) — Code Tables / Code Descriptions (ZIP). Extract and convert to CSV with columns `code` and `full_name`.
- **CDC NCHS:**  
  [CDC ICD-10-CM](https://www.cdc.gov/nchs/icd/icd-10-cm.htm) — same data, often in TXT/CSV. Normalize to `code`, `full_name`.
- **WHO:**  
  [ICD-10 versions](https://icdcdn.who.int/icd10/index.html) — ClaML (XML) or tabular; you may need a small script to convert to CSV.
- **Third-party (e.g. GitHub):**  
  Search for “ICD-10 CSV” or “ICD-10 JSON”; ensure the source is reputable and the dataset has `code` + description. Map the description column to `full_name`.

### ICD-9 (procedures)

- **CMS (US):**  
  [ICD-9-CM Procedure Codes](https://www.cms.gov/medicare/coding-billing/icd-10-codes/icd-9-cm-diagnosis-procedure-codes-abbreviated-and-full-code-titles) — full and abbreviated titles; pick procedure files and convert to `code`, `full_name`.
- **HCUP (AHRQ):**  
  Procedure code files (e.g. [Procedure Classes](https://hcup-us.ahrq.gov/toolssoftware/procedure/procedure.jsp)) — often include ICD-9 procedure codes; map to `code` and `full_name`.
- **GitHub:**  
  Repositories such as [drobbins/ICD9](https://github.com/drobbins/ICD9) provide ICD-9 in text/CSV; confirm it is **procedure** codes if your app uses ICD-9 only for procedures.

After downloading, ensure your file has:
- One row per code.
- A header row with something that maps to `code` and `full_name` (see above).

---

## 3. Using the seed script (recommended for large files)

A Node script reads a local CSV or JSON file and inserts into MongoDB in batches, skipping codes that already exist.

**Usage:**

```bash
# From project root
node scripts/seed-icd-real-data.js --icd10=path/to/icd10.csv
node scripts/seed-icd-real-data.js --icd9=path/to/icd9.csv
node scripts/seed-icd-real-data.js --icd10=icd10.csv --icd9=icd9.csv
```

**Requirements:**

- `MONGODB_URI` or `MONGO_URI` in `.env`.
- CSV: first line = header; columns for code and full name (see “Required format” and script comments).
- JSON: `{ "items": [ { "code": "...", "full_name": "..." }, ... ] }` or array of `{ code, full_name }`.

**Behaviour:**

- Duplicates in the file: kept once per code.
- Codes already in DB: skipped.
- Inserts in batches of 1000 to avoid timeouts and memory issues.

**Example CSV (`icd10.csv`):**

```csv
code,full_name
E11,Type 2 diabetes mellitus
I10,Essential (primary) hypertension
J20,Acute bronchitis
```

---

## 4. Unprotected seed endpoint (from main server)

You can run the same batch seed from the main server via an **unprotected** HTTP endpoint (no auth):

- **POST** `/api/icd/seed`

**JSON body example:**

```json
{
  "icd10": {
    "items": [
      { "code": "E11", "full_name": "Type 2 diabetes mellitus" },
      { "code": "I10", "full_name": "Essential hypertension" }
    ]
  },
  "icd9": {
    "items": [
      { "code": "45.13", "full_name": "Colonoscopy" }
    ]
  }
}
```

Send either `icd10` or `icd9` (or both). Each can be `{ "items": [ ... ] }`.

**Multipart (CSV files):**  
Use form fields `icd10` and/or `icd9` with CSV files (first line `code,full_name`). Max 50 MB per file.

**Response:**  
`{ "success": true, "message": "ICD seed completed", "icd10": { "inserted": 123 }, "icd9": { "inserted": 45 } }`

Duplicate codes (already in DB) are skipped. Inserts are done in batches of 1000.

---

## 5. Using the admin import API

You can also use the existing admin endpoints with a CSV file or JSON body.

- **ICD-10:** `POST /admin/icd10/import`
- **ICD-9:** `POST /admin/icd9/import`

Auth: admin only. See [ICD_VISIT_CODES_API.md](./ICD_VISIT_CODES_API.md) for details.

**JSON body example:**

```json
{
  "items": [
    { "code": "E11", "full_name": "Type 2 diabetes mellitus" },
    { "code": "I10", "full_name": "Essential hypertension" }
  ]
}
```

**CSV upload:** send a multipart form with a file; first line must be `code,full_name`, then one row per code.

**Note:** For ~70k ICD-10 rows, the API may hit timeouts or body size limits. Prefer the **seed script** for full real-life imports; use the API for smaller updates or one-off batches.

---

## 6. Quick checklist

1. Obtain ICD-10 and/or ICD-9 procedure data (CMS, CDC, WHO, or trusted third-party).
2. Convert to CSV (or JSON) with `code` and `full_name` (or equivalent headers the script/API accept).
3. Run the seed:  
   - From the server: `POST /api/icd/seed` with JSON body or CSV file uploads (unprotected).  
   - Or locally: `node scripts/seed-icd-real-data.js --icd10=your-icd10.csv --icd9=your-icd9.csv`  
   - Or use the admin import API for smaller batches.
4. Verify: call `GET /api/icd10/search?q=diabetes` and `GET /api/icd9/search?q=colon` to confirm data is present.
