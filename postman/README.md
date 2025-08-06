# Doctor Schedule Management - Postman Collection

This Postman collection provides a complete set of APIs for managing doctor schedules, exceptions, and appointments with reception override capabilities.

## 📁 Files

- `Doctor_Schedule_Management.postman_collection.json` - The main Postman collection
- `README.md` - This documentation file

## 🚀 Quick Start

### 1. Import the Collection

1. Open Postman
2. Click "Import" button
3. Select the `Doctor_Schedule_Management.postman_collection.json` file
4. The collection will be imported with all requests organized in folders

### 2. Set Up Environment Variables

Before using the collection, you need to set up the following variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `base_url` | Your backend server URL | `http://localhost:3000` |
| `auth_token` | JWT token from login | (Will be set after login) |
| `doctor_id` | Doctor's MongoDB ID | `507f1f77bcf86cd799439011` |
| `patient_id` | Patient's MongoDB ID | `507f1f77bcf86cd799439012` |
| `exception_id` | Exception's MongoDB ID | `507f1f77bcf86cd799439013` |

### 3. Authentication

1. First, run the **"Login (Get Token)"** request in the Authentication folder
2. Copy the `token` from the response
3. Set the `auth_token` variable with the token value
4. All subsequent requests will automatically use this token

## 📋 Collection Structure

### 🔐 Authentication
- **Login (Get Token)** - Authenticate and get JWT token

### 📅 Schedule Management
- **Create/Update Daily Schedule** - Set up doctor's schedule for a specific date
- **Get Doctor Schedule** - Retrieve schedules for a date range
- **Delete Daily Schedule** - Remove a specific day's schedule

### ⚠️ Schedule Exceptions
- **Create Full Day Exception** - Block entire day (holidays, vacations)
- **Create Partial Day Exception** - Block specific time ranges (meetings, breaks)
- **Get Doctor Exceptions** - Retrieve exceptions for a date range
- **Delete Exception** - Remove a specific exception

### 🏥 Appointment Management
- **Create Reception Appointment (Override)** - Create appointments with custom times
- **Create Backdated Appointment** - Create appointments in the past for records
- **Get Appointments Dashboard** - View appointments with role-based filtering

### 🕐 Available Slots
- **Get Available Slots** - Get available appointment slots for a specific date
- **Get Next Available Date** - Find the next date with available slots

### 🔄 Bulk Operations
- **Create Weekly Schedule** - Set up recurring weekly patterns
- **Create Holiday Exception** - Block multiple days for holidays

## 📝 Usage Examples

### Example 1: Setting Up a Doctor's Weekly Schedule

1. **Login** to get authentication token
2. **Create Weekly Schedule** with the following pattern:
   ```json
   {
     "doctorId": "{{doctor_id}}",
     "startDate": "2024-01-15",
     "endDate": "2024-01-21",
     "weeklyPattern": {
       "monday": {
         "timeBlocks": [
           {"startTime": "09:00", "endTime": "12:00", "isActive": true},
           {"startTime": "14:00", "endTime": "18:00", "isActive": true}
         ]
       },
       "tuesday": {
         "timeBlocks": [
           {"startTime": "09:00", "endTime": "12:00", "isActive": true},
           {"startTime": "14:00", "endTime": "18:00", "isActive": true}
         ]
       }
     }
   }
   ```

### Example 2: Creating Holiday Exceptions

1. **Create Full Day Exception** for New Year:
   ```json
   {
     "doctorId": "{{doctor_id}}",
     "date": "2024-01-20",
     "type": "holiday",
     "title": "New Year Holiday",
     "description": "Clinic closed for New Year",
     "isFullDay": true,
     "isActive": true
   }
   ```

### Example 3: Reception Override Appointment

1. **Create Reception Appointment (Override)** for urgent consultation:
   ```json
   {
     "doctorId": "{{doctor_id}}",
     "patientId": "{{patient_id}}",
     "startTime": "2024-01-15T10:30:00.000Z",
     "endTime": "2024-01-15T11:00:00.000Z",
     "duration": 30,
     "consultationType": "consultation",
     "notes": "Urgent consultation",
     "isBackdated": false,
     "customDuration": true
   }
   ```

## 🔧 API Endpoints Overview

### Schedule Management
- `POST /api/schedule/schedule` - Create/update daily schedule
- `GET /api/schedule/schedule/:doctorId` - Get schedules
- `DELETE /api/schedule/schedule/:doctorId/:date` - Delete schedule

### Schedule Exceptions
- `POST /api/schedule/exception` - Create exception
- `GET /api/schedule/exception/:doctorId` - Get exceptions
- `DELETE /api/schedule/exception/:exceptionId` - Delete exception

### Appointments
- `POST /api/appointments/reception` - Create reception appointment
- `GET /api/appointments/dashboard` - Get appointments dashboard

### Available Slots
- `GET /api/doctors/schedule/available-slots/:doctorId` - Get available slots
- `GET /api/doctors/schedule/next-available/:doctorId` - Get next available date

## 🛡️ Authorization

All endpoints require proper authorization:

- **Admin/Receptionist**: Full access to all operations
- **Doctor**: Can only manage their own schedules and view their own appointments
- **Public**: Can only view available slots (no authentication required)

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## 🚨 Important Notes

1. **Timezone**: All times are handled in Poland timezone (`Europe/Warsaw`)
2. **Date Format**: Use ISO date format (`YYYY-MM-DD`) for dates
3. **Time Format**: Use 24-hour format (`HH:MM`) for times
4. **Token Expiry**: JWT tokens expire after a certain time, re-login if needed
5. **Validation**: All inputs are validated on the server side

## 🔍 Testing Workflow

### Complete Doctor Setup Workflow

1. **Login** as admin/receptionist
2. **Create Weekly Schedule** for the doctor
3. **Create Holiday Exceptions** for upcoming holidays
4. **Get Available Slots** to verify setup
5. **Create Reception Appointment** to test override functionality
6. **Get Appointments Dashboard** to view all appointments

### Daily Operations Workflow

1. **Login** as receptionist
2. **Get Available Slots** for today
3. **Create Reception Appointment** for walk-in patients
4. **Get Appointments Dashboard** to view today's schedule
5. **Create Exception** if doctor needs to leave early

## 🆘 Troubleshooting

### Common Issues

1. **401 Unauthorized**: Token expired or invalid - re-login
2. **400 Bad Request**: Invalid data format - check request body
3. **404 Not Found**: Doctor/patient ID not found - verify IDs
4. **500 Internal Server Error**: Server issue - check server logs

### Debug Steps

1. Check if `auth_token` is set correctly
2. Verify `doctor_id` and `patient_id` are valid MongoDB ObjectIds
3. Ensure date formats are correct (`YYYY-MM-DD`)
4. Check time formats are in 24-hour format (`HH:MM`)

## 📞 Support

For technical support or questions about the API endpoints, refer to the main documentation in `docs/APPOINTMENT_SCHEDULE_SYSTEM_IMPLEMENTATION.md`.

---

**Note**: This collection is designed to work with the new appointment scheduling system. Make sure your backend is running the updated version with all the new schedule management features. 