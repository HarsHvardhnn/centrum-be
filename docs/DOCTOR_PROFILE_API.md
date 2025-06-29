# Doctor Profile API Documentation

## Overview
This document describes the doctor profile system with SEO-optimized URLs using slugs. The system allows fetching individual doctor profiles using URL-friendly slugs like `jan-kowalski` instead of database IDs.

## Features Implemented

### ✅ Slug System
- **Automatic slug generation** from doctor names
- **Polish character support** (ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ź→z, ż→z)
- **Unique slug enforcement** with automatic numbering for duplicates
- **URL-friendly format** (lowercase, hyphens, no special characters)

### ✅ Database Changes
- Added `slug` field to User model (sparse index, allows null)
- Automatic slug generation on doctor creation/update
- Migration script for existing doctors

### ✅ API Endpoints
- **New endpoint**: `GET /docs/profile/slug/:slug`
- **Updated endpoint**: `GET /docs` (now includes slugs)
- **SEO-optimized responses** with all necessary fields

## API Endpoints

### 1. Get Doctor by Slug
**Endpoint:** `GET /docs/profile/slug/:slug`

**Description:** Fetch a specific doctor's profile using their SEO-friendly slug.

**Parameters:**
- `slug` (string, required): URL-friendly doctor identifier

**Example Request:**
```bash
GET /docs/profile/slug/jan-kowalski
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "id": "6845b84cfc4414603d22a47e",
    "d_id": "dr-1749399628407",
    "name": {
      "first": "Jan",
      "last": "Kowalski",
      "full": "Jan Kowalski"
    },
    "slug": "jan-kowalski",
    "specializations": [
      {
        "name": "Chirurgia ogólna",
        "description": "Specjalizacja w chirurgii ogólnej"
      }
    ],
    "experience": 15,
    "image": "https://example.com/doctor-photo.jpg",
    "bio": "Doświadczony chirurg z 15-letnim stażem...",
    "qualifications": ["MD", "PhD"],
    "onlineConsultationPrice": 150,
    "offlineConsultationPrice": 200,
    "ratings": {
      "average": 4.5,
      "count": 23,
      "total": 4.5
    },
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T14:45:00.000Z"
  }
}
```

**Error Responses:**
```json
// 400 Bad Request - Invalid slug
{
  "success": false,
  "message": "Nieprawidłowy slug"
}

// 404 Not Found - Doctor not found
{
  "success": false,
  "message": "Lekarz nie znaleziony"
}

// 500 Internal Server Error
{
  "success": false,
  "message": "Błąd serwera podczas pobierania profilu lekarza"
}
```

### 2. Get All Doctors (Updated)
**Endpoint:** `GET /docs`

**Description:** Fetch all doctors with pagination. Now includes slug field for each doctor.

**Query Parameters:**
- `page` (number, optional, default: 1): Page number
- `limit` (number, optional, default: 10): Items per page
- `specialization` (string, optional): Filter by specialization
- `sortBy` (string, optional, default: "name.first"): Sort field
- `sortOrder` (string, optional, default: "asc"): Sort order

**Example Request:**
```bash
GET /docs?page=1&limit=5
```

**Example Response:**
```json
{
  "success": true,
  "count": 2,
  "doctors": [
    {
      "_id": "6845b84cfc4414603d22a47e",
      "id": "dr-1749399628407",
      "slug": "jan-kowalski",
      "name": "Jan Kowalski",
      "nameObj": {
        "first": "Jan",
        "last": "Kowalski"
      },
      "specialty": "Chirurgia",
      "specializations": [
        {
          "name": "Chirurgia ogólna",
          "description": ""
        }
      ],
      "available": false,
      "status": "Unavailable",
      "experience": 15,
      "experienceText": "15 years",
      "image": "https://example.com/photo.jpg",
      "bio": "Doświadczony chirurg...",
      "qualifications": ["MD", "PhD"],
      "onlineConsultationFee": 150,
      "offlineConsultationFee": 200,
      "ratings": {
        "average": 4.5,
        "total": 4.5
      },
      "visitType": "Consultation",
      "date": "2025-01-29"
    }
  ],
  "pagination": {
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false,
    "nextPage": null,
    "prevPage": null
  }
}
```

## Slug Generation

### Algorithm
1. **Combine names**: `${firstName} ${lastName}`
2. **Convert to lowercase**: `jan kowalski`
3. **Replace Polish characters**: `jan kowalski`
4. **Replace spaces/special chars with hyphens**: `jan-kowalski`
5. **Remove multiple consecutive hyphens**: `jan-kowalski`
6. **Check uniqueness**: If exists, append number (`jan-kowalski-2`)

