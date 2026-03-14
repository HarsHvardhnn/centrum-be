# Global visit template API (szablon globalny)

Base path: **`/api/visit-templates`**  
Auth: **doctor** (own templates) or **admin** (optional `?doctorId=` to act for a doctor).

Global templates define a full visit structure: text sections (Wywiad, Badanie przedmiotowe, etc.) **and** optional **ICD-10 diagnoses (Rozpoznanie)** and **ICD-9 procedures (Procedury)**. When the user "loads" a template, the FE can pre-fill both the text fields and the diagnosis/procedure lists.

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/visit-templates/global` | List all global templates for the doctor |
| POST | `/api/visit-templates/global` | Create a new global template |
| PATCH | `/api/visit-templates/global/:id` | Update a global template |
| DELETE | `/api/visit-templates/global/:id` | Delete a global template |

---

## List global templates

**GET** `/api/visit-templates/global`

**Query (optional):**  
- `doctorId` – only for **admin**; list templates for this doctor (ObjectId).

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "doctorId": "...",
      "name": "Konsultacja chirurgiczna",
      "sections": {
        "interview": "Wywiad...",
        "physicalExamination": "Badanie...",
        "treatment": "",
        "recommendations": "",
        "notes": ""
      },
      "diagnoses": [
        { "code": "K80", "name": "Kamica żółciowa", "isPrimary": true },
        { "code": "K90", "name": "Zaburzenia wchłaniania jelitowego", "isPrimary": false }
      ],
      "procedures": [
        { "code": "97.38", "name": "Usunięcie szwów z głowy lub szyi" },
        { "code": "87.85", "name": "Badanie RTG jajowodów/macicy - inne" }
      ],
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

- **diagnoses**: ICD-10 (Rozpoznanie). Each item: `code`, `name`, `isPrimary` (boolean; one can be marked as main).
- **procedures**: ICD-9 (Procedury). Each item: `code`, `name`.

---

## Create global template

**POST** `/api/visit-templates/global`  
**Content-Type:** `application/json`

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Template name (Polish), e.g. "Konsultacja chirurgiczna" |
| `sections` | object | No | Text content per section (see below) |
| `diagnoses` | array | No | ICD-10 entries (Rozpoznanie) |
| `procedures` | array | No | ICD-9 entries (Procedury) |

**sections** (all optional strings):

- `sections.interview` – Wywiad z pacjentem  
- `sections.physicalExamination` – Badanie przedmiotowe  
- `sections.treatment` – Zastosowane leczenie  
- `sections.recommendations` – Zalecenia  
- `sections.notes` – Notatki  

**diagnoses** – array of objects:

- `code` (string) – ICD-10 code, e.g. `"K80"`  
- `name` (string) – Diagnosis name, e.g. `"Kamica żółciowa"`  
- `isPrimary` (boolean, optional) – `true` for główne (main) diagnosis  

**procedures** – array of objects:

- `code` (string) – ICD-9 code, e.g. `"97.38"`  
- `name` (string) – Procedure name, e.g. `"Usunięcie szwów z głowy lub szyi"`  

**Example request body:**
```json
{
  "name": "Konsultacja chirurgiczna",
  "sections": {
    "interview": "Treść dla Wywiad z pacjentem...",
    "physicalExamination": "Treść dla Badanie przedmiotowe...",
    "treatment": "",
    "recommendations": "Kontrola za 2 tygodnie.",
    "notes": ""
  },
  "diagnoses": [
    { "code": "K80", "name": "Kamica żółciowa", "isPrimary": true },
    { "code": "K90", "name": "Zaburzenia wchłaniania jelitowego", "isPrimary": false }
  ],
  "procedures": [
    { "code": "97.38", "name": "Usunięcie szwów z głowy lub szyi" },
    { "code": "87.85", "name": "Badanie RTG jajowodów/macicy - inne" }
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "doctorId": "...",
    "name": "Konsultacja chirurgiczna",
    "sections": { ... },
    "diagnoses": [ ... ],
    "procedures": [ ... ],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

- Invalid or empty diagnosis/procedure items (no `code` and no `name`) are dropped.  
- Backend normalizes `diagnoses` and `procedures` (trim strings, default `isPrimary: false`).

---

## Update global template

**PATCH** `/api/visit-templates/global/:id`  
**Content-Type:** `application/json`

**Params:** `id` – template ObjectId.

**Body:** Same as create; all fields optional. Only sent fields are updated.

- **name** – string  
- **sections** – object (only provided section keys are updated)  
- **diagnoses** – array (replaces entire list; use `[]` to clear)  
- **procedures** – array (replaces entire list; use `[]` to clear)  

**Example (only ICD fields):**
```json
{
  "diagnoses": [
    { "code": "E11", "name": "Type 2 diabetes mellitus", "isPrimary": true }
  ],
  "procedures": [
    { "code": "0390", "name": "Insertion of catheter into spinal canal for infusion..." }
  ]
}
```

**Response 200:** Same shape as create response (`data` = updated template).

**Errors:** 400 invalid id, 404 template not found.

---

## Delete global template

**DELETE** `/api/visit-templates/global/:id`

**Response 200:** `{ "success": true, "message": "Szablon usunięty" }`  
**Errors:** 400 invalid id, 404 template not found.

---

## Frontend: "Nowy szablon globalny" form

To support ICD-10 and ICD-9 in the modal:

1. **Existing fields** – keep: Nazwa szablonu, Wywiad z pacjentem, Badanie przedmiotowe, Zastosowane leczenie, Zalecenia, Notatki.

2. **Add two new blocks:**
   - **Rozpoznanie (ICD-10)**  
     - List of diagnoses: for each row, inputs for **code**, **name**, and optional checkbox **główne** (maps to `isPrimary`).  
     - Buttons: "Dodaj rozpoznanie", remove row.  
     - On save, send as `body.diagnoses`: array of `{ code, name, isPrimary }`.

   - **Procedury (ICD-9)**  
     - List of procedures: for each row, inputs for **code** and **name**.  
     - Buttons: "Dodaj procedurę", remove row.  
     - On save, send as `body.procedures`: array of `{ code, name }`.

3. **Load template (edit or apply):**
   - GET list or single template; pre-fill form with `name`, `sections.*`, `diagnoses`, `procedures`.  
   - When applying template to a visit, create/update visit diagnoses and procedures via existing visit APIs (e.g. POST `/appointments/:visitId/diagnoses`, POST `/appointments/:visitId/procedures`) using the template’s `diagnoses` and `procedures` arrays.

4. **Validation (optional):**  
   - Backend accepts any non-empty `code`/`name`; you can optionally validate codes against your ICD-10/ICD-9 search APIs before submit.

---

## TypeScript types (for FE)

```ts
interface DiagnosisEntry {
  code: string;
  name: string;
  isPrimary?: boolean;
}

interface ProcedureEntry {
  code: string;
  name: string;
}

interface GlobalTemplateSections {
  interview?: string;
  physicalExamination?: string;
  treatment?: string;
  recommendations?: string;
  notes?: string;
}

interface GlobalVisitTemplate {
  _id: string;
  doctorId: string;
  name: string;
  sections: GlobalTemplateSections;
  diagnoses: DiagnosisEntry[];
  procedures: ProcedureEntry[];
  createdAt: string;
  updatedAt: string;
}

// Create/update body
interface GlobalTemplateCreateUpdateBody {
  name?: string;
  sections?: GlobalTemplateSections;
  diagnoses?: DiagnosisEntry[];
  procedures?: ProcedureEntry[];
}
```

---

## Summary

- **GET /api/visit-templates/global** – list templates; each has `diagnoses` and `procedures`.  
- **POST /api/visit-templates/global** – create with `name`, `sections`, `diagnoses`, `procedures`.  
- **PATCH /api/visit-templates/global/:id** – update any of `name`, `sections`, `diagnoses`, `procedures` (diagnoses/procedures replace entire array).  
- **FE:** Add Rozpoznanie (ICD-10) and Procedury (ICD-9) to the "Nowy szablon globalny" form; send and receive them as above.
