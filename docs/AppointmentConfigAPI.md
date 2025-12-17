# Appointment Configuration API

This document describes the API for managing appointment configuration settings.

## Overview

The appointment configuration system allows you to store and manage key appointment settings in the database rather than hardcoding them. This provides flexibility to change these settings without code changes.

## Configuration Settings

The following settings can be managed through the API:

1. **DEFAULT_DURATION** (number)
   - Default appointment duration in minutes
   - Default value: 15

2. **DEFAULT_SLOT_DURATION** (number)
   - Default slot duration in minutes for available slots generation
   - Default value: 15

3. **BOOKING_BUFFER_MINUTES** (number)
   - Buffer time in minutes for booking (prevents booking slots too close to current time)
   - Default value: 15

4. **DEFAULT_TEMPORARY_PASSWORD** (string)
   - Default temporary password for new patients
   - Default value: "centrum123"

5. **JWT_EXPIRY_TIME** (string)
   - JWT access token expiry time
   - Format: string like "1h", "30m", "2d", etc. (see https://github.com/vercel/ms for format)
   - Default value: "1h"
   - Examples: "30m" (30 minutes), "1h" (1 hour), "2h" (2 hours), "1d" (1 day)

6. **REFRESH_TOKEN_EXPIRY_DAYS** (number)
   - Refresh token expiry time in days
   - Default value: 30
   - Range: 1-365 days

## API Endpoints

### Get All Configuration Settings

```
GET /api/appointment-config
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "DEFAULT_DURATION",
      "value": 15,
      "valueType": "number",
      "description": "Default appointment duration in minutes",
      "displayName": "Default Appointment Duration",
      "category": "appointment",
      "validation": {
        "min": 1,
        "max": 120
      },
      "editable": true,
      "createdAt": "2023-06-15T10:30:00.000Z",
      "updatedAt": "2023-06-15T10:30:00.000Z"
    },
    // ... other configuration settings
  ]
}
```

### Get Configuration as Object

```
GET /api/appointment-config/object
```

**Response:**
```json
{
  "success": true,
  "data": {
    "DEFAULT_DURATION": 15,
    "DEFAULT_SLOT_DURATION": 15,
    "BOOKING_BUFFER_MINUTES": 15,
    "DEFAULT_TEMPORARY_PASSWORD": "centrum123",
    "JWT_EXPIRY_TIME": "1h",
    "REFRESH_TOKEN_EXPIRY_DAYS": 30
  }
}
```

### Get Specific Configuration by Key

```
GET /api/appointment-config/:key
```

**Example:**
```
GET /api/appointment-config/DEFAULT_DURATION
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "DEFAULT_DURATION",
    "value": 15,
    "valueType": "number",
    "description": "Default appointment duration in minutes",
    "displayName": "Default Appointment Duration",
    "category": "appointment",
    "validation": {
      "min": 1,
      "max": 120
    },
    "editable": true,
    "createdAt": "2023-06-15T10:30:00.000Z",
    "updatedAt": "2023-06-15T10:30:00.000Z"
  }
}
```

### Update Configuration Value

```
PUT /api/appointment-config/:key
```

**Example:**
```
PUT /api/appointment-config/DEFAULT_DURATION
```

**Request Body:**
```json
{
  "value": 30
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration DEFAULT_DURATION updated successfully",
  "data": {
    "key": "DEFAULT_DURATION",
    "value": 30,
    // ... other fields
  }
}
```

### Reset Configuration to Default Value

```
POST /api/appointment-config/:key/reset
```

**Example:**
```
POST /api/appointment-config/DEFAULT_DURATION/reset
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration DEFAULT_DURATION reset to default value",
  "data": {
    "key": "DEFAULT_DURATION",
    "value": 15,
    // ... other fields
  }
}
```

## Setup and Initialization

The system automatically initializes the configuration settings in the database on server startup if they don't exist. You don't need to run any manual setup scripts.

However, if you want to manually reset all configuration settings to their defaults, you can run:

```bash
node scripts/seedAppointmentConfig.js
```

This script will create the initial configuration settings if they don't exist already.

## Usage in Code

The appointment configuration is automatically loaded from the database on server startup and reloaded periodically. You can access the configuration values in your code as follows:

```javascript
const appointmentConfig = require("../config/appointmentConfig");
const jwtConfig = require("../config/jwtConfig");

// Access appointment configuration values
const defaultDuration = appointmentConfig.DEFAULT_DURATION;

// Access JWT configuration values
const jwtExpiryTime = jwtConfig.JWT_EXPIRY_TIME; // e.g., "1h"
const refreshTokenExpiryDays = jwtConfig.REFRESH_TOKEN_EXPIRY_DAYS; // e.g., 30

// Or use the async getter for real-time values
const getDuration = async () => {
  const duration = await appointmentConfig.getConfigValue("DEFAULT_DURATION");
  return duration;
};

const getJwtExpiry = async () => {
  const expiry = await jwtConfig.getConfigValue("JWT_EXPIRY_TIME");
  return expiry;
};
```

### Refreshing Configuration

When you update configuration values through the API, the in-memory configuration is automatically refreshed. However, if you need to manually refresh the configuration in your code, you can use:

```javascript
const appointmentConfig = require("../config/appointmentConfig");

// Force reload of configuration from database
await appointmentConfig.reloadConfig();

// Now use the updated values
const updatedDuration = appointmentConfig.DEFAULT_DURATION;
```

This is useful if you're making configuration changes programmatically and need to ensure the latest values are used immediately.
