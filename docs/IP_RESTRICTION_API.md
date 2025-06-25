# IP Restriction System Documentation

## Overview

The IP Restriction System enhances security by limiting access to the CM7 backend to specific authorized IP addresses. Only requests from allowed IPs can access the server resources, while unauthorized IPs receive a 401 error.

## Features

- ✅ **CRUD Operations** - Complete management of allowed IP addresses
- ✅ **IPv4 & CIDR Support** - Single IPs (192.168.1.1) and IP ranges (192.168.1.0/24)
- ✅ **Development Mode Bypass** - Automatic localhost bypass in development
- ✅ **Usage Tracking** - Monitor IP usage statistics and last access times
- ✅ **Bulk Operations** - Activate, deactivate, or delete multiple IPs at once
- ✅ **Proxy Support** - Proper IP detection behind load balancers and proxies
- ✅ **Security Logging** - Detailed logs of unauthorized access attempts

## API Endpoints

### Base URL
```
/api/ip-restrictions
```

### Authentication
All endpoints require admin authentication.

---

## Endpoints

### 1. Get All Allowed IPs
```http
GET /api/ip-restrictions
```

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 10)
- `isActive` (optional) - Filter by active status (true/false)
- `search` (optional) - Search in IP address or description

**Response:**
```json
{
  "success": true,
  "message": "Allowed IPs retrieved successfully",
  "data": {
    "allowedIps": [
      {
        "_id": "64f1234567890abcdef12345",
        "ipAddress": "192.168.1.100",
        "description": "Office network access",
        "isActive": true,
        "createdBy": {
          "_id": "64f1234567890abcdef12346",
          "name": {
            "first": "Admin",
            "last": "User"
          },
          "email": "admin@centrummedyczne7.pl"
        },
        "lastUsed": "2024-01-15T10:30:00.000Z",
        "usageCount": 45,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10
    }
  }
}
```

