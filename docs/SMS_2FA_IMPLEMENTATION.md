# SMS Two-Factor Authentication Implementation

## Overview
Complete two-factor authentication system with SMS, email fallback, and backup codes for the CM7 Medical backend system.

## Features Implemented

### 1. Multi-Method 2FA Support
- **SMS Authentication**: Primary method using SMSAPI
- **Email Fallback**: Alternative delivery via branded email templates
- **Backup Codes**: 8 single-use codes generated when enabling 2FA
- **Branded Communication**: All messages include CM7 Medical branding

### 2. Security Features
- 5-minute code expiration
- Maximum 5 verification attempts per code
- 15-minute account lockout after failed attempts
- 1-minute cooldown between resend requests
- 2-hour account lockout after 5 failed login attempts
- Encrypted phone number storage
- Rate limiting on all endpoints

### 3. User Experience
- Seamless fallback from SMS to email
- Clear Polish language interface
- Mobile-responsive design considerations
- Accessibility features

## API Endpoints

### 1. Login (Modified)
**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (2FA Enabled):**
```json
{
  "requiresTwoFactor": true,
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "message": "Kod weryfikacyjny został wysłany na Twój telefon",
  "phone": "***123",
  "email": "***com",
  "availableMethods": ["sms", "email", "backup"]
}
```

### 2. Verify 2FA Code
**Endpoint:** `POST /api/auth/2fa/verify`

**Request (SMS):**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "smsCode": "123456"
}
```

**Request (Email):**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "emailCode": "123456"
}
```

**Request (Backup Code):**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "backupCode": "A1B2C3D4"
}
```

**Success Response:**
```json
{
  "message": "Logowanie zakończone pomyślnie",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "Jan Kowalski",
    "role": "doctor"
  }
}
```

### 3. Resend 2FA Code
**Endpoint:** `POST /api/auth/2fa/resend`

**Request:**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "method": "sms"
}
```

**Response:**
```json
{
  "message": "Nowy kod SMS został wysłany",
  "method": "sms",
  "phone": "***123"
}
```

### 4. Request Email Fallback
**Endpoint:** `POST /api/auth/2fa/email-fallback`

