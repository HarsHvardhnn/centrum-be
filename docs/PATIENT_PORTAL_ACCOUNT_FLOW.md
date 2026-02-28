# Patient Portal – Login / Create Account Flow (To Be Enabled Later)

This document describes the **new** patient account flow for the Patient Portal. Existing signup/login flows (e.g. OTP signup, Google login) are unchanged and co-exist with this flow.

**Rule:** A patient account can only be created if (a) the patient already exists and has at least one visit, or (b) there is a visit-only appointment (e.g. online booking) with this PESEL stored in `tempPesel` or `registrationData.pendingPesel`. In case (b), creating an account creates the patient from the visit’s `registrationData` and links that visit (and any other visits with the same PESEL) to the new patient.

---

## Flow overview

1. **Patient opens** the Patient Portal login page.
2. **Patient clicks** “Log in” or “Create account” → system requests PESEL.
3. **Patient enters PESEL** (11 digits).
4. **Backend checks (check-by-pesel):**
   - **Existing patient:** A patient with this PESEL exists **and** has at least one appointment → `200`, `found: true`, `source: "existing_patient"`, `patientId`.
   - **Pending visit:** No such patient, but an appointment exists with this PESEL in `tempPesel` or `registrationData.pendingPesel` (visit-only, not yet linked to a patient) → `200`, `found: true`, `source: "pending_visit"`. No `patientId` yet.
   - **Otherwise** → `404` with message: *"Nie znaleziono konta pacjenta. Proszę skontaktować się z rejestracją."*
5. **If found (either source):** FE shows “Enter an email address to be associated with your patient account.”
6. **Patient enters email** → FE calls **create-account** with `pesel` + `email`.
7. **Backend (create-account):**
   - **Existing patient:** Associates email with the patient, sets a temporary password, sends login details to that email.
   - **Pending visit:** Creates a new patient from the appointment’s `registrationData` (name, phone, dateOfBirth, sex, address, consents, etc.), sets PESEL and the provided email, sets a temporary password, links all appointments with this PESEL (tempPesel/pendingPesel) to the new patient, sends login details to the email.
8. **FE:** Tell the user to check their email. Patient can later change password and username; username is stored on the patient record and reflected in the internal dashboard.

---

## API base path

All endpoints are under:

```
/api/patient-portal
```

(No authentication required for these two endpoints.)

**Language:** All error and success response fields `message` are in **Polish**.

---

## 1. Check by PESEL

**Purpose:** After the user enters PESEL, check whether a patient exists and has visited at least once. Use the response to either show “enter email” or the not-found message. All response `message` values are in Polish.

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **URL** | `/api/patient-portal/check-by-pesel` |
| **Body** | `{ "pesel": "12345678901" }` |
| **Content-Type** | `application/json` |

PESEL can also be sent as query: `?pesel=12345678901` (same validation).

### Success – existing patient (has visited)

- **Status:** `200`
- **Body:**
```json
{
  "success": true,
  "found": true,
  "source": "existing_patient",
  "patientId": "P-1234567890",
  "message": "Znaleziono pacjenta, który odwiedził przychodnię. Możesz podać adres e-mail, aby powiązać konto i otrzymać dane logowania."
}
```

- **FE:** Proceed to the “Enter email” step. Next API requires `pesel` + `email`.

### Success – pending visit (PESEL in tempPesel / registrationData.pendingPesel)

- **Status:** `200`
- **Body:**
```json
{
  "success": true,
  "found": true,
  "source": "pending_visit",
  "message": "Znaleziono wizytę z tym numerem PESEL. Wprowadź adres e-mail, aby utworzyć konto pacjenta i powiązać tę wizytę."
}
```

- **FE:** Same as above: show “Enter email” and then call create-account with `pesel` + `email`. Backend will create the patient from the visit’s registration data and link the visit(s).

### Not found – no patient or no visit

- **Status:** `404`
- **Body:**
```json
{
  "success": false,
  "found": false,
  "message": "Nie znaleziono konta pacjenta. Proszę skontaktować się z rejestracją."
}
```

- **FE:** Show this message to the user (all API `message` fields are in Polish).

### Validation errors

- **Status:** `400`  
- **Body (example):**
```json
{
  "success": false,
  "message": "Podaj prawidłowy numer PESEL (11 cyfr)."
}
```
or invalid PESEL format message.

---

## 2. Create account (associate email and send login details)

**Purpose:** After check-by-pesel returns `found: true` (either `existing_patient` or `pending_visit`), the user enters an email. This endpoint either (a) associates that email with an existing patient and sets a temporary password, or (b) creates a new patient from the visit’s `registrationData` (when PESEL was only in tempPesel/pendingPesel), links the visit(s) to the new patient, and sends login details. In both cases login details are sent to the given email.

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **URL** | `/api/patient-portal/create-account` |
| **Body** | `{ "pesel": "12345678901", "email": "patient@example.com" }` |
| **Content-Type** | `application/json` |

### Success

- **Status:** `200`
- **Body:**
```json
{
  "success": true,
  "message": "Dane logowania zostały wysłane na podany adres e-mail. Sprawdź skrzynkę (oraz folder spam)."
}
```

- **FE:** Show a success message and tell the user to check their email (and spam folder). Optionally link to the login page.

### Email already used by another account

- **Status:** `409`
- **Body:**
```json
{
  "success": false,
  "message": "Ten adres e-mail jest już przypisany do innego konta. Użyj innego adresu e-mail lub skontaktuj się z rejestracją."
}
```

- **FE:** Ask for a different email or show contact info.

### Patient already has an account

