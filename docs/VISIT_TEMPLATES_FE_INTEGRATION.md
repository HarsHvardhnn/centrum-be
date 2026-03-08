# Visit Documentation Templates – Frontend Integration Guide

This document describes the **visit documentation template system** (section templates and global visit templates) from the product spec, how the **backend** implements it, and how the **frontend** should integrate.

---

## 1. Product behaviour (from spec / PDF)

### Language rule

- All **template names**, **section names**, **visit documentation labels**, and **dictionary values** must remain **exactly in Polish** in the UI and in stored data (e.g. template `name`).
- Code (variables, APIs) may use English; labels and user-visible text must match the Polish wording from the spec.

### 1.1 Section templates

- **Purpose:** Reusable content for **one** documentation field (e.g. „Wywiad z pacjentem”, „Badanie przedmiotowe”, „Zastosowane leczenie”, „Zalecenia”, „Notatki”).
- **Example:** Doctor creates a section template **„Wywiad chirurgiczny”** with content (e.g. bullet list).
- **Usage on visit card (karta wizyty):**
  - Each section has a button: **„Wybierz szablon…”**.
  - On click: show list of **section templates assigned to that section** → doctor selects one → **only that section’s field** is filled with the template content; other sections stay unchanged.

### 1.2 Global visit templates

- **Purpose:** A **full visit** structure: several sections at once (e.g. Wywiad, Badanie przedmiotowe, Zastosowane leczenie, Zalecenia).
- **Example:** **„Konsultacja chirurgiczna”** with content for multiple sections (sections may themselves use section templates when building the global template).
- **Usage on visit card:**
  - At the **top** of the visit documentation screen: **„Załaduj szablon globalny”**.
  - On click: show list of **doctor’s global templates** → doctor selects one → **all relevant sections** of the visit form are filled.
  - After load, the doctor can still **edit any field**; the template is only the initial structure.

### 1.3 Out of scope (current task)

- **Configurable visit card fields** (custom layouts, renaming/hiding sections) are a **future extension**, not part of this implementation.

---

## 2. Backend implementation summary

### 2.1 Section keys (visit fields)

The visit card has these **fixed** documentation sections. Backend uses internal keys; UI must show Polish labels:

| Backend key             | Polish label (UI)       |
|-------------------------|--------------------------|
| `interview`             | Wywiad z pacjentem       |
| `physicalExamination`   | Badanie przedmiotowe     |
| `treatment`             | Zastosowane leczenie     |
| `recommendations`       | Zalecenia                |
| `notes`                 | Notatki                  |

These map to the **Appointment** model as follows:

- `interview` → `appointment.consultation.interview`
- `physicalExamination` → `appointment.consultation.physicalExamination`
- `treatment` → `appointment.consultation.treatment`
- `recommendations` → `appointment.consultation.recommendations`
- `notes` → `appointment.consultation.consultationNotes`

### 2.2 Section templates (one field)

- **Model:** `SectionTemplate`: `doctorId`, `sectionKey`, `name` (Polish), `content` (text).
- **Scope:** Each doctor has their own section templates; optionally filter by `sectionKey` (e.g. only templates for „Wywiad z pacjentem”).

### 2.3 Global visit templates (full visit)

- **Model:** `GlobalVisitTemplate`: `doctorId`, `name` (Polish), `sections`: `{ interview, physicalExamination, treatment, recommendations, notes }` (each a string).
- **Scope:** Each doctor has their own global templates.

### 2.4 Auth

- **Roles:** `doctor`, `admin`.
- **Doctor:** Can only access **own** templates (backend uses `req.user.id` as `doctorId`).
- **Admin:** Can access another doctor’s templates by passing `?doctorId=...` on **list** endpoints (for support); create/update/delete still scoped to one doctor (admin can pass body/context as needed per your policy).

---

## 3. API base URL and auth

- **Base URL:** `https://<your-api-host>/api/visit-templates` (e.g. `https://centrum-be.onrender.com/api/visit-templates`).
- **Auth:** Bearer token; roles `doctor` or `admin`.

