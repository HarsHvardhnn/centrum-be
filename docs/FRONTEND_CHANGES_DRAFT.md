# Frontend Changes Draft – Patient / Visit / Registration (PDF Spec)

This document drafts the **frontend changes** needed to meet the specification, assuming the backend will expose the new APIs and data shape described in `BACKEND_CHANGES_CHECKLIST.md`. Use it as a checklist in the FE repo; adjust to your stack (components, state, routing).

---

## 1. Patient vs Visit – concept and data

| # | Change | Details |
|---|--------|--------|
| FE-1 | Treat **visit** and **patient** as separate concepts in state and UI. | Do not assume every visit has a `patient` object. Visit can have `patient: null` (visit-only). PATIENT_ID exists only after “Complete registration” with PESEL. |
| FE-2 | Where you currently create or edit a “patient” at the same time as booking a visit, split flows: (a) **create visit only** (online, reception first visit), (b) **assign existing patient to visit** (reception follow-up), (c) **complete registration** (PESEL + button) to create/link patient to visit. | Update booking/reception screens and state (e.g. Redux, React Query) to support visit-only creation and separate “complete registration” step. |
| FE-3 | Support **visit context by VISIT_ID** (URL or id). Visit detail/card should work when `patient` is null and show data from visit/registration payload. | Routing: e.g. `/visits/:visitId` or `/appointments/:id`. Load visit by id; if `patient` is null, show “Pacjent niezweryfikowany” and completion CTA. |

---

## 2. Identifiers (UX)

| # | Change | Details |
|---|--------|--------|
| FE-4 | **Remove Hospital ID** from all UI: labels, form fields, tables, filters, exports. Remove from any logic that uses it. | Search for hospId, “Hospital ID”, “Nr szpitalny” (or equivalent) and remove. |
| FE-5 | **Patient ID** must be **read-only** everywhere. Never show an input or editable field for Patient ID. | Replace any input for Patient ID with plain text display. Disable/hide in edit forms. |
| FE-6 | When **PATIENT_ID does not exist** (visit-only): in the place where Patient ID is usually shown, display: *„Identyfikator pacjenta zostanie utworzony po zakończeniu rejestracji pacjenta w systemie.”* | Conditional copy: if `!patient?.patientId` (or equivalent), show this message. |
| FE-7 | When **PATIENT_ID exists**: display Patient ID as read-only text (no editing). | Single source of truth from API; no manual override. |

---

## 3. Online registration flow

| # | Change | Details |
|---|--------|--------|
| FE-8 | **Public online booking**: Submit only visit data (no patient creation). Call BE so it creates only VISIT_ID and stores form data; do not expect a patient in the response. | Update submit handler: e.g. POST `/api/appointments/book`; response = appointment with `_id`, no `patient`; store visit id for confirmation/next step. |
| FE-9 | **Confirmation / next step**: After online booking, show success with VISIT_ID (e.g. link or number). Do not show Patient ID or “patient account” until registration is completed later (e.g. at reception). | Copy and layout: e.g. “Visit registered. Your visit ID: … . Complete registration at the clinic with your PESEL.” |
| FE-10 | **Visit list/detail**: For visits with `booking_source === 'ONLINE'`, show label **„Rejestracja online”** next to visit status. | Use `booking_source` from API; no label for RECEPTION (per spec). |

---

## 4. Reception flows

| # | Change | Details |
|---|--------|--------|
| FE-11 | **Reception – Follow-up**: Keep “select existing patient” then create visit. Call API with `patientId`; API sets `booking_source = 'RECEPTION'`. Do not show “Rejestracja online”. | Ensure request body includes `patientId`; do not create a new patient on this path. |
| FE-12 | **Reception – First visit**: Add flow “First visit (no patient yet)”. Form: basic data (name, etc.), **phone optional**. Submit without `patientId`; API creates only visit. Do not create or expect a patient in the response. | New or alternate form/step; call e.g. POST `/api/appointments/reception` without `patientId`. |
| FE-13 | **Reception – Complete registration**: For a visit that has no patient, show a dedicated step/screen: enter PESEL (+ other required data), then button **“Zakończ rejestrację”**. On submit, call e.g. POST `/api/appointments/:visitId/complete-registration`. Then refresh visit/patient and show PATIENT_ID. | New screen or section in visit detail; handle response (existing vs new patient, optional PESEL warning). |

