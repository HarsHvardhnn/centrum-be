# Week Slot Availability API - Implementation Summary

## Overview
This document describes the implementation of the new Week Slot Availability API endpoint that optimizes appointment booking by allowing frontend to fetch availability for multiple days in a single API call.

## Implementation Status
✅ **COMPLETED** - The API is fully implemented and ready for frontend integration.

---

## New Endpoint

### Endpoint Details
- **Method:** `GET`
- **Path:** `/docs/schedule/week-availability/:doctorId`
- **Base URL:** Same as your existing API (e.g., `https://your-api.com/docs/schedule/week-availability/:doctorId`)

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startDate` | String | Yes | - | Start date of the week (ISO format: YYYY-MM-DD) |
| `endDate` | String | No | 7 days from startDate | End date of the week (ISO format: YYYY-MM-DD) |

### Request Examples

**Basic request (defaults to 7 days):**
```
GET /docs/schedule/week-availability/507f1f77bcf86cd799439011?startDate=2024-01-15
```

**Custom date range:**
```
GET /docs/schedule/week-availability/507f1f77bcf86cd799439011?startDate=2024-01-15&endDate=2024-01-21
```

---

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "doctorId": "507f1f77bcf86cd799439011",
    "weekStart": "2024-01-15",
    "weekEnd": "2024-01-21",
    "availability": [
      {
        "date": "2024-01-15",
        "hasSlots": true,
        "slotCount": 8,
        "availableSlots": [
          {
            "startTime": "09:00",
            "endTime": "09:30",
            "available": true
          },
          {
            "startTime": "09:30",
            "endTime": "10:00",
            "available": true
          }
        ]
      },
      {
        "date": "2024-01-16",
        "hasSlots": false,
        "slotCount": 0,
        "availableSlots": []
      },
      {
        "date": "2024-01-17",
        "hasSlots": true,
        "slotCount": 6,
        "availableSlots": [
          {
            "startTime": "14:00",
            "endTime": "14:30",
            "available": true
          }
        ]
      }
    ]
  }
}
```

### Response Fields

#### Root Level
- `success` (boolean): Always `true` for successful responses
- `data` (object): Contains the availability data

#### Data Object
- `doctorId` (string): The doctor's ID
- `weekStart` (string): Start date of the week (YYYY-MM-DD format)
- `weekEnd` (string): End date of the week (YYYY-MM-DD format)
- `availability` (array): Array of availability objects for each date in the range

#### Availability Object (per date)
- `date` (string): Date in YYYY-MM-DD format
- `hasSlots` (boolean): Whether there are any available slots on this date
- `slotCount` (number): Total count of available slots
- `availableSlots` (array): Array of available slot objects (empty if `hasSlots` is false)

#### Slot Object
- `startTime` (string): Slot start time in HH:MM format (24-hour)
- `endTime` (string): Slot end time in HH:MM format (24-hour)
- `available` (boolean): Always `true` for slots in `availableSlots` array

---

## Error Responses

### 400 Bad Request - Missing startDate

```json
{
  "success": false,
  "error": "INVALID_DATE_RANGE",
  "message": "startDate query parameter is required (format: YYYY-MM-DD)"
}
```

### 400 Bad Request - Invalid Date Format

```json
{
  "success": false,
  "error": "INVALID_DATE_RANGE",
  "message": "Invalid startDate format. Use YYYY-MM-DD"
}
```

### 400 Bad Request - Invalid Date Range

```json
{
  "success": false,
  "error": "INVALID_DATE_RANGE",
  "message": "endDate must be after or equal to startDate"
}
```

### 400 Bad Request - Date Range Too Large

```json
{
  "success": false,
  "error": "INVALID_DATE_RANGE",
  "message": "Date range cannot exceed 30 days"
}
```

### 404 Not Found - Doctor Not Found

```json
{
  "success": false,
  "error": "DOCTOR_NOT_FOUND",
  "message": "Doctor not found"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "SERVER_ERROR",
  "message": "Internal server error",
  "details": "Error details here"
}
```

---

## Key Features

### 1. **Single API Call**
   - Fetch availability for an entire week (or custom date range) in one request
   - Eliminates the need for 7 separate API calls

### 2. **Smart Slot Filtering**
   - Only returns available slots (already filtered)
   - Excludes past slots
   - Respects booking buffer time (prevents booking too close to current time)
   - Excludes slots overlapping with existing appointments
   - Excludes slots blocked by schedule exceptions

### 3. **Comprehensive Availability Info**
   - `hasSlots` flag for quick checking without parsing slots
   - `slotCount` for displaying number of available slots
   - Full slot details when slots are available

### 4. **Date Range Flexibility**
   - Default: 7 days from startDate (inclusive)
   - Custom: Specify both startDate and endDate
   - Maximum: 30 days (enforced for performance)

### 5. **Consistent Date Formatting**
   - All dates in response are in YYYY-MM-DD format
   - All times in HH:MM format (24-hour)

---

## Frontend Integration Guide

### Migration Strategy

