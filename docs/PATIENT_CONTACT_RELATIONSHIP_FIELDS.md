# Patient Contact Person Relationship Fields

## Overview

Two new nullable fields have been added to the patient model to store the relationship information for contact persons:

- `contactPerson1Relationship` - Relationship of the first contact person to the patient
- `contactPerson2Relationship` - Relationship of the second contact person to the patient

Additionally, the phone-related fields have been updated to use more descriptive names:

- `contactPerson1PhoneCode` - Phone country code for first contact person (e.g., "+48")
- `contactPerson1Phone` - Phone number for first contact person
- `contactPerson1PhoneFull` - Full phone number with country code for first contact person
- `contactPerson2PhoneCode` - Phone country code for second contact person (e.g., "+48")
- `contactPerson2Phone` - Phone number for second contact person
- `contactPerson2PhoneFull` - Full phone number with country code for second contact person

## New Fields

### Field Details

| Field Name | Type | Required | Default | Description |
|------------|------|----------|---------|-------------|
| `contactPerson1Relationship` | String | No | `""` | Relationship of first contact person to patient |
| `contactPerson2Relationship` | String | No | `""` | Relationship of second contact person to patient |
| `contactPerson1PhoneCode` | String | No | `""` | Phone country code for first contact person |
| `contactPerson1Phone` | String | No | `""` | Phone number for first contact person |
| `contactPerson1PhoneFull` | String | No | `""` | Full phone number with country code for first contact person |
| `contactPerson2PhoneCode` | String | No | `""` | Phone country code for second contact person |
| `contactPerson2Phone` | String | No | `""` | Phone number for second contact person |
| `contactPerson2PhoneFull` | String | No | `""` | Full phone number with country code for second contact person |

### Field Characteristics

- **Nullable**: All fields are optional and can be left empty
- **String Type**: Accepts any text value
- **No Validation**: No specific enum values or format restrictions
- **Default Value**: Empty string (`""`) if not provided

## API Endpoints

### 1. Get Patient Details

**Endpoint**: `GET /api/patients/details/:id`

**Response**: The new fields are included in the `patientData` object:

```json
{
  "patientData": {
    // ... existing fields ...
    "contactPerson1Name": "John Doe",
    "contactPerson1PhoneCode": "+48",
    "contactPerson1Phone": "123456789",
    "contactPerson1PhoneFull": "+48123456789",
    "contactPerson1Address": "123 Main St",
    "contactPerson1Pesel": "12345678901",
    "contactPerson1Relationship": "Father",
    "contactPerson2Name": "Jane Doe",
    "contactPerson2PhoneCode": "+48",
    "contactPerson2Phone": "987654321",
    "contactPerson2PhoneFull": "+48987654321",
    "contactPerson2Address": "456 Oak Ave",
    "contactPerson2Pesel": "98765432109",
    "contactPerson2Relationship": "Mother"
  }
}
```

### 2. Create Patient

**Endpoint**: `POST /api/patients/`

**Request Body**: Include the new fields in the request:

```json
{
  "fullName": "Patient Name",
  "email": "patient@example.com",
  "phone": "123456789",
  // ... other required fields ...
  "contactPerson1Name": "John Doe",
  "contactPerson1PhoneCode": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1PhoneFull": "+48123456789",
  "contactPerson1Relationship": "Father",
  "contactPerson2Name": "Jane Doe",
  "contactPerson2PhoneCode": "+48",
  "contactPerson2Phone": "987654321",
  "contactPerson2PhoneFull": "+48987654321",
  "contactPerson2Relationship": "Mother"
}
```

### 3. Update Patient

**Endpoint**: `PUT /api/patients/:id`

**Request Body**: Update the relationship and phone fields:

```json
{
  "contactPerson1PhoneCode": "+1",
  "contactPerson1Phone": "5551234567",
  "contactPerson1PhoneFull": "+15551234567",
  "contactPerson1Relationship": "Guardian",
  "contactPerson2PhoneCode": "+44",
  "contactPerson2Phone": "2071234567",
  "contactPerson2PhoneFull": "+442071234567",
  "contactPerson2Relationship": "Emergency Contact"
}
```

## Database Schema

### Patient Model Update

The patient schema has been updated to include the new fields:

