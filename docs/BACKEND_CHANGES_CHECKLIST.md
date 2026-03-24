# Backend Changes Checklist – Patient / Visit / Registration (PDF Spec)

Concrete changes to implement on the backend to meet the specification. Order is suggested for dependencies; migrations and backward compatibility should be considered.

---

## Phase 1: Data model & schema

### 1.1 Appointment (visit) can exist without patient

| # | Change | Files / area |
|---|--------|--------------|
| 1 | Make `patient` and `bookedBy` **optional** on `Appointment` schema (allow `null`). | `models/appointment.js` |
| 2 | Add `booking_source`: enum `['ONLINE', 'RECEPTION']` (or string). Set when creating appointment. | `models/appointment.js` |
| 3 | Add status `no-show` to appointment `status` enum. | `models/appointment.js` |
| 4 | Remove or repurpose `metadata.patientSource` (spec: remove or use for something important). | `models/appointment.js` |
| 5 | Update all appointment creation paths to set `booking_source` and to allow missing `patient`/`bookedBy` where required by spec. | `controllers/appointmentController.js`, `controllers/gmeetController.js` |
| 6 | Update any queries/aggregations that assume `appointment.patient` is always set (e.g. populate, filters). | All controllers/routes that read appointments |

### 1.2 Patient model & User base

| # | Change | Files / area |
|---|--------|--------------|
| 7 | Remove **Hospital ID**: delete `hospId` from patient schema and stop reading/writing it. Add migration to drop or ignore the field. | `models/user-entity/patient.js`; any code referencing `hospId` |
| 8 | In `updatePatient` (and any PATCH), **reject** updates to `patientId` (immutable; set only by “Complete registration”). | `controllers/patientController.js` |
| 9 | Remove **unique** constraint on `phone` in User schema (phone is not unique per spec). Keep required or make optional for visit-only flows. | `models/user-entity/user.js` |
| 10 | Add **unique** index on PESEL (e.g. `govtId`) for role=patient, so one patient per PESEL. | `models/user-entity/patient.js` or migration |
| 11 | **Stop auto-generating `username`** in patient pre-save hook; reserve username creation for future “patient requests portal” flow. | `models/user-entity/patient.js` (pre-save hook) |

---

## Phase 2: Visit registration flows

### 2.1 Online registration (no patient at creation)

| # | Change | Files / area |
|---|--------|--------------|
| 12 | **bookAppointment** (gmeetController): Do **not** create User(patient). Create only **Appointment** with: doctor, date, time, mode, notes; store submitted form data (e.g. in a new field like `registrationData` or embedded object: name, phone, email, consents, etc.); set `patient` and `bookedBy` to `null`; set `booking_source = 'ONLINE'`. | `controllers/gmeetController.js` |
| 13 | Ensure online booking validation does not require fields that imply a patient (e.g. phone can be optional or stored only in registration data). | `controllers/gmeetController.js`, validation middleware |

### 2.2 Reception – follow-up (existing patient)

| # | Change | Files / area |
|---|--------|--------------|
| 14 | **createReceptionAppointment**: When `patientId` is provided, keep current behavior (create appointment with that patient). Set `booking_source = 'RECEPTION'`. Ensure `createdBy` is consistent (e.g. store user id or role string, not mixed). | `controllers/appointmentController.js` |
| 15 | Remove validation that **requires** `patientId` on reception route so that first-visit (no patient) is also allowed. | `routes/appointment-routes.js` (reception route validation) |

### 2.3 Reception – first visit (no patient at creation)

| # | Change | Files / area |
|---|--------|--------------|
| 16 | **createReceptionAppointment**: When `patientId` is **not** provided, create only **Appointment** with: doctor, date, time, mode, notes; store basic data (name, optional phone, etc.) in appointment or registration payload; set `patient` and `bookedBy` to `null`; set `booking_source = 'RECEPTION'`. Do **not** create User(patient). | `controllers/appointmentController.js` |
| 17 | Make **phone optional** for this path (reception first visit). | `controllers/appointmentController.js` |

### 2.4 Authenticated createAppointment (dashboard)

| # | Change | Files / area |
|---|--------|--------------|
| 18 | Align **createAppointment** with spec: if used for “online” flow, same as bookAppointment (visit only, no patient, `booking_source = 'ONLINE'`). If used for reception with existing patient, same as reception follow-up. Decide whether this route is only for reception with patient or also for visit-only; implement accordingly. | `controllers/appointmentController.js` |

---

## Phase 3: PESEL & “Complete registration”

### 3.1 PESEL validation utility

| # | Change | Files / area |
|---|--------|--------------|
| 19 | Add **PESEL validation**: (a) format: exactly 11 digits, digits only; (b) optional **checksum** (official algorithm). Return `{ valid: boolean, warning?: string }`; if checksum fails, set warning (e.g. “Warning: the PESEL number may be invalid.”) but do **not** block registration. | New util e.g. `utils/peselValidation.js` |

### 3.2 Check PESEL exists (for duplicate handling)

| # | Change | Files / area |
|---|--------|--------------|
| 20 | New endpoint or existing: **Check if patient exists by PESEL**. E.g. `GET /api/patients/by-pesel?pesel=...` or `POST /api/patients/check-pesel` body `{ pesel }`. Response: `{ exists: boolean, patientId?: string }` (and optionally minimal patient data for “load existing”). | New route + controller (e.g. `patientController.checkPeselExists`) |

### 3.3 Complete registration endpoint

