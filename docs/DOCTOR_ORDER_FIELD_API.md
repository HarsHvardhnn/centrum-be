# Doctor `order` (sequence) field – API contract for frontend

The doctor model has an **`order`** field used to control display order/sequence (e.g. on “Our doctors” or admin doctor list). Lower number = earlier in list. This document describes how to send and receive it in Create and Update doctor APIs.

---

## Field definition

| Field   | Type   | Description |
|--------|--------|-------------|
| **order** | number \| null | Display sequence. Lower value = higher in list. Optional; `null` or omitted = no explicit order. |

---

## 1. Create doctor

**Method:** `POST`  
**Path:** `/api/doctors` (or your base + `doctors`)  
**Content-Type:** `multipart/form-data` (file upload for profile picture) or `application/json`  
**Auth:** Required (as per your doctor create route).

### Request body – `order` (optional)

| Field   | Type   | Required | Description |
|--------|--------|----------|-------------|
| order  | number | No       | Display order/sequence. Sent as number (e.g. `1`, `2`). Omit or send `null` for no order. |

Other create fields (name, email, phone, specialization, etc.) are unchanged.

### Example (JSON)

```json
{
  "name": { "first": "Jan", "last": "Kowalski" },
  "email": "jan.kowalski@example.com",
  "phone": "+48123456789",
  "specialization": ["..."],
  "order": 2
}
```

### Response (201)

The created doctor object includes **`order`**:

```json
{
  "success": true,
  "message": "Lekarz utworzony pomyślnie",
  "doctor": {
    "id": "dr-...",
    "name": "...",
    "email": "...",
    "order": 2,
    ...
  }
}
```

If `order` was not sent or was null, the response has **`order: null`**.

---

## 2. Update doctor

**Method:** `PATCH`  
**Path:** `/api/doctors/details/:id` (or your base + `doctors/details/:id`)  
**Content-Type:** `multipart/form-data` or `application/json`  
**Auth:** Required (doctor, admin, receptionist).

### Request body – `order` (optional)

| Field   | Type   | Required | Description |
|--------|--------|----------|-------------|
| order  | number \| null | No | New display order. Send a number to set order, or `null` / omit to leave unchanged (or clear order). |

### Example (JSON)

```json
{
  "order": 3
}
```

Or to clear order:

```json
{
  "order": null
}
```

### Response (200)

The updated doctor object includes **`order`**:

```json
{
  "success": true,
  "message": "Lekarz zaktualizowany pomyślnie",
  "data": {
    "id": "...",
    "name": { "first": "...", "last": "..." },
    "email": "...",
    "order": 3,
    ...
  }
}
```

---

## Summary for frontend

| API | Sends `order` | Response includes `order` |
|-----|----------------|----------------------------|
| **POST /api/doctors** (create) | Optional (number or omit) | Yes (`doctor.order`) |
| **PATCH /api/doctors/details/:id** (update) | Optional (number or null) | Yes (`data.order`) |

**Integration:**

- When creating a doctor, send **`order`** as a number if you want a fixed position (e.g. `1`, `2`); omit or send `null` otherwise.
- When updating a doctor, send **`order`** to change sequence; send **`null`** to clear it.
- When listing doctors, the backend may support sorting by `order` (e.g. `sortBy=order`); check the list endpoint docs. You can also sort on the frontend by the `order` value returned on each doctor (treat `null` as “last” or a large number).
