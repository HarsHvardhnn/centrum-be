# Visit Reason Dictionary – Frontend Integration Guide

This document describes how the frontend should use the **visit reason dictionary** (Rodzaj wizyty) and related APIs. All dictionary values and labels are in **Polish**.

---

## 1. Context and business rules

- **Goal:** One consistent visit reason (e.g. "Konsultacja pierwszorazowa") used everywhere: registration, today’s visits, patient record, visit history, doctor visit view, visit card PDF.
- **Workflow:**
  1. **Reception:** Select **category** → then **type** → send the **display name** (e.g. "Konsultacja pierwszorazowa") when creating the appointment.
  2. **Online registration:** Backend automatically sets **"Konsultacja online"**. Reception does not choose; no need to send visit reason from patient portal.
  3. **Doctor:** When opening a visit, the doctor must **verify** the visit type (confirm or change using the same dictionary). The visit **cannot be completed** until the doctor has verified (confirm or change).
- **Validation:** Closing a visit (status → `completed`) fails with `400` if visit reason is missing or not verified. Show the backend error message to the user and prompt the doctor to verify the visit type.

---

## 2. Base URL and auth

- Use your existing API base (e.g. `https://your-api.com` or relative `/api`).
- All endpoints below require a **Bearer token** and roles: **doctor**, **receptionist**, or **admin** (unless noted).
- Online booking (`POST /api/appointments/book`) is public (reCAPTCHA); no visit reason is sent – backend sets "Konsultacja online".

---

## 3. APIs

### 3.1 Get visit reason dictionary

**Purpose:** Load categories and types for the two-step dropdown (category → type). Use the same data for **registration** and **doctor verification** UI.

| Method | URL | Auth |
|--------|-----|------|
| GET | `/api/appointments/visit-reasons` | doctor, receptionist, admin |

**Response (200) – categorised format:**

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": "Konsultacja",
        "label": "Konsultacja",
        "types": [
          { "id": "pierwszorazowa", "displayName": "Konsultacja pierwszorazowa" },
          { "id": "kontrolna", "displayName": "Konsultacja kontrolna" },
          { "id": "po zabiegu", "displayName": "Konsultacja po zabiegu" },
          { "id": "pilna", "displayName": "Konsultacja pilna" },
          { "id": "online", "displayName": "Konsultacja online" },
          { "id": "lekarska", "displayName": "Konsultacja lekarska" }
        ]
      },
      {
        "id": "Badania",
        "label": "Badania",
        "types": [
          { "id": "badanie USG", "displayName": "Badanie USG" },
          { "id": "badanie EKG", "displayName": "Badanie EKG" },
          { "id": "Holter EKG – założenie", "displayName": "Holter EKG – założenie" },
          { "id": "Holter EKG – zdjęcie", "displayName": "Holter EKG – zdjęcie" },
          { "id": "Holter ciśnieniowy – założenie", "displayName": "Holter ciśnieniowy – założenie" },
          { "id": "Holter ciśnieniowy – zdjęcie", "displayName": "Holter ciśnieniowy – zdjęcie" }
        ]
      },
      {
        "id": "Procedury",
        "label": "Procedury",
        "types": [
          { "id": "usunięcie szwów", "displayName": "Usunięcie szwów" },
          { "id": "zmiana opatrunku", "displayName": "Zmiana opatrunku" },
          { "id": "iniekcja", "displayName": "Iniekcja" },
          { "id": "pobranie materiału", "displayName": "Pobranie materiału" }
        ]
      },
      {
        "id": "Zabieg",
        "label": "Zabieg",
        "types": [
          { "id": "zabieg chirurgiczny", "displayName": "Zabieg chirurgiczny" },
          { "id": "usunięcie zmiany", "displayName": "Usunięcie zmiany" },
          { "id": "nacięcie ropnia", "displayName": "Nacięcie ropnia" }
        ]
      },
      {
        "id": "Administracyjne",
        "label": "Administracyjne",
        "types": [
          { "id": "odbiór wyników", "displayName": "Odbiór wyników" },
          { "id": "omówienie wyników", "displayName": "Omówienie wyników" },
          { "id": "recepta", "displayName": "Recepta" },
          { "id": "zaświadczenie", "displayName": "Zaświadczenie" },
          { "id": "skierowanie", "displayName": "Skierowanie" },
          { "id": "zwolnienie", "displayName": "Zwolnienie" },
          { "id": "wydanie dokumentacji medycznej", "displayName": "Wydanie dokumentacji medycznej" },
          { "id": "sprawa administracyjna", "displayName": "Sprawa administracyjna" }
        ]
      }
    ]
  }
}
```

**TypeScript / frontend types (for categorised display):**

```ts
interface VisitReasonType {
  id: string;
  displayName: string;
}

