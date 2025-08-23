# Custom Date Range Schedule Copy API Setup Guide

## Overview

This guide explains how to set up and test the new Custom Date Range Schedule Copy API, which allows doctors to copy their schedules from any custom date range to any target date range.

## What's New

The new API provides much more flexibility than the previous "copy last week" functionality:

- **Custom Source Range**: Copy from any date range (e.g., 2024-01-21 to 2024-01-27)
- **Flexible Target**: Copy to any starting date (e.g., starting from 2024-01-28)
- **Variable Duration**: Copy 1 day, 3 days, 7 days, or any number of days
- **Sequential Mapping**: Each source date maps to the corresponding target date sequentially

## Example Scenarios

### Scenario 1: Copy Full Week
- **Source**: 2024-01-21 to 2024-01-27 (7 days)
- **Target**: Starting 2024-01-28
- **Result**: Fills 7 consecutive days: 2024-01-28, 2024-01-29, 2024-01-30, 2024-01-31, 2024-02-01, 2024-02-02, 2024-02-03

### Scenario 2: Copy Partial Week
- **Source**: 2024-01-21 to 2024-01-23 (3 days)
- **Target**: Starting 2024-01-27
- **Result**: Fills 3 consecutive days: 2024-01-27, 2024-01-28, 2024-01-29

### Scenario 3: Copy Single Day
- **Source**: 2024-01-21 to 2024-01-21 (1 day)
- **Target**: Starting 2024-01-25
- **Result**: Fills only 1 day: 2024-01-25

## API Endpoints

### 1. Doctor Convenience Endpoint
```
POST /api/doctors/schedule/copy-date-range
```
- **Use Case**: Doctors copying their own schedules
- **Authorization**: `doctor`, `admin`
- **Request Body**: Required (sourceStartDate, sourceEndDate, targetStartDate)

### 2. Schedule Advanced Endpoint
```
POST /api/schedule/copy-date-range/:doctorId
```
- **Use Case**: Admins/receptionists copying any doctor's schedule
- **Authorization**: `doctor`, `admin`, `receptionist`
- **Path Parameter**: doctorId
- **Request Body**: Required (sourceStartDate, sourceEndDate, targetStartDate)

## Request Format

### Required Fields
```json
{
  "sourceStartDate": "2024-01-21",  // Start of source range (YYYY-MM-DD)
  "sourceEndDate": "2024-01-27",    // End of source range (YYYY-MM-DD)
  "targetStartDate": "2024-01-28"   // Start of target range (YYYY-MM-DD)
}
```

### Date Format Requirements
- **Format**: YYYY-MM-DD (ISO 8601)
- **Examples**: "2024-01-21", "2024-12-31", "2025-02-28"
- **Validation**: Dates must be valid and sourceStartDate ≤ sourceEndDate

## Setup Steps

### 1. Environment Variables
Set up these variables in your Postman environment:

```
base_url: http://localhost:3000 (or your server URL)
doctor_token: Your doctor JWT token
admin_token: Your admin JWT token
receptionist_token: Your receptionist JWT token
test_doctor_id: ID of a doctor to test with
```

### 2. Authentication
Ensure you have valid JWT tokens for the roles you want to test:
- **Doctor Token**: For testing doctor-specific functionality
- **Admin Token**: For testing admin capabilities
- **Receptionist Token**: For testing receptionist capabilities

### 3. Test Data
Make sure you have schedules in your database for the source date ranges you want to test:
- Create schedules for dates like 2024-01-21, 2024-01-22, etc.
- Ensure the schedules have time blocks and are properly formatted

## Testing Workflow

### Step 1: Test Basic Functionality
1. Use the "Copy 7 Days (Full Week)" request
2. Verify the response shows 7 days copied successfully
3. Check your database to confirm schedules were created

### Step 2: Test Partial Copying
1. Use the "Copy 3 Days (Partial Week)" request
2. Verify only 3 days are copied
3. Confirm the target dates are correct

### Step 3: Test Error Handling
1. Test missing required fields
2. Test invalid date formats
3. Test invalid date ranges (start > end)

### Step 4: Test Different Roles
1. Test with doctor token (own schedule)
2. Test with admin token (any doctor's schedule)
3. Test with receptionist token (any doctor's schedule)

## Expected Responses

### Success Response (200)
```json
{
  "success": true,
  "message": "Schedule copied successfully from 2024-01-21 to 2024-01-27 to target range starting 2024-01-28",
  "data": {
    "copiedSchedules": [...],
    "summary": {
      "totalDays": 7,
      "successfullyCopied": 7,
      "failedDays": 0
    }
  }
}
```

### Partial Success Response (207)
```json
{
  "success": false,
  "message": "Schedule copy completed with some errors",
  "data": {
    "copiedSchedules": [...],
    "errors": [...],
    "summary": {
      "totalDays": 7,
      "successfullyCopied": 5,
      "failedDays": 2
    }
  }
}
```

### Error Response (400)
```json
{
  "success": false,
  "message": "sourceStartDate, sourceEndDate, and targetStartDate are required"
}
```

## Common Issues and Solutions

### Issue: "No schedules found for the specified source date range"
**Solution**: Ensure you have schedules in your database for the source dates you're trying to copy from.

### Issue: "Invalid date format"
**Solution**: Use YYYY-MM-DD format exactly (e.g., "2024-01-21", not "21-01-2024").

### Issue: "Source start date must be before or equal to source end date"
**Solution**: Ensure sourceStartDate ≤ sourceEndDate.

### Issue: Permission denied
**Solution**: Check that your JWT token has the correct role and you're trying to copy your own schedule (for doctors).

## Database Verification

After successful copying, verify in your database:

1. **New schedules created**: Check the target dates have new schedules
2. **Time blocks copied**: Verify all time blocks are identical to source
3. **Notes updated**: Check that notes indicate the source date
4. **Audit fields**: Confirm createdBy and updatedBy are set correctly

## Performance Considerations

- **Large date ranges**: The API can handle copying many days, but consider the impact on database performance
- **Concurrent requests**: Multiple copy operations can run simultaneously
- **Transaction safety**: Each copy operation is wrapped in a database transaction

## Migration from Legacy API

If you're currently using the "copy last week" API:

1. **Keep using it**: The legacy API is still functional
2. **Consider migration**: The new API offers more flexibility
3. **Update frontend**: Modify your UI to use the new date range selection

## Support and Troubleshooting

If you encounter issues:

1. Check the API response for specific error messages
2. Verify your authentication tokens are valid
3. Ensure the source dates have schedules in your database
4. Check the server logs for detailed error information

## Future Enhancements

The custom date range API is designed to be extensible for future features:
- Template schedules
- Recurring patterns
- Conflict resolution
- Advanced filtering options
