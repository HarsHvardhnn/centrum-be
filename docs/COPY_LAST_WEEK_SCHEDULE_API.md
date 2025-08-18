# Copy Last Week Schedule API

## Overview

This API provides a convenience feature that allows doctors to quickly copy their schedule from the previous week to the current week, saving time when setting up recurring schedules.

## Features

- **Automatic Week Detection**: Automatically identifies the previous week and current week
- **Day-by-Day Copying**: Copies schedules for each day of the week (Monday through Sunday)
- **Flexible Target Week**: Option to copy to a specific target week instead of current week
- **Error Handling**: Provides detailed feedback on successful copies and any errors
- **Permission Control**: Doctors can only copy their own schedules
- **Audit Trail**: Maintains records of who copied the schedule and when

## API Endpoints

### 1. Doctor Routes Convenience Endpoint

**Endpoint**: `POST /api/doctors/schedule/copy-last-week`

**Description**: Simple endpoint for doctors to copy their own schedule from last week to current week.

**Authorization**: 
- `doctor` - Can copy their own schedule
- `admin` - Can copy any doctor's schedule

**Request Body**: None required (uses authenticated user's ID)

**Query Parameters**:
- `doctorId` (optional): Specific doctor ID (for admin use)

**Response Example**:
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

### 2. Schedule Routes Advanced Endpoint

**Endpoint**: `POST /api/schedule/copy-last-week/:doctorId`

**Description**: Advanced endpoint with more options for copying schedules.

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

**Path Parameters**:
- `doctorId`: ID of the doctor whose schedule to copy

**Response Example**:
```json
{
  "success": true,
  "message": "Last week's schedule copied successfully to current week",
  "data": {
    "copiedSchedules": [
      {
        "date": "2024-01-22",
        "dayOfWeek": "Monday",
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
      "totalDays": 7,
      "successfullyCopied": 7,
      "failedDays": 0
    }
  }
}
```

## How It Works

### 1. Week Calculation
- **Current Week**: Monday to Sunday of the current week
- **Last Week**: Monday to Sunday of the previous week
- **Target Week**: Can be specified or defaults to current week

### 2. Schedule Copying Process
1. Fetches all schedules from the previous week
2. For each day of the week (Monday through Sunday):
   - Finds the corresponding schedule from last week
   - Creates a new schedule for the target week
   - Copies all time blocks with their settings
   - Maintains the `isActive` status of each time block

### 3. Data Preservation
- **Time Blocks**: All start/end times are preserved exactly
- **Active Status**: Whether time blocks are active or inactive is maintained
- **Notes**: Original notes are preserved with copy indication
- **Audit Fields**: `createdBy` and `updatedBy` are set to the user performing the copy

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

### Common Error Responses

**No Previous Week Schedule** (HTTP 404):
```json
{
  "success": false,
  "message": "No schedules found for last week to copy"
}
```

**Permission Denied** (HTTP 403):
```json
{
  "success": false,
  "message": "You can only copy your own schedule"
}
```

**Doctor Not Found** (HTTP 404):
```json
{
  "success": false,
  "message": "Lekarz nie znaleziony"
}
```

## Use Cases

### 1. Weekly Schedule Setup
Doctors can quickly set up their schedule for the new week by copying from last week's proven schedule.

### 2. Recurring Patterns
For doctors with consistent weekly schedules, this feature eliminates the need to manually recreate the same schedule each week.

### 3. Schedule Recovery
If a doctor needs to restore their schedule after accidental deletion or system issues.

### 4. Bulk Operations
Administrators can use this feature to help multiple doctors set up their schedules efficiently.

## Frontend Integration

### Button/Interface Element
```javascript
// Example frontend implementation
const copyLastWeekSchedule = async () => {
  try {
    const response = await fetch('/api/doctors/schedule/copy-last-week', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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
```

### User Experience Considerations
1. **Confirmation Dialog**: Ask user to confirm before copying
2. **Progress Indicator**: Show loading state during copy operation
3. **Success Feedback**: Clear indication of what was copied
4. **Error Details**: Show specific errors for failed days
5. **Schedule Preview**: Option to preview what will be copied

## Security Considerations

1. **Role-Based Access**: Only authorized users can copy schedules
2. **Ownership Validation**: Doctors can only copy their own schedules
3. **Audit Logging**: All copy operations are logged with user information
4. **Data Validation**: Copied schedules go through the same validation as manually created ones

## Performance Considerations

1. **Batch Operations**: Schedules are copied in a single database transaction
2. **Efficient Queries**: Uses indexed queries for date ranges
3. **Error Isolation**: Individual day failures don't affect other days
4. **Response Optimization**: Returns only necessary data in responses

## Future Enhancements

1. **Template Schedules**: Save frequently used schedules as templates
2. **Custom Date Ranges**: Copy schedules for custom date ranges
3. **Schedule Merging**: Merge multiple weeks' schedules
4. **Conflict Resolution**: Handle conflicts when target dates already have schedules
5. **Recurring Patterns**: Set up automatic weekly copying

