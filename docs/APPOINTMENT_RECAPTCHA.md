# Appointment Booking reCAPTCHA Implementation

## Overview
The appointment booking endpoint (`/api/appointments/book`) now requires reCAPTCHA verification to prevent automated bookings and spam. The system uses reCAPTCHA v3 with v2 fallback for enhanced security while maintaining a good user experience.

## Configuration

### Environment Variables
Make sure these are set in your frontend environment:
```env
RECAPTCHA_V3_SITE_KEY=your_v3_site_key
RECAPTCHA_V2_SITE_KEY=your_v2_site_key
```

### Load reCAPTCHA Scripts
Add these scripts to your HTML:
```html
<!-- reCAPTCHA v3 -->
<script src="https://www.google.com/recaptcha/api.js?render=YOUR_V3_SITE_KEY"></script>
<!-- reCAPTCHA v2 (for fallback) -->
<script src="https://www.google.com/recaptcha/api.js" async defer></script>
```

## Implementation Guide

### 1. Modified Request Format
The appointment booking request now requires additional fields:
```typescript
interface AppointmentBookingRequest {
  // ... existing appointment fields ...
  consent: boolean;              // Required: GDPR consent
  recaptchaToken: string;       // Required: reCAPTCHA token
  isV2Fallback: boolean;        // Required: Whether using v2 fallback
}
```

### 2. React Implementation Example

```jsx
import React, { useState, useEffect } from 'react';

const AppointmentBooking = () => {
  const [formData, setFormData] = useState({
    // ... your appointment form fields
    consent: false
  });
  const [showV2Captcha, setShowV2Captcha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Execute reCAPTCHA v3
  const executeRecaptchaV3 = async () => {
    try {
      const token = await window.grecaptcha.execute(process.env.RECAPTCHA_V3_SITE_KEY, {
        action: 'appointment_booking'
      });
      return token;
    } catch (error) {
      console.error('reCAPTCHA v3 error:', error);
      return null;
    }
  };

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get reCAPTCHA token
      const token = await executeRecaptchaV3();
      
      // Make API request
      const response = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          recaptchaToken: token,
          isV2Fallback: false
        })
      });

      const data = await response.json();

      // Handle reCAPTCHA v2 fallback requirement
      if (data.code === 'RECAPTCHA_V2_REQUIRED') {
        setShowV2Captcha(true);
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Booking failed');
      }

      // Handle success
      // ... your success logic ...

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle reCAPTCHA v2 verification
  const handleV2Verification = async (v2Token) => {
    setLoading(true);
    try {
      const response = await fetch('/api/appointments/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          recaptchaToken: v2Token,
          isV2Fallback: true
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Booking failed');
      }

      // Handle success
      // ... your success logic ...

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
      setShowV2Captcha(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        {/* Your existing form fields */}
        
        {/* Consent Checkbox */}
        <div>
          <input
            type="checkbox"
            id="consent"
            checked={formData.consent}
            onChange={(e) => setFormData({...formData, consent: e.target.checked})}
            required
          />
          <label htmlFor="consent">
            I agree to the processing of my personal data
          </label>
        </div>

        {/* Error Message */}
        {error && <div className="error">{error}</div>}

        {/* Submit Button */}
        <button type="submit" disabled={loading}>
          {loading ? 'Booking...' : 'Book Appointment'}
        </button>
      </form>

      {/* reCAPTCHA v2 Fallback */}
      {showV2Captcha && (
        <div className="recaptcha-modal">
          <div className="recaptcha-container">
            <h3>Additional Verification Required</h3>
            <div
              className="g-recaptcha"
              data-sitekey={process.env.RECAPTCHA_V2_SITE_KEY}
              data-callback="handleV2Verification"
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentBooking;
```

### 3. Error Handling

Handle these specific error codes:

| Error Code | Meaning | Action |
|------------|---------|--------|
| `RECAPTCHA_V2_REQUIRED` | v3 score too low | Show v2 CAPTCHA |
| `RATE_LIMIT_EXCEEDED` | Too many attempts | Show wait message |
| `CONSENT_REQUIRED` | Missing consent | Highlight checkbox |
| `RECAPTCHA_MISSING` | No token provided | Retry v3 execution |
| `RECAPTCHA_FAILED` | Invalid token | Retry with new token |

Example error messages:
```javascript
const ERROR_MESSAGES = {
  RECAPTCHA_V2_REQUIRED: 'Additional verification required for security purposes.',
  RATE_LIMIT_EXCEEDED: 'Too many booking attempts. Please try again in an hour.',
  CONSENT_REQUIRED: 'Please agree to the data processing consent.',
  RECAPTCHA_MISSING: 'Security verification failed. Please try again.',
  RECAPTCHA_FAILED: 'Security verification failed. Please try again.'
};
```

### 4. Rate Limiting
- Maximum 5 attempts per hour per IP
- Show appropriate message when limit is reached
- Consider implementing a countdown timer

### 5. Testing

#### Development Mode
- Set `NODE_ENV=development` to bypass CAPTCHA
- Perfect for local testing

#### Test Keys
Use Google's test keys for development:
```env
RECAPTCHA_V3_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_V2_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
```

#### Test Cases
1. Successful booking with v3
2. v3 to v2 fallback flow
3. Rate limit triggering
4. Missing consent
5. Network errors
6. Invalid tokens

## Production Requirements

1. **HTTPS Required**
   - reCAPTCHA requires HTTPS in production
   - Configure your web server accordingly

2. **Domain Configuration**
   - Add your domain to Google reCAPTCHA console
   - Update environment variables with production keys

3. **Error Handling**
   - Implement all error scenarios
   - Show user-friendly messages
   - Log errors for debugging

4. **Performance**
   - Load reCAPTCHA scripts asynchronously
   - Consider lazy loading for v2 script
   - Implement proper loading states

## Support

For implementation issues:
1. Check the error response code
2. Verify environment variables
3. Check browser console for errors
4. Ensure proper script loading
5. Contact backend team with error details 