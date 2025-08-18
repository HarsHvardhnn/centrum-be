# Patient Phone Fields Documentation

## Overview

The Patient Phone Fields feature enhances the existing patient management system by introducing separate fields for country calling codes (`phoneCode`) and clean phone numbers (`phone`). This provides better internationalization support and cleaner data management while maintaining backward compatibility.

## Features

### New Fields

#### phoneCode
- **Type**: String
- **Default**: "+48" (Polish country code)
- **Purpose**: Stores the country calling code for the phone number
- **Examples**: "+48", "+49", "+1", "+44", "+33"

#### phone
- **Type**: String
- **Required**: Yes
- **Purpose**: Stores the clean phone number without country code
- **Examples**: "800056148", "123456789", "987654321"

### Enhanced Functionality

- **Automatic Phone Cleaning**: Removes leading zeros and formats phone numbers consistently
- **Country Code Support**: Flexible country code management for international patients
- **Backward Compatibility**: Existing `mobileNumber` field continues to work
- **Data Validation**: Phone number uniqueness enforcement across all patients
- **Flexible Input**: Accepts phone numbers with or without country codes

## API Changes

### Create Patient (`POST /api/patients`)

#### New Request Fields
```json
{
  "fullName": "Jan Kowalski",
  "email": "jan@example.com",
  "phoneCode": "+48",        // New field
  "phone": "800056148",      // New field (alternative to mobileNumber)
  "mobileNumber": "800056148", // Still supported for backward compatibility
  "sex": "Male",
  "dateOfBirth": "1990-01-01"
}
```

#### Response Changes
```json
{
  "message": "Pacjent został pomyślnie utworzony",
  "patient": {
    "_id": "patient_id_here",
    "phoneCode": "+48",
    "phone": "800056148",
    "name": { "first": "Jan", "last": "Kowalski" },
    // ... other fields
  }
}
```

### Update Patient (`PUT /api/patients/:id`)

#### New Request Fields
```json
{
  "phoneCode": "+49",
  "phone": "123456789",
  "fullName": "Updated Name"
}
```

#### Response Changes
```json
{
  "message": "Dane pacjenta zostały zaktualizowane pomyślnie",
  "patient": {
    "_id": "patient_id_here",
    "phoneCode": "+49",
    "phone": "123456789",
    "name": { "first": "Updated", "last": "Name" },
    // ... other fields
  }
}
```

### Get Patient by ID (`GET /api/patients/:id`)

#### Response Changes
```json
{
  "_id": "patient_id_here",
  "phoneCode": "+48",
  "phone": "800056148",
  "name": { "first": "Jan", "last": "Kowalski" },
  // ... other fields
}
```

### Get Patients List (`GET /api/patients/list`)

#### Response Changes
```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "pages": 1,
  "currentPage": 1,
  "patients": [
    {
      "id": "P-1234567890",
      "name": "Jan Kowalski",
      "email": "jan@example.com",
      "phone": "800056148",
      "phoneCode": "+48",        // New field
      // ... other fields
    }
  ]
}
```

### Get Patient Details (`GET /api/patients/details/:id`)

#### Response Changes
```json
{
  "patientData": {
    "id": "patient_id_here",
    "name": "Jan Kowalski",
    "email": "jan@example.com",
    "phone": "800056148",
    "phoneCode": "+48",        // New field
    // ... other fields
  },
  // ... other data
}
```

### Get Appointments List (`GET /api/patients/appointments`)

#### Response Changes
```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "pages": 1,
  "currentPage": 1,
  "appointments": [
    {
      "id": "appointment_id_here",
      "name": "Jan Kowalski",
      "email": "jan@example.com",
      "phone": "800056148",
      "phoneCode": "+48",        // New field
      // ... other fields
    }
  ]
}
```

## Database Schema Changes

### Patient Model Updates

The patient schema has been extended with the new `phoneCode` field:

```javascript
// models/user-entity/patient.js
const patientSchema = new mongoose.Schema({
  // ... existing fields
  
  // Contact and address
  address: String,
  city: String,
  district: String,
  state: String,
  country: String,
  pinCode: String,
  alternateContact: String,
  phoneFormatted: String,
  phoneCode: String, // New field for phone country code
  
  // ... other fields
});
```

### Migration Notes

- **No Database Migration Required**: The new field is optional and will be added automatically
- **Existing Data**: Current patients will have `phoneCode` defaulting to "+48"
- **Backward Compatibility**: All existing phone number functionality continues to work

## Field Behavior

### Phone Number Processing

#### Input Handling
1. **With phoneCode**: `phoneCode: "+48", phone: "800056148"`
2. **Without phoneCode**: `phone: "800056148"` → defaults to `phoneCode: "+48"`
3. **Legacy mobileNumber**: `mobileNumber: "800056148"` → processed as `phone`

#### Automatic Cleaning
- Leading zeros are removed: `"0800056148"` → `"800056148"`
- Country codes are preserved in `phoneCode`
- Phone numbers are trimmed of whitespace

#### Validation Rules
- `phone` field is required
- `phoneCode` defaults to "+48" if not provided
- Phone numbers must be unique across all patients
- Email validation remains unchanged

### Default Values

```javascript
// Default phoneCode if not provided
phoneCode: phoneCode || "+48"

// Phone number processing priority
let phoneNumber = phone || req.body.mobileNumber || '';
```

## Use Cases

### 1. Polish Patients (Default)
```json
{
  "fullName": "Jan Kowalski",
  "phone": "800056148"
  // phoneCode defaults to "+48"
}
```

