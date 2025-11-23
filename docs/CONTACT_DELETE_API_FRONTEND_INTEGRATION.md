# Contact Delete API - Frontend Integration Guide

## Overview
This guide provides comprehensive instructions for integrating the Contact Delete API into your frontend application. The API allows authorized users (admin and receptionist) to **soft delete** contact messages.

**Important:** This API performs a **soft delete**, meaning:
- The contact message is marked as deleted (`isDeleted: true`) but not permanently removed from the database
- Soft-deleted contacts are automatically excluded from all GET API responses
- The data can be recovered if needed (though no restore endpoint is currently provided)

## API Endpoint

```
DELETE /api/contact/:id
```

### Base URL
- Development: `http://localhost:5001/api/contact`
- Production: `https://your-api-domain.com/api/contact`

## Authentication

This endpoint requires authentication via Bearer token in the Authorization header. Only users with `admin` or `receptionist` roles can delete contacts.

```javascript
headers: {
  'Authorization': `Bearer ${yourAuthToken}`,
  'Content-Type': 'application/json'
}
```

## Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `id` | string | URL path | Yes | The MongoDB ObjectId of the contact message to delete |

## Request Example

```javascript
DELETE /api/contact/507f1f77bcf86cd799439011
```

## Response Structure

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Wiadomość kontaktowa usunięta pomyślnie"
}
```

**Note:** This is a soft delete. The contact is marked as deleted and will not appear in GET API responses, but the data remains in the database.

### Error Response (404 Not Found)

```json
{
  "success": false,
  "message": "Wiadomość kontaktowa nie znaleziona"
}
```

### Error Response (401 Unauthorized)

```json
{
  "success": false,
  "message": "Unauthorized - Invalid or missing token"
}
```

### Error Response (403 Forbidden)

```json
{
  "success": false,
  "message": "Forbidden - Insufficient permissions"
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "message": "Nie udało się usunąć wiadomości kontaktowej",
  "error": "Error details..."
}
```

## Frontend Integration Examples

### React with Fetch API

```jsx
import { useState } from 'react';

