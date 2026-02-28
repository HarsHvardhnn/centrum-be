# Patient Portal – Login / Create Account Flow (To Be Enabled Later)

This document describes the **new** patient account flow for the Patient Portal. Existing signup/login flows (e.g. OTP signup, Google login) are unchanged and co-exist with this flow.

**Rule:** A patient account cannot be created if the patient has never visited the clinic. The system checks that a `PATIENT_ID` exists (patient exists in the system **and** has at least one visit).

---

## Flow overview

1. **Patient opens** the Patient Portal login page.
2. **Patient clicks** “Log in” or “Create account” → system requests data required to create an account.
3. **Patient enters PESEL** (11 digits).
4. **Backend checks:** Does a patient with this PESEL exist **and** have at least one appointment (visit)?
   - **If NO** → Return `404` with message: *"No patient account found - please contact the reception desk."*  
     → **FE:** Display exactly this message.
   - **If YES** → Return `200` with `found: true` and `patientId`.
5. **If patient found:** FE shows the next step: “Enter an email address to be associated with the patient account.”
6. **Patient enters email** → FE calls **create-account** API with `pesel` + `email`.
7. **Backend:** Associates email with the patient, sets a temporary password, sends login details (or login link) to that email.
8. **FE:** Tell the user to check their email. Patient can later change the temporary password and username; if the patient changes the username, it is stored on the same patient record and is reflected in the internal system/dashboard automatically.

---

## API base path

All endpoints are under:

```
/api/patient-portal
```

(No authentication required for these two endpoints.)

---

## 1. Check by PESEL

**Purpose:** After the user enters PESEL, check whether a patient exists and has visited at least once. Use the response to either show “enter email” or the “No patient account found” message.

| Item | Value |
|------|--------|
| **Method** | `POST` |
| **URL** | `/api/patient-portal/check-by-pesel` |
| **Body** | `{ "pesel": "12345678901" }` |
| **Content-Type** | `application/json` |

PESEL can also be sent as query: `?pesel=12345678901` (same validation).

### Success – patient found and has visited

- **Status:** `200`
- **Body:**
```json
{
  "success": true,
  "found": true,
  "patientId": "P-1234567890",
  "message": "Patient found and has visited the clinic. You can proceed to associate an email and receive login details."
}
```

- **FE:** Proceed to the “Enter email” step. You may store `patientId` for display only; the next API still requires `pesel` + `email`.

### Not found – no patient or no visit

- **Status:** `404`
- **Body:**
```json
{
  "success": false,
  "found": false,
  "message": "No patient account found - please contact the reception desk."
}
```

- **FE:** Show this **exact** message to the user (e.g. “No patient account found - please contact the reception desk.”).

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

**Purpose:** After check-by-pesel returns `found: true`, the user enters an email. This endpoint associates that email with the patient, sets a temporary password, and sends the login details to the email.

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
  "message": "No patient account found - please contact the reception desk."
}
```

### Validation errors

- **Status:** `400`  
- **Body:** Invalid PESEL or invalid email message (e.g. “Podaj prawidłowy adres e-mail.”).

---

## Frontend integration checklist

- [ ] **Step 1 – PESEL:** On “Log in” / “Create account”, show PESEL input (11 digits). Call `POST /api/patient-portal/check-by-pesel` with `{ pesel }`.
- [ ] **Step 2a – Not found:** On `404` or `found: false`, show: *“No patient account found - please contact the reception desk.”*
- [ ] **Step 2b – Found:** On `200` and `found: true`, show “Enter email to associate with your patient account” and an email input.
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
| 1 | User enters PESEL | `POST /api/patient-portal/check-by-pesel` | Show “Enter email” | Show “No patient account found - please contact the reception desk.” |
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

**Success (200):** `{ "success": true, "found": true, "patientId": "P-1234567890", "message": "..." }`  
**Not found (404):** `{ "success": false, "found": false, "message": "No patient account found - please contact the reception desk." }`  
**Validation (400):** `{ "success": false, "message": "Podaj prawidłowy numer PESEL (11 cyfr)." }`

### 2. Create account

```http
POST /api/patient-portal/create-account
Content-Type: application/json

{ "pesel": "99010101234", "email": "patient@example.com" }
```

**Success (200):** `{ "success": true, "message": "Dane logowania zostały wysłane na podany adres e-mail. Sprawdź skrzynkę (oraz folder spam)." }`  
**Already has account (409):** `{ "success": false, "alreadyHasAccount": true, "message": "Ten pacjent ma już konto. Zaloguj się przy użyciu adresu e-mail i hasła." }`  
**Email taken by another (409):** `{ "success": false, "message": "Ten adres e-mail jest już przypisany do innego konta. ..." }`  
**Not found (404):** same as check-by-pesel.  
**Validation (400):** invalid PESEL or invalid email message.

**Note:** On success, the backend sets a temporary password on the patient, sends a welcome email (Polish) with login link and temporary password. Patient can later change password and username; username is stored on the patient record and reflected in the internal dashboard.