### Examples
```javascript
"Jan Kowalski" → "jan-kowalski"
"Anna Nowak-Kowalska" → "anna-nowak-kowalska"
"Dr. Michał Szymański" → "michal-szymanski"
"Józef Błąd" → "jozef-blad"
```

### Polish Character Mapping
```javascript
ą → a, ć → c, ę → e, ł → l, ń → n
ó → o, ś → s, ź → z, ż → z
```

## Database Schema

### User Model (Base)
```javascript
{
  slug: {
    type: String,
    sparse: true, // Allows null, enforces uniqueness on non-null
    index: true
  }
  // ... other fields
}
```

### Doctor Model (Discriminator)
- Inherits slug field from User model
- Pre-save middleware auto-generates slugs
- Slug generation on name changes

## Migration

### Running the Migration
```bash
# Run individual migration
node migrations/addSlugsToExistingDoctors.js

# Run all migrations
node migrations/runAllMigrations.js
```

### Migration Features
- **Safe execution**: Skips doctors that already have slugs
- **Unique slug generation**: Handles duplicates automatically
- **Progress tracking**: Shows success/failure counts
- **Verification**: Checks for duplicate slugs after migration

## Frontend Integration

### SEO URLs
Frontend can now use SEO-friendly URLs:
```
https://centrummedyczne7.pl/lekarze/jan-kowalski
https://centrummedyczne7.pl/lekarze/anna-nowak-kowalska
```

### API Calls
```javascript
// Fetch doctor by slug
const response = await fetch(`/docs/profile/slug/${slug}`);
const doctor = await response.json();

// Fetch all doctors with slugs
const response = await fetch('/docs');
const doctors = await response.json();
```

### Meta Tags Generation
```javascript
// Example meta tags for SEO
<title>Dr. Jan Kowalski - Chirurg | Centrum Medyczne 7</title>
<meta name="description" content="Dr. Jan Kowalski, doświadczony chirurg z 15-letnim stażem. Konsultacje online i offline." />
<meta property="og:title" content="Dr. Jan Kowalski - Chirurg" />
<meta property="og:description" content="Doświadczony chirurg z 15-letnim stażem..." />
<meta property="og:image" content="https://example.com/doctor-photo.jpg" />
```

## Testing

### API Testing
```bash
# Test doctor by slug
curl "http://localhost:5000/docs/profile/slug/jan-kowalski"

# Test all doctors endpoint
curl "http://localhost:5000/docs"

# Test non-existent slug
curl "http://localhost:5000/docs/profile/slug/non-existent"
```

### Expected Status Codes
- `200`: Success
- `400`: Invalid slug format
- `404`: Doctor not found
- `500`: Server error

## Error Handling

### Validation
- **Empty slug**: Returns 400 Bad Request
- **Invalid characters**: Slug generation handles automatically
- **Non-existent doctor**: Returns 404 Not Found

### Edge Cases
- **Duplicate names**: Auto-appends numbers (`jan-kowalski-2`)
- **Special characters**: Converted to hyphens
- **Very long names**: Truncated if needed
- **Empty names**: Fallback to ID-based slug

## Performance Considerations

### Database Indexes
- Sparse index on `slug` field
- Unique constraint enforcement
- Fast lookups by slug

### Caching Recommendations
- Cache doctor profiles by slug
- Cache all doctors list
- Set appropriate TTL values

## Security

### Input Validation
- Slug format validation
- SQL injection prevention (parameterized queries)
- XSS prevention in responses

### Rate Limiting
- Apply rate limiting to public endpoints
- Monitor for abuse patterns

## Monitoring

### Metrics to Track
- API response times
- 404 error rates for slug lookups
- Most accessed doctor profiles
- Slug generation performance

### Logging
- Slug generation events
- API access patterns
- Error occurrences

## Future Enhancements

### Potential Features
- **Slug history**: Track slug changes
- **Custom slugs**: Allow manual slug setting
- **Redirect handling**: 301 redirects for old URLs
- **Bulk operations**: Batch slug updates
- **Analytics**: Track profile views by slug

### SEO Improvements
- **Structured data**: JSON-LD markup
- **Canonical URLs**: Prevent duplicate content
- **Sitemap integration**: Include doctor profiles
- **Rich snippets**: Enhanced search results

---

## Quick Start Checklist

1. ✅ **Database Migration**: Run slug migration for existing doctors
2. ✅ **API Testing**: Verify both endpoints work correctly
3. ✅ **Frontend Integration**: Update frontend to use slug URLs
4. ✅ **SEO Setup**: Implement meta tags and structured data
5. ✅ **Monitoring**: Set up logging and metrics
6. ✅ **Documentation**: Update API documentation

## Support

For issues or questions about the doctor profile system:
1. Check this documentation
2. Review API response errors
3. Check server logs for detailed error information
4. Verify database connectivity and slug uniqueness 