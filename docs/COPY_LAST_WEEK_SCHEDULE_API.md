# Copy Schedule API

## Overview

This API provides flexible schedule copying functionality that allows doctors to copy their schedules from custom date ranges to target date ranges, as well as the legacy feature of copying from the previous week to the current week.

## Features

- **Custom Date Range Copying**: Copy schedules from any source date range to any target date range
- **Flexible Duration**: Copy schedules for any number of days (1 day to multiple weeks)
- **Legacy Week Copying**: Still supports copying from last week to current week
- **Day-by-Day Copying**: Copies schedules for each day in the specified range
- **Error Handling**: Provides detailed feedback on successful copies and any errors
- **Permission Control**: Doctors can only copy their own schedules
- **Audit Trail**: Maintains records of who copied the schedule and when

## API Endpoints

### 1. Custom Date Range Copying (Primary Feature)

#### Doctor Routes Convenience Endpoint

**Endpoint**: `POST /api/doctors/schedule/copy-date-range`

**Description**: Simple endpoint for doctors to copy their own schedule from a custom date range to a target date range.

**Authorization**: 
- `doctor` - Can copy their own schedule
- `admin` - Can copy any doctor's schedule

**Request Body**:
```json
{
  "sourceStartDate": "2024-01-21",
  "sourceEndDate": "2024-01-27",
  "targetStartDate": "2024-01-28"
}
```

**Query Parameters**:
- `doctorId` (optional): Specific doctor ID (for admin use)

