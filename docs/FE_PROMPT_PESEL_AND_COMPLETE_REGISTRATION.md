# Frontend implementation prompt: PESEL and Complete registration

Use this document in your **frontend repo** to implement PESEL-related changes and the “Complete registration” flow. The backend already supports the APIs and behaviour described below.

---

## Admin vs User side – overview

| Audience | What changes |
|----------|----------------|
| **Admin side** (dashboard, reception, staff) | All PESEL input rules, “Complete registration” flow, duplicate-PESEL handling, reception first visit (visit only then complete registration). Sections **A, B, C, D, E** below are **admin side**. |
| **User side** (patient/public) | Public **online booking** now creates a **visit only** (no patient). Ensure the public booking form and confirmation page handle this and optionally show “Rejestracja online”. See **section F** below. Optionally: in **patient portal**, if you show Patient ID, show it read-only or “Pacjent niezweryfikowany” when absent. |

Each section below is explicitly labelled **Admin side** or **User side**.

---

## 1. What the backend provides (summary)

- **GET `/api/patients/by-pesel?pesel=...`**  
  - Returns whether a patient with this PESEL exists and, if so, minimal patient data for “load existing”.  
  - Use **before** or when the user enters 11 digits of PESEL to: (1) show “Pacjent już istnieje” message, (2) offer “Załaduj dane istniejącego pacjenta”, (3) prefill form from `response.patient`.

- **POST `/api/appointments/:visitId/complete-registration`**  
  - Body: `pesel` (required) + patient data (e.g. `firstName`, `lastName`, `dateOfBirth`, `phone`, `email`, `sex`, `smsConsentAgreed`, `consents`).  
  - If PESEL exists: links the visit to that patient (no new patient).  
  - If PESEL is new: creates a new patient with that PESEL and links the visit.  
  - Response can include `peselWarning` when the checksum is invalid (soft warning; registration still succeeds).  
  - This is the **only** place where PATIENT_ID is created for a visit (no PATIENT_ID until this call for visit-only flows).

- **Reception first visit**  
  - POST `/api/appointments/reception` **without** `patientId`: creates **visit only** (basic data in `registrationData`; phone optional).  
  - Do **not** send PESEL or full patient data in this first request.  
  - After the visit is created, use the visit detail screen to collect PESEL and run “Complete registration” (call `complete-registration` above).

- **PESEL validation on backend**  
  - Format: exactly 11 digits, digits only.  
  - Checksum: validated; if invalid, backend still allows registration but returns `peselWarning` in the response (e.g. *"Ostrzeżenie: numer PESEL może być nieprawidłowy (błąd sumy kontrolnej)."*).

---

## 2. What you need to do on the frontend

Implement the following in order. Each item is a concrete task you can tick off.

---

### A. PESEL input behaviour (all forms that use PESEL)  
**Admin side**

**Where:** Any **admin** component that has a PESEL field (e.g. `DemographicForm.jsx`, `ReceptionAppointmentForm.jsx`, Add/Edit Patient modals, and the new “Complete registration” step in visit context). If you ever add a PESEL field on the user side (e.g. patient portal), apply the same input rules there.

**Tasks:**

1. **Restrict input to digits only and max length 11**
   - Allow only digits `0–9` (strip or block any other character).
   - Set **max length 11** (e.g. `maxLength={11}` and/or enforce in `onChange` so the user cannot type more than 11 digits).
   - After 11 digits, do not allow additional characters (no 12th digit).

2. **Optional: checksum warning (non-blocking)**
   - When the user has entered 11 digits, you may:
     - **Option A:** Call an FE helper that implements the same checksum as the backend (weights 1,3,7,9 for positions 0–9; checksum digit = (10 − (sum mod 10)) mod 10). If it fails, show a **warning** message only, e.g. *"Ostrzeżenie: numer PESEL może być nieprawidłowy (błąd sumy kontrolnej)."* or *"Warning: the PESEL number may be invalid."*
     - **Option B:** Do not validate checksum on FE; rely on the backend. After calling `complete-registration`, if the response contains `peselWarning`, display that message (e.g. below the PESEL field or in a toast). Registration must **not** be blocked when checksum fails.
   - In both cases: **do not** prevent the user from submitting “Zakończ rejestrację” when the checksum is invalid; only show a warning.