### 2. Get IP by ID
```http
GET /api/ip-restrictions/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Allowed IP retrieved successfully",
  "data": {
    "_id": "64f1234567890abcdef12345",
    "ipAddress": "192.168.1.100",
    "description": "Office network access",
    "isActive": true,
    "createdBy": {
      "_id": "64f1234567890abcdef12346",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@centrummedyczne7.pl"
    },
    "lastUsed": "2024-01-15T10:30:00.000Z",
    "usageCount": 45,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### 3. Add New Allowed IP
```http
POST /api/ip-restrictions
```

**Request Body:**
```json
{
  "ipAddress": "192.168.1.100",
  "description": "Office network access",
  "isActive": true
}
```

**Supported IP Formats:**
- Single IPv4: `192.168.1.100`
- CIDR notation: `192.168.1.0/24`
- Localhost: `127.0.0.1`

**Response:**
```json
{
  "success": true,
  "message": "IP address added to allowed list successfully",
  "data": {
    "_id": "64f1234567890abcdef12345",
    "ipAddress": "192.168.1.100",
    "description": "Office network access",
    "isActive": true,
    "createdBy": {
      "_id": "64f1234567890abcdef12346",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@centrummedyczne7.pl"
    },
    "lastUsed": null,
    "usageCount": 0,
    "createdAt": "2024-01-15T11:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 4. Update Allowed IP
```http
PUT /api/ip-restrictions/:id
```

**Request Body:**
```json
{
  "ipAddress": "192.168.1.101",
  "description": "Updated office network access",
  "isActive": false
}
```

### 5. Delete Allowed IP
```http
DELETE /api/ip-restrictions/:id
```

**Response:**
```json
{
  "success": true,
  "message": "IP address removed from allowed list successfully"
}
```

### 6. Bulk Operations
```http
POST /api/ip-restrictions/bulk
```

**Request Body:**
```json
{
  "action": "activate",
  "ids": ["64f1234567890abcdef12345", "64f1234567890abcdef12346"]
}
```

**Supported Actions:**
- `activate` - Enable selected IPs
- `deactivate` - Disable selected IPs
- `delete` - Remove selected IPs

### 7. Get Statistics
```http
GET /api/ip-restrictions/stats
```

**Response:**
```json
{
  "success": true,
  "message": "IP restriction statistics retrieved successfully",
  "data": {
    "totalIps": 15,
    "activeIps": 12,
    "inactiveIps": 3,
    "totalUsage": 1250,
    "recentlyUsed": 8,
    "recentlyAdded": 2
  }
}
```

### 8. Check Current IP
```http
GET /api/ip-restrictions/check-current
```

**Response:**
```json
{
  "success": true,
  "message": "IP check completed",
  "data": {
    "clientIp": "192.168.1.100",
    "isAllowed": true,
    "allowedIpInfo": {
      "id": "64f1234567890abcdef12345",
      "ipAddress": "192.168.1.0/24",
      "description": "Office network range",
      "lastUsed": "2024-01-15T11:00:00.000Z",
      "usageCount": 46
    }
  }
}
```

---

## Error Responses

### IP Not Allowed (401)
```json
{
  "success": false,
  "message": "Access denied: Your IP address is not authorized to access this resource",
  "code": "IP_NOT_ALLOWED",
  "clientIp": "192.168.1.200"
}
```

### Validation Error (400)
```json
{
  "success": false,
  "message": "Validation error",
  "error": ["Please enter a valid IPv4 address or CIDR notation"]
}
```

### IP Already Exists (409)
```json
{
  "success": false,
  "message": "This IP address is already in the allowed list"
}
```

---

## Setup and Management

### Initial Setup

1. **Run Setup Script:**
```bash
node scripts/setup-ip-restrictions.js setup
```

2. **Check Status:**
```bash
node scripts/setup-ip-restrictions.js status
```

3. **Reset (Development Only):**
```bash
node scripts/setup-ip-restrictions.js reset
```

### Adding Your IP Address

1. Find your current IP:
```bash
curl https://ipinfo.io/ip
```

2. Add via API:
```bash
curl -X POST http://localhost:3000/api/ip-restrictions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "ipAddress": "YOUR_IP_ADDRESS",
    "description": "My development machine",
    "isActive": true
  }'
```

### Production Deployment

1. **Before Enabling in Production:**
   - Add your production server's IP
   - Add admin access IPs
   - Test thoroughly in staging

2. **Enable IP Restrictions:**
   - The middleware is automatically applied to all routes
   - Development mode bypasses localhost restrictions
   - Production mode enforces all restrictions

---

## Configuration

### Environment Variables

```bash
NODE_ENV=production  # Enables strict IP checking
```

### Development Mode

In development (`NODE_ENV=development`), the system:
- ✅ Allows localhost access (127.0.0.1, ::1)
- ✅ Allows private network ranges
- ✅ Provides detailed error messages with client IP

### Production Mode

In production (`NODE_ENV=production`), the system:
- ❌ No automatic localhost bypass
- ❌ Strict IP validation
- ❌ Minimal error information in responses

---

## Security Considerations

### Best Practices

1. **Principle of Least Privilege:**
   - Only add IPs that absolutely need access
   - Regularly review and remove unused IPs

2. **IP Range Management:**
   - Use specific IPs when possible
   - Use CIDR ranges only for trusted networks

3. **Monitoring:**
   - Check usage statistics regularly
   - Monitor unauthorized access logs

4. **Backup Access:**
   - Always have multiple admin-accessible IPs
   - Keep emergency access procedures documented

### Proxy Considerations

The system handles common proxy headers:
- `x-forwarded-for`
- `x-real-ip`
- `cf-connecting-ip` (Cloudflare)
- `x-client-ip`

### Logging

Unauthorized access attempts are logged with:
- Timestamp
- Client IP
- Request method and URL
- User agent
- Proxy headers

---

## Troubleshooting

### Common Issues

1. **Locked Out After Enabling Restrictions:**
   - Use the setup script to add your IP
   - Check if you're behind a proxy/NAT
   - Verify your public IP address

2. **IP Not Detected Correctly:**
   - Check proxy configuration
   - Verify `x-forwarded-for` headers
   - Test with `check-current` endpoint

3. **Development Issues:**
   - Ensure `NODE_ENV=development`
   - Check if localhost IPs are active
   - Verify database connection

### Emergency Access

If locked out completely:

1. **Direct Database Access:**
```javascript
// MongoDB shell
db.allowedips.insertOne({
  ipAddress: "YOUR_IP",
  description: "Emergency access",
  isActive: true,
  createdBy: ObjectId("ADMIN_USER_ID"),
  createdAt: new Date(),
  updatedAt: new Date()
});
```

2. **Temporarily Disable Middleware:**
Comment out the IP restriction middleware in `index.js`:
```javascript
// app.use(generalIpRestriction);
```

---

## Integration Examples

### Frontend Integration

```javascript
// Check if current IP is allowed
const checkIpAccess = async () => {
  try {
    const response = await fetch('/api/ip-restrictions/check-current', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
    const data = await response.json();
    return data.data.isAllowed;
  } catch (error) {
    return false;
  }
};

// Add new IP
const addAllowedIp = async (ipData) => {
  const response = await fetch('/api/ip-restrictions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(ipData)
  });
  return response.json();
};
```

### Admin Dashboard Integration

```javascript
// Get IP statistics for dashboard
const getIpStats = async () => {
  const response = await fetch('/api/ip-restrictions/stats', {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });
  return response.json();
};
```

---

## Support

For issues or questions regarding the IP restriction system:

1. Check the logs for unauthorized access attempts
2. Verify your IP address using the `check-current` endpoint
3. Review the setup and configuration documentation
4. Test in development mode first

**Remember:** Always test IP restrictions thoroughly before enabling in production to avoid locking yourself out! 