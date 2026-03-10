# Visit Reason Dictionary (Type of Visit List) – Feasibility Analysis

**Client request:** Implement a structured visit reason dictionary (categories + types, Polish labels), used across registration, dashboard, patient record, visit history, doctor visit interface, medical events (ZM), and visit card. Reception selects category → type; displayed name saved (e.g. "Konsultacja pierwszorazowa"). Online registration auto-assigns "Konsultacja online". Doctor must verify (confirm or change) visit type before closing; system must not allow closing without verification.

**Conclusion: Feasible.** The current backend already has the right extension points. Work is mainly: (1) add the dictionary and one consistent storage field, (2) persist visit reason at registration and support doctor verification, (3) validate visit type when completing a visit. Frontend will handle the two-step category→type UI and where to show the duration field.

---

## 1. Current Backend State

| Area | Current state |
|------|----------------|
| **Storage** | `Appointment.consultation.consultationType` (enum: 6 values, mixed EN/PL). `Appointment.metadata.visitType` (free String). Both already read in visit card, doctor list, patient history. |
| **Registration** | Create appointment (with/without patient) uses `consultationType` from body only to set `mode` (online/offline). **Does not persist** a visit reason on the appointment (no `consultation.consultationType` or `metadata.visitType` set at creation). |
| **Online vs reception** | `booking_source` ("ONLINE" | "RECEPTION") and `createdBy` / `createdByRole` are set. Can use these to auto-set "Konsultacja online" for online registration. |
| **Doctor update** | `updateConsultation` accepts `consultationType` and saves it. No "visit type verified" flag; no validation when marking visit as completed. |
| **Completing visit** | `updateAppointmentStatus` sets `status` to "completed" with no check that visit type is set or verified. |
| **Visit card** | Already shows "Rodzaj wizyty" from `consultation.consultationType` or `metadata.visitType`. |
| **Dashboard / history** | Doctor appointments API returns `consultationType` / `visitType` (derived from consultation or metadata). |

---

## 2. Fit With Client Requirements

| Requirement | Feasibility | Notes |
|-------------|-------------|--------|
| **Structured dictionary (categories + types)** | ✅ Backend | Add a single source of truth (constant or config). Expose e.g. `GET /api/visit-reasons` returning categories and types in Polish. No long flat list; FE does category → type. |
| **Store and display final visit name** | ✅ Backend | Store one display string (e.g. "Konsultacja pierwszorazowa"). Use one field everywhere: e.g. `consultation.visitReason` (new) or relax `consultation.consultationType` to free String. |
| **All labels/values in Polish** | ✅ | Dictionary and stored values in Polish; code/variables can stay in English. |
| **Auto "Konsultacja online" for online registration** | ✅ Backend | When creating appointment with `booking_source === "ONLINE"` (or createdBy === "online"), set visit reason to "Konsultacja online" by default. |
| **Doctor verify (confirm or change) before close** | ✅ Backend | Add e.g. `consultation.visitTypeVerified` (boolean). Doctor endpoint (e.g. updateConsultation) sets it when they confirm or change. |
| **Block closing visit without verified visit type** | ✅ Backend | In `updateAppointmentStatus`, when new status is "completed", require: (a) visit reason set, (b) `visitTypeVerified === true`. Return 400 with clear message if not. |
| **Same dictionary in: registration, dashboard, patient record, history, doctor view, ZM, visit card** | ✅ Backend | One stored value; all existing reads (visit card, doctor list, etc.) already use consultationType/metadata.visitType. Add visit reason to any other appointment responses as needed. |
| **Visit type selection at “point 4” in registration** | ⚠️ FE | Backend only needs to accept the chosen visit reason in create/update; FE places the field at step 4. |
| **Visit duration only if end time not selected** | ⚠️ FE | Backend already has `endTime` and `duration`; conditional display is frontend. |

**Zdarzenia Medyczne (ZM):** Not present in this repo. When implemented, they can read the same visit reason field from the appointment.

---

## 3. Recommended Backend Changes

### 3.1 Visit reason dictionary

