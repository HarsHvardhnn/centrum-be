# GDPR Cookie Consent API Documentation

## Overview

The GDPR Cookie Consent API provides endpoints for managing user cookie consent preferences in compliance with GDPR regulations. This system allows users to grant, modify, and withdraw consent for different types of cookies.

## Base URL

```
/api/cookie-consent
```

## Authentication

All endpoints require user authentication via JWT Bearer token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Rate Limiting

- **General endpoints**: 20 requests per 15 minutes per user
- **Delete endpoint**: 5 requests per hour per user
- **Admin users**: Rate limiting is bypassed

## API Endpoints

### 1. Get Cookie Consent

Retrieve the current user's cookie consent preferences.

**Endpoint:** `GET /api/cookie-consent`

**Response:**

```json
{
  "success": true,
  "data": {
    "consent": {
      "necessary": true,
      "analytics": true,
      "marketing": false,
      "preferences": true,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "version": "1.0"
    }
  }
}
```

**Response (No consent found):**

```json
{
  "success": true,
  "data": null,
  "message": "No consent found for user"
}
```

### 2. Save Cookie Consent

Save or update the user's cookie consent preferences.

**Endpoint:** `POST /api/cookie-consent`

**Request Body:**

```json
{
  "consent": {
    "analytics": true,
    "marketing": false,
    "preferences": true,
    "version": "1.0"
  }
}
```

**Required Fields:**
- `analytics` (boolean): Consent for analytics cookies
- `marketing` (boolean): Consent for marketing cookies  
- `preferences` (boolean): Consent for preference cookies

**Optional Fields:**
- `version` (string): Version of the consent policy

**Notes:**
- `necessary` is automatically set to `true` (GDPR requirement)
- `timestamp` is automatically set to current time

**Response:**

```json
{
  "success": true,
  "message": "Cookie consent saved successfully",
  "data": {
    "consent": {
      "necessary": true,
      "analytics": true,
      "marketing": false,
      "preferences": true,
      "timestamp": "2024-01-15T10:30:00.000Z",
      "version": "1.0"
    }
  }
}
```

### 3. Delete Cookie Consent

Withdraw the user's cookie consent (GDPR right to be forgotten).

**Endpoint:** `DELETE /api/cookie-consent`

**Response:**

```json
{
  "success": true,
  "message": "Cookie consent withdrawn successfully"
}
```

**Response (No consent found):**

```json
{
  "success": false,
  "message": "No consent found to delete"
}
```

### 4. Get Consent Status

Quick check to see if user has given consent.

**Endpoint:** `GET /api/cookie-consent/status`

**Response:**

```json
{
  "success": true,
  "data": {
    "hasConsent": true,
    "consentGiven": "2024-01-15T10:30:00.000Z"
  }
}
```

### 5. Get Consent History

Retrieve the user's consent history for audit purposes.

**Endpoint:** `GET /api/cookie-consent/history`

**Response:**

```json
{
  "success": true,
  "data": {
    "history": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "consent": {
          "necessary": true,
          "analytics": true,
          "marketing": false,
          "preferences": true,
          "timestamp": "2024-01-15T10:30:00.000Z",
          "version": "1.0"
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

## Error Responses

### Validation Errors

```json
{
  "success": false,
  "message": "Invalid consent data: analytics must be a boolean"
}
```

### Rate Limiting

```json
{
  "success": false,
  "message": "Too many cookie consent requests. Please try again later.",
  "retryAfter": 900
}
```

### Authentication Errors

```json
{
  "message": "Unauthorized: No token provided"
}
```

### Server Errors

```json
{
  "success": false,
  "message": "Internal server error"
}
```

## Cookie Types

The system manages consent for four types of cookies:

1. **Necessary**: Essential cookies for basic functionality (always `true`)
2. **Analytics**: Cookies for website analytics and performance monitoring
3. **Marketing**: Cookies for advertising and marketing purposes
4. **Preferences**: Cookies for storing user preferences and settings

## GDPR Compliance Features

- **Consent Versioning**: Track changes in privacy policy versions
- **Audit Trail**: Complete history of consent changes
- **Right to Withdraw**: Easy consent withdrawal mechanism
- **Data Minimization**: Only store necessary consent data
- **IP Address Logging**: For legal compliance and audit purposes
- **User Agent Tracking**: For security and audit purposes

## Database Schema

```javascript
{
  userId: ObjectId,           // Reference to User
  consent: {
    necessary: Boolean,       // Always true
    analytics: Boolean,       // User choice
    marketing: Boolean,       // User choice  
    preferences: Boolean,     // User choice
    timestamp: Date,          // When consent was given
    version: String           // Policy version
  },
  ipAddress: String,          // User's IP address
  userAgent: String,          // User's browser/device info
  createdAt: Date,           // Record creation time
  updatedAt: Date            // Record update time
}
```

## Frontend Integration Example

```javascript
// Get current consent
const getCurrentConsent = async () => {
  const response = await fetch('/api/cookie-consent', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// Save consent
const saveConsent = async (consentData) => {
  const response = await fetch('/api/cookie-consent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ consent: consentData })
  });
  return response.json();
};

// Withdraw consent
const withdrawConsent = async () => {
  const response = await fetch('/api/cookie-consent', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

## Security Considerations

- **Rate Limiting**: Prevents abuse and DoS attacks
- **Input Validation**: Strict validation of all input data
- **Input Sanitization**: Protection against XSS attacks
- **Authentication Required**: All endpoints require valid JWT token
- **Audit Logging**: All actions are logged for compliance
- **Data Encryption**: All data is encrypted in transit via HTTPS

## Monitoring and Health Check

A health check endpoint will be available at:

```
GET /api/health/cookie-consent
```

This endpoint can be used to monitor the service status and database connectivity.

## Support and Troubleshooting

Common issues and solutions:

1. **Authentication Errors**: Ensure JWT token is valid and not expired
2. **Validation Errors**: Check request body format and data types
3. **Rate Limiting**: Implement exponential backoff for retries
4. **Database Errors**: Check MongoDB connection and user permissions

For technical support, contact the development team with:
- Error messages and response codes
- Request/response payloads (sanitized)
- User ID and timestamp of the issue
- Browser/device information if relevant 