#### Before (Current Implementation)
```javascript
// Frontend makes 7 separate API calls
const dates = ['2024-01-15', '2024-01-16', ..., '2024-01-21'];
const promises = dates.map(date => 
  fetch(`/docs/schedule/available-slots/${doctorId}?date=${date}`)
);
const results = await Promise.all(promises);
```

#### After (New Implementation)
```javascript
// Single API call for entire week
const response = await fetch(
  `/docs/schedule/week-availability/${doctorId}?startDate=2024-01-15`
);
const data = await response.json();

// Process availability data
data.data.availability.forEach(day => {
  if (day.hasSlots) {
    console.log(`${day.date}: ${day.slotCount} slots available`);
    day.availableSlots.forEach(slot => {
      console.log(`  ${slot.startTime} - ${slot.endTime}`);
    });
  }
});
```

### Example Usage

```javascript
async function getWeekAvailability(doctorId, startDate, endDate = null) {
  let url = `/docs/schedule/week-availability/${doctorId}?startDate=${startDate}`;
  if (endDate) {
    url += `&endDate=${endDate}`;
  }
  
  try {
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success) {
      return result.data.availability;
    } else {
      console.error('Error:', result.error, result.message);
      return [];
    }
  } catch (error) {
    console.error('Network error:', error);
    return [];
  }
}

// Usage
const availability = await getWeekAvailability(
  '507f1f77bcf86cd799439011',
  '2024-01-15'
);

// Display availability
availability.forEach(day => {
  if (day.hasSlots) {
    console.log(`✅ ${day.date}: ${day.slotCount} slots`);
  } else {
    console.log(`❌ ${day.date}: No slots`);
  }
});
```

### Benefits for Frontend

1. **Performance**
   - 85% reduction in API calls (7 calls → 1 call)
   - Faster loading times
   - Reduced server load

2. **Code Simplification**
   - No need to manage multiple Promise.all() calls
   - Single error handling point
   - Simpler state management

3. **User Experience**
   - Faster page load
   - More responsive UI
   - Better error handling (single request to retry)

---

## Important Notes

### Date Handling
- All dates should be provided in **YYYY-MM-DD** format
- The API handles timezone conversions internally (Poland timezone)
- Date comparisons are done at the day level (time is ignored for date matching)

### Slot Availability Logic
The API follows the same logic as the existing single-date endpoint:
1. Checks for schedule exceptions (full-day or partial-day blocks)
2. Checks doctor's schedule for the date
3. Generates slots based on time blocks
4. Marks slots as unavailable if they overlap with existing appointments
5. Marks slots as unavailable if they overlap with exception time ranges
6. Filters out past slots (if date is today) based on current time + buffer

### Backward Compatibility
- The existing `/docs/schedule/available-slots/:id` endpoint remains unchanged
- You can gradually migrate or use both endpoints
- Both endpoints use the same underlying logic for consistency

### Performance Considerations
- Maximum date range is limited to 30 days
- For larger date ranges, make multiple requests
- Response size grows with number of days and available slots
- Consider pagination if displaying very large date ranges

---

## Testing

### Manual Testing Checklist

- [x] ✅ Valid doctor ID with available slots
- [x] ✅ Valid doctor ID with no slots
- [x] ✅ Invalid doctor ID (404 error)
- [x] ✅ Missing startDate parameter (400 error)
- [x] ✅ Invalid date format (400 error)
- [x] ✅ Custom date range (startDate and endDate)
- [x] ✅ Default date range (only startDate, defaults to 7 days)
- [x] ✅ Date range exceeding 30 days (400 error)
- [x] ✅ End date before start date (400 error)
- [x] ✅ Dates with schedule exceptions
- [x] ✅ Dates with existing appointments
- [x] ✅ Past dates (filtered correctly)
- [x] ✅ Today's date (buffer time respected)

### Example Test Cases

```bash
# Test 1: Basic week request
curl "http://localhost:5000/docs/schedule/week-availability/DOCTOR_ID?startDate=2024-01-15"

# Test 2: Custom range
curl "http://localhost:5000/docs/schedule/week-availability/DOCTOR_ID?startDate=2024-01-15&endDate=2024-01-20"

# Test 3: Missing startDate (should error)
curl "http://localhost:5000/docs/schedule/week-availability/DOCTOR_ID"

# Test 4: Invalid date format (should error)
curl "http://localhost:5000/docs/schedule/week-availability/DOCTOR_ID?startDate=invalid"
```

---

## Questions or Issues?

If you encounter any issues or have questions about the implementation:

1. Check this documentation first
2. Verify the request format matches the examples
3. Check the error response for specific error codes
4. Contact the backend team with:
   - The exact request you're making
   - The error response (if any)
   - Your expected vs actual behavior

---

## Changelog

### Version 1.0.0 (Current)
- Initial implementation
- Week availability endpoint
- Support for custom date ranges
- Comprehensive error handling
- Full slot details in response

---

## Related Documentation

- [Appointment Reschedule API](./APPOINTMENT_RESCHEDULE_API.md) - Related single-date endpoint
- [Appointment Schedule System](./APPOINTMENT_SCHEDULE_SYSTEM_IMPLEMENTATION.md) - Overall schedule system documentation