If this PESEL already has an account (email + password set, e.g. from a previous create-account or from complete-registration at the clinic), the backend returns:

- **Status:** `409`
- **Body:**
```json
{
  "success": false,
  "alreadyHasAccount": true,
  "message": "Ten pacjent ma już konto. Zaloguj się przy użyciu adresu e-mail i hasła."
}
```

- **FE:** Do not show the email step. Show a message like “You already have an account. Please log in with your email and password.” and redirect to the login form (email + password).

### Patient not found / no visit (e.g. expired or re-check)

- **Status:** `404`
- **Body:** Same as check-by-pesel:
```json
{
  "success": false,
  "found": false,
  "message": "Nie znaleziono konta pacjenta. Proszę skontaktować się z rejestracją."
}
```

### Validation errors

- **Status:** `400`  
- **Body:** Invalid PESEL or invalid email message (e.g. “Podaj prawidłowy adres e-mail.”).

---

## Frontend integration checklist

- [ ] **Step 1 – PESEL:** On “Log in” / “Create account”, show PESEL input (11 digits). Call `POST /api/patient-portal/check-by-pesel` with `{ pesel }`.
- [ ] **Step 2a – Not found:** On `404` or `found: false`, show the response `message` (Polish): *"Nie znaleziono konta pacjenta. Proszę skontaktować się z rejestracją."*
- [ ] **Step 2b – Found:** On `200` and `found: true` (optional: use `source`: `"existing_patient"` vs `"pending_visit"` for analytics or copy). Show “Enter email to associate with your patient account” and an email input.
- [ ] **Step 3 – Create account:** On submit, call `POST /api/patient-portal/create-account` with `{ pesel, email }`.
- [ ] **Step 4a – Success:** On `200`, show success and “Check your email (and spam) for login details.”
- [ ] **Step 4b – Email taken:** On `409` without `alreadyHasAccount`, show the Polish message and ask for another email or contact reception.
- [ ] **Step 4c – Already has account:** On `409` with `alreadyHasAccount: true`, show “You already have an account. Please log in.” and redirect to login (email + password).
- [ ] **Login:** When patient portal login is enabled, patients will use the same login endpoint (e.g. `POST /auth/login` or a dedicated patient-login) with the email and temporary password (then change password as needed). Username changes are done via profile/update and are reflected in the internal system automatically.

---

## Enabling patient login (later)

Currently, the main auth login endpoint may block the `patient` role. When you are ready to enable the Patient Portal login:

- Allow `role === "patient"` in the login flow (e.g. in `authController.login`), or use a separate patient-login route that only accepts patients.
- Ensure password reset / change-password flows work for the `patient` role if they use the same User model.

The new flow only **creates/updates** the patient account (email + temporary password) and sends the email; actual login is handled by the existing auth system once patient login is enabled.

---

## Summary

| Step | FE action | API | On success | On failure |
|------|------------|-----|------------|------------|
| 1 | User enters PESEL | `POST /api/patient-portal/check-by-pesel` | Show “Enter email” | Show response `message` (Polish) |
| 2 | User enters email | `POST /api/patient-portal/create-account` | “Check your email for login details” | 409 (email taken / already has account) or 404 |

No registration of users who have never been patients.

---

## API reference (base URL + examples)

**Base URL:** `https://<your-backend-host>/api/patient-portal` (e.g. `https://centrum-be.onrender.com/api/patient-portal`).

### 1. Check by PESEL

```http
POST /api/patient-portal/check-by-pesel
Content-Type: application/json

{ "pesel": "99010101234" }
```

**Success (200) – existing patient:** `{ "success": true, "found": true, "source": "existing_patient", "patientId": "P-1234567890", "message": "Znaleziono pacjenta, który odwiedził przychodnię. Możesz podać adres e-mail, aby powiązać konto i otrzymać dane logowania." }`  
**Success (200) – pending visit:** `{ "success": true, "found": true, "source": "pending_visit", "message": "Znaleziono wizytę z tym numerem PESEL. Wprowadź adres e-mail, aby utworzyć konto pacjenta i powiązać tę wizytę." }`  
**Not found (404):** `{ "success": false, "found": false, "message": "Nie znaleziono konta pacjenta. Proszę skontaktować się z rejestracją." }`  
**Validation (400):** `{ "success": false, "message": "Podaj prawidłowy numer PESEL (11 cyfr)." }`

### 2. Create account

```http
POST /api/patient-portal/create-account
Content-Type: application/json

{ "pesel": "99010101234", "email": "patient@example.com" }
```

**Success (200):** `{ "success": true, "message": "Dane logowania zostały wysłane na podany adres e-mail. Sprawdź skrzynkę (oraz folder spam).", "patientId": "P-1234567890" }` (patientId present when patient was just created from pending visit).  
**Already has account (409):** `{ "success": false, "alreadyHasAccount": true, "message": "Ten pacjent ma już konto. Zaloguj się przy użyciu adresu e-mail i hasła." }`  
**Email taken by another (409):** `{ "success": false, "message": "Ten adres e-mail jest już przypisany do innego konta. ..." }`  
**Not found (404):** same as check-by-pesel.  
**Validation (400):** invalid PESEL or invalid email message.

**Note:** On success, the backend either updates the existing patient or creates a new one from the visit’s `registrationData` (name, phone, dateOfBirth, sex, address, consents, document fields for international, etc.), sets a temporary password, and sends a welcome email (Polish) with login link and temporary password. Any visit-only appointments with this PESEL (tempPesel/pendingPesel) are linked to the patient. Patient can later change password and username; username is stored on the patient record and reflected in the internal dashboard.
