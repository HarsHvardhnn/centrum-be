# SMS Template API Documentation

## Overview
The SMS Template API provides CRUD operations for managing SMS templates used throughout the application. Templates can be created, updated, deleted, and retrieved with various filtering options.

## Base URL
```
/api/sms-templates
```

## Authentication
All endpoints require authentication. Different endpoints have different role requirements:
- **Admin only**: Create, update, delete, and manage all templates
- **All authenticated users**: View active templates

## API Endpoints

### 1. Create SMS Template
**POST** `/api/sms-templates`

**Access**: Admin only

**Request Body**:
```json
{
  "title": "Appointment Confirmation",
  "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}."
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "SMS template created successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "Appointment Confirmation",
    "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}.",
    "isActive": true,
    "createdBy": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@example.com"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Validation Rules**:
- `title`: Required, 1-100 characters
- `description`: Required, 1-500 characters

### 2. Get All SMS Templates
**GET** `/api/sms-templates`

**Access**: Admin only

**Query Parameters**:
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `sortBy` (optional): Sort field (default: "createdAt")
- `sortOrder` (optional): "asc" or "desc" (default: "desc")
- `search` (optional): Search in title and description
- `isActive` (optional): Filter by active status ("true" or "false")

**Example Request**:
```
GET /api/sms-templates?page=1&limit=10&search=appointment&isActive=true
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "Appointment Confirmation",
      "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}.",
      "isActive": true,
      "createdBy": {
        "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
        "name": {
          "first": "Admin",
          "last": "User"
        },
        "email": "admin@example.com"
      },
      "updatedBy": null,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "pages": 1,
    "limit": 10
  }
}
```

### 3. Get Active SMS Templates
**GET** `/api/sms-templates/active`

**Access**: Admin, Doctor, Receptionist

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "Appointment Confirmation",
      "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}."
    }
  ]
}
```

### 4. Get SMS Template by ID
**GET** `/api/sms-templates/:id`

**Access**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "Appointment Confirmation",
    "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}.",
    "isActive": true,
    "createdBy": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@example.com"
    },
    "updatedBy": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Response** (404 Not Found):
```json
{
  "success": false,
  "message": "SMS template not found"
}
```

### 5. Update SMS Template
**PUT** `/api/sms-templates/:id`

**Access**: Admin only

**Request Body**:
```json
{
  "title": "Updated Appointment Confirmation",
  "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}. Please arrive 15 minutes early.",
  "isActive": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "SMS template updated successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "Updated Appointment Confirmation",
    "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}. Please arrive 15 minutes early.",
    "isActive": true,
    "createdBy": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@example.com"
    },
    "updatedBy": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@example.com"
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 6. Delete SMS Template (Soft Delete)
**DELETE** `/api/sms-templates/:id`

**Access**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "message": "SMS template deleted successfully"
}
```

### 7. Toggle SMS Template Status
**PATCH** `/api/sms-templates/:id/toggle`

**Access**: Admin only

**Response** (200 OK):
```json
{
  "success": true,
  "message": "SMS template activated successfully",
  "data": {
    "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
    "title": "Appointment Confirmation",
    "description": "Your appointment with Dr. {doctorName} has been confirmed for {date} at {time}.",
    "isActive": true,
    "updatedBy": {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d1",
      "name": {
        "first": "Admin",
        "last": "User"
      },
      "email": "admin@example.com"
    }
  }
}
```

## Error Responses

### Validation Error (400 Bad Request)
```json
{
  "success": false,
  "message": "Validation errors",
  "errors": [
    {
      "type": "field",
      "value": "",
      "msg": "Title is required and must be between 1 and 100 characters",
      "path": "title",
      "location": "body"
    }
  ]
}
```

### Conflict Error (409 Conflict)
```json
{
  "success": false,
  "message": "Template with this title already exists"
}
```

### Not Found Error (404 Not Found)
```json
{
  "success": false,
  "message": "SMS template not found"
}
```

### Server Error (500 Internal Server Error)
```json
{
  "success": false,
  "message": "Failed to create SMS template",
  "error": "Error details"
}
```

## Template Variables

SMS templates support dynamic variables that can be replaced with actual values:

- `{doctorName}` - Doctor's full name
- `{patientName}` - Patient's full name
- `{date}` - Appointment date
- `{time}` - Appointment time
- `{clinicName}` - Clinic name
- `{phoneNumber}` - Contact phone number

## Frontend Integration Examples

### React/JavaScript Example

```javascript
// Get all templates
const fetchTemplates = async () => {
  try {
    const response = await fetch('/api/sms-templates', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching templates:', error);
  }
};

// Create new template
const createTemplate = async (templateData) => {
  try {
    const response = await fetch('/api/sms-templates', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating template:', error);
  }
};

// Update template
const updateTemplate = async (id, templateData) => {
  try {
    const response = await fetch(`/api/sms-templates/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(templateData)
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating template:', error);
  }
};

// Delete template
const deleteTemplate = async (id) => {
  try {
    const response = await fetch(`/api/sms-templates/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting template:', error);
  }
};

// Toggle template status
const toggleTemplateStatus = async (id) => {
  try {
    const response = await fetch(`/api/sms-templates/${id}/toggle`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error toggling template status:', error);
  }
};
```

### Vue.js Example

```javascript
// Vue.js composable for SMS templates
export const useSmsTemplates = () => {
  const templates = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const fetchTemplates = async (params = {}) => {
    loading.value = true;
    error.value = null;
    
    try {
      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(`/api/sms-templates?${queryString}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (data.success) {
        templates.value = data.data;
      } else {
        error.value = data.message;
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const createTemplate = async (templateData) => {
    loading.value = true;
    error.value = null;
    
    try {
      const response = await fetch('/api/sms-templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(templateData)
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchTemplates(); // Refresh list
        return data;
      } else {
        error.value = data.message;
      }
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  return {
    templates,
    loading,
    error,
    fetchTemplates,
    createTemplate
  };
};
```

## Database Schema

```javascript
{
  _id: ObjectId,
  title: String (required, max 100 chars),
  description: String (required, max 500 chars),
  isActive: Boolean (default: true),
  createdBy: ObjectId (ref: User),
  updatedBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

## Indexes

- `title`: For efficient title searches
- `isActive`: For filtering active/inactive templates
- `createdAt`: For sorting by creation date

## Security Considerations

1. **Role-based Access**: Only admins can create, update, and delete templates
2. **Input Validation**: All inputs are validated for length and format
3. **Soft Delete**: Templates are soft-deleted (isActive: false) rather than hard-deleted
4. **Audit Trail**: All changes track who made them and when
5. **Unique Titles**: Prevents duplicate template titles

## Rate Limiting

Consider implementing rate limiting for template operations to prevent abuse:
- Create: 10 requests per minute per user
- Update: 20 requests per minute per user
- Delete: 5 requests per minute per user 