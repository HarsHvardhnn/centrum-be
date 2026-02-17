# Testing steps: Admin-side changes (Patient / Visit / Registration)

Use this document to verify the **backend** admin-side behaviour after the spec implementation. You can run these via **API** (Postman, curl, or similar) or use them as **acceptance criteria** when testing through the admin UI once the frontend is updated.

**Base URLs (adjust if your app uses a prefix):**

- Appointments: `POST/GET/PATCH /appointments`
- Patients: `GET/POST/PUT /patients`
- Auth: use a valid **receptionist**, **admin**, or **doctor** token in the request (e.g. `Authorization: Bearer <token>` or your app’s auth header).

---

## Prerequisites

1. **Server running** (e.g. `npm start` or your usual command).
2. **Auth token** for a user with role `receptionist`, `admin`, or `doctor` (e.g. log in via `/auth` or your login endpoint and copy the token).
3. **Test data:** at least one **doctor** ID (e.g. from your DB or from a GET doctors/list endpoint) and, for follow-up tests, one **existing patient** ID (with a valid PESEL in `govtId`).
4. **Valid PESEL** for tests (11 digits; optionally use a checksum-valid one for “new patient”, and an existing one in DB for “existing patient”). Example valid checksum: `44051401359` (or use any 11 digits; invalid checksum will return `peselWarning` but still succeed).

---

## 1. Reception – First visit (visit only, no patient)

**Goal:** Creating an appointment without `patientId` creates only a visit (no patient), with `booking_source: RECEPTION` and `registrationData`.

### Steps

1. **POST** `/appointments/reception`  
   - Headers: `Content-Type: application/json`, `Authorization: Bearer <receptionist_or_admin_token>`  
   - Body (no `patientId`, no PESEL):

   ```json
   {
     "doctorId": "<valid_doctor_id>",
     "date": "2026-03-01",
     "startTime": "10:00",
     "consultationType": "offline",
     "firstName": "Jan",
     "lastName": "Kowalski",
     "phone": "123456789",
     "message": "First visit – visit only"
   }
   ```

2. **Verify response**
   - Status: **201**
   - Body: `success: true`, and an `appointment` object with:
     - `patient`: `null` (or absent)
     - `bookedBy`: `null` (or absent)
     - `booking_source`: `"RECEPTION"`
     - `registrationData`: object with at least `name`, `firstName`, `lastName`, `phone` (or similar)
   - Message should indicate first visit / complete registration later (e.g. “Wizyta (pierwsza wizyta) została utworzona…”).

3. **Save** `appointment._id` (VISIT_ID) for the next test (Complete registration).

**Pass criteria:** Visit is created without a patient; `booking_source` is RECEPTION; `registrationData` is present.

---

## 2. Complete registration – New patient (PESEL not in system)

**Goal:** Calling complete-registration with a **new** PESEL creates a patient and assigns the visit to that patient.

### Steps

1. Use the **VISIT_ID** from test 1 (a visit with `patient: null`). If you don’t have one, create a visit-only appointment as in test 1 and use its `_id`.

2. **POST** `/appointments/<VISIT_ID>/complete-registration`  
   - Headers: `Content-Type: application/json`, `Authorization: Bearer <token>`  
   - Body:

   ```json
   {
     "pesel": "44051401359",
     "firstName": "Jan",
     "lastName": "Kowalski",
     "dateOfBirth": "1944-05-14",
     "phone": "123456789",
     "email": "jan.kowalski@example.com",
     "sex": "Male",
     "smsConsentAgreed": true
   }
   ```

3. **Verify response**
   - Status: **200**
   - Body: `success: true`, `existing: false`, `appointment` (with `patient` populated), `patient` (with `_id`, `patientId`, `govtId` = PESEL)
   - If the PESEL checksum is invalid, optional `peselWarning` may be present; registration should still succeed.

4. **GET** `/appointments/<VISIT_ID>` (or your get-appointment-by-id endpoint)  
   - Verify the appointment now has `patient` set and `booking_source` still `"RECEPTION"`.

**Pass criteria:** New patient is created with the given PESEL; visit is linked to that patient; response includes `existing: false` and patient data.

---

## 3. Check PESEL exists (by-pesel)

**Goal:** GET by-pesel returns `exists: true` and patient data when PESEL is in the system; `exists: false` when not.

### Steps

1. **GET** `/patients/by-pesel?pesel=44051401359`  
   - Use the PESEL you used in test 2 (or any PESEL that exists in DB).  
   - No auth may be required depending on your setup; if 401, add the same Bearer token.

