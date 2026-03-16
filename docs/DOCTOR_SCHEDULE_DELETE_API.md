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
| **Edit Schedule modal** | When the user opens "Edytuj Harmonogram" for a date, you have the schedule object (with `_id` and `timeBlocks`). You can: (1) add **"Usuń na stałe"** for the whole day → delete by ID; (2) for each time period (e.g. 1:00 PM–3:00 PM), add **"Delete"** → call delete single block by `scheduleId` + block index (see section 3 and FE brief below). |

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

## 3. Delete a single time block (one period within the day)

Use this when the schedule has **multiple time blocks** (e.g. 1:00 PM–3:00 PM and 4:00 PM–5:00 PM) and the user wants to remove **only one** period and keep the rest. The block is identified by its **index** in `schedule.timeBlocks` (0-based).

**Request**

| Method | Path | Description |
|--------|------|-------------|
| **DELETE** | `/api/schedule/schedule/id/:scheduleId/blocks/:blockIndex` | Remove the time block at that index. If no blocks remain, the schedule document is deleted. |

**URL example**

```http
DELETE /api/schedule/schedule/id/6789abcdef01234567890123/blocks/0
Authorization: Bearer <jwt>
```

- **scheduleId** – MongoDB `_id` of the schedule document (same as in GET list / Edit modal).
- **blockIndex** – 0-based index of the block in `timeBlocks` (e.g. `0` = first block, `1` = second).

**Response 200 (block removed; other blocks remain)**

```json
{
  "success": true,
  "message": "Time block deleted",
  "data": {
    "deletedBlock": { "startTime": "13:00", "endTime": "15:00" },
    "scheduleId": "6789abcdef01234567890123",
    "remainingBlocks": [
      { "startTime": "16:00", "endTime": "17:00", "isActive": true }
    ]
  }
}
```

**Response 200 (last block removed; schedule deleted)**

```json
{
  "success": true,
  "message": "Time block deleted; schedule had no remaining blocks and was removed",
  "data": {
    "deletedBlock": { "startTime": "13:00", "endTime": "15:00" },
    "scheduleDeleted": true
  }
}
```

**Errors**

| Status | Condition |
|--------|-----------|
| **400** | Invalid `scheduleId` or invalid `blockIndex` (not a non-negative integer). |
| **403** | Doctor tries to modify another doctor’s schedule. |
| **404** | Schedule not found, or `blockIndex` out of range. |
| **500** | Server error. |

---

## Summary for frontend

| Action | Endpoint | When to use |
|--------|----------|-------------|
| Delete **one time period** (block) | **DELETE** `/api/schedule/schedule/id/:scheduleId/blocks/:blockIndex` | You have the schedule and want to remove a single block (e.g. 1:00 PM–3:00 PM); other blocks stay. |
| Permanent delete **entire day** (by schedule id) | **DELETE** `/api/schedule/schedule/id/:scheduleId` | You have the schedule object and want to remove the whole day. |
| Permanent delete **entire day** (by doctor + date) | **DELETE** `/api/schedule/schedule/:doctorId/:date` | You only have doctor id and date. |

After any successful delete, refresh the calendar or update local state (e.g. remove the block from `schedule.timeBlocks`, or remove the day if `scheduleDeleted: true` or entire schedule was deleted).

For a step-by-step guide on **how to add the delete option on the calendar** (GET list, where to show the button, which endpoint to call, example flows), see the section **"How the frontend can offer delete on the calendar"** at the top of this document.

---

## Frontend brief: delete a specific time period (not the whole day)

**Goal:** In the Edit Schedule modal (or wherever you show a day’s time blocks), show each time period with a **Delete** option so the user can remove e.g. “1:00 PM – 3:00 PM” and keep “4:00 PM – 5:00 PM”.

**Data you already have:** From `GET /api/schedule/schedule/:doctorId?startDate=...&endDate=...` each schedule has:

- `_id` – schedule document id  
- `timeBlocks` – array of `{ startTime, endTime, isActive }`, in order (index 0, 1, 2, …)

**UI:**

- For each block in `schedule.timeBlocks`, render e.g.  
  **"1:00 PM – 3:00 PM (active) [Delete]"**  
  **"4:00 PM – 5:00 PM (active) [Delete]"**
- One **Delete** per block; “Usuń” / “Delete” is the active action for that row.

**When the user clicks Delete for a block:**

1. Confirm: e.g. “Czy na pewno usunąć ten przedział czasowy?” (Remove this time period?).
2. On confirm, call:  
   `DELETE /api/schedule/schedule/id/${schedule._id}/blocks/${blockIndex}`  
   with `Authorization: Bearer <token>`.  
   Use the **index** of that block in `timeBlocks` (0 for first, 1 for second, etc.).
3. On **200**:
   - If `data.scheduleDeleted === true`: remove this day from the calendar (or close modal and refetch).
   - Else: update local state so that block is removed from `schedule.timeBlocks` (or replace schedule with `data.remainingBlocks`), and re-render the list so the deleted period disappears; the other blocks stay.
4. On **4xx/5xx**: show the API error message.

**Example:** Schedule has two blocks: index 0 = 13:00–15:00, index 1 = 16:00–17:00. User deletes the first → call `DELETE .../blocks/0` → backend returns `remainingBlocks: [{ startTime: "16:00", endTime: "17:00", ... }]`; FE updates the schedule for that day to show only 4:00 PM – 5:00 PM.
