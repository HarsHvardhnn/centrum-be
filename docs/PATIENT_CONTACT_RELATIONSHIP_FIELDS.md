# Patient Contact Person Relationship Fields

## Overview

Two new nullable fields have been added to the patient model to store the relationship information for contact persons:

- `contactPerson1Relationship` - Relationship of the first contact person to the patient
- `contactPerson2Relationship` - Relationship of the second contact person to the patient

## New Fields

### Field Details

| Field Name | Type | Required | Default | Description |
|------------|------|----------|---------|-------------|
| `contactPerson1Relationship` | String | No | `""` | Relationship of first contact person to patient |
| `contactPerson2Relationship` | String | No | `""` | Relationship of second contact person to patient |

### Field Characteristics

- **Nullable**: Both fields are optional and can be left empty
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
    "contactPerson1Phone": "123456789",
    "contactPerson1Address": "123 Main St",
    "contactPerson1Pesel": "12345678901",
    "contactPerson1Relationship": "Father",
    "contactPerson2Name": "Jane Doe",
    "contactPerson2Phone": "987654321",
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
  "contactPerson1Relationship": "Father",
  "contactPerson2Name": "Jane Doe",
  "contactPerson2Relationship": "Mother"
}
```

### 3. Update Patient

**Endpoint**: `PUT /api/patients/:id`

**Request Body**: Update the relationship fields:

```json
{
  "contactPerson1Relationship": "Guardian",
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
  contactPerson1PhonePrefix: String,
  contactPerson1Phone: String,
  contactPerson1Address: String,
  contactPerson1Pesel: String,
  contactPerson1Relationship: String,  // NEW FIELD
  contactPerson2Name: String,
  contactPerson2PhonePrefix: String,
  contactPerson2Phone: String,
  contactPerson2Address: String,
  contactPerson2Pesel: String,
  contactPerson2Relationship: String,  // NEW FIELD
  
  // ... other fields ...
});
```

## Use Cases

### 1. Family Relationships
```json
{
  "contactPerson1Relationship": "Father",
  "contactPerson2Relationship": "Mother"
}
```

### 2. Legal Relationships
```json
{
  "contactPerson1Relationship": "Legal Guardian",
  "contactPerson2Relationship": "Power of Attorney"
}
```

### 3. Emergency Contacts
```json
{
  "contactPerson1Relationship": "Emergency Contact",
  "contactPerson2Relationship": "Secondary Contact"
}
```

### 4. Medical Representatives
```json
{
  "contactPerson1Relationship": "Primary Caregiver",
  "contactPerson2Relationship": "Medical Proxy"
}
```

## Migration Notes

### Database Changes
- **No Migration Required**: New fields are added automatically
- **Existing Data**: Current patients will have empty strings for these fields
- **Backward Compatibility**: All existing functionality continues to work

### API Changes
- **New Fields**: Added to GET `/api/patients/details/:id` response
- **Optional Fields**: Can be included in POST and PUT requests
- **No Breaking Changes**: Existing API calls continue to work

## Frontend Integration

### Displaying Relationship Information
```javascript
// Example frontend code to display relationship
const displayContactInfo = (patient) => {
  if (patient.contactPerson1Name && patient.contactPerson1Relationship) {
    return `${patient.contactPerson1Name} (${patient.contactPerson1Relationship})`;
  }
  return patient.contactPerson1Name || 'No contact person';
};
```

### Form Handling
```javascript
// Example form submission
const submitPatientForm = async (formData) => {
  const patientData = {
    // ... other fields ...
    contactPerson1Relationship: formData.contactPerson1Relationship || '',
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

### Future Considerations
- **Enum Values**: Could restrict to predefined relationship types
- **Length Limits**: Could add maximum character constraints
- **Format Validation**: Could enforce specific formats if needed

## Examples

### Complete Contact Person Data
```json
{
  "contactPerson1Name": "John Smith",
  "contactPerson1PhonePrefix": "+48",
  "contactPerson1Phone": "123456789",
  "contactPerson1Address": "123 Main Street, Warsaw",
  "contactPerson1Pesel": "12345678901",
  "contactPerson1Relationship": "Father",
  "contactPerson2Name": "Mary Smith",
  "contactPerson2PhonePrefix": "+48",
  "contactPerson2Phone": "987654321",
  "contactPerson2Address": "456 Oak Avenue, Krakow",
  "contactPerson2Pesel": "98765432109",
  "contactPerson2Relationship": "Mother"
}
```

### Minimal Contact Person Data
```json
{
  "contactPerson1Name": "John Doe",
  "contactPerson1Relationship": "Emergency Contact"
}
```

## Testing

### Test Scenarios
1. **Create Patient with Relationships**: Verify both fields are saved
2. **Update Relationships**: Verify fields can be modified
3. **Empty Relationships**: Verify empty strings are handled
4. **Null Relationships**: Verify null values are handled
5. **Missing Relationships**: Verify default empty strings are used

### API Testing
```bash
# Test creating patient with relationship fields
curl -X POST /api/patients/ \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test Patient",
    "email": "test@example.com",
    "phone": "123456789",
    "contactPerson1Relationship": "Father",
    "contactPerson2Relationship": "Mother"
  }'

# Test getting patient details
curl -X GET /api/patients/details/{patient_id}

# Test updating relationships
curl -X PUT /api/patients/{patient_id} \
  -H "Content-Type: application/json" \
  -d '{
    "contactPerson1Relationship": "Guardian",
    "contactPerson2Relationship": "Emergency Contact"
  }'
```

## Support and Troubleshooting

### Common Issues
1. **Field Not Appearing**: Ensure the field is included in the request body
2. **Empty Values**: Check if the field is being sent as an empty string vs undefined
3. **Database Issues**: Verify the patient model has been updated

### Debugging
- Check server logs for any validation errors
- Verify the patient model includes the new fields
- Test with a simple API call to isolate the issue
