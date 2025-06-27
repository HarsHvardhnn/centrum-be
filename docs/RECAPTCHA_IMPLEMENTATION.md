# reCAPTCHA v3 Implementation Guide for Frontend

## Overview
This document describes how to implement Google reCAPTCHA v3 with fallback to reCAPTCHA v2 for the contact form in the CM7 system. The backend has been configured to verify CAPTCHA tokens and enforce security requirements.

## Table of Contents
1. [Setup and Configuration](#setup-and-configuration)
2. [Contact Form Implementation](#contact-form-implementation)
3. [API Endpoints](#api-endpoints)
4. [Error Handling](#error-handling)
5. [Testing](#testing)
6. [Security Considerations](#security-considerations)

## Setup and Configuration

### 1. Get reCAPTCHA Keys from Google
Visit [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) and create:
- **reCAPTCHA v3 Site Key** and **Secret Key**
- **reCAPTCHA v2 Site Key** and **Secret Key** (for fallback)

### 2. Environment Variables
Add these to your backend `.env` file:
```env
# reCAPTCHA v3
RECAPTCHA_V3_SITE_KEY=your_v3_site_key_here
RECAPTCHA_V3_SECRET_KEY=your_v3_secret_key_here

# reCAPTCHA v2 (fallback)
RECAPTCHA_V2_SITE_KEY=your_v2_site_key_here
RECAPTCHA_V2_SECRET_KEY=your_v2_secret_key_here
```

### 3. Get Configuration from Backend
Fetch CAPTCHA configuration from the backend:

```javascript
// Get CAPTCHA configuration
const getCaptchaConfig = async () => {
  try {
    const response = await fetch('/api/captcha/config');
    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to get CAPTCHA config:', error);
    return null;
  }
};
```

## Contact Form Implementation

### 1. HTML Head Setup
Add reCAPTCHA scripts to your HTML `<head>`:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- reCAPTCHA v3 -->
  <script src="https://www.google.com/recaptcha/api.js?render=YOUR_V3_SITE_KEY"></script>
  
  <!-- reCAPTCHA v2 (loaded when needed) -->
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
</head>
</html>
```

### 2. React Component Example

```jsx
import React, { useState, useEffect } from 'react';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    consent: false // Required checkbox
  });
  
  const [captchaConfig, setCaptchaConfig] = useState(null);
  const [showV2Captcha, setShowV2Captcha] = useState(false);
  const [v2Token, setV2Token] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  // Load CAPTCHA configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      const config = await getCaptchaConfig();
      setCaptchaConfig(config);
    };
    loadConfig();
  }, []);

  // Execute reCAPTCHA v3
  const executeRecaptchaV3 = async () => {
    if (!captchaConfig?.v3?.enabled || !window.grecaptcha) {
      throw new Error('reCAPTCHA v3 not available');
    }

    try {
      const token = await window.grecaptcha.execute(captchaConfig.v3.siteKey, {
        action: 'contact_form'
      });
      return token;
    } catch (error) {
      console.error('reCAPTCHA v3 execution failed:', error);
      throw error;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    try {
      // Validation
      if (!formData.consent) {
        setErrors({ consent: 'Wymagana jest zgoda na przetwarzanie danych osobowych' });
        setIsSubmitting(false);
        return;
      }

      let recaptchaToken = null;
      let isV2Fallback = false;

      // Try reCAPTCHA v3 first
      if (!showV2Captcha) {
        try {
          recaptchaToken = await executeRecaptchaV3();
        } catch (error) {
          console.warn('reCAPTCHA v3 failed, showing v2 fallback');
          setShowV2Captcha(true);
          setIsSubmitting(false);
          return;
        }
      } else {
        // Use reCAPTCHA v2 token
        recaptchaToken = v2Token;
        isV2Fallback = true;
      }

      if (!recaptchaToken) {
        setErrors({ captcha: 'Weryfikacja CAPTCHA jest wymagana' });
        setIsSubmitting(false);
        return;
      }

      // Submit form with CAPTCHA token
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          recaptchaToken,
          isV2Fallback
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Success - reset form
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: '',
          consent: false
        });
        setShowV2Captcha(false);
        setV2Token(null);
        alert('Wiadomość została wysłana pomyślnie!');
      } else {
        // Handle specific errors
        if (result.code === 'RECAPTCHA_V2_REQUIRED') {
          setShowV2Captcha(true);
          setErrors({ captcha: 'Wymagana dodatkowa weryfikacja bezpieczeństwa' });
        } else if (result.code === 'RATE_LIMIT_EXCEEDED') {
          setErrors({ form: 'Za dużo prób. Spróbuj ponownie za godzinę.' });
        } else if (result.code === 'CONSENT_REQUIRED') {
          setErrors({ consent: result.message });
        } else {
          setErrors({ form: result.message || 'Wystąpił błąd podczas wysyłania wiadomości' });
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setErrors({ form: 'Wystąpił błąd podczas wysyłania wiadomości' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reCAPTCHA v2 callback
  const onRecaptchaV2Change = (token) => {
    setV2Token(token);
    setErrors(prev => ({ ...prev, captcha: null }));
  };

  // Handle reCAPTCHA v2 expiry
  const onRecaptchaV2Expired = () => {
    setV2Token(null);
    setErrors(prev => ({ ...prev, captcha: 'CAPTCHA wygasła. Proszę spróbować ponownie.' }));
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      {/* Name Field */}
      <div className="form-group">
        <label htmlFor="name">Imię i nazwisko *</label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Email Field */}
      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          type="email"
          id="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Subject Field */}
      <div className="form-group">
        <label htmlFor="subject">Temat *</label>
        <input
          type="text"
          id="subject"
          value={formData.subject}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Message Field */}
      <div className="form-group">
        <label htmlFor="message">Wiadomość *</label>
        <textarea
          id="message"
          rows="5"
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Consent Checkbox - REQUIRED */}
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formData.consent}
            onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
            required
            disabled={isSubmitting}
          />
          <span className="checkmark"></span>
          Wyrażam zgodę na przetwarzanie moich danych osobowych w celu udzielenia odpowiedzi na zapytanie *
        </label>
        {errors.consent && <div className="error-message">{errors.consent}</div>}
      </div>

      {/* reCAPTCHA v2 (shown when v3 fails) */}
      {showV2Captcha && captchaConfig?.v2?.enabled && (
        <div className="form-group">
          <div
            className="g-recaptcha"
            data-sitekey={captchaConfig.v2.siteKey}
            data-callback="onRecaptchaV2Change"
            data-expired-callback="onRecaptchaV2Expired"
          ></div>
          {errors.captcha && <div className="error-message">{errors.captcha}</div>}
        </div>
      )}

      {/* General form errors */}
      {errors.form && (
        <div className="error-message form-error">{errors.form}</div>
      )}

      {/* Submit Button */}
      <button 
        type="submit" 
        disabled={isSubmitting || (showV2Captcha && !v2Token)}
        className="submit-button"
      >
        {isSubmitting ? 'Wysyłanie...' : 'Wyślij wiadomość'}
      </button>

      {/* reCAPTCHA v3 Badge Notice */}
      {captchaConfig?.v3?.enabled && !showV2Captcha && (
        <div className="recaptcha-notice">
          <small>
            Ta strona jest chroniona przez reCAPTCHA i obowiązują{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
              Polityka prywatności
            </a>{' '}
            oraz{' '}
            <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">
              Warunki korzystania z usługi
            </a>{' '}
            Google.
          </small>
        </div>
      )}
    </form>
  );
};

// Global callback functions (must be in window scope)
window.onRecaptchaV2Change = (token) => {
  // This will be handled by the component's callback
  // You may need to use a global event or ref to handle this
};

window.onRecaptchaV2Expired = () => {
  // This will be handled by the component's callback
};

export default ContactForm;
```

### 3. Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://www.google.com/recaptcha/api.js?render=YOUR_V3_SITE_KEY"></script>
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
</head>
<body>
  <form id="contactForm">
    <!-- Form fields same as above -->
    
    <!-- Required consent checkbox -->
    <label>
      <input type="checkbox" id="consent" required>
      Wyrażam zgodę na przetwarzanie moich danych osobowych *
    </label>
    
    <!-- reCAPTCHA v2 container (hidden initially) -->
    <div id="recaptcha-v2" style="display: none;">
      <div class="g-recaptcha" data-sitekey="YOUR_V2_SITE_KEY" data-callback="onRecaptchaV2Change"></div>
    </div>
    
    <button type="submit">Wyślij wiadomość</button>
  </form>

  <script>
    let captchaConfig = null;
    let showV2 = false;
    
    // Load configuration
    fetch('/api/captcha/config')
      .then(response => response.json())
      .then(result => {
        captchaConfig = result.data;
      });

    // Form submission
    document.getElementById('contactForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(e.target);
      const consent = document.getElementById('consent').checked;
      
      if (!consent) {
        alert('Wymagana jest zgoda na przetwarzanie danych osobowych');
        return;
      }
      
      let recaptchaToken = null;
      
      if (!showV2) {
        try {
          recaptchaToken = await grecaptcha.execute(captchaConfig.v3.siteKey, {
            action: 'contact_form'
          });
        } catch (error) {
          // Show v2 CAPTCHA
          document.getElementById('recaptcha-v2').style.display = 'block';
          showV2 = true;
          return;
        }
      } else {
        recaptchaToken = window.v2Token;
      }
      
      // Submit form
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          subject: formData.get('subject'),
          message: formData.get('message'),
          consent: consent,
          recaptchaToken: recaptchaToken,
          isV2Fallback: showV2
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert('Wiadomość wysłana pomyślnie!');
        e.target.reset();
      } else {
        if (result.code === 'RECAPTCHA_V2_REQUIRED') {
          document.getElementById('recaptcha-v2').style.display = 'block';
          showV2 = true;
        }
        alert(result.message);
      }
    });
    
    // reCAPTCHA v2 callbacks
    function onRecaptchaV2Change(token) {
      window.v2Token = token;
    }
    
    function onRecaptchaV2Expired() {
      window.v2Token = null;
    }
  </script>
</body>
</html>
```

## API Endpoints

### 1. Get CAPTCHA Configuration
```
GET /api/captcha/config
```

**Response:**
```json
{
  "success": true,
  "message": "Konfiguracja CAPTCHA pobrana pomyślnie",
  "data": {
    "v3": {
      "siteKey": "6Lc...",
      "enabled": true
    },
    "v2": {
      "siteKey": "6Lc...",
      "enabled": true
    },
    "minScores": {
      "contact": 0.3
    },
    "rateLimits": {
      "contact": 10
    },
    "developmentMode": false
  }
}
```

### 2. Submit Contact Form
```
POST /api/contact
```

**Request Body:**
```json
{
  "name": "Jan Kowalski",
  "email": "jan@example.com",
  "subject": "Pytanie o usługi",
  "message": "Treść wiadomości",
  "consent": true,
  "recaptchaToken": "03AGdBq26...",
  "isV2Fallback": false
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Wiadomość kontaktowa wysłana pomyślnie",
  "data": {
    "_id": "...",
    "name": "Jan Kowalski",
    "email": "jan@example.com",
    "subject": "Pytanie o usługi",
    "message": "Treść wiadomości",
    "status": "new",
    "createdAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Error Responses:**

**Low Score (requires v2):**
```json
{
  "success": false,
  "requiresV2": true,
  "message": "Wymagana dodatkowa weryfikacja",
  "code": "RECAPTCHA_V2_REQUIRED",
  "score": 0.2,
  "minScore": 0.3
}
```

**Rate Limited:**
```json
{
  "success": false,
  "message": "Za dużo prób. Spróbuj ponownie za godzinę.",
  "code": "RATE_LIMIT_EXCEEDED",
  "rateLimitInfo": {
    "isLimitExceeded": true,
    "currentAttempts": 10,
    "maxAttempts": 10,
    "timeWindowHours": 1
  }
}
```

**Missing Consent:**
```json
{
  "success": false,
  "message": "Wymagana jest zgoda na przetwarzanie danych osobowych",
  "code": "CONSENT_REQUIRED"
}
```

## Error Handling

### Error Codes and Messages
| Code | Description | Action |
|------|-------------|--------|
| `RECAPTCHA_V2_REQUIRED` | Score too low | Show reCAPTCHA v2 |
| `RATE_LIMIT_EXCEEDED` | Too many attempts | Show timeout message |
| `CONSENT_REQUIRED` | Missing consent checkbox | Highlight consent field |
| `RECAPTCHA_MISSING` | No CAPTCHA token | Retry with CAPTCHA |
| `RECAPTCHA_FAILED` | Invalid CAPTCHA token | Show error, retry |

### Error Handling Best Practices

```javascript
const handleFormError = (result) => {
  switch (result.code) {
    case 'RECAPTCHA_V2_REQUIRED':
      // Show v2 CAPTCHA
      setShowV2Captcha(true);
      setErrors({ captcha: 'Wymagana dodatkowa weryfikacja bezpieczeństwa' });
      break;
      
    case 'RATE_LIMIT_EXCEEDED':
      // Show rate limit message
      setErrors({ 
        form: `Za dużo prób. Spróbuj ponownie za godzinę. (${result.rateLimitInfo.currentAttempts}/${result.rateLimitInfo.maxAttempts})` 
      });
      break;
      
    case 'CONSENT_REQUIRED':
      // Highlight consent checkbox
      setErrors({ consent: result.message });
      document.getElementById('consent').focus();
      break;
      
    case 'RECAPTCHA_FAILED':
    case 'RECAPTCHA_MISSING':
      // Retry CAPTCHA
      setErrors({ captcha: 'Wystąpił błąd podczas weryfikacji. Spróbuj ponownie.' });
      if (showV2Captcha && window.grecaptcha) {
        window.grecaptcha.reset();
      }
      break;
      
    default:
      setErrors({ form: result.message || 'Wystąpił nieoczekiwany błąd' });
  }
};
```

## Testing

### Development Mode
In development (`NODE_ENV=development`), CAPTCHA verification is automatically skipped for easier testing.

### Test Endpoints
Admin-only endpoints for testing:

```javascript
// Test CAPTCHA verification
const testCaptcha = async (token, isV2 = false) => {
  const response = await fetch('/api/captcha/test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + adminToken
    },
    body: JSON.stringify({
      token,
      isV2,
      remoteip: '127.0.0.1'
    })
  });
  
  return response.json();
};
```

### Google Test Keys
For testing, Google provides special test keys:

**Test Site Key (v3):** `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
**Test Secret Key (v3):** `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`

