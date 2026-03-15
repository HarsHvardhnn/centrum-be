# Doctor schedule – permanent delete API

Base path: **`/api/schedule`**  
Auth: **doctor** (own schedule only), **admin**, **receptionist**.

Deleting a schedule removes it **permanently from the database** (no soft delete). This doc describes how the frontend can offer the option to delete schedules on the calendar.

---

## How the frontend can offer delete on the calendar

### 1. Get schedules for the calendar (so you have `_id` per day)

To show delete for a day, you need either the schedule’s `_id` or `doctorId` + `date`. The list endpoint returns each schedule with `_id`.

**GET** `/api/schedule/schedule/:doctorId?startDate=...&endDate=...`

**Example (March 2026):**

```http
GET /api/schedule/schedule/507f1f77bcf86cd799439011?startDate=2026-03-01&endDate=2026-03-31
Authorization: Bearer <jwt>
```

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "6789abcdef01234567890123",
      "doctorId": "507f1f77bcf86cd799439011",
      "date": "2026-03-15T00:00:00.000Z",
      "timeBlocks": [
        { "startTime": "09:00", "endTime": "17:00", "isActive": true }
      ],
      "isActive": true,
      "notes": "",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

- Store each item’s **`_id`** and **`date`** (and optionally `doctorId`) when building the calendar.  
- For each day that has a schedule, you can offer **Edit** and **Delete**.

### 2. Where to show the delete option

| Place | What to do |
|-------|------------|
| **Calendar day cell** | For a day that has a schedule, show e.g. "Edytuj" and "Usuń na stałe". On "Usuń na stałe" → confirm → call delete API (see below). |
| **Edit Schedule modal** | When the user opens "Edytuj Harmonogram" for a date, you have the schedule object (with `_id`). Add a button "Usuń na stałe" / "Permanently delete". On confirm → call delete by ID. |

### 3. Which delete endpoint to call

- **You have the schedule document (e.g. from GET list or from the Edit modal):**  
  Use **DELETE by schedule ID** so the FE only needs the `_id`:

  ```http
  DELETE /api/schedule/schedule/id/{schedule._id}
  Authorization: Bearer <jwt>
  ```

- **You only have doctorId and date (e.g. from the calendar date):**  
  Use **DELETE by doctor + date**:

  ```http
  DELETE /api/schedule/schedule/{doctorId}/{date}
  Authorization: Bearer <jwt>
  ```
  Use a date string the backend can parse (e.g. `YYYY-MM-DD` for 15 March 2026: `2026-03-15`).

### 4. Example flow (Edit modal)

1. User clicks "Edytuj" on 15.03.2026 → open modal, load schedule for that day (you already have it from the month’s GET response, or fetch it).
2. Modal has schedule `_id`, e.g. `6789abcdef01234567890123`.
3. User clicks "Usuń na stałe" → confirm dialog "Czy na pewno usunąć ten harmonogram?".
4. On confirm:  
   `DELETE /api/schedule/schedule/id/6789abcdef01234567890123`  
   with `Authorization: Bearer <token>`.
5. On **200**: close modal, remove that day’s schedule from calendar state (or refetch the month). Show a short success message.
6. On **403/404/500**: show error message from the API.

### 5. Example flow (from calendar cell without opening modal)

1. User clicks "Usuń na stałe" on a day that has a schedule (you have `schedule._id` from the GET list).
2. Confirm dialog.
3. On confirm:  
   `DELETE /api/schedule/schedule/id/{schedule._id}`  
   with auth header.
4. On 200: remove that schedule from local state or refetch; update the calendar so the block disappears.

---

## 1. Delete by schedule ID (recommended for Edit modal)

When the user has the schedule open in the "Edytuj Harmonogram" modal, you already have the schedule document (including `_id`). Use this endpoint so you don’t need to build `doctorId` and `date` again.

**Request**

| Method | Path | Description |
|--------|------|-------------|
| **DELETE** | `/api/schedule/schedule/id/:scheduleId` | Permanently delete the schedule with the given MongoDB `_id`. |

**URL example**

```http
DELETE /api/schedule/schedule/id/6789abcdef01234567890123
```

**Headers**

- `Authorization: Bearer <jwt>`

**Response 200**

```json
{
  "success": true,
  "message": "Schedule deleted permanently",
  "data": {
    "deletedId": "6789abcdef01234567890123"
  }
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| **400** | Missing or invalid `scheduleId`. |
| **403** | Doctor tries to delete another doctor’s schedule. |
| **404** | No schedule with that `_id`. |
| **500** | Server error. |

**Frontend (Edit Schedule modal)**

- When opening the modal, store the current schedule’s `_id` (from the list you got via `GET /api/schedule/schedule/:doctorId?startDate=...&endDate=...`).
- Add a button e.g. "Usuń na stałe" / "Permanently delete".
- On confirm, call:  
  `DELETE /api/schedule/schedule/id/${schedule._id}`  
  with the auth header.
- On 200: close the modal and refresh the calendar (or remove that day from local state).

---

## 2. Delete by doctor and date

Use when you have `doctorId` and the schedule date but not the schedule document `_id`.

**Request**

| Method | Path | Description |
|--------|------|-------------|
| **DELETE** | `/api/schedule/schedule/:doctorId/:date` | Permanently delete the schedule for that doctor and date. |

**URL example**

```http
DELETE /api/schedule/schedule/507f1f77bcf86cd799439011/2026-03-15
```

- **doctorId** – MongoDB `_id` of the doctor (User).
- **date** – Schedule date in a form JavaScript `new Date(...)` can parse (e.g. `YYYY-MM-DD` or ISO string).

**Response 200**

```json
{
  "success": true,
  "message": "Schedule deleted permanently",
  "data": {
    "deletedId": "6789abcdef01234567890123"
  }
}
```

**Errors**

- Same as above (400, 403, 404, 500).  
- 404 if there is no schedule for that `doctorId` and `date`.

---

## Summary for frontend

| Action | Endpoint | When to use |
|--------|----------|-------------|
| Permanent delete from Edit modal | **DELETE** `/api/schedule/schedule/id/:scheduleId` | You have the schedule object and its `_id`. |
| Permanent delete by doctor + date | **DELETE** `/api/schedule/schedule/:doctorId/:date` | You only have doctor id and date. |

Both endpoints remove the schedule document from the database permanently. After a successful delete, refresh the calendar or update local state so the deleted day no longer shows a block.

For a step-by-step guide on **how to add the delete option on the calendar** (GET list, where to show the button, which endpoint to call, example flows), see the section **"How the frontend can offer delete on the calendar"** at the top of this document.