---

## 4. Section templates API

### 4.1 Get section keys and labels

Use this to build section dropdowns or to know which `sectionKey` to use for „Wybierz szablon…” per section.

| Method | URL | Response |
|--------|-----|----------|
| GET    | `/api/visit-templates/sections/keys` | `{ "success": true, "data": [ { "key": "interview", "label": "Wywiad z pacjentem" }, ... ] }` |

### 4.2 List section templates

| Method | URL | Query | Response |
|--------|-----|-------|----------|
| GET    | `/api/visit-templates/sections` | Optional: `sectionKey` (e.g. `interview`) to filter by section | `{ "success": true, "data": [ { "_id", "doctorId", "sectionKey", "name", "content", "createdAt", "updatedAt" }, ... ] }` |

- **FE usage:** For a given section (e.g. „Wywiad z pacjentem”), call with `?sectionKey=interview` and show the list in „Wybierz szablon…” modal; on select, set that section’s field to `template.content`.

### 4.3 Create section template

| Method | URL | Body | Response |
|--------|-----|------|----------|
| POST   | `/api/visit-templates/sections` | `{ "sectionKey": "interview", "name": "Wywiad chirurgiczny", "content": "Dolegliwości główne\nHistoria choroby..." }` | `{ "success": true, "data": { "_id", "doctorId", "sectionKey", "name", "content", ... } }` |

- **FE:** Template **name** must be in Polish (e.g. „Wywiad chirurgiczny”). `sectionKey` must be one of: `interview`, `physicalExamination`, `treatment`, `recommendations`, `notes`.

### 4.4 Update section template

| Method | URL | Body | Response |
|--------|-----|------|----------|
| PATCH  | `/api/visit-templates/sections/:id` | `{ "name": "Nowa nazwa", "content": "..." }` (both optional) | `{ "success": true, "data": { ... } }` |

### 4.5 Delete section template

| Method | URL | Response |
|--------|-----|----------|
| DELETE | `/api/visit-templates/sections/:id` | `{ "success": true, "message": "Szablon usunięty" }` |

---

## 5. Global visit templates API

### 5.1 List global templates

| Method | URL | Response |
|--------|-----|----------|
| GET    | `/api/visit-templates/global` | `{ "success": true, "data": [ { "_id", "doctorId", "name", "sections": { "interview", "physicalExamination", "treatment", "recommendations", "notes" }, "createdAt", "updatedAt" }, ... ] }` |

- **FE usage:** Show this list in „Załaduj szablon globalny”; on select, fill **all** visit section fields from `template.sections.*`.

### 5.2 Create global template

| Method | URL | Body | Response |
|--------|-----|------|----------|
| POST   | `/api/visit-templates/global` | `{ "name": "Konsultacja chirurgiczna", "sections": { "interview": "...", "physicalExamination": "...", "treatment": "...", "recommendations": "...", "notes": "" } }` | `{ "success": true, "data": { "_id", "doctorId", "name", "sections", ... } }` |

- **FE:** All section keys are optional in `sections`; omit or send empty string for unused sections. **Name** in Polish.

### 5.3 Update global template

| Method | URL | Body | Response |
|--------|-----|------|----------|
| PATCH  | `/api/visit-templates/global/:id` | `{ "name": "...", "sections": { "interview": "...", ... } }` (both optional) | `{ "success": true, "data": { ... } }` |

### 5.4 Delete global template

| Method | URL | Response |
|--------|-----|----------|
| DELETE | `/api/visit-templates/global/:id` | `{ "success": true, "message": "Szablon usunięty" }` |

---

## 6. How to integrate on the visit documentation screen (karta wizyty)

### 6.1 Section templates („Wybierz szablon…”)

1. For each documentation section (Wywiad z pacjentem, Badanie przedmiotowe, Zastosowane leczenie, Zalecenia, Notatki), show a button **„Wybierz szablon…”** (or equivalent Polish label from spec).
2. Map the section to its **sectionKey** (see table in §2.1).
3. On button click:
   - Call `GET /api/visit-templates/sections?sectionKey=<key>`.
   - Show the list of templates (use `name` for display; keep `_id` and `content`).
