# Patient Bill API Documentation

This document outlines the API endpoints for managing patient bills in the healthcare management system.

## API Endpoints

### 1. Generate Bill for Appointment

Generates a new bill for a specific appointment and updates the appointment status to "completed".

- **URL**: `/patient-bills/generate/:appointmentId`
- **Method**: `POST`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor, Receptionist
- **Request Parameters**:
  - `appointmentId` (path parameter): ID of the appointment

- **Request Body**:
  ```json
  {
    "services": [
      {
        "serviceId": "681b8cefbf1c53012db05f76",
        "title": "Consultation",
        "price": "1200",
        "status": "active"
      }
    ],
    "subtotal": 1200,
    "taxPercentage": 18,
    "taxAmount": 216,
    "discount": 0,
    "additionalCharges": 0,
    "additionalChargeNote": "",
    "totalAmount": "1416.00",
    "paymentMethod": "cash",
    "notes": "Payment received in full"
  }
  ```

- **Success Response**:
  - **Code**: 201 Created
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Bill generated successfully",
      "data": {
        // Bill object
      }
    }
    ```

- **Error Responses**:
  - **Code**: 404 Not Found
    ```json
    {
      "success": false,
      "message": "Appointment not found"
    }
    ```
  - **Code**: 400 Bad Request
    ```json
    {
      "success": false,
      "message": "Bill already exists for this appointment"
    }
    ```

### 2. Get All Bills

Retrieves all bills with pagination, sorting, and filtering options.

- **URL**: `/patient-bills/all`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor, Receptionist
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Number of items per page (default: 10)
  - `sortBy` (optional): Field to sort by (default: "billedAt")
  - `sortOrder` (optional): Sort order (1 for ascending, -1 for descending, default: -1)
  - `patientId` (optional): Filter by patient ID
  - `startDate` (optional): Filter bills after this date (format: YYYY-MM-DD)
  - `endDate` (optional): Filter bills before this date (format: YYYY-MM-DD)
  - `paymentStatus` (optional): Filter by payment status ("pending", "paid", "partial", "cancelled")

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": [
        // Array of bill objects with populated patient, appointment, and billedBy fields
      ],
      "pagination": {
        "totalBills": 100,
        "totalPages": 10,
        "currentPage": 1,
        "limit": 10
      }
    }
    ```

### 3. Get Patient Bills

Retrieves all bills for a specific patient.

- **URL**: `/patient-bills/patient/:patientId`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor, Receptionist, Patient (own bills only)
- **Path Parameters**:
  - `patientId`: ID of the patient
- **Query Parameters**:
  - `page` (optional): Page number (default: 1)
  - `limit` (optional): Number of items per page (default: 10)
  - `sortBy` (optional): Field to sort by (default: "billedAt")
  - `sortOrder` (optional): Sort order (1 for ascending, -1 for descending, default: -1)

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": [
        // Array of bill objects with populated appointment and billedBy fields
      ],
      "pagination": {
        "totalBills": 25,
        "totalPages": 3,
        "currentPage": 1,
        "limit": 10
      }
    }
    ```

### 4. Get Bill by ID

Retrieves a single bill by its ID.

- **URL**: `/patient-bills/:billId`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor, Receptionist, Patient (own bills only)
- **Path Parameters**:
  - `billId`: ID of the bill

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": {
        // Bill object with populated patient, appointment (with doctor), and billedBy fields
      }
    }
    ```

- **Error Response**:
  - **Code**: 404 Not Found
    ```json
    {
      "success": false,
      "message": "Bill not found"
    }
    ```

### 5. Update Bill Payment Status

Updates the payment status of a bill.

- **URL**: `/patient-bills/:billId/payment-status`
- **Method**: `PATCH`
- **Auth Required**: Yes
- **Permissions**: Admin, Receptionist
- **Path Parameters**:
  - `billId`: ID of the bill
- **Request Body**:
  ```json
  {
    "paymentStatus": "paid",
    "paymentMethod": "card",
    "notes": "Payment received via credit card"
  }
  ```

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Bill payment status updated successfully",
      "data": {
        // Updated bill object
      }
    }
    ```

- **Error Response**:
  - **Code**: 404 Not Found
    ```json
    {
      "success": false,
      "message": "Bill not found"
    }
    ```

### 6. Delete Bill

Soft deletes a bill by setting its `isDeleted` flag to true.

- **URL**: `/patient-bills/:billId`
- **Method**: `DELETE`
- **Auth Required**: Yes
- **Permissions**: Admin
- **Path Parameters**:
  - `billId`: ID of the bill

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Bill deleted successfully"
    }
    ```

- **Error Response**:
  - **Code**: 404 Not Found
    ```json
    {
      "success": false,
      "message": "Bill not found"
    }
    ```

### 7. Get Bill Statistics

Retrieves statistical information about bills for analytics.

