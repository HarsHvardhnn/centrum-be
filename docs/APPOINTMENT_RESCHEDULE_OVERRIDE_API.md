# Appointment Reschedule/Time Update - Override Support

This document explains override behavior for reschedule APIs, aligned with booking flow.

---

## 1) Reschedule endpoint

- **Method:** `PATCH`
- **Path:** `/appointments/:appointmentId/reschedule`
- **Roles:** `doctor`, `receptionist`, `admin`

### Request body

You can send either naming convention:
- `newDate`, `newStartTime`, `newEndTime`
- or `date`, `startTime`, `endTime`
- optional doctor change:
  - `newDoctorId` (preferred)
  - `doctorId` (legacy-compatible alias)

Override fields:
- `overrideConflicts` (boolean, optional, default `false`)
- `isBackdated` (boolean, optional, default `false`)
- `sendSMSNotification` (boolean, optional) - SMS toggle
- `sendEmailNotification` (boolean, optional) - Email toggle

```json
{
  "newDate": "2026-05-10",
  "newStartTime": "14:30",
  "newEndTime": "14:45",
  "newDoctorId": "6845a07e7d8e37e04d8f1d15",
  "overrideConflicts": true,
  "isBackdated": false,
  "consultationType": "offline",
  "sendSMSNotification": true,
  "sendEmailNotification": false
}
```

### Behavior

- If `isBackdated` is `false`, moving to past datetime is blocked (`400`).
- If `overrideConflicts` is `false`, same-doctor/same-day/same-startTime booked-slot conflict is blocked (`409`).
- If `overrideConflicts` is `true`, conflict check is bypassed.
- If `newDoctorId`/`doctorId` is provided, appointment is reassigned to that doctor as part of reschedule.
- Notifications are decoupled:
  - `sendSMSNotification=true` can send SMS (only when patient has phone **and** SMS consent in DB is true).
  - `sendEmailNotification=true` can send email (only when email is valid/present).
  - You can send only SMS, only Email, both, or none.

### Legacy compatibility (deprecated)

The backend still accepts old fields for compatibility:
- `smsToBeSent`
- `persistSmsConsent`

FE should migrate to:
- `sendSMSNotification`
- `sendEmailNotification`

### Success response (200) additions

`data.overrideInfo` is returned:

```json
{
  "overrideInfo": {
    "overrideConflicts": true,
    "isBackdated": false
  }
}
```

Notification result fields remain:

```json
{
  "emailSent": true,
  "smsSent": false
}
```

Doctor change info is also returned:

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

## 2) Time update endpoint

- **Method:** `PATCH`
- **Path:** `/appointments/:id/time`
- **Roles:** `doctor`, `receptionist`, `admin`

### Request body

```json
{
  "date": "2026-05-10",
  "startTime": "14:30",
  "endTime": "14:45",
  "doctorId": "6845a07e7d8e37e04d8f1d15",
  "overrideConflicts": true,
  "isBackdated": false
}
```

### Behavior

- If `isBackdated` is `false`, moving to past datetime is blocked (`400`).
- If `overrideConflicts` is `false`, same-doctor/same-day/same-startTime booked-slot conflict is blocked (`409`).
- If `overrideConflicts` is `true`, conflict check is bypassed.

### Success response (200) additions

`data.overrideInfo` is returned:

```json
{
  "overrideInfo": {
    "overrideConflicts": true,
    "isBackdated": false
  }
}
```

---

## Error responses relevant for FE

### 400 - Past datetime blocked

```json
{
  "success": false,
  "message": "Cannot move appointment to past date/time. Set isBackdated to true to override this restriction."
}
```

or:

```json
{
  "success": false,
  "message": "Nie można przełożyć wizyty na przeszłą datę/godzinę. Set isBackdated to true to override this restriction."
}
```

### 409 - Conflict blocked

```json
{
  "success": false,
  "message": "Jest już umówiona wizyta u tego lekarza w tym czasie. Set overrideConflicts to true to override this restriction.",
  "conflict": true
}
```

---

## FE implementation notes

- Default both toggles to `false`.
- Show confirmation modal before enabling overrides.
- Retry flow:
  1. call API with defaults
  2. if `409`, ask user and retry with `overrideConflicts: true`
  3. if `400` past datetime, ask user and retry with `isBackdated: true`
- Use returned `data.overrideInfo` to display audit chip/badge in UI.