const DeleteContactButton = ({ contactId, onDeleteSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    // Confirm deletion
    if (!window.confirm('Czy na pewno chcesz usunąć tę wiadomość kontaktową?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      
      const response = await fetch(
        `http://localhost:5001/api/contact/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete contact');
      }

      // Success
      if (onDeleteSuccess) {
        onDeleteSuccess(contactId);
      }
      
      alert('Wiadomość kontaktowa usunięta pomyślnie');
    } catch (err) {
      setError(err.message);
      alert(`Błąd: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleDelete}
        disabled={loading}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Usuwanie...' : 'Usuń'}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default DeleteContactButton;
```

### React with Axios

```jsx
import { useState } from 'react';
import axios from 'axios';

const DeleteContactButton = ({ contactId, onDeleteSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę wiadomość kontaktową?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await axios.delete(
        `http://localhost:5001/api/contact/${contactId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        }
      );

      if (onDeleteSuccess) {
        onDeleteSuccess(contactId);
      }
      
      alert('Wiadomość kontaktowa usunięta pomyślnie');
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(errorMessage);
      alert(`Błąd: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
    >
      {loading ? 'Usuwanie...' : 'Usuń'}
    </button>
  );
};
```

### Vue 3 with Composition API

```vue
<template>
  <div>
    <button
      @click="handleDelete"
      :disabled="loading"
      class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
    >
      {{ loading ? 'Usuwanie...' : 'Usuń' }}
    </button>
    <p v-if="error" class="text-red-500 text-sm mt-2">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  contactId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['deleted']);

const loading = ref(false);
const error = ref(null);

const handleDelete = async () => {
  if (!confirm('Czy na pewno chcesz usunąć tę wiadomość kontaktową?')) {
    return;
  }

  try {
    loading.value = true;
    error.value = null;

    const token = localStorage.getItem('authToken');
    const response = await fetch(
      `http://localhost:5001/api/contact/${props.contactId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete contact');
    }

    emit('deleted', props.contactId);
    alert('Wiadomość kontaktowa usunięta pomyślnie');
  } catch (err) {
    error.value = err.message;
    alert(`Błąd: ${err.message}`);
  } finally {
    loading.value = false;
  }
};
</script>
```

### Custom Hook (React)

```javascript
// hooks/useDeleteContact.js
import { useState } from 'react';

export const useDeleteContact = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteContact = async (contactId) => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `http://localhost:5001/api/contact/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete contact');
      }

      return { success: true, message: data.message };
    } catch (err) {
      const errorMessage = err.message;
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return { deleteContact, loading, error };
};

// Usage in component
import { useDeleteContact } from './hooks/useDeleteContact';

const ContactList = () => {
  const { deleteContact, loading } = useDeleteContact();
  const [contacts, setContacts] = useState([]);

  const handleDelete = async (contactId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć tę wiadomość?')) {
      return;
    }

    const result = await deleteContact(contactId);
    
    if (result.success) {
      // Remove from list
      setContacts(contacts.filter(c => c._id !== contactId));
      alert(result.message);
    } else {
      alert(`Błąd: ${result.error}`);
    }
  };

  return (
    <div>
      {contacts.map(contact => (
        <div key={contact._id}>
          <p>{contact.name} - {contact.email}</p>
          <button
            onClick={() => handleDelete(contact._id)}
            disabled={loading}
          >
            Usuń
          </button>
        </div>
      ))}
    </div>
  );
};
```

### TypeScript Interface

```typescript
// types/contact.ts

export interface DeleteContactResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface DeleteContactError {
  success: false;
  message: string;
  error?: string;
}

// Usage
const deleteContact = async (
  contactId: string
): Promise<DeleteContactResponse> => {
  const token = localStorage.getItem('authToken');
  
  const response = await fetch(
    `http://localhost:5001/api/contact/${contactId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Failed to delete contact');
  }

  return data;
};
```

## Complete Example Component

```jsx
import React, { useState } from 'react';
import { useDeleteContact } from './hooks/useDeleteContact';

const ContactItem = ({ contact, onDelete }) => {
  const { deleteContact, loading } = useDeleteContact();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    const result = await deleteContact(contact._id);
    
    if (result.success) {
      onDelete(contact._id);
      setShowConfirm(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{contact.name}</h3>
          <p className="text-gray-600">{contact.email}</p>
          <p className="text-sm text-gray-500 mt-1">{contact.subject}</p>
          <p className="mt-2">{contact.message}</p>
          <div className="mt-2">
            <span className={`px-2 py-1 rounded text-xs ${
              contact.status === 'new' ? 'bg-blue-100 text-blue-800' :
              contact.status === 'read' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {contact.status}
            </span>
          </div>
        </div>
        
        <div className="ml-4">
          {!showConfirm ? (
            <button
              onClick={handleDeleteClick}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Usuń
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? 'Usuwanie...' : 'Potwierdź'}
              </button>
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 disabled:opacity-50"
              >
                Anuluj
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ContactList = () => {
  const [contacts, setContacts] = useState([]);

  const handleDelete = (contactId) => {
    setContacts(contacts.filter(c => c._id !== contactId));
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Wiadomości kontaktowe</h2>
      {contacts.map(contact => (
        <ContactItem
          key={contact._id}
          contact={contact}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default ContactList;
```

## Error Handling

```javascript
const deleteContact = async (contactId) => {
  try {
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `http://localhost:5001/api/contact/${contactId}`,
      {
        method: 'DELETE',
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
        case 401:
          // Token expired or invalid
          localStorage.removeItem('authToken');
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');
        
        case 403:
          throw new Error('You do not have permission to delete contacts.');
        
        case 404:
          throw new Error('Contact message not found.');
        
        case 500:
          throw new Error('Server error. Please try again later.');
        
        default:
          throw new Error(data.message || 'Failed to delete contact');
      }
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    throw error;
  }
};
```

## Best Practices

### 1. Confirmation Dialog

Always show a confirmation dialog before deleting:

```javascript
const handleDelete = async (contactId) => {
  const confirmed = window.confirm(
    'Czy na pewno chcesz usunąć tę wiadomość kontaktową? Ta operacja jest nieodwracalna.'
  );
  
  if (!confirmed) return;
  
  // Proceed with deletion
};
```

### 2. Optimistic UI Update

Update the UI immediately for better UX:

```javascript
const handleDelete = async (contactId) => {
  // Optimistically remove from UI
  const updatedContacts = contacts.filter(c => c._id !== contactId);
  setContacts(updatedContacts);

  try {
    await deleteContact(contactId);
    // Success - UI already updated
  } catch (error) {
    // Revert on error
    setContacts(contacts);
    alert(`Błąd: ${error.message}`);
  }
};
```

### 3. Toast Notifications

Use toast notifications instead of alerts:

```javascript
import { toast } from 'react-toastify';

const handleDelete = async (contactId) => {
  try {
    await deleteContact(contactId);
    toast.success('Wiadomość kontaktowa usunięta pomyślnie');
    onDeleteSuccess(contactId);
  } catch (error) {
    toast.error(`Błąd: ${error.message}`);
  }
};
```

### 4. Loading States

Show loading indicators during deletion:

```jsx
<button
  onClick={handleDelete}
  disabled={loading}
  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
>
  {loading ? (
    <>
      <span className="animate-spin mr-2">⏳</span>
      Usuwanie...
    </>
  ) : (
    'Usuń'
  )}
</button>
```

### 5. Error Boundaries

Wrap delete operations in error boundaries:

```jsx
import { ErrorBoundary } from 'react-error-boundary';

const ErrorFallback = ({ error, resetErrorBoundary }) => (
  <div className="bg-red-50 border border-red-200 rounded p-4">
    <p className="text-red-800">Error: {error.message}</p>
    <button onClick={resetErrorBoundary} className="mt-2 px-4 py-2 bg-red-600 text-white rounded">
      Try Again
    </button>
  </div>
);

<ErrorBoundary FallbackComponent={ErrorFallback}>
  <ContactList />
</ErrorBoundary>
```

## Summary

- **Endpoint**: `DELETE /api/contact/:id`
- **Delete Type**: **Soft Delete** (contact is marked as deleted, not permanently removed)
- **Authentication**: Required (Bearer token)
- **Authorization**: Admin or Receptionist roles only
- **Response**: Success message on deletion
- **GET APIs**: Soft-deleted contacts are automatically excluded from all GET responses
- **Error Handling**: Handle 401, 403, 404, and 500 errors
- **Best Practices**: Always confirm deletion, show loading states, use optimistic updates

### Soft Delete Behavior

- When a contact is deleted, it's marked with `isDeleted: true` and `deletedAt` timestamp
- All GET endpoints (`GET /api/contact` and `GET /api/contact/:id`) automatically filter out soft-deleted contacts
- Deleted contacts will not appear in search results or pagination
- The data remains in the database for potential recovery or audit purposes

For questions or issues, refer to the API documentation or contact the backend team.

