# Frontend prompt: Patient / Visit / Registration spec alignment

**Use this prompt in your frontend (FE) repo.**  
It asks the FE codebase to be compared against the same specification used for the backend. The backend comparison and API changes are documented in the backend repo under `docs/SPEC_COMPARISON_PATIENT_VISIT_REGISTRATION.md`.

---

## Instructions for the frontend

1. **Get the specification**  
   Use the document: **SPECIFICATION – PATIENT / VISIT / REGISTRATION LOGIC (FOR IMPLEMENTATION)** (the PDF/spec that describes Patient ≠ Visit, VISIT_ID, PATIENT_ID, PESEL, “Complete registration”, booking_source, patient list, etc.).

2. **Compare current FE flow with the spec**  
   Go through the frontend code and UX and produce a **comparison** of:
   - **What is currently there** (screens, flows, fields, validation, labels, API usage).
   - **What the spec requires** (for each section of the spec).
   - **Gaps**: what needs to change on the frontend (including any API contract assumptions that will change once the backend is updated).

3. **Focus on these areas** (align with spec sections):

   - **Patient vs Visit**
     - Do you currently treat “visit” and “patient” as the same (e.g. always creating/editing a patient with every visit)?
     - Spec: Visit can exist without a patient; PATIENT_ID only after PESEL + “Complete registration”. Identify where the FE assumes a patient always exists for a visit.

   - **Identifiers (UX)**
     - Hospital ID: spec says **deprecated** – remove from UI and any logic.
     - Patient ID: must be **read-only** (never editable/enterable by user).
     - When PATIENT_ID does **not** exist (visit-only): show message:  
       *„Identyfikator pacjenta zostanie utworzony po zakończeniu rejestracji pacjenta w systemie.”*
     - When PATIENT_ID exists: show it as read-only text.

   - **Visit registration flows**
     - **Online:** Should only create a visit (no patient account yet). Next to visit status, show label: **„Rejestracja online”** (once backend exposes `booking_source = ONLINE`).
     - **Reception – Follow-up:** Select existing patient → create visit, assign to patient. No extra label (booking_source = RECEPTION).
     - **Reception – First visit:** Enter basic data (phone optional); create visit only; no patient until “Complete registration” with PESEL. Do you currently require patient selection or creation for every reception visit?

   - **UI tabs**
     - **Dane podstawowe** and **Zgody** must **always** be visible (for scheduled, cancelled, no-show, online and reception), in visit context (by VISIT_ID). Check if any of these tabs are hidden based on visit/patient state and align with spec.

   - **PESEL**
     - Input: digits only, **max 11 characters**, no extra characters after 11 digits.
     - After 11 digits: optional **checksum** check; if invalid show **warning**: “Warning: the PESEL number may be invalid.” Do **not** block registration.
     - **First-visit mistake (reception):** If PESEL already exists in system:
       - Show **informational** message: *„Pacjent o podanym numerze PESEL już istnieje w systemie.”*
       - Show button: **[ Załaduj dane istniejącego pacjenta ]**
       - Only after staff clicks it: reload form with existing patient data (PESEL/identity fields may be locked).
       - On “Zakończ rejestrację”: assign visit to existing patient; do not create duplicate.

   - **“Complete registration” / “Zakończ rejestrację”**
     - This action is what creates PATIENT_ID (after valid PESEL). Do you have a dedicated step/button for this, or do you currently create “patient” at first save? Align with spec: PATIENT_ID only after this click.

   - **Unverified status**
     - Where PATIENT_ID is normally shown, if it does **not** exist yet, display: **“Pacjent niezweryfikowany”**.
     - After PATIENT_ID is created, show normal read-only Patient ID.

   - **Cancellation / no-show**
     - Spec: no PESEL → no PATIENT_ID → no patient account. Visit stays as VISIT_ID with status cancelled/no-show; basic data and consents still accessible. Ensure UI doesn’t assume a “patient” record for every cancelled/no-show visit (e.g. when backend will support visit-only records).

   - **Patient list**
     - Spec: list must show **only** patients who have PATIENT_ID (completed registration). No visit-only persons, no cancelled/no-show without PATIENT_ID. Columns: patient full name, PATIENT_ID, date/time of **first completed visit**, physician of first visit. Check current list: does it include people who are only “visits” or pre-registration? Plan to filter by “has PATIENT_ID” once API supports it.

   - **Patient source field**
     - Spec: remove “patient source” field from UX (or use it only for something important for the dashboard). Find where it’s shown and remove or repurpose.

4. **Deliverables**
   - A short **comparison document** (or list): current FE behavior vs spec, per area above.
   - A list of **concrete FE changes** (screens, components, validation, copy, API calls) so that the frontend aligns with the spec once the backend supports visit-without-patient, booking_source, “Complete registration”, and filtered patient list.

5. **API assumptions**
   - Note any FE assumptions about APIs (e.g. “patient required on appointment”, “patient list returns all users with role patient”). These should be updated when the backend implements the changes in `SPEC_COMPARISON_PATIENT_VISIT_REGISTRATION.md` (e.g. optional patient on visit, `booking_source`, complete-registration endpoint, patient list filtered by PATIENT_ID).

---

**Backend reference:**  
The backend repo has a detailed **current vs required** comparison in `docs/SPEC_COMPARISON_PATIENT_VISIT_REGISTRATION.md`. Use it to see which API and data model changes are planned; align FE with those (e.g. new endpoints, optional patient, booking_source, PESEL as unique key, patient list filter).