```javascript
// models/user-entity/patient.js
const patientSchema = new mongoose.Schema({
  // ... existing fields ...
  
  // Additional contact person fields
  contactPerson1Name: String,
  contactPerson1PhoneCode: String,    // NEW FIELD NAME
  contactPerson1Phone: String,
  contactPerson1PhoneFull: String,    // NEW FIELD
  contactPerson1Address: String,
  contactPerson1Pesel: String,
  contactPerson1Relationship: String, // NEW FIELD
  contactPerson2Name: String,
  contactPerson2PhoneCode: String,    // NEW FIELD NAME
  contactPerson2Phone: String,
  contactPerson2PhoneFull: String,    // NEW FIELD
  contactPerson2Address: String,
  contactPerson2Pesel: String,
  contactPerson2Relationship: String, // NEW FIELD
  
  // ... other fields ...
});
```

## Use Cases

### 1. Family Relationships with Phone Numbers
```json
{
  "contactPerson1PhoneCode": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1PhoneFull": "+48123456789",
  "contactPerson1Relationship": "Father",
  "contactPerson2PhoneCode": "+48",
  "contactPerson2Phone": "987654321",
  "contactPerson2PhoneFull": "+48987654321",
  "contactPerson2Relationship": "Mother"
}
```

### 2. International Contact Persons
```json
{
  "contactPerson1PhoneCode": "+1",
  "contactPerson1Phone": "5551234567",
  "contactPerson1PhoneFull": "+15551234567",
  "contactPerson1Relationship": "Legal Guardian",
  "contactPerson2PhoneCode": "+44",
  "contactPerson2Phone": "2071234567",
  "contactPerson2PhoneFull": "+442071234567",
  "contactPerson2Relationship": "Power of Attorney"
}
```

### 3. Emergency Contacts
```json
{
  "contactPerson1PhoneCode": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1PhoneFull": "+48123456789",
  "contactPerson1Relationship": "Emergency Contact",
  "contactPerson2PhoneCode": "+48",
  "contactPerson2Phone": "987654321",
  "contactPerson2PhoneFull": "+48987654321",
  "contactPerson2Relationship": "Secondary Contact"
}
```

### 4. Medical Representatives
```json
{
  "contactPerson1PhoneCode": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1PhoneFull": "+48123456789",
  "contactPerson1Relationship": "Primary Caregiver",
  "contactPerson2PhoneCode": "+48",
  "contactPerson2Phone": "987654321",
  "contactPerson2PhoneFull": "+48987654321",
  "contactPerson2Relationship": "Medical Proxy"
}
```

## Migration Notes

### Database Changes
- **No Migration Required**: New fields are added automatically
- **Field Renaming**: `contactPerson1PhonePrefix` → `contactPerson1PhoneCode`
- **New Fields**: `contactPerson1PhoneFull` and `contactPerson2PhoneFull` added
- **Existing Data**: Current patients will have empty strings for these fields
- **Backward Compatibility**: All existing functionality continues to work

### API Changes
- **New Fields**: Added to GET `/api/patients/details/:id` response
- **Field Renaming**: Phone prefix fields now use "PhoneCode" naming
- **Optional Fields**: Can be included in POST and PUT requests
- **No Breaking Changes**: Existing API calls continue to work

## Frontend Integration

### Displaying Contact Information with Phone Numbers
```javascript
// Example frontend code to display contact person with phone
const displayContactInfo = (patient) => {
  if (patient.contactPerson1Name && patient.contactPerson1PhoneFull) {
    return `${patient.contactPerson1Name} (${patient.contactPerson1Relationship}) - ${patient.contactPerson1PhoneFull}`;
  }
  return patient.contactPerson1Name || 'No contact person';
};

// Display phone number with country code
const displayPhoneWithCode = (phoneCode, phone) => {
  if (phoneCode && phone) {
    return `${phoneCode} ${phone}`;
  }
  return phone || 'No phone number';
};
```

### Form Handling
```javascript
// Example form submission with new phone fields
const submitPatientForm = async (formData) => {
  const patientData = {
    // ... other fields ...
    contactPerson1PhoneCode: formData.contactPerson1PhoneCode || '',
    contactPerson1Phone: formData.contactPerson1Phone || '',
    contactPerson1PhoneFull: formData.contactPerson1PhoneFull || '',
    contactPerson1Relationship: formData.contactPerson1Relationship || '',
    contactPerson2PhoneCode: formData.contactPerson2PhoneCode || '',
    contactPerson2Phone: formData.contactPerson2Phone || '',
    contactPerson2PhoneFull: formData.contactPerson2PhoneFull || '',
    contactPerson2Relationship: formData.contactPerson2Relationship || ''
  };
  
  await createPatient(patientData);
};
```

