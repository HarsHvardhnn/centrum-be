# Appointment `role` and `visitMode` – API contract for frontend

This document lists **all APIs** that return the **`role`** and **`visitMode`** fields on appointment objects, how they are sent, and how to use them in the UI.

---

## Field definitions

| Field        | Type   | Description | Fallback when missing/null |
|-------------|--------|--------------|----------------------------|
| **`role`**  | string | Role of the user who created the appointment (from auth token at creation time). | **`"online"`** |
| **`visitMode`** | string | How the visit is conducted: `"online"` or `"offline"`. | **`"offline"`** |

### `role` – possible values

| Value           | Meaning |
|-----------------|--------|
| `"admin"`       | Appointment created by an admin. |
| `"receptionist"`| Appointment created by a receptionist. |
| `"doctor"`      | Appointment created by a doctor. |
| `"patient"`     | Appointment created by a patient (e.g. logged-in patient booking). |
| `"online"`      | **Fallback:** no token at creation (e.g. public booking) or value not set. Treated as “created via online flow”. |

### `visitMode` – possible values

| Value      | Meaning |
|------------|--------|
| `"online"` | Visit is conducted online (e.g. teleconsultation). |
| `"offline"`| Visit is in-person / at clinic. **Fallback** when the field is missing or empty. |

**Note:** The backend never returns `null` for these two fields. If the stored value is missing (e.g. before backfill), the API uses the fallbacks above.

---

## APIs that return `role` and `visitMode`

### 1. GET /appointments/details/list

**Method:** `GET`  
**Path:** `/api/appointments/details/list` (or `/appointments/details/list` with your base URL)  
**Auth:** Bearer token required.

**Query params (examples):** `page`, `limit`, `sortBy`, `sortOrder`, `searchTerm`, `status`, `startDate`, `endDate`, `doctorId`, `isClinicIp`, etc.

**Response shape:**  
- **Clinic** (`isClinicIp=true`): `{ success, data: [ appointment, ... ], pagination }`  
- **Non-clinic:** `{ success, data: [ appointment, ... ], pagination }` (structure may differ; each item is an appointment row)

**Each appointment object includes:**

```json
{
  "id": "...",
  "_id": "...",
  "date": "...",
  "startTime": "...",
  "endTime": "...",
  "status": "...",
  "mode": "...",
  "role": "online",
  "visitMode": "offline",
  "patient": { ... } | null,
  "isVisitOnly": true | false,
  "doctor": { ... },
  "metadata": { ... },
  "isInternational": false,
  ...
}
```

- **`role`** – Creator role; fallback **`"online"`** when null/not set.  
- **`visitMode`** – Visit mode; fallback **`"offline"`** when null/empty.  
- **`mode`** – Same as `visitMode` (legacy); prefer **`visitMode`** for new code.

**Used for:** Lista pacjentów, Historia wizyt (clinic), and any list that uses this endpoint.

---

### 2. GET /patients/data/appointments

**Method:** `GET`  
**Path:** `/api/patients/data/appointments` (or `/patients/data/appointments` with your base URL)  
**Auth:** Bearer token required.

**Query params (examples):** `page`, `limit`, `sortBy`, `sortOrder`, `search`, `status`, `doctor`, `mode`, `sex`, `minAge`, `maxAge`.

**Response shape:**  
`{ success, count, total, pages, currentPage, appointments: [ ... ] }`

**Each appointment object includes:**

```json
{
  "id": "...",
  "_id": "...",
  "name": "...",
  "date": "...",
  "email": "...",
  "phone": "...",
  "phoneCode": "+48",
  "status": "...",
  "doctor": "...",
  "doctor_id": "...",
  "patient_id": "...",
  "mode": "offline",
  "startTime": "...",
  "endTime": "...",
  "tempPesel": null | "...",
  "isInternational": false,
  "role": "online",
  "visitMode": "offline"
}
```

- **`role`** – Creator role; fallback **`"online"`** when null/not set.  
- **`visitMode`** – Visit mode; fallback **`"offline"`** when null/empty.

**Used for:** Patient/appointments list under “data” (e.g. admin/receptionist views that use this list).

---

## Summary for frontend

| API | Returns `role` | Returns `visitMode` | Fallback `role` | Fallback `visitMode` |
|-----|----------------|---------------------|------------------|----------------------|
| **GET /appointments/details/list** (clinic & non-clinic) | Yes | Yes | `"online"` | `"offline"` |
| **GET /patients/data/appointments** | Yes | Yes | `"online"` | `"offline"` |

**Integration:**

1. Use **`visitMode`** (or `mode`) to show “Online” vs “W przychodni” (or similar).
2. Use **`role`** to show who created the appointment (e.g. “Online”, “Recepcja”, “Lekarz”, “Admin”) or to filter/segment lists.
3. You can rely on both fields always being strings; no need to handle `null` for these two.

---

## Where these values come from (backend)

- **`role`** is stored on the appointment as **`createdByRole`** when the appointment is created (POST /appointments, POST /appointments/reception, POST /appointments/book). It is set from the auth token’s `role`; if there is no token (e.g. public /book), it remains null and the API returns the fallback **`"online"`**.
- **`visitMode`** is the appointment’s **`mode`** (`"online"` or `"offline"`). If missing or empty, the API returns **`"offline"`**.

Existing appointments that have not been backfilled may have null `createdByRole` or missing `mode`; the APIs still return the fallbacks above so the frontend always gets a string.
