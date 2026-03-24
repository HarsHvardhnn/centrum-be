# Get all visit cards by patient ID – API documentation

**Base path:** `/visit-cards`  
**Auth:** Required. Roles: **doctor**, **receptionist**, **admin**, **patient**.  
Patients may only request their own visit cards (same `patientId` as their token).

---

## Get all visit cards for a patient

Returns every visit card (PDF report) linked to appointments for the given patient. Each item includes appointment context (date, time, doctor, status) and the visit card URL and metadata.

**Request**

| Method | Path | Description |
|--------|------|-------------|
| **GET** | `/visit-cards/patient/:patientId` | List all visit cards for the patient. |

**URL example**

```http
GET /visit-cards/patient/507f1f77bcf86cd799439011
Authorization: Bearer <jwt>
```

**Path parameters**

| Parameter   | Type   | Required | Description                          |
|------------|--------|----------|--------------------------------------|
| `patientId`| string | Yes      | MongoDB `_id` of the patient (User). |

**Response 200**

```json
{
  "success": true,
  "data": {
    "patientId": "507f1f77bcf86cd799439011",
    "total": 2,
    "visitCards": [
      {
        "appointmentId": "6789abcdef01234567890123",
        "date": "2026-03-15T00:00:00.000Z",
        "startTime": "09:00",
        "endTime": "09:30",
        "status": "completed",
        "doctor": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Jan Kowalski"
        },
        "visitCard": {
          "reportId": "abc123report456",
          "url": "https://res.cloudinary.com/.../visit-card.pdf",
          "name": "Karta wizyty",
          "type": "visit-card",
          "createdAt": "2026-03-15T10:05:00.000Z"
        }
      },
      {
        "appointmentId": "6789abcdef01234567890124",
        "date": "2026-02-20T00:00:00.000Z",
        "startTime": "14:00",
        "endTime": "14:30",
        "status": "completed",
        "doctor": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Jan Kowalski"
        },
        "visitCard": {
          "reportId": "def789report012",
          "url": "https://res.cloudinary.com/.../visit-card-2.pdf",
          "name": "Karta wizyty",
          "type": "visit-card",
          "createdAt": "2026-02-20T14:35:00.000Z"
        }
      }
    ]
  }
}
```

**Response fields**

| Field | Type | Description |
|-------|------|--------------|
| `data.patientId` | string | The requested patient ID. |
| `data.total` | number | Number of visit cards returned. |
| `data.visitCards` | array | List of visit cards with appointment context. |
| `data.visitCards[].appointmentId` | string | Appointment `_id`. |
| `data.visitCards[].date` | string (ISO date) | Appointment date. |
| `data.visitCards[].startTime` | string | Appointment start time (e.g. `"09:00"`). |
| `data.visitCards[].endTime` | string | Appointment end time. |
| `data.visitCards[].status` | string | Appointment status (`booked`, `completed`, `cancelled`, etc.). |
| `data.visitCards[].doctor` | object or null | `id` (doctor user id), `name` (full name). |
| `data.visitCards[].visitCard` | object | Visit card document. |
| `data.visitCards[].visitCard.reportId` | string | Report document id (for download/display). |
| `data.visitCards[].visitCard.url` | string | URL to the visit card PDF (may be signed/expiring). |
| `data.visitCards[].visitCard.name` | string | Display name (e.g. "Karta wizyty"). |
| `data.visitCards[].visitCard.type` | string | Report type (e.g. `"visit-card"`). |
| `data.visitCards[].visitCard.createdAt` | string (ISO date) | When the visit card was created/uploaded. |

**Empty list**

If the patient has no visit cards (no appointments with a visit-card report), the API still returns **200** with an empty list:

```json
{
  "success": true,
  "data": {
    "patientId": "507f1f77bcf86cd799439011",
    "visitCards": [],
    "total": 0
  }
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| **400** | Invalid `patientId` (not a valid MongoDB ObjectId). |
| **403** | Patient role calling with a different `patientId` (only own data allowed). |
| **500** | Server error. |

---

## Frontend usage

1. **Patient profile / history**  
   Call `GET /visit-cards/patient/:patientId` with the patient’s ID (and auth token).  
   Use `data.visitCards` to render a list; show `date`, `startTime`, `doctor.name`, and use `visitCard.url` for “View”/“Download” (note: URLs may be signed and expire).

2. **Patient portal**  
   Use the same endpoint with the logged-in patient’s ID (from token). The backend ensures a patient can only request their own `patientId`.

3. **Ordering**  
   Results are ordered by appointment date and start time (newest first). You can re-sort on the client by `date`/`startTime` if needed.

4. **Single visit card by appointment**  
   For one appointment, use **GET** `/visit-cards/appointment/:appointmentId` (see existing visit-card docs).