4. When the user selects a template:
   - Set **only that section’s** form field to `selectedTemplate.content`.
   - Do **not** change other sections.
5. User can then edit the field as usual before saving the visit.

### 6.2 Global templates („Załaduj szablon globalny”)

1. At the **top** of the visit documentation form, show an option **„Załaduj szablon globalny”** (or equivalent from spec).
2. On click:
   - Call `GET /api/visit-templates/global`.
   - Show the list of global templates (use `name` for display).
3. When the user selects a template:
   - Fill **all** section fields from `template.sections`:
     - `consultation.interview` ← `sections.interview`
     - `consultation.physicalExamination` ← `sections.physicalExamination`
     - `consultation.treatment` ← `sections.treatment`
     - `consultation.recommendations` ← `sections.recommendations`
     - `consultation.consultationNotes` (Notatki) ← `sections.notes`
4. After loading, the user can edit any field; then save the visit as usual (e.g. existing PATCH/PUT appointment or consultation API).

### 6.3 Saving the visit

- Filling from templates only updates the **local form state** (or draft). The actual persistence is done by your **existing** visit/appointment update API (e.g. update consultation fields). No new save endpoint was added for templates; templates only provide content to prefill the form.

---

## 7. Template settings screens (Doctor Dashboard)

The spec mentions:

- **Doctor Dashboard – Template Section Settings**
- **Doctor Dashboard – Global Template Settings**

FE should implement these settings UIs and call the same APIs:

- **Section template settings:** List (per section or all), Create, Edit, Delete using `/api/visit-templates/sections` (GET, POST, PATCH, DELETE). Use `GET /api/visit-templates/sections/keys` to show section labels when creating/editing.
- **Global template settings:** List, Create, Edit, Delete using `/api/visit-templates/global` (GET, POST, PATCH, DELETE). When creating/editing a global template, you can allow the doctor to fill each section (interview, physicalExamination, treatment, recommendations, notes); send that as the `sections` object.

---

## 8. Error responses

- **400:** Invalid body (e.g. missing `name`, invalid `sectionKey`). Response: `{ "success": false, "message": "..." }`.
- **403:** Not allowed (e.g. not doctor/admin). Response: `{ "success": false, "message": "Dostęp tylko dla lekarza lub administratora" }`.
- **404:** Template not found (wrong id or not owner). Response: `{ "success": false, "message": "Szablon nie znaleziony" }`.
- **500:** Server error. Response: `{ "success": false, "message": "Błąd serwera", "error": "..." }`.

---

## 9. Checklist for FE

- [ ] **Section keys:** Use `GET /api/visit-templates/sections/keys` to get keys and Polish labels; use the same keys when calling list/create and when mapping form fields to `consultation.*` and `consultationNotes`.
- [ ] **„Wybierz szablon…”** per section: GET sections with `sectionKey`, show list, on select set only that section’s value to `template.content`.
- [ ] **„Załaduj szablon globalny”** at top: GET global templates, on select fill all sections from `template.sections` into the visit form.
- [ ] **Template names and labels** in UI and in API bodies (e.g. `name`) are in **Polish**.
- [ ] **Settings screens:** Section and global template CRUD using the APIs above; doctor sees only their own templates (backend enforces by `req.user.id`).
- [ ] **Visit save:** Continue using existing appointment/consultation update API after applying templates; no new save endpoint for templates.

---

## 10. Reference: sectionKey → appointment field

| sectionKey           | Appointment path                          |
|----------------------|--------------------------------------------|
| `interview`          | `consultation.interview`                   |
| `physicalExamination`| `consultation.physicalExamination`        |
| `treatment`          | `consultation.treatment`                  |
| `recommendations`    | `consultation.recommendations`             |
| `notes`              | `consultation.consultationNotes`           |

Use this mapping both when **loading** a global template into the form and when **saving** the visit (existing update appointment/consultation payload).