- Add a single source (e.g. `config/visitReasons.js` or DB config) with the exact structure and Polish labels from the client (5 categories, each with types and display names).
- Expose **GET /api/visit-reasons** returning something like:
  - `{ "categories": [ { "id": "Konsultacja", "label": "Konsultacja", "types": [ { "id": "pierwszorazowa", "displayName": "Konsultacja pierwszorazowa" }, ... ] }, ... ] }`
- Frontend uses this for: registration (category → type), doctor verification (same list), and any dropdown that shows visit type.

### 3.2 Model (Appointment)

- **Option A (recommended):** Add `consultation.visitReason` (String) for the display name. Keep `consultationType` for backward compatibility or phase it out; all new logic uses `visitReason`.
- **Option B:** Remove enum from `consultation.consultationType` and allow any string; use it as the single display name.
- Add `consultation.visitTypeVerified` (Boolean, default false). Set to `true` when the doctor confirms or changes the visit type in the doctor flow.

### 3.3 Create appointment (reception + online)

- Accept in body: e.g. `visitReason` or keep using `metadata.visitType` (display name string).
- If `booking_source === "ONLINE"` (or createdBy is "online"), ignore body and set visit reason to **"Konsultacja online"**.
- Persist the chosen (or auto-set) value on the new appointment (`consultation.visitReason` or `consultation.consultationType` / `metadata.visitType`).
- Do not set `visitTypeVerified` at creation (doctor verifies later).

### 3.4 Update consultation (doctor)

- Accept `visitReason` (or `consultationType`) and `visitTypeVerified`.
- When doctor confirms or changes visit type, set `visitTypeVerified: true` and save the (possibly new) display name.

### 3.5 Complete visit validation

- In **updateAppointmentStatus**, when the new status is **"completed"**:
  - Require that the appointment has a non-empty visit reason (from `consultation.visitReason` or `consultation.consultationType` or `metadata.visitType`).
  - Require `consultation.visitTypeVerified === true`.
- If not met: return **400** with a clear message (e.g. "Nie można zamknąć wizyty bez weryfikacji rodzaju wizyty" / "Visit type must be verified by the doctor before closing").

### 3.6 APIs that return appointments

- Ensure the single visit reason field is returned everywhere appointments are listed (today’s visits, patient record, visit history, doctor view). Most already expose `consultationType`/`visitType`; align with the new field name (e.g. `visitReason`) and keep one consistent key for the frontend.

### 3.7 Visit card

- Keep "Rodzaj wizyty" as is; continue reading from the same stored field (e.g. `consultation.visitReason` or `consultation.consultationType` or `metadata.visitType`). No structural change needed.

---

## 4. Frontend Responsibilities (for reference)

- **Registration (point 4):** Show visit type selection (category dropdown → type dropdown); send the **display name** (e.g. "Konsultacja pierwszorazowa") in the create-appointment request. Same for: first visit (with number), subsequent visit, registration by name only.
- **Visit duration:** Show duration field only when end time of visit is **not** selected during registration (backend already provides `endTime` and `duration`).
- **Doctor view:** When doctor opens the visit, show current visit type and a way to confirm or change (same dictionary). On save, send the (possibly updated) visit reason and `visitTypeVerified: true`.
- **Dashboard, patient record, history:** Display the visit reason from the API (single field).

---

## 5. Summary

| Item | Feasible? | Owner |
|------|-----------|--------|
| Visit reason dictionary (categories + types, Polish) | ✅ Yes | Backend: config + GET /api/visit-reasons |
| Store display name at registration | ✅ Yes | Backend: create appointment + online override |
| Auto "Konsultacja online" for online registration | ✅ Yes | Backend: create appointment |
| Doctor verify (confirm/change) visit type | ✅ Yes | Backend: updateConsultation + visitTypeVerified; FE: UI |
| Block close without verified visit type | ✅ Yes | Backend: updateAppointmentStatus validation |
| Use same dictionary everywhere | ✅ Yes | Backend: one field, same in all responses + visit card |
| Visit type at registration step 4 / duration only if no end time | ✅ Yes | Frontend |

**Overall: Feasible.** Backend needs: dictionary API, one persistent visit reason field, optional `visitTypeVerified`, persistence at create (with online override), and validation on status → completed. Frontend handles two-step selection, placement at step 4, and conditional duration display.