**Acceptance:**  
- PESEL field accepts only digits and has exactly 11 characters max.  
- Invalid checksum shows a warning only; “Complete registration” can still be submitted and succeeds.

---

### B. “Complete registration” flow in visit context  
**Admin side**

**Where:** **Staff** visit detail / appointment detail screen when the visit has **no patient** yet (e.g. `appointment.patient === null` or `!appointment.patient_id`). This applies to visits created as “first visit” (reception, no `patientId`) or online (visit only).

**Tasks:**

1. **Show a dedicated “Complete registration” section when the visit has no patient**
   - When opening a visit by VISIT_ID and the API returns `patient: null` (and possibly `registrationData`), show a clear section or step for “Zakończ rejestrację”.
   - This section should include:
     - PESEL input (with the rules from section A).
     - Other required patient data (e.g. first name, last name, date of birth, phone; align with what the backend `complete-registration` expects).
     - Button: **“Zakończ rejestrację”**.

2. **Do not create a patient on “first save” of the visit**
   - For reception “first visit”, the first submit should only create the **visit** (POST `/api/appointments/reception` without `patientId`, with basic data like name, optional phone).  
   - PATIENT_ID is created **only** when the user clicks “Zakończ rejestrację” and the frontend calls POST `/api/appointments/:visitId/complete-registration` with PESEL and the rest of the data.

3. **Call the complete-registration API**
   - On “Zakończ rejestrację”:
     - Collect PESEL (required) and any other required fields from the form.
     - Normalize PESEL to 11 digits (strip non-digits).
     - **POST** to `/api/appointments/:visitId/complete-registration` with body for example:
       ```json
       {
         "pesel": "12345678901",
         "firstName": "...",
         "lastName": "...",
         "dateOfBirth": "...",
         "phone": "...",
         "email": "...",
         "sex": "...",
         "smsConsentAgreed": true/false,
         "consents": []
       }
       ```
     - Use the **visit id** from the current visit (e.g. `appointment._id` or the id from the route).

4. **Handle the response**
   - On success: refresh the visit (or navigate) so that the visit now has a patient and PATIENT_ID. Show success message (e.g. “Rejestracja zakończona”).
   - If the response includes **`peselWarning`**: display that message (e.g. under the PESEL field or as a non-blocking alert). Do **not** treat it as an error; registration has still succeeded.
   - On error (4xx/5xx): show the error message and do not clear the form (user can correct and retry).

**Acceptance:**  
- Visit-only visits show a “Complete registration” step with PESEL and “Zakończ rejestrację”.  
- Clicking “Zakończ rejestrację” calls the backend and creates/assigns the patient; PATIENT_ID appears after success.  
- `peselWarning` is shown but does not block or invalidate the flow.

---

### C. Duplicate PESEL: “Pacjent już istnieje” and “Załaduj dane istniejącego pacjenta”  
**Admin side**

**Where:** Same **admin** “Complete registration” section (or the step where staff enter PESEL before “Zakończ rejestrację”).

**Tasks:**

1. **Check if PESEL already exists when the user has entered 11 digits**
   - When PESEL has 11 digits (and optionally passes format/checksum if you validate on FE), call:
     - **GET** `/api/patients/by-pesel?pesel=<11 digits>`
   - Use the **normalized** 11-digit string (digits only).

2. **Handle `exists: true`**
   - If the response is `{ exists: true, patientId?, patient? }`:
     - Show an **informational** message (not an error):  
       *„Pacjent o podanym numerze PESEL już istnieje w systemie.”*
     - Show a button: **[ Załaduj dane istniejącego pacjenta ]**

3. **When the user clicks “Załaduj dane istniejącego pacjenta”**
   - Take `response.patient` (or refetch patient by `response.patientId` if you need full details) and **reload the form** with that patient’s data (e.g. name, date of birth, phone, email, sex).
   - Optionally **lock** PESEL and identity fields (read-only) so the user does not change them.
   - The form is now “assign visit to this existing patient” rather than “create new patient”.

4. **On “Zakończ rejestrację” when existing patient was loaded**
   - Still call **POST** `/api/appointments/:visitId/complete-registration` with the same PESEL and the (possibly updated) patient data.
   - Backend will **not** create a new patient; it will assign the visit to the existing patient and may update that patient’s data. Do **not** create a second patient on the frontend.