**Response Example**:
```json
{
  "success": true,
  "message": "Harmonogram został pomyślnie skopiowany z 2024-01-21 do 2024-01-27 do zakresu docelowego rozpoczynającego się 2024-01-28",
  "data": {
    "copiedSchedules": [
      {
        "date": "2024-01-28",
        "dayOfWeek": "Sunday",
        "timeBlocks": [
          {
            "startTime": "09:00",
            "endTime": "12:00",
            "isActive": true
          },
          {
            "startTime": "14:00",
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

#### Schedule Routes Advanced Endpoint

**Endpoint**: `POST /api/schedule/copy-date-range/:doctorId`

**Description**: Advanced endpoint with more options for copying schedules from custom date ranges.

**Authorization**: 
- `doctor` - Can copy their own schedule
- `admin` - Can copy any doctor's schedule
- `receptionist` - Can copy any doctor's schedule

**Request Body**:
```json
{
  "sourceStartDate": "2024-01-21",
  "sourceEndDate": "2024-01-24",
  "targetStartDate": "2024-01-27"
}
```

**Path Parameters**:
- `doctorId`: ID of the doctor whose schedule to copy

**Response Example**:
```json
{
  "success": true,
  "message": "Schedule copied successfully from 2024-01-21 to 2024-01-24 to target range starting 2024-01-27",
  "data": {
    "copiedSchedules": [
      {
        "date": "2024-01-27",
        "dayOfWeek": "Saturday",
        "timeBlocks": [
          {
            "startTime": "09:00",
            "endTime": "12:00",
            "isActive": true
          }
        ]
      }
    ],
    "summary": {
      "totalDays": 4,
      "successfullyCopied": 4,
      "failedDays": 0
    }
  }
}
```

### 2. Legacy Week Copying (Maintained for Backward Compatibility)

#### Doctor Routes Convenience Endpoint

**Endpoint**: `POST /api/doctors/schedule/copy-last-week`

**Description**: Legacy endpoint for doctors to copy their own schedule from last week to current week.

**Authorization**: 
- `doctor` - Can copy their own schedule
- `admin` - Can copy any doctor's schedule

**Request Body**: None required (uses authenticated user's ID)

**Query Parameters**:
- `doctorId` (optional): Specific doctor ID (for admin use)

#### Schedule Routes Advanced Endpoint

**Endpoint**: `POST /api/schedule/copy-last-week/:doctorId`

**Description**: Legacy advanced endpoint for copying schedules from last week to current week.

**Authorization**: 
- `doctor` - Can copy their own schedule
- `admin` - Can copy any doctor's schedule
- `receptionist` - Can copy any doctor's schedule

**Request Body**:
```json
{
  "targetWeekStart": "2024-01-22"  // Optional: specific target week
}
```

## How It Works

### 1. Custom Date Range Copying Process
1. **Source Range**: Specifies the date range to copy FROM (e.g., 2024-01-21 to 2024-01-27)
2. **Target Start**: Specifies the starting date to copy TO (e.g., 2024-01-28)
3. **Duration Calculation**: Automatically calculates how many days to copy based on source range
4. **Sequential Copying**: Copies each day sequentially from source to target

**Example Scenarios**:
- **Copy 7 days**: Source 21-27 → Target starting 28 → Fills 28, 29, 30, 31, 1, 2, 3
- **Copy 3 days**: Source 21-23 → Target starting 27 → Fills 27, 28, 29
- **Copy 1 day**: Source 21-21 → Target starting 25 → Fills only 25

### 2. Schedule Copying Process
1. Fetches all schedules from the specified source date range
2. For each day in the source range:
   - Finds the corresponding schedule for that specific date
   - Creates a new schedule for the corresponding target date
   - Copies all time blocks with their settings
   - Maintains the `isActive` status of each time block

### 3. Data Preservation
- **Time Blocks**: All start/end times are preserved exactly
- **Active Status**: Whether time blocks are active or inactive is maintained
- **Notes**: Original notes are preserved with copy indication
- **Audit Fields**: `createdBy` and `updatedBy` are set to the user performing the copy

## Use Cases

### 1. Custom Schedule Replication
- Copy a specific week's schedule to a future week
- Replicate a successful schedule pattern to different time periods
- Copy schedules from peak periods to off-peak periods

### 2. Flexible Duration Copying
- Copy just 3 days of a week (e.g., Monday-Wednesday)
- Copy 10 days of schedules to cover a longer period
- Copy single-day schedules to multiple future dates

### 3. Strategic Schedule Planning
- Copy proven schedule patterns to new time periods
- Replicate successful schedules from different months
- Copy schedules to cover vacation periods or special events

### 4. Legacy Weekly Copying
- Quick weekly schedule setup (maintained for backward compatibility)
- Copy from last week to current week for recurring patterns

## Error Handling

### Partial Success Response (HTTP 207)
When some days fail to copy:

```json
{
  "success": false,
  "message": "Schedule copy completed with some errors",
  "data": {
    "copiedSchedules": [...],
    "errors": [
      {
        "date": "2024-01-28",
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

### Common Error Responses

**Missing Required Fields** (HTTP 400):
```json
{
  "success": false,
  "message": "sourceStartDate, sourceEndDate, and targetStartDate are required"
}
```

**Invalid Date Format** (HTTP 400):
```json
{
  "success": false,
  "message": "Invalid date format. Use YYYY-MM-DD format"
}
```

**Invalid Date Range** (HTTP 400):
```json
{
  "success": false,
  "message": "Source start date must be before or equal to source end date"
}
```

**No Source Schedules** (HTTP 404):
```json
{
  "success": false,
  "message": "No schedules found for the specified source date range"
}
```

**Permission Denied** (HTTP 403):
```json
{
  "success": false,
  "message": "You can only copy your own schedule"
}
```

## Frontend Integration

### Button/Interface Element
```javascript
// Example frontend implementation for custom date range copying
const copyScheduleFromDateRange = async (sourceStart, sourceEnd, targetStart) => {
  try {
    const response = await fetch('/api/doctors/schedule/copy-date-range', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sourceStartDate: sourceStart,
        sourceEndDate: sourceEnd,
        targetStartDate: targetStart
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      // Show success message
      showNotification('Schedule copied successfully!', 'success');
      // Refresh schedule display
      refreshSchedule();
    } else {
      // Handle partial success or errors
      if (response.status === 207) {
        showNotification(`Schedule copied with ${result.data.summary.failedDays} errors`, 'warning');
      } else {
        showNotification(result.message, 'error');
      }
    }
  } catch (error) {
    showNotification('Failed to copy schedule', 'error');
  }
};

// Example usage
copyScheduleFromDateRange('2024-01-21', '2024-01-27', '2024-01-28');
```

### User Experience Considerations
1. **Date Range Selection**: Clear date picker interface for source and target ranges
2. **Preview Functionality**: Show what will be copied before execution
3. **Confirmation Dialog**: Ask user to confirm before copying
4. **Progress Indicator**: Show loading state during copy operation
5. **Success Feedback**: Clear indication of what was copied
6. **Error Details**: Show specific errors for failed days
7. **Schedule Visualization**: Display source and target ranges visually

## Security Considerations

1. **Role-Based Access**: Only authorized users can copy schedules
2. **Ownership Validation**: Doctors can only copy their own schedules
3. **Audit Logging**: All copy operations are logged with user information
4. **Data Validation**: Copied schedules go through the same validation as manually created ones
5. **Date Validation**: Prevents copying to past dates and validates date ranges

## Performance Considerations

1. **Batch Operations**: Schedules are copied in a single database transaction
2. **Efficient Queries**: Uses indexed queries for date ranges
3. **Error Isolation**: Individual day failures don't affect other days
4. **Response Optimization**: Returns only necessary data in responses
5. **Scalable Date Handling**: Efficiently handles various date range sizes

## Migration from Legacy API

The legacy "copy last week" functionality is still available but consider migrating to the new custom date range API for:

- **More Flexibility**: Copy any date range, not just weeks
- **Better Control**: Specify exact source and target dates
- **Future-Proofing**: New features will be added to the custom date range API
- **Consistency**: Unified API for all schedule copying operations

## Future Enhancements

1. **Template Schedules**: Save frequently used date ranges as templates
2. **Recurring Patterns**: Set up automatic copying on specific schedules
3. **Conflict Resolution**: Handle conflicts when target dates already have schedules
4. **Schedule Merging**: Merge multiple date ranges into one target period
5. **Bulk Operations**: Copy schedules for multiple doctors simultaneously
6. **Advanced Filtering**: Copy only specific time blocks or active schedules

