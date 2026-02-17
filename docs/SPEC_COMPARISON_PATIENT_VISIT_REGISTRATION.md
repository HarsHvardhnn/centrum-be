# Specification Comparison: Patient / Visit / Registration Logic

This document compares the **current backend implementation** with the requirements from **SPECIFICATION – PATIENT / VISIT / REGISTRATION LOGIC (FOR IMPLEMENTATION)**.  
Use it to plan backend (and API) changes. For UI/UX and frontend flows, use the companion prompt in `docs/PROMPT_FRONTEND_PATIENT_VISIT_SPEC.md` in the FE repo.

---

## 1. Core principle: Patient ≠ Visit

| Spec requirement | Current backend | Gap / action |
|------------------|-----------------|--------------|
| A Visit (VISIT_ID) may exist **without** a patient. | `Appointment` has `patient` and `bookedBy` as **required** (ObjectId ref User). Every visit forces a patient. | **Backend:** Allow visits without patient: make `patient` and `bookedBy` optional (or introduce a separate “visit-only” entity and link patient when registration is completed). |
| PATIENT_ID created **only** after valid PESEL + clicking “Complete registration”. | Patient (User with role `patient`) is created **at booking time** in `createAppointment`, `createReceptionAppointment`, and `bookAppointment` (gmeetController). No “Complete registration” step. | **Backend:** Introduce “Complete registration” flow: create/link PATIENT_ID only when PESEL is provided and an explicit “complete registration” action is called (new/updated endpoint). Online and reception “first visit” should create only VISIT_ID (and store form data) until that step. |

---

## 2. Identifiers – what is created and when

| Spec | Current | Gap / action |
|------|---------|--------------|
| **VISIT_ID** – always created when a visit is registered (online or reception); exists independently of patient. | Appointment `_id` acts as visit id; creation always requires and creates/assigns a patient. | **Backend:** Ensure visit (appointment) can be created without a patient; VISIT_ID = appointment id (or equivalent) in API. |
| **PATIENT_ID** – only when valid PESEL + “Complete registration”. | `patientId` (e.g. `P-{timestamp}`) and full User(patient) are set at booking; no PESEL gate. | **Backend:** Create/link patient only in “Complete registration”; use PESEL as unique patient key (see below). |
| **USERNAME** (patient account) – only for patients with PATIENT_ID, and only when patient requests portal. | `patient.js` pre-save hook **always** generates `username` for every patient. | **Backend:** Do **not** auto-generate username on patient save; generate only when patient requests portal (future flow). |

---

## 3. Visit registration scenarios

### A. Online registration

| Spec | Current | Gap / action |
|------|---------|--------------|
| Create VISIT_ID; store form data; set **booking_source = ONLINE**; do **not** create PATIENT_ID or USERNAME. | `bookAppointment` (gmeetController) creates a **User(patient)** (with `patientId`, optional `govtId`) and an Appointment with `patient` required. No `booking_source` field. | **Backend:** (1) Allow creating appointment **without** patient for online flow. (2) Store submitted data (e.g. on appointment or a “visit registration” model). (3) Add and set `booking_source = 'ONLINE'` (or equivalent). (4) Do not create User(patient) until “Complete registration” with PESEL. |
| Display label “Rejestracja online” next to visit status. | N/A (no booking_source). | **API:** Expose `booking_source` (e.g. from appointment) so FE can show label. |

### B. Reception – “Follow-up visit”

| Spec | Current | Gap / action |
|------|---------|--------------|
| Reception selects **existing** patient → create VISIT_ID, assign VISIT_ID → PATIENT_ID, **booking_source = RECEPTION**. | `createReceptionAppointment` requires `patientId` in body; creates appointment with that patient. `createdBy` stores user/role, not a dedicated booking_source. | **Backend:** (1) Add `booking_source` (e.g. `'RECEPTION'`) on appointment. (2) Keep “select existing patient + create visit” as-is, but ensure it’s the only path when patient is already chosen (no accidental patient creation). |
| No extra label (informational silence). | N/A. | OK if FE gets booking_source. |

