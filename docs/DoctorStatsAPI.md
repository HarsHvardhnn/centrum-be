# Doctor Statistics API Documentation

This document outlines the API endpoints for fetching and analyzing doctor appointment statistics for the healthcare management system.

## API Endpoints

### 1. Get Doctors List

Retrieves a simplified list of doctors with just their ID and name, useful for populating dropdown menus or selector components.

- **URL**: `/doctor-stats/doctors-list`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor, Receptionist

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "count": 10,
      "data": [
        {
          "_id": "60f1a1b2c3d4e5f6a7b8c9d0",
          "name": "Jan Kowalski"
        },
        {
          "_id": "60f1a1b2c3d4e5f6a7b8c9d1",
          "name": "Anna Nowak"
        },
        // More doctors...
      ]
    }
    ```

- **Error Response**:
  - **Code**: 500 Internal Server Error
    ```json
    {
      "success": false,
      "message": "Failed to fetch doctors list",
      "error": "Error details..."
    }
    ```

### 2. Get Doctor Appointment Stats

Retrieves appointment statistics for a specific doctor over a time period, grouped by day, week, month, or year.

- **URL**: `/doctor-stats/:doctorId/appointment-stats`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor
- **Path Parameters**:
  - `doctorId`: ID of the doctor
- **Query Parameters**:
  - `startDate` (optional): Start date for the statistics (format: YYYY-MM-DD)
  - `endDate` (optional): End date for the statistics (format: YYYY-MM-DD)
  - `groupBy` (optional): Time period grouping ('day', 'week', 'month', 'year'), defaults to 'month'
  - `includeRevenue` (optional): Whether to include revenue statistics ('true', 'false'), defaults to 'false'

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": {
        "doctorId": "60f1a1b2c3d4e5f6a7b8c9d0",
        "timeframe": {
          "startDate": "2023-01-01",
          "endDate": "2023-06-30",
          "groupBy": "month"
        },
        "dateFormat": "YYYY-MM",
        "stats": [
          {
            "datePeriod": "2023-01",
            "appointments": {
              "total": 45,
              "completed": 35,
              "cancelled": 5,
              "booked": 5,
              "online": 20,
              "offline": 25
            },
            "revenue": {
              "totalRevenue": 12500,
              "billCount": 35,
              "avgRevenue": 357.14
            }
          },
          // More monthly data...
        ]
      }
    }
    ```

- **Error Responses**:
  - **Code**: 400 Bad Request
    ```json
    {
      "success": false,
      "message": "Invalid doctor ID format"
    }
    ```
  - **Code**: 400 Bad Request
    ```json
    {
      "success": false,
      "message": "Invalid date format. Please use YYYY-MM-DD"
    }
    ```

### 3. Get Appointment Distribution Stats

Retrieves appointment distribution statistics for a doctor, showing patterns by day of week, time of day, and consultation type.

- **URL**: `/doctor-stats/:doctorId/distribution`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor
- **Path Parameters**:
  - `doctorId`: ID of the doctor
- **Query Parameters**:
  - `startDate` (optional): Start date for the statistics (format: YYYY-MM-DD)
  - `endDate` (optional): End date for the statistics (format: YYYY-MM-DD)

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": {
        "doctorId": "60f1a1b2c3d4e5f6a7b8c9d0",
        "dayOfWeekDistribution": [
          { "day": "Sunday", "count": 5 },
          { "day": "Monday", "count": 25 },
          { "day": "Tuesday", "count": 30 },
          { "day": "Wednesday", "count": 28 },
          { "day": "Thursday", "count": 22 },
          { "day": "Friday", "count": 15 },
          { "day": "Saturday", "count": 8 }
        ],
        "timeOfDayDistribution": [
          { "period": "morning", "count": 48 },
          { "period": "afternoon", "count": 65 },
          { "period": "evening", "count": 20 }
        ],
        "consultationTypeDistribution": [
          { "_id": "Clinic Consulting", "count": 75 },
          { "_id": "Online Consultation", "count": 45 },
          { "_id": "Home Visit", "count": 13 }
        ]
      }
    }
    ```

### 4. Get Doctor Performance Metrics

Retrieves key performance metrics for a doctor over a specific time period, with optional comparison to the previous period.

- **URL**: `/doctor-stats/:doctorId/performance`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor
- **Path Parameters**:
  - `doctorId`: ID of the doctor
- **Query Parameters**:
  - `startDate` (optional): Start date for the metrics (format: YYYY-MM-DD)
  - `endDate` (optional): End date for the metrics (format: YYYY-MM-DD)
  - `compareWithPrevious` (optional): Whether to include comparison with the previous period ('true', 'false'), defaults to 'false'

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": {
        "doctorId": "60f1a1b2c3d4e5f6a7b8c9d0",
        "currentPeriod": {
          "startDate": "2023-06-01",
          "endDate": "2023-06-30",
          "metrics": {
            "totalAppointments": 52,
            "completedAppointments": 45,
            "cancelledAppointments": 7,
            "completionRate": 86.54,
            "cancellationRate": 13.46,
            "totalRevenue": 15750,
            "billCount": 45,
            "avgRevenuePerAppointment": 350
          }
        },
        "previousPeriod": {
          "startDate": "2023-05-01",
          "endDate": "2023-05-31",
          "metrics": {
            "totalAppointments": 48,
            "completedAppointments": 40,
            "cancelledAppointments": 8,
            "completionRate": 83.33,
            "cancellationRate": 16.67,
            "totalRevenue": 14000,
            "billCount": 40,
            "avgRevenuePerAppointment": 350
          }
        },
        "performanceChanges": {
          "appointmentChange": 8.33,
          "completionRateChange": 3.21,
          "cancellationRateChange": -3.21,
          "avgRevenueChange": 0,
          "totalRevenueChange": 12.5
        }
      }
    }
    ```

