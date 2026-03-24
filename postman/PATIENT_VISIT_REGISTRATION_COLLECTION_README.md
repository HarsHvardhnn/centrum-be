# Patient / Visit / Registration Spec – Postman collection

This collection tests the **admin-side** backend changes for the Patient/Visit/Registration spec (visit-only creation, complete registration, PESEL by-pesel, patient list filter, no-show, etc.).

## File

- **`Patient_Visit_Registration_Spec_Collection.postman_collection.json`** – Import this into Postman.

## Quick start

### 1. Import

1. Open Postman → **Import** → choose **Patient_Visit_Registration_Spec_Collection.postman_collection.json**.

### 2. Set collection variables

Open the collection → **Variables** tab and set:

| Variable   | Example / description |
|-----------|------------------------|
| **baseUrl** | `http://localhost:5000` (your server URL and port) |
| **token**   | Leave empty; it can be set automatically after **Login** (see below) |
| **doctorId**| A valid doctor `_id` from your DB (e.g. from **Get Doctors** or your app) |
| **patientId** | Filled automatically after **Complete registration – new PESEL** (or set manually) |
| **visitId** | Filled automatically after **Reception first visit** (or set manually) |
| **pesel**   | `44051401359` (sample valid PESEL; used for “existing” after first complete-registration) |
| **peselNew** | `99010101234` (another PESEL for creating a new patient in “Create patient”) |

### 3. Get a token

1. Run **0. Auth & Setup → Login (receptionist / admin)**.
2. In the request body, set real `email` and `password` for a receptionist or admin user.
3. After a successful login, if your API returns the token in `token`, `accessToken`, or `data.token`, the collection script will set **token** for you. Otherwise, copy the token from the response and paste it into the **token** variable.

### 4. Get doctorId

1. Run **0. Auth & Setup → Get Doctors (get doctorId)** (or use your own “list doctors” endpoint).
2. From the response, copy one doctor’s `_id` and set it as the **doctorId** collection variable.

### 5. Run tests in order (recommended)

1. **0. Auth & Setup** – Login, then Get Doctors (and set doctorId).
2. **1. Reception – First visit** – Creates a visit only; **visitId** is set automatically.
3. **2. Complete registration** – Run “Complete registration – new PESEL” for that **visitId**; **patientId** is set automatically.
4. Then run any of **3. Patients**, **4. Appointments**, **5. Reception – Follow-up**, **6. Patient – create & update** as needed.

For **Complete registration – existing PESEL**: create another visit-only appointment (step 1 again), then run that request with the **same** PESEL so the visit is linked to the existing patient.

## Sample test data (included in collection)

- **PESEL (valid checksum):** `44051401359`
- **PESEL (new, for create patient):** `99010101234`
- **First visit:** Jan Kowalski, phone 123456789, date 2026-03-01, 10:00
- **Complete registration body:** firstName, lastName, dateOfBirth, phone, email, sex, smsConsentAgreed
- **Follow-up:** same doctor, patientId from variable, date 2026-03-02, 11:00

Adjust dates (e.g. `2026-03-01`) if your backend rejects past dates or has other rules.

## Folders and main requests

| Folder | Requests |
|--------|----------|
| **0. Auth & Setup** | Login, Get Doctors |
| **1. Reception – First visit** | Create visit only (no patientId) |
| **2. Complete registration** | New PESEL, existing PESEL (link), invalid checksum (peselWarning) |
| **3. Patients** | By-pesel (exists yes/no), Get patients list, Get all patients |
| **4. Appointments** | Get by ID (with/without patient), Update status (no-show, booked) |
| **5. Reception – Follow-up** | Create visit with patientId |
| **6. Patient – create & update** | Create with PESEL, create without PESEL (400), duplicate PESEL (409), update patientId (400) |

## Expected outcomes (summary)

- **Reception first visit:** 201, `appointment.patient` null, `booking_source` RECEPTION, `registrationData` set.
- **Complete registration (new PESEL):** 200, `existing: false`, patient and appointment returned; **patientId** may be saved to variables.
- **Complete registration (existing PESEL):** 200, `existing: true`, visit linked to existing patient.
- **Complete registration (invalid checksum):** 200, `peselWarning` in response.
- **By-pesel:** 200, `exists: true` with patient data, or `exists: false`.
- **Get appointment (visit only):** 200, `patient: null`, `booking_source`, `registrationData`.
- **Update status:** 200 for `no-show` (and other allowed statuses).
- **Create patient without PESEL:** 400.
- **Create patient duplicate PESEL:** 409.
- **Update patient with different patientId:** 400.

For full step-by-step testing instructions, see **`docs/TESTING_ADMIN_SIDE_CHANGES.md`**.
