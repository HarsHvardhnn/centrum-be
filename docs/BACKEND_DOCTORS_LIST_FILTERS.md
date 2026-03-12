# Backend: Doctors List Filters (GET /docs)

This document specifies the query parameters and behavior for the doctors list endpoint used by the frontend (e.g. "Dodaj wizytę" doctor selection).

---

## Endpoint

| Method | Path | Description |
|--------|------|-------------|
| GET | `/docs` | List doctors with optional filters. Response shape unchanged: `{ doctors: [ ... ], pagination: { ... } }`. |

---

## Query parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `search` | string | Search by doctor name (first/last) or email. Case-insensitive partial match. |
| `specialization` | string | Specialization ID (ObjectId). Return only doctors who have this specialization in their `specialization` array. |
| `department` | string | Department name (exact). Return only doctors with this `department` (e.g. "Cardiology", "Pediatrics"). |
| `date` | string (ISO date) | Return only doctors who have at least one appointment on this date. Use with `status` / `visitType` to narrow. |
| `status` | string | Appointment status (e.g. `booked`, `completed`, `cancelled`). When used with `date`, only doctors with an appointment on that date with this status. When used without `date`, doctors who have any appointment with this status. |
| `visitType` | string | Visit reason display name (e.g. `Konsultacja pierwszorazowa`). When used with `date`, only doctors with an appointment on that date with this visit type. When used without `date`, doctors who have any such appointment. |
| `availability` | string | `"true"` = only doctors currently available (in an active time block now). `"false"` = only doctors currently unavailable. Omit = no filter. |
| `experience` | number (string) | Minimum years of experience. Return only doctors with `experience >= value`. |
| `page` | number | Page number (default 1). |
| `limit` | number | Items per page (default 10). |
| `sortBy` | string | Sort field (default `name.first`). |
| `sortOrder` | string | `asc` or `desc` (default `asc`). |

All filters are **ANDed**: only doctors matching every provided filter are returned.

---

## Response shape (unchanged)

```json
{
  "success": true,
  "count": 2,
  "doctors": [
    {
      "_id": "...",
      "id": "...",
      "slug": "...",
      "name": "Jan Kowalski",
      "nameObj": { "first": "Jan", "last": "Kowalski" },
      "specialty": "...",
      "department": "Cardiology",
      "available": true,
      "status": "Available",
      "experience": 10,
      "experienceText": "10 years",
      "image": "...",
      "visitType": "Consultation",
      "date": "2026-03-10",
      "qualifications": [],
      "specializations": [],
      "bio": "",
      "consultationFee": 0,
      "offlineConsultationFee": 0,
      "onlineConsultationFee": 0,
      "ratings": { "average": 0, "total": 0 }
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false,
    "nextPage": null,
    "prevPage": null
  }
}
```

---

## Implementation notes

1. **search**  
   Apply a `$or` regex on `name.first`, `name.last`, and `email` (case-insensitive). Ensure `email` is included in the query/select when using this filter.

2. **specialization**  
   Match doctors where `specialization` array contains the given ID. If the frontend sends a string, convert to ObjectId: `specialization: { $in: [ new mongoose.Types.ObjectId(specialization) ] }` (only if valid ObjectId).

3. **department**  
   Exact match: `query.department = department`.

4. **experience**  
   Numeric: `query.experience = { $gte: parseInt(experience, 10) }` (only if provided and valid).

5. **date**  
   From the Appointment model, find all `doctor` IDs that have at least one appointment whose `date` (day) equals the given `date`. Then restrict the doctors query: `query._id = { $in: doctorIds }`. If no doctor IDs found, return empty list.

6. **status**  
   From the Appointment model, find all `doctor` IDs that have at least one appointment with `status` equal to the given value. If `date` is also provided, restrict to appointments on that date. Then add `query._id = { $in: doctorIds }`.

7. **visitType**  
   From the Appointment model, find all `doctor` IDs that have at least one appointment whose visit reason matches (e.g. `consultation.visitReason` or `metadata.visitType` or `consultation.consultationType`). If `date` is also provided, restrict to that date. Then add `query._id = { $in: doctorIds }`.

8. **availability**  
   "Currently available" is defined by existing logic: doctor has an active schedule today (Poland time) and current time is within one of today’s active time blocks. When `availability=true`, first compute the set of doctor IDs that are currently available, then `query._id = { $in: availableIds }`. When `availability=false`, `query._id = { $nin: availableIds }`. When availability filter is used, this step runs in addition to other filters.

9. **Combining filters**  
   Build the doctors query by applying all of the above in one query (each filter adds conditions with AND). For date/status/visitType, resolve the set of doctor IDs from appointments first, then intersect with the rest of the query (e.g. `_id: { $in: appointmentDoctorIds }`).

10. **Pagination and sort**  
    Apply after filters: `sort`, `skip`, `limit`. Total count = number of doctors matching the combined filter (before skip/limit).

---

## Checklist

- [ ] `search`: regex on name + email, case-insensitive
- [ ] `specialization`: by ID (ObjectId), match in `specialization` array
- [ ] `department`: exact match on `department`
- [ ] `experience`: min years `experience >= value`
- [ ] `date`: restrict to doctors with ≥1 appointment on that date
- [ ] `status`: restrict to doctors with ≥1 appointment with that status (optionally on `date`)
- [ ] `visitType`: restrict to doctors with ≥1 appointment with that visit reason (optionally on `date`)
- [ ] `availability`: restrict to currently available or unavailable doctors
- [ ] All filters ANDed; response shape unchanged; pagination based on filtered total
