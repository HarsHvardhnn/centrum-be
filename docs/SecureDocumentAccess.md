# Secure Document Access Guide

This document explains how to access secure documents that require signed URLs in the application.

## Overview

Some documents in the system (like visit cards) are stored with enhanced security using Cloudinary's signed URLs. These URLs expire after a set time, requiring a fresh URL to be generated when accessing the document.

## API Endpoints

### 1. Generate a Signed URL from Public ID

```
GET /api/secure-documents/signed-url?publicId=your_public_id
```

**Parameters:**
- `publicId` (query parameter): The Cloudinary public ID of the document
- `expiration` (query parameter, optional): Expiration time in minutes (default: 60)

**Example:**
```
GET /api/secure-documents/signed-url?publicId=hospital_app/secure_documents/document_name&expiration=30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/document_name.pdf",
    "publicId": "hospital_app/secure_documents/document_name",
    "expiresAt": 1625097600
  }
}
```

### 2. Get Patient Document with Fresh Signed URL

```
GET /api/secure-documents/patient/:patientId/document/:documentId
```

**Parameters:**
- `patientId` (path parameter): The ID of the patient
- `documentId` (path parameter): The ID of the document

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60c72b2f9b8e389c8c85e473",
    "documentId": "60c72b2f9b8e389c8c85e473",
    "fileName": "medical_report.pdf",
    "url": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/medical_report.pdf",
    "downloadUrl": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/medical_report.pdf",
    "preview": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/medical_report.pdf",
    "publicId": "hospital_app/secure_documents/medical_report",
    "requiresSignedUrl": true,
    "urlExpiresAt": 1625097600,
    // ... other document fields
  }
}
```

### 3. Get Appointment Report with Fresh Signed URL

```
GET /api/secure-documents/appointment/:appointmentId/report/:reportId
```

**Parameters:**
- `appointmentId` (path parameter): The ID of the appointment
- `reportId` (path parameter): The ID of the report

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60c72b2f9b8e389c8c85e473",
    "documentId": "60c72b2f9b8e389c8c85e473",
    "fileName": "visit_card.pdf",
    "url": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/visit_card.pdf",
    "downloadUrl": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/visit_card.pdf",
    "preview": "https://res.cloudinary.com/your-cloud/raw/upload/s--abc123--/hospital_app/secure_documents/visit_card.pdf",
    "publicId": "hospital_app/secure_documents/visit_card",
    "requiresSignedUrl": true,
    "urlExpiresAt": 1625097600,
    // ... other report fields
  }
}
```

## Frontend Integration

When displaying documents that might require signed URLs, follow these steps:

1. Check if the document has `requiresSignedUrl: true`
2. If yes, check if the URL has expired (compare `urlExpiresAt` with current time)
3. If expired, fetch a fresh URL using one of the endpoints above
4. Use the returned URL for displaying or downloading the document

### Example JavaScript Code

```javascript
// Function to get a fresh signed URL for a document
async function getFreshSignedUrl(publicId) {
  try {
    // Encode the publicId properly since it contains slashes
    const encodedPublicId = encodeURIComponent(publicId);
    
    const response = await fetch(`/api/secure-documents/signed-url?publicId=${encodedPublicId}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data.url;
    } else {
      console.error("Error fetching signed URL:", result.message);
      return null;
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

// Function to get a document with a fresh URL if needed
async function getSecureDocument(patientId, documentId) {
  // Check if we need to get a fresh URL
  const needsFreshUrl = document.requiresSignedUrl && 
    (!document.urlExpiresAt || document.urlExpiresAt * 1000 < Date.now());
  
  if (needsFreshUrl) {
    // Get a fresh signed URL
    const response = await fetch(`/api/secure-documents/patient/${patientId}/document/${documentId}`);
    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      console.error("Error fetching secure document:", result.message);
      return document;
    }
  }
  
  // Return the original document if no fresh URL is needed
  return document;
}
```

## Security Considerations

1. These endpoints require authentication and proper role authorization
2. Signed URLs expire after a set time (default: 60 minutes)
3. Even if someone obtains a signed URL, it will eventually expire
4. The public ID alone cannot be used to access the document without proper signing

## Testing with cURL

Here are example cURL commands to test the endpoints:

```bash
# Generate a signed URL from public ID
curl --location 'http://localhost:5000/api/secure-documents/signed-url?publicId=hospital_app/secure_documents/karta_wizyty_Jan_Kowalski_12_06_2023_CM7&expiration=30' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN_HERE'

# Get patient document with fresh signed URL
curl --location 'http://localhost:5000/api/secure-documents/patient/60c72b2f9b8e389c8c85e473/document/60c72b2f9b8e389c8c85e474' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN_HERE'

# Get appointment report with fresh signed URL
curl --location 'http://localhost:5000/api/secure-documents/appointment/60c72b2f9b8e389c8c85e475/report/60c72b2f9b8e389c8c85e476' \
--header 'Authorization: Bearer YOUR_JWT_TOKEN_HERE'
```

Replace `YOUR_JWT_TOKEN_HERE` with a valid JWT token for a user with appropriate permissions.