**Request:**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "message": "Kod weryfikacyjny został wysłany na Twój email jako alternatywa",
  "email": "***com",
  "method": "email"
}
```

### 5. Toggle 2FA
**Endpoint:** `POST /api/auth/2fa/toggle`
**Authentication:** Required

**Request (Enable):**
```json
{
  "enable": true,
  "currentPassword": "password123"
}
```

**Response (Enable):**
```json
{
  "message": "Uwierzytelnianie dwuskładnikowe zostało włączone",
  "backupCodes": [
    "A1B2C3D4",
    "E5F6G7H8",
    "I9J0K1L2",
    "M3N4O5P6",
    "Q7R8S9T0",
    "U1V2W3X4",
    "Y5Z6A7B8",
    "C9D0E1F2"
  ],
  "warning": "Zapisz te kody zapasowe w bezpiecznym miejscu. Nie będą ponownie wyświetlone."
}
```

### 6. Get 2FA Status
**Endpoint:** `GET /api/auth/2fa/status`
**Authentication:** Required

**Response:**
```json
{
  "twoFactorEnabled": true,
  "hasPhone": true,
  "phone": "***123"
}
```

## Database Schema Changes

### OTP Model Updates
```javascript
{
  purpose: {
    type: String,
    enum: ["signup", "password-reset", "login-verification", "sms-2fa", "email-2fa"],
    required: true,
  },
  deliveryMethod: {
    type: String,
    enum: ["sms", "email"],
    required: false,
  }
}
```

### User Model Updates
```javascript
{
  twoFactorEnabled: {
    type: Boolean,
    default: false,
  },
  encryptedPhone: {
    type: String,
    required: false,
  },
  twoFactorBackupCodes: [{
    code: {
      type: String,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
    usedAt: {
      type: Date,
      required: false,
    }
  }],
  loginAttempts: {
    type: Number,
    default: 0,
  },
  lockUntil: {
    type: Date,
    required: false,
  }
}
```

## Message Templates

### SMS Template
```
CM7 Medical - Twój kod weryfikacyjny: {CODE}. Kod jest ważny przez 5 minut. Nie udostępniaj go nikomu.
```

### Email Template
Professional HTML template with:
- CM7 Medical branding and logo
- Clear code display
- Security warnings
- Sent from: admin@cm7med.pl

## Security Considerations

### 1. Rate Limiting
- Applied to all 2FA endpoints
- Prevents brute force attacks
- Configurable limits per endpoint

### 2. Encryption
- Phone numbers encrypted when 2FA enabled
- Secure token generation for temporary authentication
- Backup codes generated using crypto.randomBytes

### 3. Session Management
- Temporary tokens expire in 10 minutes
- Full session tokens after successful 2FA
- Proper cleanup of expired OTP records

### 4. Audit Trail
- All 2FA attempts logged
- Failed attempts tracked
- Security events recorded

## Error Handling

### Common Error Responses

**Invalid Token:**
```json
{
  "message": "Token tymczasowy jest nieprawidłowy lub wygasł"
}
```

**Account Locked:**
```json
{
  "message": "Konto tymczasowo zablokowane z powodu zbyt wielu nieudanych prób. Spróbuj ponownie później.",
  "blockedUntil": "2024-01-15T10:30:00.000Z"
}
```

**Code Expired:**
```json
{
  "message": "Kod weryfikacyjny wygasł. Proszę zalogować się ponownie."
}
```

**Invalid Code:**
```json
{
  "message": "Nieprawidłowy kod weryfikacyjny",
  "attemptsLeft": 3
}
```

**Cooldown Active:**
```json
{
  "message": "Możesz poprosić o nowy kod za minutę",
  "canResendAt": "2024-01-15T10:01:00.000Z"
}
```

## Testing Checklist

### Functional Testing
- [ ] SMS code delivery and verification
- [ ] Email fallback functionality
- [ ] Backup code generation and usage
- [ ] Code expiration handling
- [ ] Attempt limiting and lockouts
- [ ] Resend cooldown functionality
- [ ] 2FA enable/disable flow

### Security Testing
- [ ] Rate limiting effectiveness
- [ ] Token validation and expiration
- [ ] Phone number encryption
- [ ] Backup code single-use enforcement
- [ ] Account lockout mechanisms
- [ ] SQL injection prevention
- [ ] XSS protection

### Integration Testing
- [ ] SMSAPI integration
- [ ] Email service integration
- [ ] Database operations
- [ ] Frontend compatibility
- [ ] Mobile responsiveness

## Deployment Notes

### Environment Variables Required
```env
# SMS Configuration
SMSAPI_TOKEN=your_smsapi_token
SMSAPI_SENDER=CM7Medical

# Email Configuration  
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=admin@cm7med.pl
SMTP_PASS=your_smtp_password

# JWT Configuration
JWT_SECRET=your_jwt_secret

# Encryption Key for Phone Numbers
PHONE_ENCRYPTION_KEY=your_32_char_encryption_key
```

### Database Migration
Run the following to update existing users:
```javascript
// Add new fields to existing users
db.users.updateMany(
  {},
  {
    $set: {
      twoFactorEnabled: false,
      twoFactorBackupCodes: [],
      loginAttempts: 0
    }
  }
);
```

### Production Checklist
- [ ] Rate limiting configured
- [ ] SMS service credentials verified
- [ ] Email service configured
- [ ] Encryption keys generated
- [ ] Backup procedures tested
- [ ] Monitoring alerts configured
- [ ] User documentation updated

## Troubleshooting

### Common Issues

**SMS Not Delivered:**
1. Check SMSAPI credentials
2. Verify phone number format
3. Check rate limits
4. Review SMS service logs

**Email Not Delivered:**
1. Check SMTP configuration
2. Verify sender reputation
3. Check spam filters
4. Review email service logs

**Backup Codes Not Working:**
1. Verify code hasn't been used
2. Check case sensitivity
3. Confirm user has backup codes
4. Review database integrity

### Support Contacts
- Technical Support: tech@cm7med.pl
- SMS Service: SMSAPI support
- Email Service: Provider support

---

**Implementation Status:** ✅ Complete
**Last Updated:** January 2024
**Version:** 2.0.0 
- Alert on high lockout rates 