# Doctor Appointment Stats API - Frontend Integration Guide

## Overview
This guide provides comprehensive instructions for integrating the Doctor Appointment Stats API into your frontend application. The API allows you to fetch appointment statistics for doctors based on different timeframes (week, month, year) or custom date ranges.

**Note:** While the API supports `today` as a timeframe option, it's recommended to use `week`, `month`, or `year` for better statistical insights in the UI.

## API Endpoint

```
GET /doctor-stats/:doctorId/appointment-stats
```

### Base URL
- Development: `http://localhost:5001/doctor-stats`
- Production: `https://your-api-domain.com/doctor-stats`

## Authentication

All requests require authentication via Bearer token in the Authorization header:

```javascript
headers: {
  'Authorization': `Bearer ${yourAuthToken}`,
  'Content-Type': 'application/json'
}
```

## Query Parameters

| Parameter | Type | Required | Description | Values |
|-----------|------|----------|-------------|--------|
| `timeframe` | string | No | Predefined time period | `today`, `week`, `month`, `year` |
| `startDate` | string | No | Custom start date (YYYY-MM-DD) | ISO date format |
| `endDate` | string | No | Custom end date (YYYY-MM-DD) | ISO date format |
| `groupBy` | string | No | Grouping granularity | `day`, `week`, `month`, `year` (default: `month`) |
| `includeRevenue` | string | No | Include revenue statistics | `true` or `false` (default: `false`) |

### Notes:
- If `timeframe` is provided, it takes precedence over `startDate`/`endDate`
- If `timeframe` is not provided, you can use `startDate` and `endDate` for custom ranges
- `groupBy` is automatically set based on `timeframe` if not explicitly provided:
  - `today`, `week`, `month` → `day`
  - `year` → `month`

## Request Examples

### 1. Get This Week's Statistics
```javascript
GET /doctor-stats/688887149cc810a1bd1d8589/appointment-stats?timeframe=week
```

### 2. Get This Month's Statistics
```javascript
GET /doctor-stats/688887149cc810a1bd1d8589/appointment-stats?timeframe=month
```

### 3. Get This Year's Statistics
```javascript
GET /doctor-stats/688887149cc810a1bd1d8589/appointment-stats?timeframe=year
```

### 4. Custom Date Range
```javascript
GET /doctor-stats/688887149cc810a1bd1d8589/appointment-stats?startDate=2025-01-01&endDate=2025-01-31&groupBy=day
```

### 5. With Revenue Statistics
```javascript
GET /doctor-stats/688887149cc810a1bd1d8589/appointment-stats?timeframe=month&includeRevenue=true
```

## Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "doctorId": "688887149cc810a1bd1d8589",
    "timeframe": {
      "startDate": "2025-01-01",
      "endDate": "2025-01-31",
      "groupBy": "day",
      "timeframe": "month"
    },
    "dateFormat": "YYYY-MM-DD",
    "stats": [
      {
        "datePeriod": "2025-01-01",
        "appointments": {
          "total": 15,
          "completed": 12,
          "cancelled": 2,
          "booked": 1,
          "online": 8,
          "offline": 7
        },
        "revenue": {
          "totalRevenue": 4500.00,
          "billCount": 12,
          "avgRevenue": 375.00
        }
      },
      // ... more periods
    ]
  }
}
```

### Error Response (400 Bad Request)

```json
{
  "success": false,
  "message": "Nieprawidłowy parametr timeframe. Dozwolone wartości: today, week, month, year"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Nie udało się pobrać statystyk lekarza",
  "error": "Error details..."
}
```

## Frontend Integration Examples

### React with Fetch API

```jsx
import { useState, useEffect } from 'react';

