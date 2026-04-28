# Get consents by visit – API contract

Use this API to load consents for a single visit (appointment). Consents can come from the **patient** (when the visit is linked to a patient) or from **registration data** (visit-only / to-be-completed).

---

## Endpoint

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/appointments/:visitId/consents` | Required: `doctor`, `receptionist`, or `admin` |

**Path parameter**

- **`visitId`** – Appointment (visit) ID, e.g. `6999b34b6c043f2a3ebd4bcd`.

**Example**

```http
GET /appointments/6999b34b6c043f2a3ebd4bcd/consents
Authorization: Bearer <token>
```

---

## Response

### Success (200)

**When the visit has a linked patient**  
Consents are taken from the patient record (`source: "patient"`).

**When the visit has no patient (visit-only)**  
Consents are taken from the visit’s registration data (`source: "registration"`).

**Body**

```json
{
  "success": true,
  "visitId": "6999b34b6c043f2a3ebd4bcd",
  "source": "patient",
  "consents": [
    {
      "id": 1234567890,
      "text": "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
      "agreed": true
    },
    {
      "id": 1234567891,
      "text": "Zapoznałem(-am) się z Regulaminem i Polityką Prywatności i akceptuję ich postanowienia.",
      "agreed": true
    }
  ],
  "bookingConsentsAtBooking": [
    {
      "id": 1234567890,
      "text": "Wyrażam zgodę na otrzymywanie powiadomień SMS i e-mail dotyczących mojej wizyty (np. przypomnienia, zmiany terminu).",
      "agreed": true
    }
  ],
  "patientData": {
    "name": "Jan Kowalski",
    "firstName": "Jan",
    "lastName": "Kowalski",
    "email": "jan@example.com",
    "phone": "123456789",
    "phoneCode": "+48",
    "sex": "Male",
    "dateOfBirth": "1990-01-15T00:00:00.000Z",
    "govtId": "90011512345"
  },
  "appointmentData": {
    "visitId": "6999b34b6c043f2a3ebd4bcd",
    "status": "booked",
    "date": "2026-01-03T00:00:00.000Z",
    "startTime": "15:00",
    "endTime": "15:15",
    "notes": "Patient note written during registration...",
    "reservation": {
      "createdBy": "Online",
      "createdAt": "2026-01-01T08:00:00.000Z",
      "createdAtDisplay": "01.01, 08:00",
      "wasRescheduled": true,
      "latestRescheduledBy": "Reception",
      "latestRescheduledAt": "03.01, 15:00",
      "history": [
        {
          "action": "rescheduled",
          "by": "Reception",
          "at": "03.01, 15:00",
          "previousDate": "2026-01-01T00:00:00.000Z",
          "previousStartTime": "08:00",
          "previousEndTime": "08:15",
          "newDate": "2026-01-03T00:00:00.000Z",
          "newStartTime": "15:00",
          "newEndTime": "15:15",
          "previousDoctor": {
            "id": "6845a07e7d8e37e04d8f1d15",
            "name": "Jan Kowalski"
          },
          "newDoctor": {
            "id": "6845a07e7d8e37e04d8f1d99",
            "name": "Anna Nowak"
          }
        }
      ],
      "summaryText": "Created by: Online (01.01, 08:00); rescheduled by: Reception (03.01, 15:00)"
    }
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` |
| `visitId` | string | The appointment/visit ID requested. |
| `source` | string | `"patient"` if consents (and data) come from the linked patient; `"registration"` if from visit-only registration data. |
| `consents` | array | List of consent objects. Each item can have `id`, `text`, `agreed` (and other fields the backend stores). |
| `bookingConsentsAtBooking` | array | Snapshot of consents captured at booking time (immutable history view). |
| `patientData` | object | Basic contact/identity data for the visit. All fields are `null` when not available. See table below. |
| `appointmentData` | object | Reservation-level details for this visit (who created, when, reschedule info, notes). |

**`patientData` fields** (all nullable; use for display and to know what to send when updating):

| Field | Type | Description |
|-------|------|-------------|
| `name` | string \| null | Full name. |
| `firstName` | string \| null | First name. |
| `lastName` | string \| null | Last name. |
| `email` | string \| null | Email address. |
| `phone` | string \| null | Phone number. |
| `phoneCode` | string \| null | Phone country code (e.g. `"+48"`). |
| `sex` | string \| null | Gender (e.g. `"Male"`, `"Female"`). |
| `dateOfBirth` | string (ISO) \| null | Date of birth. |
| `govtId` | string \| null | PESEL or other government ID. |

If there are no consents (e.g. visit-only with no registration consents saved), `consents` is `[]`. For visit-only, `patientData` is built from `registrationData`; for linked patient, from the patient document.

### Visit not found (404)

```json
{
  "success": false,
  "message": "Visit not found"
}
```

### Invalid visit ID (400)

```json
{
  "success": false,
  "message": "Invalid visit ID format"
}
```

### Server error (500)

```json
{
  "success": false,
  "message": "Failed to fetch visit consents",
  "error": "..."
}
```

---

## Frontend usage

- Call **after** you have a visit/appointment ID (e.g. from list or detail).
- Use **`source`** to know where consents/data came from (patient vs registration).
- Use **`consents`** to render the consent list (text + agreed yes/no).
- Use **`bookingConsentsAtBooking`** to render "consents at booking time" history (do not overwrite with current edits).
- Use **`patientData`** to show name, email, phone, sex, DOB, etc. (all nullable – show empty or "—" when null).
- Use **`appointmentData`** to show reservation summary:
  - created by + created time
  - whether rescheduled and who/when
  - note/problem text from the reservation
  - full reschedule history if needed for timeline UI (including `previousDoctor` and `newDoctor` per change)
- Handle **empty `consents`** for visit-only visits that have no stored consents.

**Example (fetch)**

```js
const visitId = "6999b34b6c043f2a3ebd4bcd"; // from your state/route
const res = await fetch(`/appointments/${visitId}/consents`, {
  headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
if (data.success) {
  console.log(data.consents, data.source, data.patientData);
  // e.g. data.patientData.name, data.patientData.email, data.patientData.phone
} else {
  console.error(data.message);
}
```

---

## How the frontend can update this data

- **Consents:** Update via **PUT `/appointments/:id/details`** with the full `patientData` (and `consultationData`, etc.). Consents are part of the patient or registration flow; when you complete registration or update appointment details, send the updated `consents` array in the payload (e.g. in the object used for patient/registration data).
- **Name, email, phone, sex, DOB, etc.:**
  - **Visit already has a patient:** use **PUT `/appointments/:appointmentId/details`** and send the updated fields in `patientData` (e.g. `firstName`, `lastName`, `email`, `phone`, `phoneCode`, `dateOfBirth`, `sex`). The backend persists these to the patient model.
  - **Visit-only (no patient yet):** use **POST `/appointments/:visitId/complete-registration`** to link or create the patient; send PESEL (or international document) plus `firstName`, `lastName`, `email`, `phone`, `dateOfBirth`, `sex`, `consents`, etc. After that, the visit is linked to the patient and further changes go through PUT details or patient APIs.

So: **GET consents** = read consents + basic patient/registration data for display; **update** = PUT appointment details (when patient exists) or complete-registration (when visit-only).

---

## Summary

| Item | Value |
|------|--------|
| **API** | `GET /appointments/:visitId/consents` |
| **Auth** | Doctor, receptionist, or admin |
| **Returns** | `consents` array, `source` (`"patient"` or `"registration"`), and `patientData` (name, email, phone, phoneCode, sex, dateOfBirth, govtId – all nullable). |
| **Visit-only** | Uses `registrationData` for consents and `patientData` when no patient is linked. |
| **Update** | PUT `/appointments/:id/details` (when patient linked) or POST `/appointments/:visitId/complete-registration` (visit-only). |
