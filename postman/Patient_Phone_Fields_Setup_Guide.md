# Patient Phone Fields Collection Setup Guide

This guide will help you set up and use the Patient Phone Fields Collection to test the new `phoneCode` and `phone` fields in the patient APIs.

## Overview

The Patient Phone Fields Collection tests the following functionality:
- **Create Patient**: Create a new patient with `phoneCode` and `phone` fields
- **Get Patient by ID**: Retrieve patient information including phone fields
- **Update Patient**: Update patient's phone fields
- **Get Patients List**: Retrieve list of patients with phone fields
- **Get Patient Details**: Get detailed patient information including phone fields
- **Get Appointments List**: Retrieve appointments with patient phone information

## Setup Instructions

### 1. Import the Collection

1. Open Postman
2. Click "Import" button
3. Select the `Patient_Phone_Fields_Collection.postman_collection.json` file
4. The collection will be imported with all requests

### 2. Configure Environment Variables

Before running the tests, you need to set up environment variables:

1. **Create a new environment** in Postman
2. **Set the following variables**:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `baseUrl` | Your server base URL | `http://localhost:3000` |
| `patientId` | Test patient ID (will be set after creation) | Leave empty initially |
| `specializationId` | Valid specialization ID from your database | `507f1f77bcf86cd799439011` |
| `doctorId` | Valid doctor ID from your database | `507f1f77bcf86cd799439012` |

### 3. Get Required IDs

You'll need to obtain valid IDs for testing:

#### Get Specialization ID:
```bash
# Query your database or use existing API
GET {{baseUrl}}/api/specializations
```

#### Get Doctor ID:
```bash
# Query your database or use existing API
GET {{baseUrl}}/api/doctors
```

### 4. Test Workflow

#### Step 1: Create Patient
1. Set `specializationId` and `doctorId` variables
2. Run "Create Patient with Phone Fields" request
3. Copy the returned `patientId` from the response
4. Set the `patientId` environment variable with this value

#### Step 2: Verify Creation
1. Run "Get Patient by ID" request
2. Verify that `phoneCode` and `phone` fields are returned
3. Check that `phoneCode` defaults to "+48" if not provided

#### Step 3: Update Patient
1. Run "Update Patient Phone Fields" request
2. This will change `phoneCode` to "+49" and `phone` to "123456789"

#### Step 4: Verify Update
1. Run "Get Patient by ID" again
2. Verify that the phone fields have been updated

#### Step 5: Test List Endpoints
1. Run "Get Patients List" to verify `phoneCode` is included
2. Run "Get Patient Details" to verify phone fields in detailed view
3. Run "Get Appointments List" to verify phone fields in appointments

## Expected Responses

### Create Patient Response
```json
{
  "message": "Pacjent został pomyślnie utworzony",
  "patient": {
    "_id": "patient_id_here",
    "phoneCode": "+48",
    "phone": "800056148",
    "name": { "first": "Test", "last": "Patient Phone" },
    // ... other fields
  }
}
```

### Get Patient Response
```json
{
  "_id": "patient_id_here",
  "phoneCode": "+48",
  "phone": "800056148",
  "name": { "first": "Test", "last": "Patient Phone" },
  // ... other fields
}
```

### Update Patient Response
```json
{
  "message": "Dane pacjenta zostały zaktualizowane pomyślnie",
  "patient": {
    "_id": "patient_id_here",
    "phoneCode": "+49",
    "phone": "123456789",
    "name": { "first": "Updated", "last": "Test Patient Phone" },
    // ... other fields
  }
}
```

## Field Behavior

### phoneCode Field
- **Type**: String
- **Default**: "+48" (Polish country code)
- **Examples**: "+48", "+49", "+1", "+44"
- **Purpose**: Stores the country calling code for the phone number

### phone Field
- **Type**: String
- **Required**: Yes
- **Format**: Clean phone number without country code
- **Examples**: "800056148", "123456789"
- **Purpose**: Stores the actual phone number

### Backward Compatibility
- The existing `mobileNumber` field is still supported for backward compatibility
- If `phone` is not provided, the system falls back to `mobileNumber`
- Phone number cleaning (removing leading zeros) is still applied

## Error Handling

### Common Errors
1. **Missing Phone Number**: Returns 400 error if no phone number is provided
2. **Duplicate Phone**: Returns 409 error if phone number already exists
3. **Invalid Patient ID**: Returns 404 error for non-existent patients

### Validation
- Phone numbers are automatically cleaned (leading zeros removed)
- Country codes are preserved in the `phoneCode` field
- Phone uniqueness is enforced across all patients

## Testing Scenarios

### Scenario 1: Default Phone Code
- Create patient without specifying `phoneCode`
- Expected: `phoneCode` defaults to "+48"

### Scenario 2: Custom Phone Code
- Create patient with `phoneCode: "+49"`
- Expected: `phoneCode` is set to "+49"

### Scenario 3: Phone Number Update
- Update existing patient's phone number
- Expected: New phone number is saved and returned

### Scenario 4: Phone Code Update
- Update existing patient's phone code
- Expected: New phone code is saved and returned

## Troubleshooting

### Issue: Phone fields not appearing in response
**Solution**: Check if the patient model has been updated with the new fields

### Issue: phoneCode always shows "+48"
**Solution**: Verify that the field is being passed in the request body

### Issue: Phone validation errors
**Solution**: Ensure phone number format is correct and unique

### Issue: Collection import fails
**Solution**: Check Postman version compatibility (requires v2.1.0+)

## Next Steps

After testing the basic functionality:

1. **Integration Testing**: Test with your frontend application
2. **Database Verification**: Check that data is properly stored in MongoDB
3. **Performance Testing**: Test with large datasets
4. **Security Testing**: Verify field validation and sanitization

## Support

If you encounter issues:
1. Check the server logs for error messages
2. Verify that all environment variables are set correctly
3. Ensure the patient model has been updated with the new fields
4. Check that the API endpoints are accessible
