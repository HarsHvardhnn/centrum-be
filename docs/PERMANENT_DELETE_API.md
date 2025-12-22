# Permanent Delete API Documentation

## Overview

This API provides endpoints for **permanently deleting** records from the system. These operations are **irreversible** and should be used with extreme caution. All endpoints require **admin role** authentication.

**⚠️ WARNING: These operations permanently remove data from the database and cannot be undone.**

## Base URL

- Development: `http://localhost:5001/api/permanent-delete`
- Production: `https://your-api-domain.com/api/permanent-delete`

## Authentication

All endpoints require authentication via Bearer token in the Authorization header. **Only users with `admin` role** can access these endpoints.

```javascript
headers: {
  'Authorization': `Bearer ${yourAuthToken}`,
  'Content-Type': 'application/json'
}
```

## Common Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "deletedCount": 5,  // Optional: number of records deleted
  "deletedRecords": {  // Optional: breakdown of deleted records
    "appointments": 3,
    "bills": 2
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error message"
}
```

## Endpoints

### 1. Get Deletion Statistics

Get statistics about records that can be permanently deleted.

**Endpoint:** `GET /api/permanent-delete/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "cancelledAppointments": 15,
    "completedAppointments": 42,
    "softDeletedContacts": 8,
    "cancelledInvoices": 5,
    "paidInvoices": 38,
    "softDeletedUsers": 3
  }
}
```

**Use Case:** Use this endpoint to show admins how many records can be deleted before performing bulk operations.

---

### 2. Permanently Delete Patient

Permanently delete a patient and all related records (appointments, bills, services, etc.).

**Endpoint:** `DELETE /api/permanent-delete/patients/:patientId`

**Parameters:**
- `patientId` (path, required): MongoDB ObjectId of the patient

**What Gets Deleted:**
- Patient user account
- Patient profile (including photo from Cloudinary)
- All appointments for this patient
- All bills/invoices for this patient
- All patient services
- All user services related to this patient

**Response:**
```json
{
  "success": true,
  "message": "Patient and all related records permanently deleted",
  "deletedRecords": {
    "patient": 1,
    "appointments": 12,
    "bills": 8,
    "patientServices": 5
  }
}
```

**Example Request:**
```javascript
const deletePatient = async (patientId) => {
  const response = await fetch(`/api/permanent-delete/patients/${patientId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data;
};
```

**Error Responses:**
- `400`: Invalid patient ID format
- `404`: Patient not found
- `401`: Unauthorized (not admin)
- `500`: Server error

#### Bulk Delete Patients by IDs

**Endpoint:** `DELETE /api/permanent-delete/patients/bulk`

**Request Body:**
```json
{
  "ids": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 3 patient(s) and all related records",
  "deletedRecords": {
    "patients": 3,
    "appointments": 25,
    "bills": 18,
    "patientServices": 12
  },
  "requestedCount": 3
}
```

**Example Request:**
```javascript
const bulkDeletePatients = async (patientIds) => {
  const response = await fetch('/api/permanent-delete/patients/bulk', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: patientIds })
  });
  
  const data = await response.json();
  return data;
};

// Usage
await bulkDeletePatients([
  '507f1f77bcf86cd799439011',
  '507f1f77bcf86cd799439012'
]);
```

**Error Responses:**
- `400`: No valid patient IDs provided, or some IDs are invalid, or some IDs are not patients
- `401`: Unauthorized
- `500`: Server error

---

### 3. Permanently Delete Appointments

Permanently delete appointments. Can delete a single appointment or bulk delete by status.

#### Delete Single Appointment

**Endpoint:** `DELETE /api/permanent-delete/appointments/:appointmentId`

**Parameters:**
- `appointmentId` (path, required): MongoDB ObjectId of the appointment

**What Gets Deleted:**
- The appointment
- Related bill/invoice (if exists)
- Appointment reports from Cloudinary (if any)

**Response:**
```json
{
  "success": true,
  "message": "Appointment permanently deleted"
}
```

#### Bulk Delete Appointments by Status

**Endpoint:** `DELETE /api/permanent-delete/appointments?bulk=true&status=cancelled`

**Query Parameters:**
- `bulk` (required): Must be `"true"`
- `status` (required): Must be `"cancelled"` or `"paid"`

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 15 cancelled appointment(s)",
  "deletedCount": 15
}
```

**Example Request (Bulk Delete):**
```javascript
const bulkDeleteCancelledAppointments = async () => {
  const response = await fetch(
    '/api/permanent-delete/appointments?bulk=true&status=cancelled',
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  return data;
};
```

**Use Cases:**
- Clean up bulk wrong scheduling (e.g., 10 patients booked on wrong date)
- Remove test appointments
- Clean up old cancelled appointments

**Error Responses:**
- `400`: Invalid appointment ID or invalid status for bulk delete
- `404`: Appointment not found (single delete)
- `401`: Unauthorized
- `500`: Server error

#### Bulk Delete Appointments by IDs

**Endpoint:** `DELETE /api/permanent-delete/appointments/bulk`

**Request Body:**
```json
{
  "ids": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 3 appointment(s)",
  "deletedCount": 3,
  "requestedCount": 3
}
```

**Example Request:**
```javascript
const bulkDeleteAppointments = async (appointmentIds) => {
  const response = await fetch('/api/permanent-delete/appointments/bulk', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: appointmentIds })
  });
  
  const data = await response.json();
  return data;
};

