# ICD client XML – analysis and import

## Summary

- **No DB schema changes** are required. Existing `Icd10Master` and `Icd9Master` models use `code` and `full_name`; the client’s XML maps directly to these fields.
- You can **replace** the current (wrong) data by clearing the master collections and running the new import script that reads the client’s XML files.

---

## 1. Current DB schema (unchanged)

| Model         | Fields       | Purpose                          |
|---------------|--------------|-----------------------------------|
| `Icd10Master` | `code`, `full_name` | Lookup/autocomplete for diagnoses |
| `Icd9Master`  | `code`, `full_name` | Lookup/autocomplete for procedures |

`VisitDiagnosis` and `VisitProcedure` store `icd10_code`/`icd10_name` and `icd9_code`/`icd9_name` per visit; they do not reference the master tables by ID, so changing master data does not require any migration of visit data.

---

## 2. Client ICD-9 XML (`ICD9_85_20260108_100054.xml`)

- **Format:** Flat list of entries.
- **Element:** `pozycja_slownika` with attributes:
  - `kod` → map to **code**
  - `nazwa` → map to **full_name** (Polish)
  - `status` (e.g. `"A"`) – optional; we don’t need to store it.
- **Optional child:** `daty_proc data_od="..."` – validity date; not needed for current schema.

**Mapping:** `kod` → `code`, `nazwa` → `full_name`. One document per `pozycja_slownika` with non-empty `kod` and `nazwa`. No schema change.

---

## 3. Client ICD-10 XML (`ICD10_2008_PL_v2024_03_12.xml`)

- **Format:** Hierarchical (nested `node` elements under `hcd` → `nodes`).
- **Namespace:** Default `xmlns="http://rsk.rejestrymedyczne.csioz.gov.pl"` (parser must handle or strip).
- **Per node:**
  - `node` has attribute `code` (e.g. `"A00"`, `"A00.0"`, or range `"A00–B99"`).
  - Child `name` = Polish title → **full_name**.
  - Optional `attributes` / `attribute name="EN"` = English; we don’t need to store it for current schema.
- **Empty codes:** Some nodes have `code=""` (e.g. synonyms); we only insert nodes with non-empty `code` and non-empty `name`.

**Mapping:** For every `node` with non-empty `code` and non-empty `name`, insert `{ code: node.@code, full_name: node.name }`. Chapters/ranges (e.g. `A00–B99`) can be included for search; assignable codes are the leaf/specific ones (e.g. `A00`, `A00.0`). No schema change.

---

## 4. Import approach

1. **Optional:** Clear existing ICD master data (if you want to fully replace the old “Google” data):
   - `Icd10Master.deleteMany({})`
   - `Icd9Master.deleteMany({})`
2. Run the new seed script that:
   - Parses `icd/ICD9_85_20260108_100054.xml` → insert into `Icd9Master`.
   - Parses `icd/ICD10_2008_PL_v2024_03_12.xml` → flatten tree, insert into `Icd10Master`.
3. No migration, no new collections, no new fields. Visit diagnoses/procedures keep using `icd10_code`/`icd10_name` and `icd9_code`/`icd9_name` as today.

---

## 5. Script and usage

- **Script:** `scripts/seed-icd-from-client-xml.js`
- **XML paths (default):** `icd/ICD10_2008_PL_v2024_03_12.xml`, `icd/ICD9_85_20260108_100054.xml`

Commands (from project root, after `npm install`):

```bash
# Add new codes; skip codes that already exist
npm run seed:icd-client-xml

# Replace all ICD master data with client XML (deletes existing, then inserts)
npm run seed:icd-client-xml:replace
```

Or directly:

```bash
node scripts/seed-icd-from-client-xml.js
node scripts/seed-icd-from-client-xml.js --replace
```

Requires `fast-xml-parser` (added to `package.json`) and `MONGODB_URI` or `MONGO_URI` in `.env`.