## Usage Examples

### Example 1: Fetching Monthly Appointment Stats for a Doctor

```javascript
// Frontend code example
async function getDoctorMonthlyStats(doctorId) {
  try {
    // Get stats for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const startDate = sixMonthsAgo.toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];
    
    const response = await fetch(
      `/doctor-stats/${doctorId}/appointment-stats?startDate=${startDate}&endDate=${endDate}&groupBy=month&includeRevenue=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    if (data.success) {
      console.log('Doctor appointment stats:', data.data);
      
      // Example of extracting data for charts
      const labels = data.data.stats.map(item => item.datePeriod);
      const appointmentCounts = data.data.stats.map(item => item.appointments.total);
      const revenueData = data.data.stats.map(item => item.revenue.totalRevenue);
      
      // Now you can use these arrays with chart libraries
      renderHistogram(labels, appointmentCounts, 'Appointments per Month');
      renderLineChart(labels, revenueData, 'Revenue per Month');
    } else {
      console.error('Error fetching doctor stats:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}
```

### Example 2: Analyzing Appointment Distribution

```javascript
// Frontend code example
async function getDoctorDistribution(doctorId, startDate, endDate) {
  try {
    const response = await fetch(
      `/doctor-stats/${doctorId}/distribution?startDate=${startDate}&endDate=${endDate}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    if (data.success) {
      // Extract day of week data for charts
      const daysOfWeek = data.data.dayOfWeekDistribution.map(item => item.day);
      const daysCounts = data.data.dayOfWeekDistribution.map(item => item.count);
      
      // Extract time of day data
      const timePeriods = data.data.timeOfDayDistribution.map(item => item.period);
      const timeCounts = data.data.timeOfDayDistribution.map(item => item.count);
      
      // Extract consultation types
      const consultationTypes = data.data.consultationTypeDistribution.map(item => item._id);
      const typeCounts = data.data.consultationTypeDistribution.map(item => item.count);
      
      // Render charts
      renderBarChart(daysOfWeek, daysCounts, 'Appointments by Day of Week');
      renderPieChart(timePeriods, timeCounts, 'Time of Day Distribution');
      renderDoughnutChart(consultationTypes, typeCounts, 'Consultation Types');
    } else {
      console.error('Error fetching distribution data:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}
```

### Example 3: Comparing Performance Metrics

```javascript
// Frontend code example
async function getDoctorPerformanceComparison(doctorId) {
  try {
    // Get this month's performance with comparison to last month
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const startDate = startOfMonth.toISOString().split('T')[0];
    const endDate = endOfMonth.toISOString().split('T')[0];
    
    const response = await fetch(
      `/doctor-stats/${doctorId}/performance?startDate=${startDate}&endDate=${endDate}&compareWithPrevious=true`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    if (data.success) {
      // Display key performance indicators with changes
      displayKPI('Total Appointments', 
                data.data.currentPeriod.metrics.totalAppointments,
                data.data.performanceChanges.appointmentChange);
                
      displayKPI('Completion Rate', 
                `${data.data.currentPeriod.metrics.completionRate.toFixed(1)}%`,
                data.data.performanceChanges.completionRateChange);
                
      displayKPI('Revenue', 
                `$${data.data.currentPeriod.metrics.totalRevenue}`,
                data.data.performanceChanges.totalRevenueChange);
    } else {
      console.error('Error fetching performance metrics:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}

// Helper function to display KPIs with change indicators
function displayKPI(label, value, change) {
  const changeClass = change >= 0 ? 'positive-change' : 'negative-change';
  const changeIcon = change >= 0 ? '↑' : '↓';
  
  document.getElementById('kpi-container').innerHTML += `
    <div class="kpi-card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-change ${changeClass}">
        ${changeIcon} ${Math.abs(change).toFixed(1)}%
      </div>
    </div>
  `;
}
```

### Example 4: Getting Doctors List for Dropdown Menu

```javascript
// Frontend code example
async function loadDoctorsDropdown() {
  try {
    const response = await fetch(
      '/doctor-stats/doctors-list',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    if (data.success) {
      const selectElement = document.getElementById('doctor-select');
      
      // Clear existing options
      selectElement.innerHTML = '<option value="">Select a doctor</option>';
      
      // Add options for each doctor
      data.data.forEach(doctor => {
        const option = document.createElement('option');
        option.value = doctor._id;
        option.textContent = doctor.name;
        selectElement.appendChild(option);
      });
    } else {
      console.error('Error fetching doctors list:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}
```

## Error Handling

All API endpoints follow a consistent error handling pattern:

1. **Invalid Parameters** (400) are returned for invalid doctor IDs or dates
2. **Not Found errors** (404) are returned when a requested resource doesn't exist
3. **Unauthorized errors** (401) are returned for unauthenticated requests
4. **Forbidden errors** (403) are returned when a user doesn't have permission
5. **Server errors** (500) are returned for internal server issues

All error responses include:
- `success: false`
- `message`: A human-readable error message
- `error`: (optional) Additional error details 