# Refresh Token API Documentation

This document describes the refresh token mechanism for authentication in the application. The refresh token system allows users to maintain their session without re-authenticating frequently.

## Overview

The authentication system uses a dual-token approach:
- **Access Token (JWT)**: Short-lived token used for API requests (default: 1 hour, configurable)
- **Refresh Token**: Long-lived token stored in HTTP-only cookie (default: 30 days, configurable)

## How It Works

1. **Login/Signup**: User receives both access token and refresh token
2. **API Requests**: Access token is sent in `Authorization` header
3. **Token Expiry**: When access token expires, frontend uses refresh token to get a new access token
4. **Refresh Flow**: Refresh token is automatically sent via HTTP-only cookie

## API Endpoints

### 1. Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "message": "Zalogowano pomyślnie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "profilePicture": "url",
    "singleSessionMode": false
  }
}
```

**Cookies Set:**
- `refreshToken`: HTTP-only cookie containing the refresh token (expires in 30 days by default)

### 2. Signup

**Endpoint:** `POST /api/auth/signup`

After successful signup and OTP verification, the user receives both tokens similar to login.

### 3. Refresh Token

**Endpoint:** `POST /api/auth/refresh-token`

**Description:** Exchanges a refresh token for a new access token and refresh token.

**Request:**
- Refresh token is automatically sent via HTTP-only cookie
- No request body required

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin",
    "profilePicture": "url",
    "singleSessionMode": false
  }
}
```

**Cookies Updated:**
- `refreshToken`: New refresh token cookie is set

**Error Responses:**

```json
{
  "message": "Wymagany token odświeżania"
}
```
Status: `401` - No refresh token cookie found

```json
{
  "message": "Nieprawidłowy lub wygasły token odświeżania"
}
```
Status: `401` - Invalid or expired refresh token

### 4. Logout

**Endpoint:** `POST /api/auth/logout`

**Description:** Invalidates the current refresh token and clears the cookie.

**Response:**
```json
{
  "message": "Wylogowano pomyślnie"
}
```

**Cookies Cleared:**
- `refreshToken`: Cookie is removed

## Frontend Implementation Guide

### 1. Storing Tokens

```javascript
// After login/signup, store the access token
const { token, user } = await login(email, password);
localStorage.setItem('accessToken', token);
localStorage.setItem('user', JSON.stringify(user));

// Refresh token is automatically stored in HTTP-only cookie by the browser
// You don't need to manually store it
```

### 2. Making Authenticated Requests

```javascript
// Include access token in Authorization header
const makeAuthenticatedRequest = async (url, options = {}) => {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    credentials: 'include' // Important: Include cookies for refresh token
  });
  
  // If token expired, try to refresh
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry the original request
      return makeAuthenticatedRequest(url, options);
    } else {
      // Refresh failed, redirect to login
      window.location.href = '/login';
      return;
    }
  }
  
  return response;
};
```

### 3. Token Refresh Logic

```javascript
let isRefreshing = false;
let refreshPromise = null;

const refreshAccessToken = async () => {
  // Prevent multiple simultaneous refresh requests
  if (isRefreshing) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include', // Important: Include cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      } else {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};
```

### 4. Axios Interceptor Example

```javascript
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api',
  withCredentials: true // Important: Include cookies
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Request interceptor: Add access token to headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const response = await axios.post('/api/auth/refresh-token', {}, {
          withCredentials: true
        });
        
        const { token } = response.data;
        localStorage.setItem('accessToken', token);
        
        processQueue(null, token);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### 5. React Hook Example

```javascript
import { useState, useEffect, useCallback } from 'react';

export const useAuth = () => {
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken')
  );
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user') || 'null')
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshToken = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.token);
        setUser(data.user);
        localStorage.setItem('accessToken', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
      } else {
        // Refresh failed
        setAccessToken(null);
        setUser(null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAccessToken(null);
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('user');
    }
  }, []);

  return {
    accessToken,
    user,
    refreshToken,
    logout,
    isAuthenticated: !!accessToken
  };
};
```

### 6. Automatic Token Refresh Before Expiry

```javascript
// Check token expiry and refresh proactively
const setupTokenRefresh = () => {
  const checkAndRefresh = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    
    try {
      // Decode JWT to check expiry (without verification)
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiry = expiryTime - currentTime;
      
      // Refresh if token expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60 * 1000) {
        await refreshAccessToken();
      }
    } catch (error) {
      console.error('Error checking token expiry:', error);
    }
  };
  
  // Check every minute
  setInterval(checkAndRefresh, 60 * 1000);
  
  // Initial check
  checkAndRefresh();
};

