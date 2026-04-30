# Reschedule API Visit Type Support (FE Guide)

This document covers the new `visitType` support in reschedule flow and how FE should fetch available visit type options.

---

## 1) Updated API: reschedule appointment

- **Method:** `PATCH`
- **Path:** `/appointments/:appointmentId/reschedule`
- **Auth roles:** `doctor`, `receptionist`, `admin`

### New request field

- `visitType` (string, optional) - selected visit type label (Polish display name)
- `visitReason` is accepted as a **legacy alias** and internally mapped to `visitType`

If provided, backend updates:
- `consultation.visitType`
- `metadata.visitType`

### Request example

```json
{
  "newDate": "2026-05-15",
  "newStartTime": "09:30",
  "newEndTime": "09:45",
  "newDoctorId": "6845a07e7d8e37e04d8f1d99",
  "visitType": "Konsultacja kontrolna",
  "overrideConflicts": true,
  "isBackdated": false,
  "sendSMSNotification": true,
  "sendEmailNotification": true
}
```

### Response addition

`data.visitType` now returns final visit type after reschedule:

```json
{
  "success": true,
  "data": {
    "visitType": "Konsultacja kontrolna"
  }
}
```

---

## 2) Fetch visit type options for dropdown

- **Method:** `GET`
- **Path:** `/appointments/visit-reasons`
- **Auth roles:** `doctor`, `receptionist`, `admin`

Use `categories[].types[].displayName` as the value sent in reschedule `visitType`.

### Example response (shortened)

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "key": "consultation",
        "label": "Konsultacje",
        "types": [
          {
            "key": "first-visit",
            "displayName": "Konsultacja pierwszorazowa"
          },
          {
            "key": "follow-up",
            "displayName": "Konsultacja kontrolna"
          }
        ]
      }
    ]
  }
}
```

---

## FE integration notes

- Prefer sending `visitType` (do not use `visitReason` in new FE code).
- Keep existing override flags and notification toggles unchanged.
- On reschedule modal load:
  1. call `GET /appointments/visit-reasons`
  2. build options from `categories[].types[].displayName`
  3. submit selected value in `visitType`
- After success, use `data.visitType` from response for UI confirmation/toast.