- **URL**: `/patient-bills/statistics/summary`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor
- **Query Parameters**:
  - `startDate` (optional): Filter statistics after this date (format: YYYY-MM-DD)
  - `endDate` (optional): Filter statistics before this date (format: YYYY-MM-DD)

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "data": {
        "totalRevenue": 50000,
        "paymentStatusCounts": {
          "pending": 10,
          "paid": 85,
          "partial": 3,
          "cancelled": 2
        }
      }
    }
    ```

### 8. Generate Invoice PDF

Generates a professionally formatted PDF invoice for a specific bill.

- **URL**: `/patient-bills/:billId/invoice`
- **Method**: `GET`
- **Auth Required**: Yes
- **Permissions**: Admin, Doctor, Receptionist, Patient (own invoices only)
- **Path Parameters**:
  - `billId`: ID of the bill for which to generate an invoice

- **Success Response**:
  - **Code**: 200 OK
  - **Content**:
    ```json
    {
      "success": true,
      "message": "Invoice generated successfully",
      "data": {
        "invoiceUrl": "https://res.cloudinary.com/your-cloud-name/raw/upload/v1234567890/invoices/invoice_60f1a1b2c3d4e5f6a7b8c9d0_abcdef123456.pdf",
        "billId": "60f1a1b2c3d4e5f6a7b8c9d0"
      }
    }
    ```

- **Error Responses**:
  - **Code**: 404 Not Found
    ```json
    {
      "success": false,
      "message": "Bill not found"
    }
    ```
  - **Code**: 400 Bad Request
    ```json
    {
      "success": false,
      "message": "Invalid bill ID format"
    }
    ```

## Data Models

### Patient Bill Model

```javascript
{
  patient: ObjectId,         // Reference to User (patient)
  appointment: ObjectId,     // Reference to Appointment
  services: [                // Array of services included in the bill
    {
      serviceId: ObjectId,   // Reference to Service
      title: String,         // Service name
      price: String,         // Service price
      status: String         // Status of the service (active, completed, cancelled)
    }
  ],
  subtotal: Number,          // Sum of all service prices
  taxPercentage: Number,     // Tax percentage applied
  taxAmount: Number,         // Calculated tax amount
  discount: Number,          // Discount amount
  additionalCharges: Number, // Any additional charges
  additionalChargeNote: String, // Note for additional charges
  totalAmount: String,       // Final bill amount (subtotal + tax - discount + additionalCharges)
  paymentStatus: String,     // pending, paid, partial, cancelled
  paymentMethod: String,     // cash, card, online, insurance, other
  billedAt: Date,            // Date when bill was generated
  billedBy: ObjectId,        // Reference to User who generated the bill
  notes: String,             // Additional notes
  isDeleted: Boolean,        // Soft delete flag
  createdAt: Date,           // Auto-generated timestamp
  updatedAt: Date            // Auto-generated timestamp
}
```

## Usage Examples

### Example 1: Generating a Bill for an Appointment

```javascript
// Frontend code example
async function generateBill(appointmentId, billData) {
  try {
    const response = await fetch(`/patient-bills/generate/${appointmentId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(billData)
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Bill generated successfully:', data.data);
      // Update UI or redirect
    } else {
      console.error('Error generating bill:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}

// Example bill data
const billData = {
  services: [
    {
      serviceId: "681b8cefbf1c53012db05f76",
      title: "Consultation",
      price: "1200",
      status: "active"
    },
    {
      serviceId: "681b8d10bf1c53012db05f78",
      title: "Blood Test",
      price: "500",
      status: "active"
    }
  ],
  subtotal: 1700,
  taxPercentage: 18,
  taxAmount: 306,
  discount: 100,
  additionalCharges: 0,
  additionalChargeNote: "",
  totalAmount: "1906.00",
  paymentMethod: "card",
  notes: "Patient requested itemized receipt"
};
```

### Example 2: Fetching Patient Bills

```javascript
// Frontend code example
async function getPatientBills(patientId, page = 1) {
  try {
    const response = await fetch(`/patient-bills/patient/${patientId}?page=${page}&limit=10&sortBy=billedAt&sortOrder=-1`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Patient bills:', data.data);
      console.log('Pagination info:', data.pagination);
      // Update UI with bills data
    } else {
      console.error('Error fetching bills:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}
```

### Example 3: Generating an Invoice for a Bill

```javascript
// Frontend code example
async function generateInvoice(billId) {
  try {
    const response = await fetch(`/patient-bills/${billId}/invoice`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Invoice generated successfully');
      
      // Open the invoice in a new tab
      window.open(data.data.invoiceUrl, '_blank');
      
      // Or provide a download link
      const downloadLink = document.createElement('a');
      downloadLink.href = data.data.invoiceUrl;
      downloadLink.download = `Invoice_${billId}.pdf`;
      downloadLink.click();
    } else {
      console.error('Error generating invoice:', data.message);
    }
  } catch (error) {
    console.error('API request failed:', error);
  }
}
```

## Error Handling

All API endpoints follow a consistent error handling pattern:

1. **Not Found errors** (404) are returned when a requested resource doesn't exist
2. **Bad Request errors** (400) are returned for invalid input data
3. **Unauthorized errors** (401) are returned for unauthenticated requests
4. **Forbidden errors** (403) are returned when a user doesn't have permission
5. **Server errors** (500) are returned for internal server issues

All error responses include:
- `success: false`
- `message`: A human-readable error message
- `error`: (optional) Additional error details 