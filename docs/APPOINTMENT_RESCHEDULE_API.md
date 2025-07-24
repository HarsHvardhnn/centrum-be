# Appointment Reschedule API Documentation

## Overview
This document describes the appointment reschedule functionality that allows authorized users (doctors, receptionists, admins) to reschedule existing appointments with proper validation and notifications.

## Available Slots API

### Get Available Slots for Doctor
**Endpoint:** `GET /api/doctors/schedule/available-slots/:doctorId`

**Description:** Fetches available time slots for a specific doctor on a given date, considering their working hours, existing appointments, and off-time periods.

**Parameters:**
- `doctorId` (path parameter): The ID of the doctor
- `date` (query parameter): Date in YYYY-MM-DD format (optional, defaults to current date)

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "startTime": "09:00",
      "endTime": "09:30",
      "available": true
    },
    {
      "startTime": "09:30",
      "endTime": "10:00",
      "available": false
    }
  ]
}
```

**Example Request:**
```bash
GET /api/doctors/schedule/available-slots/507f1f77bcf86cd799439011?date=2024-01-15
```

**Notes:**
- Slots are generated in 30-minute intervals by default
- Available slots exclude times when doctor has existing appointments
- Available slots exclude doctor's off-time periods
- Only returns slots within doctor's working hours for that day

## Reschedule Appointment API

### Reschedule Existing Appointment
**Endpoint:** `PATCH /api/appointments/:appointmentId/reschedule`

**Description:** Reschedules an existing appointment to a new date and time with validation and notifications.

**Authorization:** Requires `doctor`, `receptionist`, or `admin` role

**Request Body:**
```json
{
  "newDate": "2024-01-20",
  "newStartTime": "14:30",
  "consultationType": "offline"
}
```

**Parameters:**
- `appointmentId` (path parameter): The ID of the appointment to reschedule
- `newDate` (required): New date in YYYY-MM-DD format
- `newStartTime` (required): New start time in HH:MM format (24-hour)
- `consultationType` (optional): "online" or "offline" (defaults to current mode)

**Response Format:**
```json
{
  "success": true,
  "message": "Appointment rescheduled successfully",
  "data": {
    "appointment": {
      "_id": "507f1f77bcf86cd799439011",
      "doctor": "507f1f77bcf86cd799439012",
      "patient": "507f1f77bcf86cd799439013",
      "date": "2024-01-20T14:30:00.000Z",
      "startTime": "14:30",
      "endTime": "15:00",
      "mode": "offline",
      "status": "booked"
    },
    "oldDate": "2024-01-15T10:00:00.000Z",
    "oldStartTime": "10:00",
    "oldEndTime": "10:30",
    "newDate": "2024-01-20T14:30:00.000Z",
    "newStartTime": "14:30",
    "newEndTime": "15:00"
  },
  "notifications": {
    "email": {
      "sent": true
    },
    "sms": {
      "sent": true,
      "error": null
    }
  }
}
```

**Error Responses:**

1. **Missing Required Fields:**
```json
{
  "success": false,
  "message": "New date and start time are required"
}
```

2. **Invalid Date/Time Format:**
```json
{
  "success": false,
  "message": "Invalid date or time format"
}
```

3. **Past Date/Time:**
```json
{
  "success": false,
  "message": "Cannot reschedule to a past date/time"
}
```

4. **Appointment Not Found:**
```json
{
  "success": false,
  "message": "Appointment not found"
}
```

5. **Cannot Reschedule Cancelled/Completed Appointment:**
```json
{
  "success": false,
  "message": "Cannot reschedule a cancelled or completed appointment"
}
```

6. **Time Slot Conflict:**
```json
{
  "success": false,
  "message": "Jest już umówiona wizyta u tego lekarza w tym czasie.",
  "conflict": true
}
```

## Validation Rules

### Date/Time Validation
- New date must be in YYYY-MM-DD format
- New start time must be in HH:MM format (24-hour)
- Cannot reschedule to past date/time
- Appointment duration is fixed at 30 minutes

### Business Rules
- Cannot reschedule cancelled or completed appointments
- New time slot must be available (no conflicts with existing appointments)
- Doctor must be working on the new date
- New time must be within doctor's working hours

### Notification System
- **Email:** Sent to patient if email is available
- **SMS:** Sent to patient if SMS consent is given
- Both notifications include old and new appointment details

## Frontend Integration Flow

### Step 1: Get Available Slots
1. Call `GET /api/doctors/schedule/available-slots/:doctorId?date=YYYY-MM-DD`
2. Display available slots to user
3. Allow user to select new date and time

### Step 2: Reschedule Appointment
1. Call `PATCH /api/appointments/:appointmentId/reschedule`
2. Send new date, time, and consultation type
3. Handle success/error responses
4. Update UI with new appointment details

### Example Frontend Implementation

```javascript
// Get available slots for a specific date
const getAvailableSlots = async (doctorId, date) => {
  try {
    const response = await fetch(`/api/doctors/schedule/available-slots/${doctorId}?date=${date}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data.filter(slot => slot.available);
    }
    return [];
  } catch (error) {
    console.error('Error fetching available slots:', error);
    return [];
  }
};

// Reschedule appointment
const rescheduleAppointment = async (appointmentId, newDate, newStartTime, consultationType) => {
  try {
    const response = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        newDate,
        newStartTime,
        consultationType
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Handle success - update UI, show confirmation
      console.log('Appointment rescheduled successfully');
      return data;
    } else {
      // Handle error
      console.error('Reschedule failed:', data.message);
      return data;
    }
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    throw error;
  }
};
```

## Email Template

The reschedule email includes:
- **Header:** "Zmiana Terminu Wizyty" (Appointment Reschedule)
- **Old Appointment Details:** Highlighted in yellow box
- **New Appointment Details:** Highlighted in green box
- **Online Meeting Info:** If consultation type is online
- **Footer:** Contact information and terms

## SMS Notification

SMS message format for reschedule:
```
Your appointment with Dr. [Doctor Name] has been rescheduled to [New Date] at [New Time].
```

## Security Considerations

1. **Authorization:** Only authorized roles can reschedule appointments
2. **Validation:** Comprehensive validation prevents invalid reschedules
3. **Conflict Prevention:** Checks for existing appointments at new time
4. **Audit Trail:** Old appointment details are preserved in response
5. **Notification Consent:** SMS only sent if patient has consented

## Error Handling

The API provides detailed error messages for:
- Missing required fields
- Invalid date/time formats
- Past date/time attempts
- Appointment not found
- Cancelled/completed appointment attempts
- Time slot conflicts
- Server errors

## Rate Limiting

Consider implementing rate limiting to prevent abuse:
- Maximum 10 reschedule attempts per hour per user
- Maximum 5 reschedule attempts per appointment

## Testing Scenarios

1. **Valid Reschedule:** Successfully reschedule to available slot
2. **Conflict Detection:** Attempt to reschedule to occupied slot
3. **Past Date:** Attempt to reschedule to past date/time
4. **Cancelled Appointment:** Attempt to reschedule cancelled appointment
5. **Invalid Format:** Send invalid date/time formats
6. **Missing Fields:** Send request without required fields
7. **Unauthorized Access:** Attempt without proper authorization
8. **Notification Testing:** Verify email and SMS notifications 