// Usage
await bulkDeleteAppointments([
  '507f1f77bcf86cd799439011',
  '507f1f77bcf86cd799439012'
]);
```

**What Gets Deleted:**
- The appointments
- Related bills/invoices (if exist)
- Appointment reports from Cloudinary (if any)

**Error Responses:**
- `400`: No valid appointment IDs provided, or some IDs are invalid
- `401`: Unauthorized
- `500`: Server error

---

### 4. Permanently Delete Contact Messages

Permanently delete contact form messages. Can delete a single message or bulk delete all soft-deleted messages.

#### Delete Single Contact Message

**Endpoint:** `DELETE /api/permanent-delete/contacts/:contactId`

**Parameters:**
- `contactId` (path, required): MongoDB ObjectId of the contact message

**Response:**
```json
{
  "success": true,
  "message": "Contact message permanently deleted"
}
```

#### Bulk Delete Soft-Deleted Contacts

**Endpoint:** `DELETE /api/permanent-delete/contacts?bulk=true`

**Query Parameters:**
- `bulk` (required): Must be `"true"`

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 8 contact message(s)",
  "deletedCount": 8
}
```

**Use Cases:**
- Remove spam messages
- Delete test messages
- Clean irrelevant inquiries

**Example Request (Bulk Delete):**
```javascript
const bulkDeleteContacts = async () => {
  const response = await fetch(
    '/api/permanent-delete/contacts?bulk=true',
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  return data;
};
```

**Error Responses:**
- `400`: Invalid contact ID or missing bulk parameter
- `404`: Contact message not found
- `401`: Unauthorized
- `500`: Server error

#### Bulk Delete Contacts by IDs

**Endpoint:** `DELETE /api/permanent-delete/contacts/bulk`

**Request Body:**
```json
{
  "ids": [
    "507f1f77bcf86cd799439011",
    "507f1f77bcf86cd799439012",
    "507f1f77bcf86cd799439013"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 3 contact message(s)",
  "deletedCount": 3,
  "requestedCount": 3
}
```

**Example Request:**
```javascript
const bulkDeleteContacts = async (contactIds) => {
  const response = await fetch('/api/permanent-delete/contacts/bulk', {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ids: contactIds })
  });
  
  const data = await response.json();
  return data;
};

// Usage
await bulkDeleteContacts([
  '507f1f77bcf86cd799439011',
  '507f1f77bcf86cd799439012'
]);
```

**Error Responses:**
- `400`: No valid contact IDs provided, or some IDs are invalid
- `401`: Unauthorized
- `500`: Server error

---

### 5. Permanently Delete User Account

Permanently delete a user account and related records. **Cannot delete admin users** (safety check).

**Endpoint:** `DELETE /api/permanent-delete/users/:userId`

**Parameters:**
- `userId` (path, required): MongoDB ObjectId of the user

**What Gets Deleted (based on role):**

**For Patients:**
- User account
- Patient profile (including photo)
- All appointments
- All bills/invoices
- All patient services
- All user services