| # | Change | Files / area |
|---|--------|--------------|
| 21 | New endpoint: **Complete registration** – e.g. `POST /api/appointments/:visitId/complete-registration`. Body: PESEL (required) + patient data (name, DOB, phone, etc.). Logic: (1) Validate PESEL (format + optional checksum; return warning in response if checksum invalid, do not block). (2) Find patient by PESEL. (3) If found: assign appointment `visitId` to that patient (`patient`, `bookedBy` = patient._id); update patient data if provided; return existing patient + visit. (4) If not found: create new User(patient) with PESEL and `patientId` (e.g. `P-{timestamp}` or your rule); assign appointment to new patient; return new patient + visit. Never create duplicate by PESEL. | New route + controller (e.g. `appointmentController.completeRegistration`) |
| 22 | Ensure **PATIENT_ID** is set only in this flow (and in reception follow-up when selecting existing patient). No PATIENT_ID without PESEL. | Same endpoint + patient creation logic |

---

## Phase 4: Patient list & APIs

### 4.1 Patient list filter

| # | Change | Files / area |
|---|--------|--------------|
| 23 | **getAllPatients** and **getPatientsList**: Filter to only patients who have **completed registration** (e.g. have non-empty `govtId`/PESEL and/or `patientId`). Exclude users created only as “placeholders” if you introduce such. | `controllers/patientController.js` |
| 24 | Patient list response: include **first completed visit** date/time and **physician** of first completed visit (per spec). Add aggregation or lookup if not already present. | `controllers/patientController.js` |

### 4.2 Visit/visit-card by VISIT_ID

| # | Change | Files / area |
|---|--------|--------------|
| 25 | **Visit by ID** (and visit-card): Support visits that have **no patient** (patient null). Expose basic data and consents from visit/registration data so FE can show “Dane podstawowe” and “Zgody” tabs always. | `controllers/appointmentController.js`, `controllers/visit-card.js` |
| 26 | Ensure **booking_source** is returned in appointment/visit responses so FE can show “Rejestracja online” when `booking_source === 'ONLINE'`. | All appointment read endpoints |

---

## Phase 5: Edge cases & cleanup

### 5.1 Duplicate PESEL (first-visit mistake)

| # | Change | Files / area |
|---|--------|--------------|
| 27 | Complete-registration endpoint already handles “PESEL exists” by linking to existing patient. Ensure FE can get “existing patient” data for “Załaduj dane istniejącego pacjenta” (e.g. from check-pesel or complete-registration response). | `patientController`, `appointmentController` |

### 5.2 Cancellation / no-show

| # | Change | Files / area |
|---|--------|--------------|
| 28 | When updating appointment status to **cancelled** or **no-show**, do **not** create a patient if the visit was visit-only (patient null). No ghost accounts. | Already satisfied if visit-only visits never create User(patient) |
| 29 | Add **no-show** to status enum and to any status update logic/UI contract. | `models/appointment.js`; `updateAppointmentStatus` (if any) |

### 5.3 createPatient (standalone)

| # | Change | Files / area |
|---|--------|--------------|
| 30 | **createPatient** (direct create): Require PESEL; use PESEL as unique key. Do not allow creating patient without PESEL (or document that this is only for migration/special cases). Remove or relax “unique phone” conflict if it blocks multiple patients with same phone. | `controllers/patientController.js` |

### 5.4 Migration & backward compatibility

| # | Change | Files / area |
|---|--------|--------------|
| 31 | **Migration**: Existing appointments have required `patient`. Option A: backfill a “placeholder” patient for old visits where needed, or Option B: make `patient` optional and leave null only for new flow; existing data keeps patient ref. Document and run migration script if needed. | Migration script (e.g. `scripts/` or DB migration) |
| 32 | **Existing patients**: Consider backfilling or marking legacy patients (e.g. has PESEL vs not) so patient list filter works. Or treat “no PESEL” as “legacy, show in list” until data is cleaned. | Migration / product decision |

---

## Summary table

| Phase | Focus | Key deliverables |
|-------|--------|-------------------|
| 1 | Schema & model | Optional patient on Appointment; booking_source; no-show; remove hospId; phone not unique; PESEL unique; no username auto-gen |
| 2 | Registration flows | Online + reception first visit = visit only; reception follow-up = with patient; booking_source set |
| 3 | PESEL & complete registration | PESEL validation util; check-PESEL endpoint; complete-registration endpoint |
| 4 | Lists & APIs | Patient list = only with PATIENT_ID; visit by id with null patient; booking_source in responses |
| 5 | Edge cases & migration | No ghost patients; no-show; createPatient requires PESEL; migration for existing data |

---

## New/updated API contract (for FE)

- **POST /api/appointments/book** (public) – body unchanged or extended; response: appointment with `_id` (VISIT_ID), no `patient`; `booking_source: 'ONLINE'`.
- **POST /api/appointments/reception** – body: optional `patientId`; when absent, same as first visit (visit only); when present, follow-up. Response: appointment with `booking_source: 'RECEPTION'`.
- **GET /api/appointments/:id** (or visit by id) – response may have `patient: null`; always include `booking_source`, basic/registration data, consents.
- **POST /api/appointments/:visitId/complete-registration** – body: `{ pesel, ...patientData }`; response: appointment (with patient assigned), patient (existing or new), optional `peselWarning` if checksum invalid.
- **GET /api/patients/by-pesel?pesel=...** (or POST check-pesel) – response: `{ exists, patientId?, patient? }`.
- **GET /api/patients** (list) – only patients with PATIENT_ID (completed registration); include first completed visit date and physician.
- **PATCH /api/appointments/:id/status** – allow status `no-show`.