---

## 5. UI tabs – Dane podstawowe & Zgody

| # | Change | Details |
|---|--------|--------|
| FE-14 | **Always show** tabs **“Dane podstawowe”** and **“Zgody”** in visit context (by VISIT_ID), for: scheduled, cancelled, no-show, online and reception. Never hide these tabs based on visit or patient state. | Remove any conditional that hides these tabs. Data can come from visit/registration payload when patient is null. |
| FE-15 | When visit has no patient, **Dane podstawowe** and **Zgody** should display data stored on the visit (registration data). When patient exists, can show patient data + visit data as needed. | Ensure API returns basic data and consents for visit-by-id; FE reads from visit when `patient` is null. |

---

## 6. PESEL – input and validation

| # | Change | Details |
|---|--------|--------|
| FE-16 | **PESEL input**: Accept **digits only** (0–9); **max length 11**; do not allow more than 11 characters. | Input mask or validation: strip non-digits; `maxLength={11}`; block 12th character. |
| FE-17 | **Checksum**: After 11 digits, optionally call BE or run client-side checksum. If invalid, show **warning**: “Warning: the PESEL number may be invalid.” Do **not** block submitting “Complete registration”. | Warning state + message; submit still allowed. |
| FE-18 | **Duplicate PESEL (first-visit mistake)**: When user enters PESEL and BE returns “patient exists”, show **informational** message: *„Pacjent o podanym numerze PESEL już istnieje w systemie.”* and button **[ Załaduj dane istniejącego pacjenta ]**. | Use e.g. GET `/api/patients/by-pesel?pesel=...` (or check response from complete-registration). On button click: load existing patient data into form (and optionally lock PESEL/identity fields). |
| FE-19 | On **“Zakończ rejestrację”** with existing PESEL: submit complete-registration; BE assigns visit to existing patient. Show success and updated visit/patient; do not create a second patient. | Same endpoint; BE handles “link to existing”; FE just submits and refreshes. |

---

## 7. “Complete registration” / “Zakończ rejestrację”

| # | Change | Details |
|---|--------|--------|
| FE-20 | Expose a clear **“Zakończ rejestrację”** (Complete registration) action only for visits that **do not yet have a patient**. Disable or hide when visit already has PATIENT_ID. | Button visibility/state based on `!appointment.patient` (or equivalent). |
| FE-21 | This button triggers the **complete registration** flow: collect PESEL (required) + any required patient data, then POST to complete-registration. After success, PATIENT_ID appears and message/placeholder for “no PATIENT_ID” is removed. | Single place that calls POST `/api/appointments/:visitId/complete-registration` and updates local state. |

---

## 8. Unverified status

| # | Change | Details |
|---|--------|--------|
| FE-22 | Where you normally display **Patient ID**, if the visit has **no PATIENT_ID yet** (visit-only or before completion), display: **“Pacjent niezweryfikowany”**. | Conditional: `patient?.patientId ? patient.patientId : 'Pacjent niezweryfikowany'` (or use spec wording exactly). |
| FE-23 | After PATIENT_ID is created (post complete registration), show normal read-only Patient ID. | Same component; condition on presence of patientId. |

---

## 9. Cancellation / no-show

| # | Change | Details |
|---|--------|--------|
| FE-24 | Support appointment status **no-show** in filters, badges, and status updates. | Add “no-show” to status enum/options and UI. |
| FE-25 | For **cancelled** and **no-show** visits, do not assume a patient record exists. Visit detail should still show basic data and consents from visit (and “Pacjent niezweryfikowany” if no patient). | Avoid “patient required” assumptions; handle `patient: null` in visit detail and lists. |

---

## 10. Patient list