**For Doctors:**
- User account
- All appointments where they are the doctor
- All user services

**For Receptionists:**
- User account
- Bills they created (billedBy reference removed)

**Response:**
```json
{
  "success": true,
  "message": "User account and related records permanently deleted",
  "deletedRecords": {
    "user": 1,
    "appointments": 5,
    "bills": 3,
    "services": 2
  }
}
```

**Example Request:**
```javascript
const deleteUser = async (userId) => {
  const response = await fetch(`/api/permanent-delete/users/${userId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data;
};
```

**Error Responses:**
- `400`: Invalid user ID format
- `403`: Cannot delete admin users
- `404`: User not found
- `401`: Unauthorized
- `500`: Server error

**Use Cases:**
- Delete test accounts
- Remove duplicate accounts
- Delete accounts upon patient request

---

### 6. Permanently Delete Invoice/Bill

Permanently delete invoices/bills. Can delete a single invoice or bulk delete by status.

#### Delete Single Invoice

**Endpoint:** `DELETE /api/permanent-delete/invoices/:invoiceId`

**Parameters:**
- `invoiceId` (path, required): MongoDB ObjectId of the invoice/bill

**What Gets Deleted:**
- The invoice/bill record
- Invoice PDF from Cloudinary (if exists)

**Response:**
```json
{
  "success": true,
  "message": "Invoice permanently deleted"
}
```

#### Bulk Delete Invoices by Status

**Endpoint:** `DELETE /api/permanent-delete/invoices?bulk=true&status=cancelled`

**Query Parameters:**
- `bulk` (required): Must be `"true"`
- `status` (required): Must be `"cancelled"` or `"paid"`

**Response:**
```json
{
  "success": true,
  "message": "Permanently deleted 5 cancelled invoice(s)",
  "deletedCount": 5
}
```

**Example Request (Bulk Delete):**
```javascript
const bulkDeleteCancelledInvoices = async () => {
  const response = await fetch(
    '/api/permanent-delete/invoices?bulk=true&status=cancelled',
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  const data = await response.json();
  return data;
};
```

**Use Cases:**
- Remove cancelled invoices
- Delete duplicate invoices
- Clean up test or mistakenly generated invoices
- Ensure incorrect financial data doesn't appear in reports

**Error Responses:**
- `400`: Invalid invoice ID or invalid status for bulk delete
- `404`: Invoice not found
- `401`: Unauthorized
- `500`: Server error

---

## Frontend Implementation Guide

### 1. React Hook for Permanent Deletion

```javascript
import { useState } from 'react';

export const usePermanentDelete = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteRecord = async (endpoint, id, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const url = id 
        ? `/api/permanent-delete/${endpoint}/${id}`
        : `/api/permanent-delete/${endpoint}${options.query || ''}`;

      const fetchOptions = {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      };

      // Add body for bulk delete by IDs
      if (options.body) {
        fetchOptions.body = options.body;
      }

      const response = await fetch(url, fetchOptions);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Delete failed');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteRecord, loading, error };
};
```

### 2. Confirmation Dialog Component

```javascript
import React, { useState } from 'react';
import { usePermanentDelete } from './usePermanentDelete';

const PermanentDeleteDialog = ({ 
  open, 
  onClose, 
  type, 
  id, 
  onSuccess,
  title,
  message 
}) => {
  const { deleteRecord, loading, error } = usePermanentDelete();
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    try {
      const endpoint = {
        patient: 'patients',
        appointment: 'appointments',
        contact: 'contacts',
        user: 'users',
        invoice: 'invoices'
      }[type];

      await deleteRecord(endpoint, id);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-red-600 mb-4">{title}</h2>
        <p className="text-gray-700 mb-4">{message}</p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type <strong>DELETE</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="DELETE"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || confirmText !== 'DELETE'}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : 'Permanently Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermanentDeleteDialog;
```

### 3. Bulk Delete Component

```javascript
import React, { useState, useEffect } from 'react';
import { usePermanentDelete } from './usePermanentDelete';

const BulkDeleteComponent = ({ type, status }) => {
  const { deleteRecord, loading, error } = usePermanentDelete();
  const [stats, setStats] = useState(null);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/permanent-delete/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      const data = await response.json();
      setStats(data.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (confirmText !== 'DELETE ALL') {
      alert('Please type DELETE ALL to confirm');
      return;
    }

    try {
      const endpoint = {
        appointment: 'appointments',
        invoice: 'invoices',
        contact: 'contacts'
      }[type];

      const query = `?bulk=true&status=${status}`;
      const result = await deleteRecord(endpoint, null, { query });
      
      alert(`Successfully deleted ${result.deletedCount} record(s)`);
      fetchStats(); // Refresh stats
      setConfirmText('');
    } catch (err) {
      console.error('Bulk delete error:', err);
    }
  };

  const getCount = () => {
    if (!stats) return 0;
    
    if (type === 'appointment') {
      return status === 'cancelled' 
        ? stats.cancelledAppointments 
        : stats.completedAppointments;
    }
    if (type === 'invoice') {
      return status === 'cancelled' 
        ? stats.cancelledInvoices 
        : stats.paidInvoices;
    }
    if (type === 'contact') {
      return stats.softDeletedContacts;
    }
    return 0;
  };

  return (
    <div className="p-4 border border-red-300 rounded-lg bg-red-50">
      <h3 className="font-bold text-red-800 mb-2">
        Bulk Delete {type} ({status})
      </h3>
      <p className="text-sm text-gray-700 mb-4">
        {getCount()} record(s) can be permanently deleted
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type <strong>DELETE ALL</strong> to confirm:
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="DELETE ALL"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleBulkDelete}
        disabled={loading || confirmText !== 'DELETE ALL' || getCount() === 0}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? 'Deleting...' : `Delete All ${getCount()} Record(s)`}
      </button>
    </div>
  );
};

