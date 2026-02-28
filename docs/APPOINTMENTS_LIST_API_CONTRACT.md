# Appointments list API – contract for frontend

**Endpoint:** `GET /api/appointments/details/list`  
**Used for:** Lista pacjentów (patient list) and Historia wizyt (visit history / clinic).

---

## 1. Why visit-only was added now

The list API was originally implemented to return only appointments that had a linked patient. Visit-only appointments (created as “Wizyta bez pacjenta” or first visit before “Zakończ rejestrację”) were not in scope at that time, so they were excluded. The backend has now been updated so that **all** matching appointments are returned, including those without a patient. There is no separate “visit-only” endpoint; the same list endpoint returns both.

If your PDF requirements mentioned “include visit-only in list” and it wasn’t done earlier, it was likely a missed item in the first implementation pass. To avoid that in future, keep a short checklist from the PDF (e.g. “List API must include visit-only”) and confirm each item during integration.

---

## 2. Other changes that might still be relevant

From the current codebase, these are already in place or not applicable:

- **GET /appointments/details/list** – Now includes visit-only (with and without `isClinicIp`).
- **GET /appointments/dashboard** – Does not filter by patient, so visit-only are already included.
- **Complete registration** – Duplicate phone/email (E11000) is handled with 409 and a clear message.
- **Patient create** – Empty `consultingSpecialization` / `consultingDoctor` no longer cause CastError.
- **Appointment createdBy** – `"admin"` is allowed in the enum.

If your PDF had additional items (e.g. other list endpoints, reports, or filters), those would need to be checked separately against the spec.

---

## 3. How visit-only is represented (no separate endpoint)

- There is **no** separate endpoint for “patient-less” appointments.
- The **same** `GET /api/appointments/details/list` returns:
  - Appointments **with** a linked patient.
  - Appointments **without** a linked patient (visit-only).
- For clinic (`isClinicIp=true`) you can additionally pass `patientLessOnly=true` to return **only** visit-only rows.

---

## 4. How the frontend can recognise visit-only

Two equivalent options:

**Option A – Explicit flag (recommended)**  
- Use the **`isVisitOnly`** field on each appointment object.
- `isVisitOnly === true` → visit-only (no patient linked); show e.g. “Zakończ rejestrację”.
- `isVisitOnly === false` or missing → appointment has a patient.

**Option B – Infer from patient**  
- Use: `!(appointment.patient?.id || appointment.patient?._id)`.
- If that expression is true, treat as visit-only (same behaviour as Option A).

No other flag or query parameter was added; the only explicit signal is **`isVisitOnly`** on each item.

---

## 5. API contract: GET /api/appointments/details/list

### Request

- **Method:** `GET`
- **Path:** `/api/appointments/details/list`
- **Auth:** Bearer token (e.g. `Authorization: Bearer <token>`)

**Query parameters**

| Parameter    | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `page`      | number | No       | Page number (default `1`) |
| `limit`     | number | No       | Page size (default `10`, max `100`) |
| `sortBy`    | string | No       | e.g. `"date"` (default `"date"`) |
| `sortOrder` | string | No       | e.g. `"desc"` (default `"desc"`) |
| `searchTerm`| string | No       | Search in patient name, contact, registrationData, notes, etc. |
| `status`    | string | No       | `"All"`, `"booked"`, `"completed"`, `"cancelled"`, `"checkedIn"`, `"no_appointment"` (non-clinic only) |
| `startDate` | string | No       | Date range start (ISO or YYYY-MM-DD) |
| `endDate`   | string | No       | Date range end (ISO or YYYY-MM-DD) |
| `doctorId`  | string | No       | Filter by doctor ObjectId |
| `appointmentId` | string | No   | Single appointment by ID |
| `isClinicIp`| string | No       | `"true"` for clinic / Historia wizyt; omit or `"false"` for Lista pacjentów |
| `patientLessOnly` | string | No | **Clinic only (`isClinicIp=true`)**. When `"true"`/`"1"` returns only visit-only (patient-less) appointments (`isVisitOnly === true`). Ignored for non-clinic calls. |

### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "<appointmentId>",
      "_id": "<appointmentId>",
      "date": "<ISO date>",
      "startTime": "10:00",
      "endTime": "10:30",
      "meetLink": "",
      "status": "booked",
      "mode": "online",
      "checkIn": false,
      "checkInDate": null,
      "patient": null,
      "patient_id": null,
      "isVisitOnly": true,
      "registrationData": {
        "firstName": "Jan",
        "lastName": "Kowalski",
        "name": "Jan Kowalski",
        "phone": "600111222",
        "email": "jan@example.com"
      },
      "doctor": {
        "id": "<doctorId>",
        "name": "Jan Doktor",
        "email": "doctor@example.com"
      },
      "metadata": {}
    },
    {
      "id": "<appointmentId>",
      "_id": "<appointmentId>",
      "date": "<ISO date>",
      "startTime": "11:00",
      "endTime": "11:30",
      "meetLink": "",
      "status": "booked",
      "mode": "offline",
      "checkIn": false,
      "checkInDate": null,
      "patient": {
        "patient_status": "active",
        "id": "<patientId>",
        "_id": "<patientId>",
        "patientId": "P-1234567890",
        "name": "Anna Nowak",
        "sex": "Female",
        "age": 25,
        "phoneNumber": "600111222",
        "profilePicture": null,
        "email": "anna@example.com"
      },
      "patient_id": "<patientId>",
      "isVisitOnly": false,
      "doctor": {
        "id": "<doctorId>",
        "name": "Jan Doktor",
        "email": "doctor@example.com"
      },
      "metadata": {}
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "pages": 3,
    "limit": 10
  }
}
```

### Per-item fields (important for FE)

| Field              | Type    | When present | Meaning |
|--------------------|---------|--------------|--------|
| `patient`          | object \| null | Always | `null` = visit-only; object = linked patient. |
| `patient_id`       | string \| null | Always | Patient `_id` when linked; `null` for visit-only. |
| `isVisitOnly`      | boolean | Always | `true` = no patient (visit-only); `false` = has patient. |
| `registrationData` | object  | Optional | Present for visit-only; may contain `firstName`, `lastName`, `name`, `phone`, `email` for display. |

### Frontend usage

- **Show “Zakończ rejestrację”:**  
  `appointment.isVisitOnly === true` or `!(appointment.patient?.id || appointment.patient?._id)`.
- **Open Complete registration modal:**  
  Use same condition; send `visitId` = `appointment.id` (or `appointment._id`) to `POST /api/appointments/:visitId/complete-registration`.
- **Display name for visit-only:**  
  Use `appointment.registrationData?.name` or `[appointment.registrationData?.firstName, appointment.registrationData?.lastName].filter(Boolean).join(' ')` when `patient` is null.

---

## 6. Summary

| Topic | Detail |
|-------|--------|
| **Why not done from PDF** | No access to prior conversation/PDF; possible missed item in first pass. |
| **Other missing changes** | List + dashboard + complete-registration + patient create + createdBy are addressed; any other PDF items need a separate check. |
| **How visit-only is sent** | Same list API; we no longer exclude rows where patient is null. |
| **Flag for FE** | **`isVisitOnly`** on each appointment; `true` = visit-only, `false` = has patient. |
| **API contract** | Above request/response and field table; use `isVisitOnly` (or `patient == null`) to integrate. |