### 2. International Patients
```json
{
  "fullName": "John Smith",
  "phoneCode": "+1",
  "phone": "5551234567"
}
```

### 3. European Patients
```json
{
  "fullName": "Hans Mueller",
  "phoneCode": "+49",
  "phone": "301234567"
}
```

### 4. Legacy Support
```json
{
  "fullName": "Legacy Patient",
  "mobileNumber": "800056148"
  // Automatically processed as phone field
}
```

## Implementation Details

### Controller Updates

#### createPatient Function
- Added `phoneCode` and `phone` to destructured request body
- Enhanced phone number handling logic
- Added `phoneCode` to new patient object creation
- Maintained backward compatibility with `mobileNumber`

#### updatePatient Function
- Added `phoneCode` and `phone` to destructured request body
- Enhanced phone number update logic
- Added phone fields to update data object
- Maintained existing validation and error handling

#### Get Functions
- All GET endpoints now return `phoneCode` field
- `phoneCode` defaults to "+48" if not set
- Populate queries updated to include phone fields

### Model Updates

#### Patient Schema
- Added `phoneCode: String` field
- Field is optional with no default value
- No validation constraints (allows any string)

#### Pre-save Hooks
- Existing phone cleaning logic preserved
- New fields integrated with existing validation
- No breaking changes to existing functionality

## Testing

### Test Scripts
- `scripts/test-patient-phone-fields.js` - Comprehensive testing of all phone field functionality

### Postman Collections
- `postman/Patient_Phone_Fields_Collection.postman_collection.json` - Ready-to-use API testing

### Test Scenarios

#### 1. Create Patient Tests
- Create with `phoneCode` and `phone`
- Create with only `phone` (default `phoneCode`)
- Create with legacy `mobileNumber`
- Create with invalid phone data

#### 2. Update Patient Tests
- Update `phoneCode` only
- Update `phone` only
- Update both fields
- Update with invalid data

#### 3. Get Patient Tests
- Verify `phoneCode` appears in all responses
- Verify default values are correct
- Verify field formatting

#### 4. Validation Tests
- Duplicate phone number handling
- Missing phone number handling
- Invalid phone format handling

## Error Handling

### Common Error Scenarios

#### 1. Missing Phone Number
```json
{
  "error": "Numer telefonu jest wymagany"
}
```

#### 2. Duplicate Phone Number
```json
{
  "message": "Pacjent z tym numerem telefonu już istnieje",
  "patient": { /* existing patient data */ }
}
```

#### 3. Invalid Patient ID
```json
{
  "message": "Nie znaleziono pacjenta"
}
```

### Error Response Format
All error responses maintain the existing format for consistency:
- **400**: Bad Request (validation errors)
- **404**: Not Found (patient not found)
- **409**: Conflict (duplicate phone number)
- **500**: Internal Server Error

## Performance Considerations

### Database Impact
- **Minimal**: Single string field addition
- **Indexing**: No additional indexes required
- **Query Performance**: No impact on existing queries

### API Performance
- **Response Size**: Minimal increase due to single field
- **Processing Time**: Negligible impact
- **Memory Usage**: Minimal increase

## Security Considerations

### Data Validation
- Phone numbers are sanitized (leading zeros removed)
- No SQL injection risks (MongoDB)
- Input validation maintains existing security

### Privacy
- Phone numbers remain encrypted as per existing implementation
- No additional privacy concerns
- GDPR compliance maintained

## Backward Compatibility

### Existing APIs
- All existing endpoints continue to work unchanged
- `mobileNumber` field is still supported
- Response formats remain compatible

### Database
- No migration required
- Existing data remains accessible
- No breaking changes to queries

### Frontend Integration
- Existing frontend code continues to work
- New fields are optional in responses
- Gradual migration to new fields possible

## Future Enhancements

### Planned Features
1. **Phone Number Formatting**: Automatic formatting based on country code
2. **International Validation**: Country-specific phone number validation
3. **Bulk Import**: Support for importing patients with phone codes
4. **Phone Number Search**: Enhanced search by country code

### API Extensions
1. **Phone Number Validation**: Endpoint to validate phone numbers
2. **Country Code Management**: CRUD operations for supported country codes
3. **Phone Number Statistics**: Analytics on phone number usage

## Troubleshooting

### Common Issues

#### 1. Phone Fields Not Appearing
**Symptoms**: `phoneCode` field missing from responses
**Solution**: Verify patient model has been updated with new field

#### 2. Default Phone Code Not Working
**Symptoms**: `phoneCode` always shows "+48"
**Solution**: Check if field is being passed in request body

#### 3. Phone Validation Errors
**Symptoms**: Phone number validation failures
**Solution**: Ensure phone format is correct and unique

#### 4. Database Connection Issues
**Symptoms**: Patient creation/update failures
**Solution**: Verify MongoDB connection and schema updates

### Debug Steps
1. Check server logs for error messages
2. Verify request body contains correct fields
3. Test with minimal data to isolate issues
4. Verify database schema has been updated

## Support and Maintenance

### Documentation
- This document provides comprehensive implementation details
- API examples included for all endpoints
- Error handling documented with examples

### Testing
- Test scripts provided for validation
- Postman collection ready for immediate use
- Comprehensive test scenarios covered

### Maintenance
- Regular validation of phone field functionality
- Monitor for any performance impacts
- Update documentation as needed

## Conclusion

The Patient Phone Fields feature provides a robust, backward-compatible enhancement to the existing patient management system. It introduces better internationalization support while maintaining all existing functionality and performance characteristics.

The implementation follows best practices for API design, database schema management, and error handling, ensuring a smooth integration experience for both developers and end users.