| # | Change | Details |
|---|--------|--------|
| FE-26 | **Patient list** should show **only** patients who have completed registration (have PATIENT_ID). Backend will filter; FE should not add “all users” or visit-only records. | Once BE returns only registered patients, FE just displays the list. Remove any client-side inclusion of “pre-registration” or visit-only rows if present. |
| FE-27 | List columns per spec: **patient full name**, **PATIENT_ID**, **date and time of first completed visit**, **physician of first visit**. Add or align columns; get first completed visit and physician from API. | Table/columns and API mapping. |
| FE-28 | Do not show “empty” or placeholder patient accounts (no PATIENT_ID). | Handled by BE filter; FE should not display such rows. |

---

## 11. Patient source field

| # | Change | Details |
|---|--------|--------|
| FE-29 | **Remove** the “patient source” field from forms and tables (or repurpose for something important for the dashboard only). Spec: remove or use for key dashboard functionality. | Find and remove `patientSource` (or equivalent) from UI unless product decides to repurpose. |

---

## 12. API integration summary

| # | Change | Details |
|---|--------|--------|
| FE-30 | **Online booking**: POST visit only; no patient in response; use `booking_source` for “Rejestracja online” label. | See BACKEND_CHANGES_CHECKLIST.md “New/updated API contract”. |
| FE-31 | **Reception**: POST with or without `patientId`; accept `booking_source` in responses. | Same. |
| FE-32 | **Visit by id**: Handle `patient: null`; always show basic data and consents; use `booking_source`. | GET appointment/visit by id. |
| FE-33 | **Complete registration**: POST PESEL + data to `/api/appointments/:visitId/complete-registration`; handle existing vs new patient and optional PESEL warning. | Same. |
| FE-34 | **Check PESEL**: Call GET (or POST) check-pesel when needed for “load existing patient” flow. | Same. |
| FE-35 | **Patient list**: Use filtered list from BE (only PATIENT_ID); display first completed visit and physician. | Same. |
| FE-36 | **Status**: Send and display `no-show` where applicable. | PATCH status. |

---

## 13. Copy and accessibility

| # | Change | Details |
|---|--------|--------|
| FE-37 | Use exact spec messages where specified: e.g. “Identyfikator pacjenta zostanie utworzony…”, “Pacjent niezweryfikowany”, “Pacjent o podanym numerze PESEL już istnieje…”, “Załaduj dane istniejącego pacjenta”, “Zakończ rejestrację”, “Rejestracja online”, PESEL warning. | Copy-review against PDF. |
| FE-38 | Ensure **Patient ID** and **Pacjent niezweryfikowany** are readable by screen readers and not only visual. | A11y labels and live regions if needed. |

---

## Implementation order (suggested)

1. **Data & API** – Support visit without patient in state and API types; add `booking_source`; handle null patient in visit detail and lists.
2. **Identifiers** – Remove Hospital ID; make Patient ID read-only; add message when no PATIENT_ID and “Pacjent niezweryfikowany”.
3. **Online flow** – Visit-only booking; “Rejestracja online” label; confirmation without Patient ID.
4. **Reception flows** – First visit (no patientId); follow-up (with patientId); complete registration screen and “Zakończ rejestrację”.
5. **PESEL** – Input rules; checksum warning; duplicate-PESEL message and “Załaduj dane istniejącego pacjenta”.
6. **Tabs** – Always show Dane podstawowe and Zgody; data from visit when patient is null.
7. **Patient list** – Columns and BE-filtered list only.
8. **Cleanup** – No-show status; remove patient source; copy and a11y.

---

## Backend reference

- **Backend comparison (current vs spec):** `SPEC_COMPARISON_PATIENT_VISIT_REGISTRATION.md`
- **Backend implementation checklist:** `BACKEND_CHANGES_CHECKLIST.md`
- **New/updated API contract:** see “New/updated API contract (for FE)” at the end of `BACKEND_CHANGES_CHECKLIST.md`

Align FE work with backend phases so that when BE deploys visit-only creation and complete-registration, FE can switch to the new endpoints and flows without breaking existing usage during rollout.