## Validation and Constraints

### Current Implementation
- **No Validation**: Fields accept any string value
- **No Length Limits**: No maximum character restrictions
- **No Format Requirements**: No specific format enforcement
- **Phone Number Format**: No automatic formatting or validation

### Future Considerations
- **Phone Validation**: Could add phone number format validation
- **Country Code Validation**: Could restrict to valid country codes
- **Length Limits**: Could add maximum character constraints
- **Enum Values**: Could restrict relationship types to predefined values

## Examples

### Complete Contact Person Data
```json
{
  "contactPerson1Name": "John Smith",
  "contactPerson1PhoneCode": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1PhoneFull": "+48123456789",
  "contactPerson1Address": "123 Main Street, Warsaw",
  "contactPerson1Pesel": "12345678901",
  "contactPerson1Relationship": "Father",
  "contactPerson2Name": "Mary Smith",
  "contactPerson2PhoneCode": "+48",
  "contactPerson2Phone": "987654321",
  "contactPerson2PhoneFull": "+48987654321",
  "contactPerson2Address": "456 Oak Avenue, Krakow",
  "contactPerson2Pesel": "98765432109",
  "contactPerson2Relationship": "Mother"
}
```

### Minimal Contact Person Data
```json
{
  "contactPerson1Name": "John Doe",
  "contactPerson1PhoneCode": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1PhoneFull": "+48123456789",
  "contactPerson1Relationship": "Emergency Contact"
}
```

### International Contact Person
```json
{
  "contactPerson1Name": "Jane Smith",
  "contactPerson1PhoneCode": "+1",
  "contactPerson1Phone": "5551234567",
  "contactPerson1PhoneFull": "+15551234567",
  "contactPerson1Relationship": "Legal Guardian"
}
```

## Testing

### Test Scenarios
1. **Create Patient with Phone Fields**: Verify all phone fields are saved
2. **Update Phone Fields**: Verify fields can be modified
3. **Empty Phone Fields**: Verify empty strings are handled
4. **Null Phone Fields**: Verify null values are handled
5. **Missing Phone Fields**: Verify default empty strings are used
6. **International Phone Numbers**: Verify different country codes work

### API Testing
```bash
# Test creating patient with new phone fields
curl -X POST /api/patients/ \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Patient",
    "email": "test@example.com",
    "phone": "123456789",
    "contactPerson1PhoneCode": "+48",
    "contactPerson1Phone": "123456789",
    "contactPerson1PhoneFull": "+48123456789",
    "contactPerson1Relationship": "Father",
    "contactPerson2PhoneCode": "+1",
    "contactPerson2Phone": "5551234567",
    "contactPerson2PhoneFull": "+15551234567",
    "contactPerson2Relationship": "Mother"
  }'

# Test getting patient details
curl -X GET /api/patients/details/{patient_id}

# Test updating phone fields
curl -X PUT /api/patients/{patient_id} \
  -H "Content-Type: application/json" \
  -d '{
    "contactPerson1PhoneCode": "+44",
    "contactPerson1Phone": "2071234567",
    "contactPerson1PhoneFull": "+442071234567",
    "contactPerson1Relationship": "Guardian"
  }'
```

## Support and Troubleshooting

### Common Issues
1. **Field Not Appearing**: Ensure the field is included in the request body
2. **Empty Values**: Check if the field is being sent as an empty string vs undefined
3. **Database Issues**: Verify the patient model has been updated
4. **Phone Format**: Ensure phone numbers are in the correct format

### Debugging
- Check server logs for any validation errors
- Verify the patient model includes the new fields
- Test with a simple API call to isolate the issue
- Check if phone fields are being sent correctly from frontend

### Field Mapping
- **Old Field**: `contactPerson1PhonePrefix` → **New Field**: `contactPerson1PhoneCode`
- **New Field**: `contactPerson1PhoneFull` (stores complete phone number with country code)
- **Same Field**: `contactPerson1Phone` (stores just the phone number)
