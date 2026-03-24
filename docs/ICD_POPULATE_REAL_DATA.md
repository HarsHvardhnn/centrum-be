# Populating ICD-10 and ICD-9 with Real-Life Data

This document describes how to fill the **Icd10Master** and **Icd9Master** collections with real-life code lists (~70k ICD-10 diagnoses, ~4k ICD-9 procedures) using either the **admin import API** or the **seed script**.

---

## 1. Where to get the data (direct links)

You need two files: one for ICD-10 (diagnoses) and one for ICD-9 (procedures). Below are **ready-to-use** sources you can download and use with the seed script or the `/api/icd/seed` endpoint.

### ICD-10 (diagnoses) – ready-to-use CSV

| Source | Link | What to do |
|--------|------|------------|
| **GitHub (Bobrovskiy)** | **[Download diagnosis.csv](https://raw.githubusercontent.com/Bobrovskiy/ICD-10-CSV/master/2020/diagnosis.csv)** | CSV has columns `Code` and `LongDescription`. The seed script accepts these as-is (no need to rename). ~14 MB, ~70k rows. |
| **GitHub (2019 same repo)** | **[Download 2019 diagnosis.csv](https://raw.githubusercontent.com/Bobrovskiy/ICD-10-CSV/master/2019/diagnosis.csv)** | Same format if you prefer 2019. |

**Steps:**

1. Open the link and save as `icd10.csv` (or use browser “Save as” / `curl -o icd10.csv "https://raw.githubusercontent.com/Bobrovskiy/ICD-10-CSV/master/2020/diagnosis.csv"`).
2. Run:  
   `node scripts/seed-icd-real-data.js --icd10=icd10.csv`  
   or upload `icd10.csv` to **POST /api/icd/seed** (form field `icd10`).

### ICD-9 (procedures) – ready-to-use CSV

| Source | Link | What to do |
|--------|------|------------|
| **NBER (official-style data)** | **[ICD-9 procedure codes page](https://www.nber.org/research/data/icd-9-cm-diagnosis-and-procedure-codes)** | On that page, under “Surgical Procedure”, click **CSV** for the year you want (e.g. 2015). Direct file: `https://data.nber.org/data/ICD9ProviderDiagnosticCodes/2015/icd9sg2015.csv` |
| **Direct 2015 procedure CSV** | **https://data.nber.org/data/ICD9ProviderDiagnosticCodes/2015/icd9sg2015.csv** | Columns: `prcdrcd` (code), `longdesc` (description). The seed script accepts these as-is. ~3,882 procedure codes. |

**Steps:**

1. Download the CSV (e.g. save as `icd9.csv`). If the NBER link asks for a description page, use the main page link above and pick the CSV from the table.
2. Run:  
   `node scripts/seed-icd-real-data.js --icd9=icd9.csv`  
   or upload `icd9.csv` to **POST /api/icd/seed** (form field `icd9`).

### If the NBER CSV link doesn’t work

- Go to **[NBER ICD-9-CM data](https://www.nber.org/research/data/icd-9-cm-diagnosis-and-procedure-codes)**.
- In the table, find the row for the year you want (e.g. 2015).
- Under **Surgical Procedure**, click the **CSV** link — it will download a file like `icd9sg2015.csv`.
- Use that file as `icd9.csv` in the steps above.

---

## 2. Required format (for other files)

If you use a different source, both import methods expect:

- **ICD-10:** `code` (e.g. `E11`), `full_name` (e.g. `Type 2 diabetes mellitus`).
- **ICD-9:** same — `code` (e.g. `45.13`), `full_name` (e.g. `Colonoscopy`).

CSV must have a header row. The seed script also accepts these column names (case-insensitive): `Code`, `LongDescription` / `Long description`, `full_name`, `name`, `description`, `title`; for NBER procedure CSV: `prcdrcd` (code), `longdesc` (description). Tab-separated files are supported.

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