// Call on app initialization
setupTokenRefresh();
```

## Configuration

### JWT Expiry Time

The JWT access token expiry time can be configured through the appointment config API:

**Get Current Value:**
```
GET /api/appointment-config/JWT_EXPIRY_TIME
```

**Update Value:**
```
PUT /api/appointment-config/JWT_EXPIRY_TIME
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "value": "2h"  // Examples: "1h", "30m", "2d", "1w"
}
```

**Valid Formats:**
- `"30m"` - 30 minutes
- `"1h"` - 1 hour (default)
- `"2h"` - 2 hours
- `"1d"` - 1 day
- `"7d"` - 7 days

### Refresh Token Expiry

The refresh token expiry (in days) can also be configured:

**Get Current Value:**
```
GET /api/appointment-config/REFRESH_TOKEN_EXPIRY_DAYS
```

**Update Value:**
```
PUT /api/appointment-config/REFRESH_TOKEN_EXPIRY_DAYS
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "value": 60  // Number of days (1-365)
}
```

## Security Considerations

1. **HTTP-Only Cookies**: Refresh tokens are stored in HTTP-only cookies to prevent XSS attacks
2. **Secure Cookies**: In production, cookies are only sent over HTTPS
3. **SameSite**: Cookies use `strict` SameSite policy to prevent CSRF attacks
4. **Token Rotation**: Each refresh generates a new refresh token, invalidating the old one
5. **Single Session Mode**: Users can enable single session mode to invalidate all other sessions

## Error Handling

### Common Scenarios

1. **Access Token Expired**
   - Status: `401 Unauthorized`
   - Action: Automatically refresh token and retry request

2. **Refresh Token Expired**
   - Status: `401 Unauthorized`
   - Action: Redirect user to login page

3. **Invalid Refresh Token**
   - Status: `401 Unauthorized`
   - Action: Clear tokens and redirect to login

4. **Network Error During Refresh**
   - Action: Retry refresh, if fails redirect to login

## Testing

### Manual Testing

1. **Login and get tokens:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt
```

2. **Use access token:**
```bash
curl -X GET http://localhost:5000/api/protected-route \
  -H "Authorization: Bearer <access_token>" \
  -b cookies.txt
```

3. **Refresh token:**
```bash
curl -X POST http://localhost:5000/api/auth/refresh-token \
  -b cookies.txt \
  -c cookies.txt
```

## Best Practices

1. **Always use `credentials: 'include'`** in fetch requests to send cookies
2. **Handle 401 errors gracefully** by attempting token refresh
3. **Prevent multiple simultaneous refresh requests** using a flag or queue
4. **Clear tokens on logout** and redirect to login
5. **Proactively refresh tokens** before they expire (e.g., 5 minutes before expiry)
6. **Store access token in memory** if possible, or use secure storage
7. **Never expose refresh token** to client-side JavaScript (it's in HTTP-only cookie)

## Troubleshooting

### Refresh Token Not Working

1. **Check cookies are being sent:**
   - Ensure `credentials: 'include'` or `withCredentials: true` is set
   - Check browser DevTools > Application > Cookies

2. **Check CORS settings:**
   - Ensure backend allows credentials: `credentials: true` in CORS config
   - Ensure frontend origin is whitelisted

3. **Check cookie settings:**
   - Verify `httpOnly`, `secure`, and `sameSite` settings match your environment

### Token Refresh Loop

If you experience infinite refresh loops:
- Check that refresh endpoint doesn't require authentication
- Verify refresh token validation logic
- Check for network issues causing refresh to fail

## Related Documentation

- [Appointment Config API](./AppointmentConfigAPI.md) - For configuring JWT expiry times
- [Authentication API](./FORGOT_PASSWORD_API.md) - For password reset and other auth flows
