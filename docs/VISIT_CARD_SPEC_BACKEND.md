# Visit Card – Final Technical Spec: Backend Mapping

This document maps the **FINAL TECHNICAL SPECIFICATION: VISIT CARD** to backend implementation status and responsibilities. FE handles most of the UI; below is what the backend provides or must support.

---

## 1. Header and Visit Data

| Spec item | Backend status / notes |
|-----------|------------------------|
| **Date** | From `Appointment.date`. Already used in visit card. |
| **Time (Start + End)** | `Appointment.startTime`, `Appointment.endTime`. **Done:** visit card PDF now shows "Start - End" when `endTime` is set. FE must allow editing duration and send `endTime` on update. |
| **Doctor** | Populated from `Appointment.doctor`. Read-only. |
| **Status** | Current statuses unchanged. Stored on `Appointment.status` (e.g. `booked`, `checkedIn`, `completed`). No new status names. |
| **Visit Type (NEW)** | Dropdown: First-time Consultation, Follow-up Consultation, Medical Consultation, Procedure (Zabieg). Default: "Medical Consultation". **Backend:** Use `Appointment.consultation.consultationType` or `Appointment.metadata.visitType`. FE and reception must be able to set this when creating/editing a visit. |

---

## 2. Left Panel (Patient Context)

| Spec item | Backend status / notes |
|-----------|------------------------|
| **First name, last name, age** | From `Patient` (name.first, name.last, dateOfBirth). Age is computed (FE or backend). |
| **Age in Days/Months (<1 year)** | Logic on FE for visit card view only. Backend provides `dateOfBirth`. |
| **ID, PESEL, Phone** | `Patient.patientId`, `Patient.govtId`, `Patient.phone`. |
| **"Unverified" (Niezweryfikowany)** | Show when patient has no permanent ID (e.g. visit-only before complete registration). FE can derive from absence of `patientId` or from visit/appointment metadata. |
| **Visit History** | Existing APIs for appointment list by patient. Visit Type (above) must be included in history payload – **Done** in GET doctor appointments (`consultationType` / `visitType`). |
| **Vitals (Weight, Height, Temperature, BMI)** | Stored in `Appointment.healthData` or patient-level health data. BMI: computed on FE from weight/height. |

---

## 3. Main Section (P1 Readiness)

| Spec item | Backend status / notes |
|-----------|------------------------|
| **Diagnosis (ICD-10)** | **Done.** `VisitDiagnosis` model; APIs: add/list/delete per visit. Search: `GET /api/icd10/search?q=...`. Visit card PDF **includes ICD-10** (and primary marker). |
| **Clinical fields (Interview, Examination, etc.)** | `Appointment.consultation`: interview, physicalExamination, treatment, recommendations, description. **Templates:** Backend may expose a "templates" API (e.g. per field type) for "Select Template" – to be defined. |
| **Drugs / e-prescription** | Placeholder. Message "Feature available soon". No backend change. |
| **Exams & Referrals (ICD-9)** | **Done.** `VisitProcedure` model; APIs: add/list/delete per visit. Search: `GET /api/icd9/search?q=...`. Visit card PDF **includes ICD-9**. |
| **Services (name + price snapshot)** | Price must be snapshot at invoice/service add. Backend: ensure service/price is stored on the visit or invoice line when added, not read from current price list. (Implementation depends on existing invoice/service models.) |

---

## 4. Footer and Actions

| Spec item | Backend status / notes |
|-----------|------------------------|
| **Download Visit Card** | **Done.** `POST /visit-cards/generate/:appointmentId`. Generates PDF. |
| **File naming** | **Done.** Format: `karta_wizyty_PESEL_DATE.pdf` (PESEL or npesei/brak, date YYYY-MM-DD). |
| **Storage location** | **Done.** File is saved **only** in the visit (appointment.reports). It is **not** added to general patient documents (reception no longer sees it in patient documents). |
| **Save Visit** | UPDATE appointment (and nested consultation, healthData, etc.) without changing status. Existing update APIs. |
| **Finish Visit** | Save + set status to "Realized" (Zrealizowana) and proceed to invoice. Existing logic; FE disables button when visit already finished/invoiced. |
| **Last Saved** | Backend can store `appointment.updatedAt` or a dedicated `lastSavedAt`. FE displays it; hide by default via CSS. |

---

## 5. Admin Permissions

| Spec item | Backend status / notes |
|-----------|------------------------|
| **Revert Status** | Only Super Admin can change status from "Finished" back to "In Progress/Realized". Backend: add a role check (e.g. `superAdmin` or existing admin role) on the endpoint that updates status; allow revert only for that role. |

---

## Backend Changes Completed (this round)

1. **Visit card PDF**
   - File naming: `karta_wizyty_PESEL_DATE.pdf` (PESEL or npesei/brak + date).
   - Time range: "Godzina wizyty" shows Start–End when `endTime` is set.
   - ICD-10 and ICD-9: PDF includes "Rozpoznania i procedury" with diagnoses (with "Główne" for primary) and procedures.
   - Storage: Visit card is saved **only** in `Appointment.reports`; it is **not** written to `Patient.documents`.

2. **Doctor appointments list**
   - Each appointment includes `consultationType` / `visitType` for Visit History and header.

3. **Patient details panel**
   - `GET /patients/det/reports/:patientId` returns PESEL, allergies, lastVisit, lastDiagnosis, medications (active only), etc.

---

## Suggested Next Backend Tasks

- **Visit type:** Ensure reception/doctor can set and read `consultationType` or `metadata.visitType` when creating/editing appointments.
- **Templates for clinical fields:** If FE needs a "Select Template" list per field, add a small templates API (e.g. by type: interview, examination, recommendations).
- **Service price snapshot:** Confirm invoice/service logic stores price at add time; no change if already snapshot.
- **Last saved:** Add or use `updatedAt` / `lastSavedAt` and expose in GET appointment.
- **Revert status:** Restrict status revert to Super Admin in the relevant PATCH/status endpoint.
