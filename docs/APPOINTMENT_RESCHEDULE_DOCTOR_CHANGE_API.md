# Appointment Reschedule + Doctor Change (FE Integration)

This document lists API changes made for supporting doctor reassignment during reschedule and showing old/new doctor in visit details.

---

## 1) Updated API: Reschedule appointment

- **Method:** `PATCH`
- **Path:** `/appointments/:appointmentId/reschedule`
- **Roles:** `doctor`, `receptionist`, `admin`

### What changed

- You can now change doctor while rescheduling.
- New request field: `newDoctorId` (preferred).
- Backward-compatible alias: `doctorId`.
- Conflict check uses the **target doctor** (new doctor if provided; current doctor otherwise).
- Reschedule history now stores both:
  - `previousDoctorId`
  - `newDoctorId`

### Request example

```json
{
  "newDate": "2026-05-12",
  "newStartTime": "10:30",
  "newEndTime": "10:45",
  "newDoctorId": "6845a07e7d8e37e04d8f1d99",
  "overrideConflicts": false,
  "isBackdated": false,
  "sendSMSNotification": true,
  "sendEmailNotification": true
}
```

### Response additions (200)

`data` now includes:

```json
{
  "oldDoctor": {
    "id": "6845a07e7d8e37e04d8f1d15",
    "name": "Jan Kowalski"
  },
  "newDoctor": {
    "id": "6845a07e7d8e37e04d8f1d99",
    "name": "Anna Nowak"
  }
}
```

---

## 2) Updated API: Visit details/consents

- **Method:** `GET`
- **Path:** `/appointments/:visitId/consents`
- **Roles:** `doctor`, `receptionist`, `admin`

### What changed

Inside `appointmentData.reservation.history[]`, each history item now includes:

- `previousDoctor`: `{ id, name } | null`
- `newDoctor`: `{ id, name } | null`

This allows FE to show timeline entries like:
- "Rescheduled from Dr A to Dr B"
- "Time changed (same doctor)" when both doctor IDs are identical.

### History item example

```json
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
```

---

## FE notes

- Prefer sending `newDoctorId` in reschedule requests.
- Keep `doctorId` only for backward compatibility if needed.
- When rendering history timeline, use `previousDoctor` and `newDoctor` if present.
- If either is `null`, show fallback text like `"Unknown doctor"` or hide doctor-change badge for that event.