export default BulkDeleteComponent;
```

### 4. Bulk Delete by IDs Component

```javascript
import React, { useState } from 'react';
import { usePermanentDelete } from './usePermanentDelete';

const BulkDeleteByIds = ({ type, selectedIds, onSuccess, onCancel }) => {
  const { deleteRecord, loading, error } = usePermanentDelete();
  const [confirmText, setConfirmText] = useState('');

  const handleBulkDelete = async () => {
    if (confirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    try {
      const endpoint = {
        patient: 'patients/bulk',
        appointment: 'appointments/bulk',
        contact: 'contacts/bulk'
      }[type];

      const result = await deleteRecord(endpoint, null, {
        body: JSON.stringify({ ids: selectedIds })
      });

      alert(`Successfully deleted ${result.deletedCount || result.deletedRecords?.patients || selectedIds.length} record(s)`);
      onSuccess();
    } catch (err) {
      console.error('Bulk delete error:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold text-red-600 mb-4">
          Permanently Delete {selectedIds.length} {type}(s)?
        </h2>
        <p className="text-gray-700 mb-4">
          This action cannot be undone. All related records will also be deleted.
        </p>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type <strong>DELETE</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="DELETE"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={loading || confirmText !== 'DELETE'}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Deleting...' : `Delete ${selectedIds.length} Record(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkDeleteByIds;
```

### 5. Usage Example

```javascript
import React, { useState } from 'react';
import PermanentDeleteDialog from './PermanentDeleteDialog';
import BulkDeleteComponent from './BulkDeleteComponent';
import BulkDeleteByIds from './BulkDeleteByIds';

const AdminPanel = () => {
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    type: null,
    id: null
  });

  const [bulkDeleteDialog, setBulkDeleteDialog] = useState({
    open: false,
    type: null,
    ids: []
  });

  const [selectedIds, setSelectedIds] = useState([]);

  const handleDeleteClick = (type, id) => {
    setDeleteDialog({
      open: true,
      type,
      id,
      title: `Permanently Delete ${type}?`,
      message: `This action cannot be undone. All related records will also be deleted.`
    });
  };

  const handleBulkDeleteClick = (type, ids) => {
    setBulkDeleteDialog({
      open: true,
      type,
      ids
    });
  };

  const handleDeleteSuccess = () => {
    // Refresh data, show success message, etc.
    console.log('Record deleted successfully');
    setSelectedIds([]);
  };

  return (
    <div>
      <h1>Admin Panel - Permanent Deletion</h1>
      
      {/* Selection Controls */}
      <div className="mb-4">
        <button
          onClick={() => handleBulkDeleteClick('patient', selectedIds)}
          disabled={selectedIds.length === 0}
          className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          Delete {selectedIds.length} Selected
        </button>
      </div>
      
      {/* Bulk Delete Sections */}
      <div className="space-y-4 mb-8">
        <BulkDeleteComponent type="appointment" status="cancelled" />
        <BulkDeleteComponent type="invoice" status="cancelled" />
        <BulkDeleteComponent type="contact" />
      </div>

      {/* Single Delete Dialog */}
      <PermanentDeleteDialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, type: null, id: null })}
        type={deleteDialog.type}
        id={deleteDialog.id}
        title={deleteDialog.title}
        message={deleteDialog.message}
        onSuccess={handleDeleteSuccess}
      />

      {/* Bulk Delete by IDs Dialog */}
      <BulkDeleteByIds
        open={bulkDeleteDialog.open}
        onClose={() => setBulkDeleteDialog({ open: false, type: null, ids: [] })}
        type={bulkDeleteDialog.type}
        selectedIds={bulkDeleteDialog.ids}
        onSuccess={handleDeleteSuccess}
        onCancel={() => setBulkDeleteDialog({ open: false, type: null, ids: [] })}
      />
    </div>
  );
};

