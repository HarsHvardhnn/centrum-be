# API: Patient visit history (simple list)

**Endpoint:** `GET /patients/:patientId/visits`  
Returns all visits (appointments) for a patient in a **simple shape** for modals/lists: date, time, doctor, visit type, status.

---

## Route & auth

| Method | Path | Controller |
|--------|------|------------|
| GET | `/patients/:patientId/visits` | `patientController.getPatientVisits` |

**Authorization:** `authorizeRoles(["doctor", "receptionist", "admin", "patient"])`

- **doctor / receptionist / admin:** can request any patient’s visits.
- **patient:** can request only their own visits (`req.user.id === patientId`). Otherwise responds with **403**.

---

## Request

### Path parameters

| Param | Type | Description |
|-------|------|-------------|
| `patientId` | string (ObjectId) | Patient’s `_id`. |

### Query parameters

None. All visits for the patient are returned (sorted by date descending, then start time).

---

## Response

### Success (200)

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "visitId": "...",
      "date": "09.03.2026",
      "time": "10:00 – 10:30",
      "startTime": "10:00",
      "endTime": "10:30",
      "doctor": {
        "id": "...",
        "name": "Jan Kowalski"
      },
      "visitType": "Konsultacja pierwszorazowa",
      "mode": "offline",
      "status": "booked"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | `true` |
| `count` | number | Length of `data` |
| `data` | array | List of visit objects (see below) |

### Each item in `data`

| Field | Type | Description |
|-------|------|-------------|
| `visitId` | string (ObjectId) | Appointment `_id` |
| `date` | string \| null | Visit date in Polish locale (`pl-PL`: `DD.MM.YYYY`) |
| `time` | string \| null | `"startTime – endTime"` (e.g. `"10:00 – 10:30"`), or only `startTime` if no `endTime` |
| `startTime` | string \| null | Appointment `startTime` |
| `endTime` | string \| null | Appointment `endTime` |
| `doctor` | object | `{ id: doctor _id, name: "First Last" }` or `name: null` if no doctor |
| `visitType` | string | From `consultation.visitReason` → `consultation.consultationType` → `metadata.visitType` → mode-based default ("Konsultacja online" / "Konsultacja w przychodni") → `mode` → `"—"` |
| `mode` | string \| null | e.g. `"offline"`, `"online"` |
| `status` | string \| null | Appointment status (e.g. `booked`, `completed`, `cancelled`) |

---

## Errors

| Status | Condition |
|--------|-----------|
| **400** | `patientId` is not a valid ObjectId → `{ success: false, message: "Nieprawidłowy format ID pacjenta" }` |
| **403** | Logged-in user is `patient` and `patientId` is not their own → `{ success: false, message: "Brak dostępu do wizyt innego pacjenta" }` |
| **500** | Server error → `{ success: false, message: "Nie udało się pobrać wizyt", error: ... }` |

---

## Implementation notes

- Appointments are loaded with `Appointment.find({ patient: patientId })`, `.populate("doctor", "name")`, sorted by `date: -1`, `startTime: 1`.
- No pagination; full list is returned. Use for modals/short lists; for long histories consider adding `limit`/`skip` later if needed.