2. **Verify response**
   - Status: **200**
   - Body: `exists: true`, `patientId`, and `patient` object (e.g. `_id`, `name`, `govtId`, `dateOfBirth`, `phone`, `email`, `sex`).

3. **GET** `/patients/by-pesel?pesel=00000000000`  
   - Use a PESEL that does **not** exist in the system.

4. **Verify response**
   - Status: **200**
   - Body: `exists: false` (no `patient`).

**Pass criteria:** Correct `exists` and patient data for existing PESEL; `exists: false` for unknown PESEL.

---

## 4. Complete registration – Existing patient (duplicate PESEL)

**Goal:** When PESEL already exists, complete-registration **links** the visit to that patient and does **not** create a second patient.

### Steps

1. Create **another** visit-only appointment (same as test 1), or use any visit that still has `patient: null`. Note its `_id` (VISIT_ID_2).

2. **POST** `/appointments/<VISIT_ID_2>/complete-registration`  
   - Use the **same** PESEL as in test 2 (e.g. `44051401359`).  
   - Body: same structure, e.g. `pesel`, `firstName`, `lastName`, `phone`, etc. (can be same or slightly different; backend should link to existing patient).

3. **Verify response**
   - Status: **200**
   - Body: `success: true`, **`existing: true`**, `appointment` with `patient` set, `patient` object (same patient as before, not a new one).
   - Message should indicate assignment to existing patient (e.g. “Rejestracja zakończona. Wizyta przypisana do istniejącego pacjenta.”).

4. **Optional:** In DB or via GET patient list, confirm there is still **one** patient with that PESEL (no duplicate).

**Pass criteria:** Visit is assigned to existing patient; `existing: true`; no new patient created.

---

## 5. Reception – Follow-up (existing patient)

**Goal:** Sending `patientId` creates a visit linked to that patient with `booking_source: RECEPTION`.

### Steps

1. **POST** `/appointments/reception`  
   - Body **with** `patientId` (use an existing patient `_id` from your DB or from test 2):

   ```json
   {
     "doctorId": "<valid_doctor_id>",
     "patientId": "<existing_patient_id>",
     "date": "2026-03-02",
     "startTime": "11:00",
     "consultationType": "offline",
     "message": "Follow-up visit"
   }
   ```

2. **Verify response**
   - Status: **201**
   - Body: `appointment` with `patient` and `bookedBy` set to that patient, and **`booking_source`: `"RECEPTION"`**.

**Pass criteria:** Appointment has patient and bookedBy set; booking_source is RECEPTION.

---

## 6. Get appointment by ID – Visit without patient

**Goal:** Fetching a visit that has no patient returns `patient: null`, `booking_source`, and `registrationData` (for “Dane podstawowe” / “Zgody” in UI).

### Steps

1. Create a **visit-only** appointment (test 1) if you don’t have one left with `patient: null`. Note its `_id`.

2. **GET** `/appointments/<VISIT_ID>`  
   - Use the visit id that has no patient.

3. **Verify response**
   - Status: **200**
   - Body (e.g. under `data` or root): `patient: null`, `booking_source` present (e.g. `"RECEPTION"` or `"ONLINE"`), `registrationData` present with name/phone/consents or similar.

**Pass criteria:** No crash; patient null; booking_source and registrationData present.

---

## 7. Get appointment by ID – Visit with patient

**Goal:** Fetching a visit that has a patient returns full appointment with patient and booking_source.

### Steps

1. **GET** `/appointments/<VISIT_ID>`  
   - Use a visit that **has** a patient (e.g. after complete registration or follow-up).

2. **Verify response**
   - Status: **200**
   - Body: `patient` populated (e.g. `_id`, `name`, `patientId`, `govtId`, …), `booking_source` present.

**Pass criteria:** Patient and booking_source returned; no errors.

---

## 8. Update appointment status to no-show

**Goal:** Status can be set to `no-show` (and other allowed statuses).

### Steps

1. **PATCH** `/appointments/<APPOINTMENT_ID>/status`  
   - Body: `{ "status": "no-show" }`  
   - Use any appointment id (with or without patient).

2. **Verify response**
   - Status: **200** (or your success code)
   - Appointment status is updated to `no-show`.

3. **Optional:** Repeat with `"cancelled"`, `"completed"`, `"checkedIn"`, `"booked"` to ensure all are accepted.

**Pass criteria:** `no-show` and other enum values are accepted and persisted.

---

