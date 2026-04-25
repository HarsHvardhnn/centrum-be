# Services API - Optional `doctorId` Filter

This document describes how to fetch services from `GET /services`, including filtering by doctor.

## Endpoint

- **Method:** `GET`
- **URL:** `/services`
- **Auth:** Not required by route (token can still be sent by client)

## Query Parameters

- `doctorId` (optional, string): MongoDB ObjectId of a doctor user.

If `doctorId` is provided, the API returns only services assigned to that doctor (from doctor user-services mapping).  
If `doctorId` is missing, the API returns the full active services catalog (existing behavior).

## Examples

### 1) Get all active services

```bash
curl "https://backend.centrummedyczne7.pl/services"
```

### 2) Get services for a specific doctor

```bash
curl "https://backend.centrummedyczne7.pl/services?doctorId=6845a07e7d8e37e04d8f1d15"
```

## Success Response (200)

Always returns an array.

```json
[
  {
    "_id": "689f1234abcd1234abcd1234",
    "title": "Konsultacja internistyczna",
    "slug": "konsultacja-internistyczna",
    "shortDescription": "Konsultacja lekarza internisty",
    "description": "Pełny opis usługi...",
    "images": [],
    "price": "200",
    "bulletPoints": [],
    "redirectionUrl": "/services/konsultacja-internistyczna",
    "createdAt": "2026-01-01T10:00:00.000Z",
    "updatedAt": "2026-01-05T12:00:00.000Z"
  }
]
```

If doctor has no assigned services, response is:

```json
[]
```

## Error Responses

### 400 - Invalid doctorId format

```json
{
  "message": "Invalid doctorId format"
}
```

### 500 - Server error

```json
{
  "message": "Failed to get services",
  "error": "..."
}
```

## FE Integration Notes

- Keep using `GET /services` for global catalog pages.
- Use `GET /services?doctorId=<doctorUserId>` where doctor-specific service list is needed.
- Response shape stays the same (array of service objects), so frontend mapping can be reused.