**Test Site Key (v2):** `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`
**Test Secret Key (v2):** `6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe`

## Security Considerations

### 1. Rate Limiting
- Contact form: **10 attempts per hour per IP**
- Rate limits are enforced server-side
- Use proper error messages to inform users

### 2. Consent Requirement
- **Required checkbox** for data processing consent
- Form cannot be submitted without consent
- Clear privacy policy link

### 3. Score Thresholds
- **Minimum score: 0.3** for contact form
- Scores below threshold trigger v2 fallback
- Adjust thresholds based on spam analysis

### 4. Data Privacy
- CAPTCHA attempts are logged for 7 days then auto-deleted
- No sensitive data is stored in logs
- IP addresses are stored for rate limiting only

### 5. HTTPS Requirement
- reCAPTCHA requires HTTPS in production
- Ensure SSL certificates are properly configured

## CSS Styling

```css
/* Contact form styling */
.contact-form {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
  color: #333;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* Checkbox styling */
.checkbox-label {
  display: flex !important;
  align-items: flex-start;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto !important;
  margin: 0;
}

/* Error messages */
.error-message {
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.form-error {
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

/* Submit button */
.submit-button {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.submit-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.submit-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

/* reCAPTCHA notice */
.recaptcha-notice {
  margin-top: 1rem;
  font-size: 0.75rem;
  color: #666;
}

.recaptcha-notice a {
  color: #007bff;
  text-decoration: none;
}

.recaptcha-notice a:hover {
  text-decoration: underline;
}

/* reCAPTCHA v2 container */
.g-recaptcha {
  margin: 1rem 0;
}

/* Responsive design */
@media (max-width: 768px) {
  .contact-form {
    padding: 1rem;
  }
  
  .g-recaptcha {
    transform: scale(0.85);
    transform-origin: 0 0;
  }
}
```

## Summary

The reCAPTCHA implementation for the contact form includes:

✅ **Backend Features:**
- reCAPTCHA v3 verification with configurable score thresholds
- Automatic fallback to reCAPTCHA v2 for low scores
- Rate limiting (10 attempts per hour per IP)
- Required consent checkbox validation
- Comprehensive logging and monitoring
- Polish language error messages
- Development mode bypass

✅ **Frontend Requirements:**
1. Load both reCAPTCHA v3 and v2 scripts
2. Execute v3 silently on form submission
3. Show v2 CAPTCHA when v3 fails or score is too low
4. Include required consent checkbox
5. Handle all error scenarios properly
6. Implement proper rate limiting feedback

✅ **Security Features:**
- IP-based rate limiting
- CAPTCHA score validation
- Automatic log cleanup (7 days)
- GDPR-compliant consent handling
- Protection against bot submissions

The system is ready for production use and provides a smooth user experience while maintaining strong security measures against spam and automated submissions. 