export default AdminPanel;
```

## Security Considerations

1. **Admin Only**: All endpoints require admin role authentication
2. **Confirmation Required**: Frontend should always require explicit confirmation
3. **Audit Trail**: Consider logging all permanent deletions (not implemented in this API)
4. **Backup**: Ensure database backups are in place before bulk deletions
5. **Rate Limiting**: Consider implementing rate limiting for bulk delete operations

## Best Practices

1. **Always Confirm**: Require explicit confirmation (e.g., typing "DELETE")
2. **Show Statistics**: Use the stats endpoint to show what will be deleted
3. **Batch Operations**: For large deletions, consider implementing pagination
4. **Error Handling**: Always handle errors gracefully and show user-friendly messages
5. **Loading States**: Show loading indicators during deletion operations
6. **Success Feedback**: Confirm successful deletions to users

## Error Handling

```javascript
const handleDelete = async (endpoint, id) => {
  try {
    const response = await fetch(`/api/permanent-delete/${endpoint}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new Error('Invalid request: ' + data.message);
        case 401:
          throw new Error('Unauthorized: Please log in again');
        case 403:
          throw new Error('Forbidden: Admin access required');
        case 404:
          throw new Error('Record not found');
        case 500:
          throw new Error('Server error: ' + data.message);
        default:
          throw new Error(data.message || 'Delete failed');
      }
    }

    return data;
  } catch (error) {
    console.error('Delete error:', error);
    // Show error to user
    alert(error.message);
    throw error;
  }
};
```

## Summary

- **Base URL**: `/api/permanent-delete`
- **Authentication**: Bearer token (admin role required)
- **Operations**: Permanent, irreversible deletion
- **Use Cases**: Clean up test data, remove spam, delete cancelled records, etc.
- **Safety**: Always require confirmation, show statistics, handle errors gracefully

## Available Bulk Delete Methods

### For Appointments:
1. **Single Delete**: `DELETE /api/permanent-delete/appointments/:appointmentId`
2. **Bulk by Status**: `DELETE /api/permanent-delete/appointments?bulk=true&status=cancelled`
3. **Bulk by IDs**: `DELETE /api/permanent-delete/appointments/bulk` (with `{ ids: [...] }` in body)

### For Patients:
1. **Single Delete**: `DELETE /api/permanent-delete/patients/:patientId`
2. **Bulk by IDs**: `DELETE /api/permanent-delete/patients/bulk` (with `{ ids: [...] }` in body)

### For Contacts:
1. **Single Delete**: `DELETE /api/permanent-delete/contacts/:contactId`
2. **Bulk All Soft-Deleted**: `DELETE /api/permanent-delete/contacts?bulk=true`
3. **Bulk by IDs**: `DELETE /api/permanent-delete/contacts/bulk` (with `{ ids: [...] }` in body)

For questions or issues, refer to the API documentation or contact the backend team.