### C. Reception – “First visit”

| Spec | Current | Gap / action |
|------|---------|--------------|
| Reception enters same basic data; **phone optional**. Create VISIT_ID; do **not** create PATIENT_ID or USERNAME. | Reception route **requires** `patientId` (validation: “Patient ID is required”). If not provided, code path creates new patient from name/phone. So “first visit” without patient is not supported. | **Backend:** (1) Allow reception to create visit **without** patient (optional `patientId`). (2) Make phone optional for this path. (3) Store basic data on visit/registration. (4) Add “Complete registration” later (PESEL + assign visit to existing or new PATIENT_ID). |

---

## 4. Data model and field changes

| Spec | Current | Gap / action |
|------|---------|--------------|
| **Hospital ID deprecated** – remove from system (UX and logic). | `models/user-entity/patient.js`: `hospId` with default `HOSP-${Date.now()}`. | **Backend:** Remove `hospId` (migration + stop reading/writing). |
| **Patient ID** – never manually editable; read-only. | Backend can accept any PATCH; no explicit “immutable patientId” rule. | **Backend:** Reject updates to `patientId` (and ensure it’s set only by “Complete registration” logic). |
| **Remove or repurpose `metadata.patientSource`** (spec: no significance or use for something important). | `appointment.js` has `metadata.patientSource`. | **Backend:** Remove or repurpose; if keeping, align with `booking_source` and document. |
| **booking_source** = ONLINE | RECEPTION. | `createdBy` is `"receptionist" \| "online" \| "doctor"` (and sometimes ObjectId in reception). No `booking_source`. | **Backend:** Add `booking_source` (enum or string) to appointment (or equivalent); set in online vs reception flows. |

---

## 5. PESEL and patient identity

| Spec | Current | Gap / action |
|------|---------|--------------|
| **PESEL** = only unique identifier for patient; no PATIENT_ID without PESEL. | Patient lookup/creation uses **phone** (and email) in createAppointment/createReceptionAppointment/bookAppointment. `govtId` stores PESEL but is not the primary key. | **Backend:** Use PESEL (e.g. `govtId` or dedicated field) as **unique** patient key. Create/link patient only when PESEL is present and “Complete registration” is invoked. |
| **Phone is NOT unique** – same number may be used for multiple visits/persons (e.g. parent registering children). | `user.js`: `phone: { required: true, unique: true }`. | **Backend:** Remove **unique** constraint on phone (and adjust any “find patient by phone” logic so it doesn’t assume a single patient). |
| PESEL: digits only, length 11, no extra characters; **checksum validation** as soft warning (do not block registration). | `govtId` stored; no backend length/format or checksum validation. | **Backend:** Add validation (format + optional checksum); return warning in API if checksum fails; do not block “Complete registration”. |
| **Duplicate-PESEL (first-visit mistake):** If PESEL already exists → do not create new patient; show message; button “Załaduj dane istniejącego pacjenta”; on “Zakończ rejestrację” assign VISIT_ID → existing PATIENT_ID. | No “existing patient by PESEL” check; no “load existing patient” or “complete registration” endpoint. | **Backend:** (1) Endpoint or step: on PESEL submit, check if patient with this PESEL exists; return flag + message. (2) “Complete registration” endpoint: if PESEL exists, link appointment to that patient and save data; if not, create new patient with PESEL and link. Never create duplicate by PESEL. |

---

## 6. “Complete registration” and PATIENT_ID creation

| Spec | Current | Gap / action |
|------|---------|--------------|
| PATIENT_ID created **only** when user clicks “Complete registration” (after entering PESEL). If PESEL new → new patient + PATIENT_ID. If PESEL exists → assign VISIT_ID → existing PATIENT_ID, no new patient. | No “Complete registration” step; patient is created at booking. | **Backend:** Implement explicit “Complete registration” (e.g. `POST /api/appointments/:visitId/complete-registration` or similar) that: accepts PESEL + patient data; creates patient only if PESEL is new; assigns appointment to that patient; returns PATIENT_ID and visit. |

---

## 7. Cancellation / no-show