const DoctorStats = ({ doctorId, timeframe = 'month' }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(
          `http://localhost:5001/doctor-stats/${doctorId}/appointment-stats?timeframe=${timeframe}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch statistics');
        }

        const data = await response.json();
        setStats(data.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [doctorId, timeframe]);

  if (loading) return <div>Loading statistics...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!stats) return null;

  return (
    <div>
      <h2>Appointment Statistics</h2>
      <p>Period: {stats.timeframe.startDate} to {stats.timeframe.endDate}</p>
      
      {stats.stats.map((period, index) => (
        <div key={index}>
          <h3>{period.datePeriod}</h3>
          <p>Total: {period.appointments.total}</p>
          <p>Completed: {period.appointments.completed}</p>
          <p>Cancelled: {period.appointments.cancelled}</p>
        </div>
      ))}
    </div>
  );
};

export default DoctorStats;
```

### React with Axios

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

const DoctorStats = ({ doctorId, timeframe = 'month' }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        const response = await axios.get(
          `http://localhost:5001/doctor-stats/${doctorId}/appointment-stats`,
          {
            params: {
              timeframe: timeframe,
              includeRevenue: 'true'
            },
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
          }
        );

        setStats(response.data.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [doctorId, timeframe]);

  // ... rest of component
};
```

### Vue 3 with Composition API

```vue
<template>
  <div>
    <h2>Appointment Statistics</h2>
    
    <select v-model="selectedTimeframe" @change="fetchStats">
      <option value="week">This Week</option>
      <option value="month">This Month</option>
      <option value="year">This Year</option>
    </select>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error: {{ error }}</div>
    <div v-else-if="stats">
      <p>Period: {{ stats.timeframe.startDate }} to {{ stats.timeframe.endDate }}</p>
      
      <div v-for="(period, index) in stats.stats" :key="index">
        <h3>{{ period.datePeriod }}</h3>
        <p>Total: {{ period.appointments.total }}</p>
        <p>Completed: {{ period.appointments.completed }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps({
  doctorId: {
    type: String,
    required: true
  }
});

const stats = ref(null);
const loading = ref(false);
const error = ref(null);
const selectedTimeframe = ref('month');

const fetchStats = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    const token = localStorage.getItem('authToken');
    const response = await fetch(
      `http://localhost:5001/doctor-stats/${props.doctorId}/appointment-stats?timeframe=${selectedTimeframe.value}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }

    const data = await response.json();
    stats.value = data.data;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStats();
});
</script>
```

### Custom Hook (React)

```javascript
// hooks/useDoctorStats.js
import { useState, useEffect } from 'react';

export const useDoctorStats = (doctorId, timeframe = 'month', includeRevenue = false) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('authToken');
        const params = new URLSearchParams({
          timeframe: timeframe,
          includeRevenue: includeRevenue.toString()
        });

        const response = await fetch(
          `http://localhost:5001/doctor-stats/${doctorId}/appointment-stats?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch statistics');
        }

        const result = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (doctorId) {
      fetchStats();
    }
  }, [doctorId, timeframe, includeRevenue]);

  return { data, loading, error, refetch: () => fetchStats() };
};

// Usage in component
import { useDoctorStats } from './hooks/useDoctorStats';

const MyComponent = ({ doctorId }) => {
  const { data, loading, error } = useDoctorStats(doctorId, 'month', true);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {/* Render stats */}
    </div>
  );
};
```

### TypeScript Interface

```typescript
// types/doctorStats.ts

export interface AppointmentStats {
  total: number;
  completed: number;
  cancelled: number;
  booked: number;
  online: number;
  offline: number;
}

export interface RevenueStats {
  totalRevenue: number;
  billCount: number;
  avgRevenue: number;
}

export interface StatPeriod {
  datePeriod: string;
  appointments: AppointmentStats;
  revenue?: RevenueStats;
}

export interface TimeframeInfo {
  startDate: string;
  endDate: string;
  groupBy: string;
  timeframe?: string;
}

export interface DoctorStatsResponse {
  success: boolean;
  data: {
    doctorId: string;
    timeframe: TimeframeInfo;
    dateFormat: string;
    stats: StatPeriod[];
  };
}