interface VisitReasonCategory {
  id: string;
  label: string;
  types: VisitReasonType[];
}

interface VisitReasonsResponse {
  success: boolean;
  data: {
    categories: VisitReasonCategory[];
  };
}
```

**How to show categorised:**

1. First dropdown: list `data.categories`, show `category.label` (e.g. "Konsultacja", "Badania").
2. After user picks a category: list `category.types`, show `type.displayName` (e.g. "Konsultacja pierwszorazowa").
3. On submit: send the selected **`type.displayName`** as `visitReason` in the request body.

**Frontend usage:**

- **Registration (step 4):** First dropdown = `categories` (show `label`). Second dropdown = `selectedCategory.types` (show `displayName`). On submit, send **`displayName`** as `visitReason` in the create-appointment body.
- **Doctor verification:** Same two-step UI; when the doctor confirms or changes, send the chosen **`displayName`** as `visitReason` and `visitTypeVerified: true` to the update-consultation API.

---

### 3.2 Create appointment (reception)

**Purpose:** Create a visit; optionally set the visit reason. If the patient booked **online**, the backend already has "Konsultacja online" – reception does not need to send it for that flow.

| Method | URL | Auth |
|--------|-----|------|
| POST | `/api/appointments` | doctor, receptionist, admin |
| POST | `/api/appointments/reception` | doctor, receptionist, admin |

**Body (relevant fields):**

- `visitReason` (string, optional): Display name from the dictionary, e.g. `"Konsultacja pierwszorazowa"`.  
  Alternatively you can send `metadata.visitType` with the same value.
- Other existing fields: `doctorId`, `date`, `startTime`, `consultationType` (mode: online/offline), `patientId` (if follow-up), etc.

**Example (reception, with visit reason):**

```json
{
  "doctorId": "...",
  "date": "2026-03-15",
  "startTime": "10:00",
  "consultationType": "offline",
  "visitReason": "Konsultacja pierwszorazowa",
  "firstName": "Jan",
  "lastName": "Kowalski",
  "phone": "..."
}
```

**Note:** For **online** bookings (`POST /api/appointments/book`), do **not** send `visitReason` – backend sets `"Konsultacja online"` automatically.

---

### 3.3 Update consultation (doctor verification)

**Purpose:** Doctor confirms or changes the visit type and marks it as verified. Call this when the doctor clicks “Confirm” or “Change” in the visit type verification step.

| Method | URL | Auth |
|--------|-----|------|
| PUT | `/api/appointments/:id/consultation` | doctor, receptionist, admin |

**Body (relevant fields):**

- `visitReason` (string, optional): New or confirmed display name, e.g. `"Konsultacja kontrolna"`.
- `visitTypeVerified` (boolean): Set to **`true`** when the doctor has confirmed or changed the visit type. Required so the visit can be completed later.

**Example:**

```json
{
  "visitReason": "Konsultacja kontrolna",
  "visitTypeVerified": true,
  "interview": "...",
  "physicalExamination": "...",
  "treatment": "...",
  "recommendations": "..."
}
```

You can send only `visitReason` and `visitTypeVerified` if you are only updating the visit type; other consultation fields are merged with existing data.

---

### 3.4 Complete visit (status → completed)

**Purpose:** Mark the visit as completed. Backend **validates** that a visit reason is set and that the doctor has verified it.

| Method | URL | Auth |
|--------|-----|------|
| PATCH | `/api/appointments/:appointmentId/status` | doctor, receptionist, admin |

**Body:**

```json
{
  "status": "completed"
}
```

**If visit type is not set or not verified (400):**

```json
{
  "success": false,
  "message": "Nie można zamknąć wizyty bez weryfikacji rodzaju wizyty. Lekarz musi potwierdzić lub zmienić rodzaj wizyty przed zamknięciem.",
  "code": "VISIT_TYPE_NOT_VERIFIED",
  "visitReasonSet": false,
  "visitTypeVerified": false
}
```

**Frontend:** When you get `code: "VISIT_TYPE_NOT_VERIFIED"`, show the `message` (or a short version) and redirect the user to the **consultation/visit type verification** step so they can set/confirm the visit type and set `visitTypeVerified: true` via the update-consultation API. Then they can try completing the visit again.

---

## 4. Where the visit reason appears in API responses

- **Doctor’s list (today’s visits, dashboard):**  
  `GET /api/appointments/doctor/:doctorId` (and dashboard endpoint) returns for each appointment:
  - `consultationType` / `visitType` / `visitReason`: same value – the display name to show as “Rodzaj wizyty”.
  - `visitTypeVerified`: `true` or `false`. Use this to show a badge like “Do weryfikacji” when `false` and visit is not yet completed.

- **Single appointment (doctor view, edit):**  
  `GET /api/appointments/:id` returns the full appointment; `consultation.visitReason`, `consultation.visitTypeVerified`, and `consultation.consultationType` are present. Prefer `consultation.visitReason` for display; fallback to `consultation.consultationType` or `metadata.visitType` for older data.

- **Patient record / visit history:**  
  Use the same `visitType` / `visitReason` / `consultationType` field that your existing appointment list endpoints return (they now resolve from `consultation.visitReason` first).

- **Visit card PDF:**  
  Backend already puts the same value in “Rodzaj wizyty” on the PDF. No FE change needed for the PDF content.

---

## 5. Where to make changes on the frontend

| Place | What to do |
|-------|------------|
| **Visit registration (reception)** | At **step 4** (as per client spec): Add the two-step visit type selection (category → type). Call `GET /api/appointments/visit-reasons` once, then on submit send the chosen **displayName** as `visitReason` in `POST /api/appointments` or `POST /api/appointments/reception`. Same flow for: first visit (with number), subsequent visit, registration by name only. |
| **Today’s visits / dashboard** | Show “Rodzaj wizyty” using `consultationType` / `visitType` / `visitReason`. Optionally show a “Do weryfikacji” (or similar) badge when `visitTypeVerified === false` and status is not `completed`. |
| **Doctor visit view** | When the doctor opens a visit, show the current visit type (from `consultation.visitReason` or fallbacks). Add a **“Verify visit type”** step: doctor can confirm or change using the same dictionary (same two-step dropdown from `GET /api/appointments/visit-reasons`). On confirm/change, call `PUT /api/appointments/:id/consultation` with `visitReason` and `visitTypeVerified: true`. |
| **Complete visit button** | When the user tries to complete the visit, if the API returns `400` with `code: "VISIT_TYPE_NOT_VERIFIED"`, show the error message and guide the user to the visit type verification step (and ensure `visitTypeVerified` is set to `true` via the consultation update). |
| **Patient record / visit history** | Display the visit reason in the list/detail using the `visitType` / `visitReason` / `consultationType` field returned by your existing list endpoints. |
| **Visit card** | No change needed for PDF content; backend already shows “Rodzaj wizyty” from the same source. |

---

## 6. Visit duration field (client note)

The client specified: *“The visit duration field must only appear if the end time of the visit is not selected during registration.”*  
This is a **frontend** rule: show the duration field only when the user has not selected an end time. Backend already accepts and stores `startTime`, `endTime`, and `duration`.

---

## 7. Summary checklist

- [ ] Call **GET /api/appointments/visit-reasons** and implement category → type dropdowns (registration + doctor verification).
- [ ] In **registration step 4**, send the chosen **displayName** as **`visitReason`** when creating an appointment (reception only; not for online booking).
- [ ] In **doctor visit view**, add a verify step: show current visit type, allow confirm/change, then **PUT .../consultation** with **`visitReason`** and **`visitTypeVerified: true`**.
- [ ] When **completing a visit**, handle **400** with **`code: "VISIT_TYPE_NOT_VERIFIED"`** by showing the message and guiding to verify visit type.
- [ ] In **dashboard, patient record, visit history**, display **Rodzaj wizyty** from **`visitType`** / **`visitReason`** / **`consultationType`** and optionally **`visitTypeVerified`** for badges.
- [ ] Optionally show **visit duration** only when end time was not selected during registration (FE-only rule).