## 9. Patient list – Only patients with PATIENT_ID / govtId

**Goal:** GET patients list returns only patients who have completed registration (have `patientId` or `govtId`).

### Steps

1. **GET** `/patients` or `/patients/data/simple` (depending on your API)  
   - With auth if required.

2. **Verify**
   - Every returned patient has either `patientId` or `govtId` (or both) set and non-empty.
   - If you have any “visit-only” or placeholder users in DB with no PESEL/patientId, they should **not** appear in this list.

**Pass criteria:** List contains only patients with patientId or govtId; no ghost/placeholder records.

---

## 10. Patient ID immutable (updatePatient)

**Goal:** Backend rejects attempts to change a patient’s `patientId` via update.

### Steps

1. **PUT** `/patients/<PATIENT_ID>` (or PATCH, depending on your API)  
   - Body includes a **different** `patientId` than the one currently stored (e.g. try to set `patientId: "P-9999999999"` for a patient who has another value).

2. **Verify response**
   - Status: **400**
   - Message indicates that Patient ID cannot be changed (e.g. “Identyfikator pacjenta nie może być zmieniony”).

3. **GET** `/patients/<PATIENT_ID>`  
   - Confirm the patient’s `patientId` is **unchanged**.

**Pass criteria:** Update with different patientId is rejected; existing patientId unchanged.

---

## 11. Create patient (standalone) – PESEL required and unique

**Goal:** Creating a patient via POST /patients requires PESEL; duplicate PESEL is rejected.

### Steps

1. **POST** `/patients`  
   - Body **without** `govtId` / PESEL (or with invalid PESEL, e.g. too short).  
   - Include other required fields (e.g. name, phone, role, etc. as your API expects).

2. **Verify response**
   - Status: **400**
   - Message that PESEL is required (e.g. “PESEL (11 cyfr) jest wymagany do utworzenia pacjenta.”).

3. **POST** `/patients`  
   - Body **with** a PESEL that **already exists** in the system (e.g. the one from test 2).  
   - Other fields valid.

4. **Verify response**
   - Status: **409**
   - Message that patient with this PESEL already exists (e.g. “Pacjent z tym numerem PESEL już istnieje w systemie.”).

5. **POST** `/patients`  
   - Body with a **new** PESEL (11 digits, not in DB) and all required fields.

6. **Verify response**
   - Status: **201** (or 200)
   - New patient created with that `govtId` and a `patientId` (e.g. P-…).

**Pass criteria:** Patient cannot be created without PESEL; duplicate PESEL returns 409; new PESEL creates patient.

---

## 12. PESEL checksum warning (soft validation)

**Goal:** Complete-registration with an **invalid checksum** PESEL still succeeds but returns `peselWarning`.

### Steps

1. Create a visit-only appointment; note its `_id`.

2. **POST** `/appointments/<VISIT_ID>/complete-registration`  
   - Body with a PESEL that has **11 digits but invalid checksum** (e.g. `12345678901` – last digit wrong).  
   - Include required fields (firstName, lastName, phone, etc.).

3. **Verify response**
   - Status: **200**
   - Registration succeeds: `success: true`, `patient` and `appointment` returned.
   - Body includes **`peselWarning`** with a message like “Ostrzeżenie: numer PESEL może być nieprawidłowy (błąd sumy kontrolnej).”.

**Pass criteria:** Request succeeds; `peselWarning` present; no 400/500 due to checksum.

---

## Quick reference – Endpoints used

| Action | Method | Endpoint |
|--------|--------|----------|
| Reception first visit (visit only) | POST | `/appointments/reception` (no patientId) |
| Reception follow-up | POST | `/appointments/reception` (with patientId) |
| Complete registration | POST | `/appointments/:visitId/complete-registration` |
| Check PESEL exists | GET | `/patients/by-pesel?pesel=...` |
| Get appointment by ID | GET | `/appointments/:id` |
| Update appointment status | PATCH | `/appointments/:appointmentId/status` |
| Get patients list | GET | `/patients` or `/patients/data/simple` |
| Update patient | PUT | `/patients/:id` |
| Create patient | POST | `/patients` |

---

## Suggested order

1. **1** → **2** → **6** (first visit, then complete registration, then get visit with patient).  
2. **3** (by-pesel).  
3. **4** (complete registration with existing PESEL).  
4. **5** (follow-up).  
5. **7**, **8**, **9**, **10**, **11**, **12** in any order.

After all steps pass, the admin-side backend behaviour for visits, PESEL, and complete registration is verified.
