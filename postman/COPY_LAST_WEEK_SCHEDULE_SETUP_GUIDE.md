# Copy Last Week Schedule - Postman Collection Setup Guide

## Overview

This guide will help you set up and use the Postman collection for testing the Copy Last Week Schedule functionality. The collection includes comprehensive tests for all endpoints, permission scenarios, and error handling.

## Prerequisites

1. **Postman Desktop App** or **Postman Web** installed
2. **Running Centrum Backend Server** (default: http://localhost:3000)
3. **Valid JWT Tokens** for different user roles
4. **Test Doctor IDs** for testing

## Setup Instructions

### 1. Import the Collection

1. Open Postman
2. Click **Import** button
3. Select the `Copy_Last_Week_Schedule_Collection.postman_collection.json` file
4. The collection will appear in your Postman workspace

### 2. Configure Environment Variables

The collection uses environment variables for dynamic values. You need to set these up:

#### Required Variables

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `base_url` | Your API server base URL | `http://localhost:3000` |
| `doctor_token` | JWT token for a doctor user | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `admin_token` | JWT token for an admin user | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `receptionist_token` | JWT token for a receptionist user | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `test_doctor_id` | ID of a test doctor | `507f1f77bcf86cd799439011` |
| `other_doctor_id` | ID of another doctor for permission testing | `507f1f77bcf86cd799439012` |

#### Auto-Calculated Variables (No Setup Required)

| Variable | Description | Auto-Calculated Value |
|----------|-------------|----------------------|
| `current_week_start` | Current week Monday | `2024-01-15` |
| `current_week_end` | Current week Sunday | `2024-01-21` |
| `next_week_monday` | Next week Monday | `2024-01-22` |

### 3. Setting Up Environment Variables

#### Option A: Using Postman Environment

1. Click the **Environment** dropdown in the top-right corner
2. Click **New** to create a new environment
3. Name it `Copy Last Week Schedule - Local`
4. Add the required variables:

```json
{
  "base_url": "http://localhost:3000",
  "doctor_token": "your_doctor_jwt_token_here",
  "admin_token": "your_admin_jwt_token_here",
  "receptionist_token": "your_receptionist_jwt_token_here",
  "test_doctor_id": "your_test_doctor_id_here",
  "other_doctor_id": "another_doctor_id_here"
}
```

5. Click **Save**
6. Select the environment from the dropdown

#### Option B: Using Collection Variables

1. Right-click on the collection
2. Select **Edit**
3. Go to **Variables** tab
4. Update the values directly in the collection

### 4. Getting JWT Tokens

To get valid JWT tokens for testing:

#### For Doctor Token:
```bash
POST {{base_url}}/api/auth/login
{
  "email": "doctor@example.com",
  "password": "doctor_password"
}
```

#### For Admin Token:
```bash
POST {{base_url}}/api/auth/login
{
  "email": "admin@example.com",
  "password": "admin_password"
}
```

#### For Receptionist Token:
```bash
POST {{base_url}}/api/auth/login
{
  "email": "receptionist@example.com",
  "password": "receptionist_password"
}
```

### 5. Getting Test Doctor IDs

To get valid doctor IDs for testing:

```bash
GET {{base_url}}/api/doctors
Authorization: Bearer {{admin_token}}
```

Look for the `_id` field in the response.

## Collection Structure

### 1. Doctor Convenience Endpoint
- **Copy My Schedule (Doctor)**: Simple endpoint for doctors to copy their own schedule
- **Copy Specific Doctor Schedule (Admin)**: Admin can copy any doctor's schedule

### 2. Schedule Advanced Endpoint
- **Copy to Current Week**: Basic copy functionality
- **Copy to Specific Target Week**: Copy to a specific week with targetWeekStart

### 3. Permission Tests
- **Doctor Copying Another Doctor's Schedule**: Should fail with 403
- **Receptionist Copying Doctor Schedule**: Should succeed

### 4. Error Scenarios
- **Non-Existent Doctor**: Should return 404
- **No Authentication**: Should return 401

### 5. Supporting Endpoints
- **Get Doctor Schedule**: Verify copied schedules
- **Get Weekly Shifts**: Test backward compatibility

## Testing Workflow

### Step 1: Basic Functionality Test
1. Run **Copy My Schedule (Doctor)** with a doctor token
2. Verify success response (200 OK)
3. Check that schedules were copied

### Step 2: Permission Testing
1. Run **Doctor Copying Another Doctor's Schedule** with a doctor token
2. Verify it fails with 403 Forbidden
3. Run **Receptionist Copying Doctor Schedule** with receptionist token
4. Verify it succeeds

### Step 3: Advanced Features
1. Run **Copy to Specific Target Week** with admin token
2. Verify schedules are copied to the specified week
3. Check the response includes the target week dates

### Step 4: Verification
1. Run **Get Doctor Schedule** to view the copied schedules
2. Run **Get Weekly Shifts** to test legacy compatibility
3. Verify the data matches what was copied

### Step 5: Error Handling
1. Run **Copy Schedule for Non-Existent Doctor**
2. Verify 404 response
3. Run **Copy Schedule Without Authentication**
4. Verify 401 response

## Expected Responses

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Harmonogram z poprzedniego tygodnia został pomyślnie skopiowany na bieżący tydzień",
  "data": {
    "copiedSchedules": [
      {
        "date": "2024-01-15",
        "dayOfWeek": "Monday",
        "timeBlocks": [
          {
            "startTime": "09:00",
            "endTime": "17:00",
            "isActive": true
          }
        ]
      }
    ],
    "summary": {
      "totalDays": 7,
      "successfullyCopied": 7,
      "failedDays": 0
    }
  }
}
```

### Partial Success Response (207 Multi-Status)
```json
{
  "success": false,
  "message": "Kopiowanie harmonogramu zakończone z błędami",
  "data": {
    "copiedSchedules": [...],
    "errors": [
      {
        "date": "2024-01-15",
        "error": "Validation error message"
      }
    ],
    "summary": {
      "totalDays": 7,
      "successfullyCopied": 5,
      "failedDays": 2
    }
  }
}
```

### Error Responses
- **403 Forbidden**: Permission denied
- **404 Not Found**: Doctor not found or no schedules to copy
- **401 Unauthorized**: No authentication token

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check if the JWT token is valid
   - Ensure the token hasn't expired
   - Verify the Authorization header format: `Bearer <token>`

2. **403 Forbidden**
   - Check user role permissions
   - Ensure the user is trying to copy their own schedule (for doctors)
   - Verify the user has the required role

3. **404 Not Found**
   - Verify the doctor ID exists
   - Check if the doctor has schedules from last week
   - Ensure the doctor ID format is correct

4. **500 Internal Server Error**
   - Check server logs for detailed error information
   - Verify database connection
   - Check if required models are properly imported

### Debug Tips

1. **Enable Console Logging**: Check Postman console for detailed request/response info
2. **Check Server Logs**: Look at your backend server console for error details
3. **Verify Database**: Ensure the database has the required data
4. **Test with Simple Requests**: Start with basic endpoints before testing complex scenarios

## Advanced Testing

### Testing with Different Date Ranges

The collection automatically calculates current week dates, but you can test with custom dates:

1. Modify the `current_week_start` and `current_week_end` variables
2. Update the `next_week_monday` variable
3. Test edge cases like month/year boundaries

### Testing Schedule Conflicts

To test how the system handles conflicts:

1. Create schedules for the target week before copying
2. Run the copy operation
3. Verify that existing schedules are properly updated/merged

### Performance Testing

For performance testing:

1. Create multiple doctors with extensive schedules
2. Run copy operations in parallel
3. Monitor response times and server performance

## Integration with CI/CD

The collection can be integrated with Newman for automated testing:

```bash
# Install Newman
npm install -g newman

# Run the collection
newman run Copy_Last_Week_Schedule_Collection.postman_collection.json \
  --environment Copy_Last_Week_Schedule_-_Local.postman_environment.json \
  --reporters cli,json \
  --reporter-json-export results.json
```

## Support

If you encounter issues:

1. Check the [API Documentation](docs/COPY_LAST_WEEK_SCHEDULE_API.md)
2. Review server logs for error details
3. Verify all environment variables are set correctly
4. Test with the provided test script: `scripts/test-copy-schedule.js`