**Acceptance:**  
- Entering an existing PESEL shows the spec message and the “Załaduj dane istniejącego pacjenta” button.  
- Clicking it loads the existing patient into the form; “Zakończ rejestrację” assigns the visit to that patient without creating a duplicate.

---

### D. Reception “first visit” flow (visit only, then complete registration)  
**Admin side**

**Where:** **Reception** appointment form when staff choose “first visit” (new patient) and the backend supports visit-only creation.

**Tasks:**

1. **First submit: create visit only**
   - Do **not** require PESEL for the **first** step.
   - Collect only the data needed for the visit: e.g. first name, last name, optional phone, optional email, doctor, date, time, etc. (align with backend expectations for POST `/api/appointments/reception` without `patientId`).
   - Submit with **no** `patientId` and **no** PESEL. Backend will create only the appointment (visit) and store basic data in `registrationData`.

2. **After the visit is created**
   - Redirect or navigate to the **visit detail** (by VISIT_ID).
   - There, show the “Complete registration” section (section B) with PESEL and “Zakończ rejestrację”.
   - When the user completes registration, call `complete-registration` as in B.

3. **Optional: “first visit” in one screen**
   - If you prefer to keep first visit in one screen, you can:
     - First call POST `/api/appointments/reception` without `patientId` (visit only).
     - Then, in the same flow (e.g. next step or same modal), collect PESEL and required patient data and call POST `/api/appointments/:visitId/complete-registration` with the new visit’s `_id`.  
   - Important: **two** API calls — first visit, then complete registration — and no PATIENT_ID until the second succeeds.

**Acceptance:**  
- First visit does not send PESEL on the first request; it creates only a visit.  
- PATIENT_ID appears only after “Zakończ rejestrację” with PESEL (via `complete-registration`).

---

### E. Display of PESEL warning from backend  
**Admin side**

**Where:** Any **admin** UI that calls `complete-registration` or displays the result (e.g. visit detail after “Zakończ rejestrację”).

**Tasks:**

1. After a successful **POST** `/api/appointments/:visitId/complete-registration`, check the response for **`peselWarning`**.
2. If present, display the warning text (e.g. *"Ostrzeżenie: numer PESEL może być nieprawidłowy (błąd sumy kontrolnej)."* or the exact string from the backend) in a non-blocking way (e.g. info banner or below the form).
3. Do not block, disable, or invalidate the success state; registration is already complete.

**Acceptance:**  
- When the backend returns `peselWarning`, the user sees it and understands the number might be wrong, but the flow remains successful.

---

### F. Public online booking (visit only, no patient)  
**User side**

**Where:** The **public** booking form (e.g. website page where a patient books a visit without logging in) and the confirmation/success page after booking.

**Tasks:**

1. **Do not assume a patient is created**
   - The backend **POST** `/api/appointments/book` (or your public booking endpoint) now creates only a **visit** (no patient account, no PATIENT_ID). The response contains the appointment (visit) with `_id`, `booking_source: 'ONLINE'`, and possibly `registrationData`; `patient` will be null.
   - Ensure the public booking form **does not** expect a patient object in the response. Update any success handler or confirmation page so it uses the **visit** (e.g. appointment `_id`, date, time, doctor) and does not show or rely on Patient ID or “patient account”.

2. **Optional: show “Rejestracja online” on confirmation**
   - If the API returns `booking_source` on the appointment, you can show the label **„Rejestracja online”** on the confirmation page (e.g. next to the booking summary) so the user sees how the visit was registered.

3. **Patient portal (if applicable)**
   - If the patient later logs in to a **patient portal** and you show their Patient ID: display it **read-only**. If for some reason they have no PATIENT_ID yet (edge case), show **“Pacjent niezweryfikowany”** or the message that the ID will be created after registration at the clinic.

**Acceptance:**  
- Public booking succeeds and shows confirmation without assuming a patient exists.  
- Optionally “Rejestracja online” and correct Patient ID / unverified handling in patient portal.

---

## 3. API reference (copy-paste for FE)

**Check if patient exists by PESEL**

