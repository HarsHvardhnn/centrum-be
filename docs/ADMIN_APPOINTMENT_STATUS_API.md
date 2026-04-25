# Admin Appointment Status API

This endpoint allows **admin** users to directly change an appointment status to any allowed value.

## Endpoint

- **Method:** `PATCH`
- **URL:** `/api/appointments/admin/:appointmentId/status`
- **Auth:** Bearer token required
- **Role:** `admin` only

## Path Params

- `appointmentId` (string, required): Mongo ObjectId of the appointment.

## Request Body

```json
{
  "status": "completed"
}
```

## Allowed `status` values

- `booked`
- `cancelled`
- `completed`
- `checkedIn`
- `no-show`

### Accepted aliases

The API also accepts these aliases and normalizes them:

- `checkedin` -> `checkedIn`
- `checked-in` -> `checkedIn`
- `noshow` -> `no-show`
- `no_show` -> `no-show`

## Success Response (200)

```json
{
  "success": true,
  "message": "Appointment status updated successfully",
  "data": {
    "_id": "69d1f2b84db03582b7eb462f",
    "status": "completed"
  },
  "availableStatuses": ["booked", "cancelled", "completed", "checkedIn", "no-show"]
}
```

## Error Responses

### 400 - Invalid appointment id

```json
{
  "success": false,
  "message": "Invalid appointment ID format"
}
```

### 400 - Missing status

```json
{
  "success": false,
  "message": "Status is required"
}
```

### 400 - Invalid status

```json
{
  "success": false,
  "message": "Invalid status value",
  "availableStatuses": ["booked", "cancelled", "completed", "checkedIn", "no-show"]
}
```

### 401/403 - Unauthorized or forbidden

Returned when token is missing/invalid or user is not admin.

### 404 - Appointment not found

```json
{
  "success": false,
  "message": "Appointment not found"
}
```

### 500 - Server error

```json
{
  "success": false,
  "message": "Failed to update appointment status",
  "error": "..."
}
```

## Example cURL

```bash
curl -X PATCH "https://backend.centrummedyczne7.pl/api/appointments/admin/69d1f2b84db03582b7eb462f/status" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"checkedIn\"}"
```