// Usage
const fetchDoctorStats = async (
  doctorId: string,
  timeframe: 'week' | 'month' | 'year'
): Promise<DoctorStatsResponse> => {
  const response = await fetch(
    `http://localhost:5001/doctor-stats/${doctorId}/appointment-stats?timeframe=${timeframe}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch statistics');
  }

  return response.json();
};
```

## Chart Integration Examples

### Chart.js Integration

```jsx
import { Line } from 'react-chartjs-2';
import { useDoctorStats } from './hooks/useDoctorStats';

const DoctorStatsChart = ({ doctorId }) => {
  const { data, loading } = useDoctorStats(doctorId, 'month');

  if (loading) return <div>Loading chart...</div>;
  if (!data) return null;

  const chartData = {
    labels: data.stats.map(stat => stat.datePeriod),
    datasets: [
      {
        label: 'Completed Appointments',
        data: data.stats.map(stat => stat.appointments.completed),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: 'Total Appointments',
        data: data.stats.map(stat => stat.appointments.total),
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      }
    ]
  };

  return (
    <div>
      <h2>Appointment Statistics</h2>
      <Line data={chartData} />
    </div>
  );
};
```

### Recharts Integration

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { useDoctorStats } from './hooks/useDoctorStats';

const DoctorStatsChart = ({ doctorId }) => {
  const { data, loading } = useDoctorStats(doctorId, 'month');

  if (loading) return <div>Loading...</div>;
  if (!data) return null;

  const chartData = data.stats.map(stat => ({
    date: stat.datePeriod,
    completed: stat.appointments.completed,
    total: stat.appointments.total,
    cancelled: stat.appointments.cancelled,
    ...(stat.revenue && { revenue: stat.revenue.totalRevenue })
  }));

  return (
    <LineChart width={800} height={400} data={chartData}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="completed" stroke="#8884d8" />
      <Line type="monotone" dataKey="total" stroke="#82ca9d" />
      <Line type="monotone" dataKey="cancelled" stroke="#ffc658" />
    </LineChart>
  );
};
```

## Error Handling

```javascript
const fetchDoctorStats = async (doctorId, timeframe) => {
  try {
    const response = await fetch(
      `http://localhost:5001/doctor-stats/${doctorId}/appointment-stats?timeframe=${timeframe}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Handle specific error cases
      switch (response.status) {
        case 400:
          console.error('Bad Request:', data.message);
          // Show user-friendly error message
          break;
        case 401:
          console.error('Unauthorized - Token expired');
          // Redirect to login
          break;
        case 404:
          console.error('Doctor not found');
          break;
        case 500:
          console.error('Server error:', data.message);
          break;
        default:
          console.error('Unknown error:', data.message);
      }
      throw new Error(data.message || 'Failed to fetch statistics');
    }

    return data.data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      console.error('Network error - Check your connection');
    } else {
      console.error('Error fetching stats:', error);
    }
    throw error;
  }
};
```

## Best Practices

### 1. Caching
```javascript
// Use React Query or SWR for caching
import { useQuery } from 'react-query';

const useDoctorStats = (doctorId, timeframe) => {
  return useQuery(
    ['doctorStats', doctorId, timeframe],
    () => fetchDoctorStats(doctorId, timeframe),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false
    }
  );
};
```

### 2. Debouncing for Timeframe Changes
```javascript
import { useDebounce } from './hooks/useDebounce';

const DoctorStats = ({ doctorId }) => {
  const [timeframe, setTimeframe] = useState('month');
  const debouncedTimeframe = useDebounce(timeframe, 300);
  const { data, loading } = useDoctorStats(doctorId, debouncedTimeframe);

  // ...
};
```

### 3. Loading States
```javascript
const DoctorStats = ({ doctorId }) => {
  const { data, loading, error } = useDoctorStats(doctorId, 'month');

  if (loading) {
    return <SkeletonLoader />; // Show skeleton instead of spinner
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => refetch()} />;
  }

  // ...
};
```

### 4. Formatting Dates
```javascript
import { format, parseISO } from 'date-fns';

const formatDatePeriod = (datePeriod, dateFormat) => {
  if (dateFormat === 'YYYY-MM-DD') {
    return format(parseISO(datePeriod), 'MMM dd, yyyy');
  } else if (dateFormat === 'YYYY-MM') {
    return format(parseISO(datePeriod + '-01'), 'MMMM yyyy');
  }
  return datePeriod;
};
```

## Complete Example Component

```jsx
import React, { useState } from 'react';
import { useDoctorStats } from './hooks/useDoctorStats';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const DoctorStatsDashboard = ({ doctorId }) => {
  const [timeframe, setTimeframe] = useState('month');
  const [includeRevenue, setIncludeRevenue] = useState(false);
  const { data, loading, error, refetch } = useDoctorStats(doctorId, timeframe, includeRevenue);

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-4">
        <p className="text-red-800">Error: {error}</p>
        <button 
          onClick={refetch}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || !data.stats || data.stats.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No statistics available for this period.</p>
      </div>
    );
  }

  const chartData = data.stats.map(stat => ({
    date: stat.datePeriod,
    completed: stat.appointments.completed,
    total: stat.appointments.total,
    cancelled: stat.appointments.cancelled,
    ...(stat.revenue && { revenue: stat.revenue.totalRevenue })
  }));

  const totals = data.stats.reduce((acc, stat) => ({
    total: acc.total + stat.appointments.total,
    completed: acc.completed + stat.appointments.completed,
    cancelled: acc.cancelled + stat.appointments.cancelled,
  }), { total: 0, completed: 0, cancelled: 0 });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Appointment Statistics</h2>
        
        <div className="flex gap-4 mb-4">
          <select
            value={timeframe}
            onChange={(e) => handleTimeframeChange(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={includeRevenue}
              onChange={(e) => setIncludeRevenue(e.target.checked)}
              className="mr-2"
            />
            Include Revenue
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded">
            <p className="text-sm text-gray-600">Total Appointments</p>
            <p className="text-2xl font-bold">{totals.total}</p>
          </div>
          <div className="bg-green-50 p-4 rounded">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold">{totals.completed}</p>
          </div>
          <div className="bg-red-50 p-4 rounded">
            <p className="text-sm text-gray-600">Cancelled</p>
            <p className="text-2xl font-bold">{totals.cancelled}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded shadow">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} />
            <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DoctorStatsDashboard;
```

## Summary

- Use the `timeframe` parameter for quick access to predefined periods
- Use `startDate` and `endDate` for custom date ranges
- The API automatically groups data appropriately based on the timeframe
- Always handle loading and error states
- Consider caching responses for better performance
- Use TypeScript for type safety
- Format dates appropriately for your locale

For questions or issues, refer to the API documentation or contact the backend team.

