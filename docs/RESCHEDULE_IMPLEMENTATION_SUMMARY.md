# Appointment Reschedule Implementation Summary

## Overview
This document summarizes the complete appointment reschedule functionality that has been implemented in the Centrum Medyczne backend system.

## What Was Implemented

### 1. Available Slots API (Existing - Documented)
**Endpoint:** `GET /api/doctors/schedule/available-slots/:doctorId`

**Purpose:** Fetches available time slots for a doctor on a specific date
- Considers doctor's working hours
- Excludes existing appointments
- Excludes doctor's off-time periods
- Returns 30-minute intervals by default

**Usage:** Frontend should call this first to get available slots before allowing reschedule

### 2. Reschedule Appointment API (New)
**Endpoint:** `PATCH /api/appointments/:appointmentId/reschedule`

**Purpose:** Reschedules an existing appointment to a new date/time with full validation

**Features:**
- ✅ Validates new date/time format
- ✅ Prevents rescheduling to past dates
- ✅ Checks for time slot conflicts
- ✅ Prevents rescheduling cancelled/completed appointments
- ✅ Sends email notifications to patients
- ✅ Sends SMS notifications (if patient consented)
- ✅ Updates appointment with new details
- ✅ Returns old and new appointment details

## Complete Reschedule Flow

### Frontend Implementation Steps:

1. **User initiates reschedule**
   - User clicks "Reschedule" on an appointment
   - Frontend shows reschedule modal/form

2. **Get available slots**
   ```javascript
   // Get available slots for the doctor on selected date
   const slots = await getAvailableSlots(doctorId, selectedDate);
   ```

3. **Display available slots**
   - Show calendar with available dates
   - Show time slots for selected date
   - Allow user to select new date/time

4. **Submit reschedule request**
   ```javascript
   const result = await rescheduleAppointment(
     appointmentId, 
     newDate, 
     newStartTime, 
     consultationType
   );
   ```

5. **Handle response**
   - Show success message with new details
   - Update UI with new appointment info
   - Handle any errors appropriately

## API Endpoints Summary

| Method | Endpoint | Purpose | Authorization |
|--------|----------|---------|---------------|
| GET | `/api/doctors/schedule/available-slots/:doctorId` | Get available slots | Public |
| PATCH | `/api/appointments/:appointmentId/reschedule` | Reschedule appointment | Doctor/Receptionist/Admin |

## Request/Response Examples

### Get Available Slots
```bash
GET /api/doctors/schedule/available-slots/507f1f77bcf86cd799439011?date=2024-01-15
```

**Response:**
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

### Reschedule Appointment
```bash
PATCH /api/appointments/507f1f77bcf86cd799439011/reschedule
Content-Type: application/json
Authorization: Bearer <token>

{
  "newDate": "2024-01-20",
  "newStartTime": "14:30",
  "consultationType": "offline"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Wizyta została pomyślnie przełożona",
  "data": {
    "appointment": {
      "_id": "507f1f77bcf86cd799439011",
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
    "email": { "sent": true },
    "sms": { "sent": true, "error": null }
  }
}
```

## Validation Rules

### Date/Time Validation
- ✅ New date must be in YYYY-MM-DD format
- ✅ New start time must be in HH:MM format (24-hour)
- ✅ Cannot reschedule to past date/time
- ✅ Appointment duration is fixed at 30 minutes

### Business Rules
- ✅ Cannot reschedule cancelled or completed appointments
- ✅ New time slot must be available (no conflicts)
- ✅ Doctor must be working on the new date
- ✅ New time must be within doctor's working hours

## Notification System

### Email Notifications
- ✅ Sent to patient if email is available
- ✅ Professional HTML template with old/new details
- ✅ Includes doctor and appointment information
- ✅ Different styling for old vs new appointment details

### SMS Notifications
- ✅ Sent only if patient has consented to SMS
- ✅ Includes doctor name, new date, and time
- ✅ Clear, concise message format

## Error Handling

The API provides comprehensive error handling for:
- ❌ Missing required fields
- ❌ Invalid date/time formats
- ❌ Past date/time attempts
- ❌ Appointment not found
- ❌ Cancelled/completed appointment attempts
- ❌ Time slot conflicts
- ❌ Server errors

## Security Features

- ✅ Role-based authorization (Doctor/Receptionist/Admin only)
- ✅ Input validation and sanitization
- ✅ Conflict prevention
- ✅ Audit trail (old details preserved)
- ✅ Notification consent respect

## Frontend Integration Guide

### Step 1: Get Available Slots
```javascript
const getAvailableSlots = async (doctorId, date) => {
  const response = await fetch(`/api/doctors/schedule/available-slots/${doctorId}?date=${date}`);
  const data = await response.json();
  return data.success ? data.data.filter(slot => slot.available) : [];
};
```

### Step 2: Reschedule Appointment
```javascript
const rescheduleAppointment = async (appointmentId, newDate, newStartTime, consultationType) => {
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
  
  return await response.json();
};
```

## Testing Checklist

- [ ] Successfully reschedule to available slot
- [ ] Attempt to reschedule to occupied slot (should fail)
- [ ] Attempt to reschedule to past date (should fail)
- [ ] Attempt to reschedule cancelled appointment (should fail)
- [ ] Send invalid date/time formats (should fail)
- [ ] Send request without required fields (should fail)
- [ ] Attempt without authorization (should fail)
- [ ] Verify email notifications are sent
- [ ] Verify SMS notifications are sent (if consented)
- [ ] Verify appointment details are updated correctly

## Files Modified

1. **controllers/appointmentController.js**
   - Added `rescheduleAppointment` function
   - Added `createRescheduleEmailHtml` function
   - Enhanced validation and error handling

2. **routes/appointment-routes.js**
   - Added reschedule route: `PATCH /:appointmentId/reschedule`

3. **docs/APPOINTMENT_RESCHEDULE_API.md**
   - Complete API documentation
   - Request/response examples
   - Frontend integration guide

## Next Steps for Frontend

1. **Implement reschedule UI**
   - Add "Reschedule" button to appointment cards
   - Create reschedule modal/form
   - Add date picker and time slot selector

2. **Integrate with available slots API**
   - Call available slots API when date is selected
   - Display available time slots
   - Handle no available slots scenario

3. **Handle reschedule API calls**
   - Submit reschedule request
   - Handle success/error responses
   - Update UI with new appointment details

4. **Add notifications**
   - Show success/error messages
   - Display notification status (email/SMS sent)
   - Handle loading states

## Support

For any questions or issues with the reschedule functionality, refer to:
- `docs/APPOINTMENT_RESCHEDULE_API.md` - Complete API documentation
- `controllers/appointmentController.js` - Implementation details
- `routes/appointment-routes.js` - Route definitions 