| Spec | Current | Gap / action |
|------|---------|--------------|
| If patient never showed: no PESEL, no PATIENT_ID, no USERNAME. Visit remains VISIT_ID with status CANCELLED/NO-SHOW; Basic data and Consents still accessible. No ghost patient accounts. | Status enum: `booked`, `cancelled`, `completed`, `checkedIn`. No `no-show`. Every visit has a patient; cancelling doesn’t remove the already-created User(patient). | **Backend:** (1) Add status `no-show` (or equivalent). (2) For visit-only bookings (no “Complete registration”), ensure we never create a User(patient) for cancelled/no-show; only the visit record exists. |

---

## 8. Patient list

| Spec | Current | Gap / action |
|------|---------|--------------|
| **Only** patients with PATIENT_ID (i.e. completed registration) in the patient list. Visits without PATIENT_ID (first visit, cancelled, no-show) and persons who never completed registration must **not** appear. | `getAllPatients` and `getPatientsList` use `patient.find({ deleted: false })` – i.e. all User(patient) documents. No filter for “has completed registration” (e.g. has PESEL / has PATIENT_ID). | **Backend:** Filter patient list so only “registered” patients are returned (e.g. require that patient was created via “Complete registration” and has PESEL / PATIENT_ID). If you introduce a “visit-only” entity, exclude it from patient list. List fields per spec: full name, PATIENT_ID, date/time of first completed visit, physician of first visit. |

---

## 9. Patient account (portal) – to be enabled later

| Spec | Current | Gap / action |
|------|---------|--------------|
| Patient account (login) only if PATIENT_ID exists. Login flow: check by PESEL; if PATIENT_ID exists → allow account creation (email, send login details); if not → “No patient account found – please contact the reception desk.” | Username is auto-generated for every patient on save. | **Backend:** Stop auto-generating username; generate only when patient explicitly requests portal (future). When implementing login: resolve by PESEL → PATIENT_ID; if none, return clear error for FE message. |

---

## 10. UI tabs and UX (for FE / API contract)

| Spec | Current | Gap / action |
|------|---------|--------------|
| Tabs “Dane podstawowe” and “Zgody” **always** visible (VISIT_ID context) for scheduled, cancelled, no-show, online and reception. | N/A. | **Backend:** Ensure APIs for visit/visit-card expose basic data and consents so FE can always show these tabs (by visit id, with or without patient). |

---

## Summary of backend work items

1. **Visit without patient:** Make `patient` (and `bookedBy`) optional on Appointment, or introduce visit-only model; ensure all visit flows can create a visit without creating a User(patient).
2. **booking_source:** Add and set `ONLINE` / `RECEPTION` on appointment (or equivalent); expose in API.
3. **Online registration:** Create only visit + form data; no User(patient) until “Complete registration”.
4. **Reception first visit:** Allow creating visit without `patientId`; phone optional; no patient until “Complete registration”.
5. **Complete registration:** New (or updated) endpoint: input PESEL + data; create patient only if PESEL new; assign visit to patient; support “load existing patient” when PESEL exists.
6. **PESEL as unique key:** Use PESEL (e.g. `govtId`) as unique patient identifier; no PATIENT_ID without PESEL.
7. **Phone not unique:** Remove unique constraint on `phone` in User schema; adjust lookups.
8. **PESEL validation:** Format (11 digits) + optional checksum; soft warning only.
9. **Duplicate PESEL handling:** Check by PESEL before creating patient; return “existing patient” + allow linking visit to existing.
10. **Hospital ID:** Remove `hospId` from patient model and logic.
11. **patientSource:** Remove or repurpose `metadata.patientSource`.
12. **Patient list:** Filter to “has PATIENT_ID” / completed registration only; include first completed visit date and physician.
13. **Username:** Do not auto-generate on save; reserve for future “patient requests portal” flow.
14. **No-show:** Add status (e.g. `no-show`); avoid creating patient records for visit-only cancelled/no-show.

When implementing, consider migration for existing appointments that currently have required `patient` and for existing patients (e.g. backfill PESEL where possible, or mark legacy records).