- **Method:** GET  
- **URL:** `/api/patients/by-pesel?pesel=<11 digits>`  
- **Response (200):**
  - `{ "exists": false }`  
  - or `{ "exists": true, "patientId": "...", "patient": { "_id", "patientId", "name", "govtId", "dateOfBirth", "phone", "email", "sex" } }`

**Complete registration (create or link patient to visit)**

- **Method:** POST  
- **URL:** `/api/appointments/:visitId/complete-registration`  
- **Headers:** Same as other authenticated appointment endpoints (e.g. Bearer token).  
- **Body (JSON):**  
  - `pesel` (string, required) – 11 digits.  
  - Optional but recommended: `firstName`, `lastName`, `dateOfBirth`, `phone`, `email`, `sex`, `smsConsentAgreed`, `consents`.  
  - When linking to existing patient, you can send updates (e.g. phone, email); backend will update that patient and assign the visit.
- **Response (200):**  
  - `{ "success": true, "message": "...", "appointment": { ... }, "patient": { "_id", "patientId", "name", "govtId" }, "existing": true|false, "peselWarning": "..." (optional) }`  
- **Errors:** 400 (e.g. invalid PESEL, visit already has patient), 404 (visit not found), 500.

**Reception: create visit only (first visit)**

- **Method:** POST  
- **URL:** `/api/appointments/reception`  
- **Body:** Do **not** send `patientId`. Send e.g. `doctorId`, `date`, `startTime`, `firstName`, `lastName`, optional `phone`, optional `email`, etc. Backend creates only the appointment and stores data in `registrationData`.

---

## 4. Checklist (for your FE backlog)

**Admin side**

- [ ] **A1** (Admin) PESEL input: digits only, max 11 characters, no 12th character.
- [ ] **A2** (Admin) PESEL checksum: show warning when invalid; do not block “Zakończ rejestrację” (FE and/or backend `peselWarning`).
- [ ] **B1** (Admin) Visit detail: when `patient === null`, show “Complete registration” section with PESEL and “Zakończ rejestrację”.
- [ ] **B2** (Admin) “Zakończ rejestrację” calls POST `/api/appointments/:visitId/complete-registration` with `pesel` and required data.
- [ ] **B3** (Admin) On success, refresh visit so PATIENT_ID appears; show `peselWarning` if present.
- [ ] **C1** (Admin) When 11 digits entered, call GET `/api/patients/by-pesel?pesel=...`.
- [ ] **C2** (Admin) If `exists: true`, show message and button “Załaduj dane istniejącego pacjenta”.
- [ ] **C3** (Admin) On button click, load `response.patient` into form; optionally lock PESEL/identity.
- [ ] **C4** (Admin) “Zakończ rejestrację” with existing patient still calls `complete-registration` (backend links visit, no duplicate).
- [ ] **D1** (Admin) Reception first visit: first request creates visit only (no `patientId`, no PESEL).
- [ ] **D2** (Admin) After visit creation, staff complete registration in visit detail (or next step) via `complete-registration`.
- [ ] **E1** (Admin) Display `peselWarning` from `complete-registration` response without blocking success.

**User side**

- [ ] **F1** (User) Public booking: do not assume a patient in the response; use visit data only on confirmation.
- [ ] **F2** (User) Optional: show “Rejestracja online” on public booking confirmation when `booking_source === 'ONLINE'`.
- [ ] **F3** (User) Optional – patient portal: show Patient ID read-only; if absent, show “Pacjent niezweryfikowany”.

---

## 5. References

- **Backend API contract:** `docs/BACKEND_CHANGES_CHECKLIST.md` in the backend repo (section “New/updated API contract (for FE)”).
- **Full FE comparison:** Your “Frontend spec comparison: Patient / Visit / Registration” (sections 5–6 and 12 for PESEL and Complete registration).
- **Spec:** SPECIFICATION – PATIENT / VISIT / REGISTRATION LOGIC (PDF): PESEL as unique identifier, PATIENT_ID only after PESEL + “Complete registration”, duplicate-PESEL handling, checksum as soft warning.

Implement the **admin** items (A → B → C → D → E) and the **user** items (F) in the order that fits your app. Once done, the frontend will be aligned with the backend’s PESEL and complete-registration behaviour on both admin and user side.
