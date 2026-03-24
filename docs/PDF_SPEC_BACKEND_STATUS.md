# PDF spec – backend implementation status

Checked against **SPEC_COMPARISON_PATIENT_VISIT_REGISTRATION.md** (which reflects the PDF **SPECIFICATION – PATIENT / VISIT / REGISTRATION LOGIC**).  
Status as of current codebase review.

---

## Done (no further backend work)

| # | Spec item | Status |
|---|------------|--------|
| 1 | **Visit without patient** | Done. `Appointment`: `patient` and `bookedBy` are `required: false`, `default: null`. |
| 2 | **booking_source** | Done. `Appointment` has `booking_source` enum `["ONLINE", "RECEPTION"]`; set in reception and online flows. |
| 3 | **Online registration = visit only** | Done. `bookAppointment` (gmeetController) creates appointment with `patient: null`, `bookedBy: null`, `booking_source: "ONLINE"`, and `registrationData`; no User(patient) created. |
| 4 | **Reception first visit** | Done. Reception can create visit without `patientId`; phone optional; `registrationData` stored; Complete registration later. |
| 5 | **Complete registration** | Done. `POST /api/appointments/:visitId/complete-registration`: PESEL + data; creates patient only if PESEL new; links visit to existing if PESEL exists; phone optional; E11000 handled with clear messages. |
| 6 | **PESEL as unique key** | Done. Patient schema: `govtId` (PESEL) is `unique: true`, `sparse: true`. Complete registration uses PESEL to find/create. |
| 7 | **Phone not unique** | Done. User schema: `phone` is `required: false`, `unique: false`. |
| 8 | **PESEL validation** | Done. `validatePesel()` used in complete registration; format + checksum; soft warning only (warning in response, no block). |
| 9 | **Duplicate PESEL** | Done. Complete registration finds by `govtId`; links to existing patient and updates; never creates duplicate by PESEL. E11000 on govtId returns clear message. |
| 10 | **Patient list = completed registration only** | Done. `getAllPatients` and `getPatientsList` filter by `patientId` or `govtId` (exists and non-empty). |
| 11 | **Patient ID immutable** | Done. Update patient rejects change to `patientId` (400 + "Identyfikator pacjenta nie może być zmieniony"). |
| 12 | **No-show status** | Done. Appointment `status` enum includes `"no-show"`. |
| 13 | **Username not auto-generated** | Done. Patient pre-save hook only cleans phone; comment states username created only when patient requests portal. |

---

## Optional / partial / clarify

| # | Spec item | Status | Notes |
|---|------------|--------|--------|
| 14 | **Hospital ID (hospId)** | Not in code | `hospId` is not present in current `models/user-entity/patient.js`. Docs still mention removing it; either already removed or never added in this codebase. No action unless you reintroduce it. |
| 15 | **metadata.patientSource** | Repurpose / ignore | Spec: remove or repurpose. `appointment.js` schema has `metadata` with other fields (visitType, isInternationalPatient, etc.); no explicit `patientSource` in schema. One script uses `patientSource: 'direct'`. Safe to stop writing/reading it and use `booking_source` instead. |
| 16 | **Patient list fields** | Partial | Spec: "full name, PATIENT_ID, date/time of **first completed visit**, physician of **first visit**". Current list returns name, patientId, **createdAt** (registration date), and **consultingDoctor** (assigned doctor). If spec strictly requires "first **completed visit** date and physician", that would need a lookup from appointments (first completed visit per patient) and is an enhancement. |

---

## Not done (if you want full spec alignment)

None of the items in the spec summary are strictly missing. The only possible enhancements:

1. **Patient list – first completed visit**  
   If you want the list to show “date/time of first **completed** visit” and “physician of **first** visit” (instead of createdAt and consultingDoctor), the backend would need to derive those from appointments (e.g. first appointment with status `completed` per patient) and expose them in the list API.

2. **Visit/visit-card APIs**  
   Spec: “Ensure APIs for visit/visit-card expose basic data and consents so FE can always show tabs (by visit id, with or without patient).” This was not verified in this pass; worth a quick check if the FE uses a dedicated visit or visit-card endpoint.

---

## Summary

- **Core PDF spec behaviour is implemented:** visit without patient, booking_source, online/reception flows, Complete registration, PESEL unique, phone optional and non-unique, patient list filtered, patientId immutable, no-show, no username auto-gen, duplicate handling.
- **Optional:** Remove or repurpose `metadata.patientSource` in any code that still sets it; consider enriching patient list with “first completed visit date and physician” if required by product.

If you want, next step can be: (1) add first-completed-visit (and physician) to the patient list API, or (2) audit visit/visit-card endpoints for basic data and consents.
