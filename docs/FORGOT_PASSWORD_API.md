# Forgot Password API Documentation

This document describes the password reset functionality for doctors and receptionists in the Centrum Medyczne system.

## Overview

The forgot password flow allows doctors and receptionists to reset their passwords using a secure OTP (One-Time Password) system. The system prioritizes email delivery but falls back to SMS if email is unavailable or fails.

## Features

- **Email Priority**: OTP is sent to email first (preferred method)
- **SMS Fallback**: If email fails or is unavailable, OTP is sent via SMS
- **Security**: 6-digit OTP with 10-minute expiration
- **Rate Limiting**: Prevents abuse with attempt limits and blocking
- **Role Restriction**: Only available for doctors and receptionists
- **Comprehensive Logging**: All actions are logged for security auditing

## API Endpoints

### 1. Request Password Reset

**Endpoint**: `POST /api/auth/forgot-password`

**Description**: Initiates the password reset process by sending an OTP to the user's email or phone.

**Request Body**:
```json
{
  "email": "doctor@example.com",  // Optional
  "phone": "+48123456789"         // Optional
}
```

**Note**: Either `email` or `phone` must be provided.

**Success Response** (200):
```json
{
  "success": true,
  "message": "Kod weryfikacyjny został wysłany na adres email",
  "data": {
    "deliveryMethod": "email",
    "maskedAddress": "doc***@example.com",
    "expiresIn": "10 minut"
  }
}
```

**Error Responses**:
- **400**: Invalid request data or missing email/phone
- **404**: User not found
- **500**: Failed to send OTP

### 2. Reset Password

**Endpoint**: `POST /api/auth/reset-password`

**Description**: Verifies the OTP and resets the user's password.

**Request Body**:
```json
{
  "email": "doctor@example.com",     // Optional
  "phone": "+48123456789",          // Optional
  "otp": "123456",                  // Required: 6-digit code
  "newPassword": "newSecurePassword123"  // Required: min 6 characters
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Hasło zostało pomyślnie zresetowane",
  "data": {
    "userId": "64a1b2c3d4e5f6789012345",
    "role": "doctor",
    "email": "doctor@example.com",
    "phone": "+48123456789"
  }
}
```

**Error Responses**:
- **400**: Invalid OTP, expired OTP, or weak password
- **404**: User not found
- **500**: Server error

### 3. Resend OTP

**Endpoint**: `POST /api/auth/resend-password-reset-otp`

**Description**: Resends the OTP using the same delivery method as the original request.

**Request Body**:
```json
{
  "email": "doctor@example.com",  // Optional
  "phone": "+48123456789"         // Optional
}
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Nowy kod weryfikacyjny został wysłany",
  "data": {
    "expiresIn": "10 minut"
  }
}
```

**Error Responses**:
- **400**: Rate limited (can resend after 1 minute)
- **404**: User not found
- **500**: Failed to send OTP

## Security Features

### OTP Security
- **Expiration**: OTP expires after 10 minutes
- **Single Use**: Each OTP can only be used once
- **Rate Limiting**: Can resend OTP only once per minute
- **Attempt Limiting**: Maximum 5 attempts before blocking
- **Blocking**: Account blocked for 15 minutes after max attempts

### User Validation
- **Role Restriction**: Only doctors and receptionists can reset passwords
- **Active Users**: Only non-deleted users can reset passwords
- **Contact Verification**: User must exist with provided email/phone

### Delivery Method Priority
1. **Email First**: Always attempts email delivery first
2. **SMS Fallback**: Falls back to SMS if email fails
3. **Security**: Response doesn't reveal which method was used

## Email Template

The system sends a professionally formatted HTML email with:
- **CM7 Branding**: Centrum Medyczne header and styling
- **Clear OTP Display**: Large, highlighted 6-digit code
- **Security Warnings**: Instructions about code validity and security
- **Professional Layout**: Responsive design with proper styling

## SMS Format

SMS messages follow this format:
```
CM7Med- Kod weryfikacyjny do resetu hasla: 123456. Kod jest wazny przez 10 minut. Nie udostepniaj go nikomu!
```

## Error Handling

### Common Error Scenarios

1. **User Not Found**
   ```json
   {
     "success": false,
     "message": "Nie znaleziono użytkownika o podanych danych. Sprawdź poprawność adresu email lub numeru telefonu."
   }
   ```

2. **Invalid OTP**
   ```json
   {
     "success": false,
     "message": "Nieprawidłowy kod weryfikacyjny"
   }
   ```

3. **Expired OTP**
   ```json
   {
     "success": false,
     "message": "Kod weryfikacyjny wygasł. Wygeneruj nowy kod."
   }
   ```

4. **Too Many Attempts**
   ```json
   {
     "success": false,
     "message": "Przekroczono maksymalną liczbę prób. Konto zostało zablokowane na 15 minut."
   }
   ```

5. **Rate Limited**
   ```json
   {
     "success": false,
     "message": "Możesz wysłać nowy kod za 1 minutę"
   }
   ```

## Usage Examples

### Example 1: Request Password Reset with Email

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com"
  }'
```

### Example 2: Request Password Reset with Phone

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+48123456789"
  }'
```

### Example 3: Reset Password

```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com",
    "otp": "123456",
    "newPassword": "newSecurePassword123"
  }'
```

### Example 4: Resend OTP

```bash
curl -X POST http://localhost:3000/api/auth/resend-password-reset-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "doctor@example.com"
  }'
```

## Database Schema

### OTP Model
```javascript
{
  userId: ObjectId,           // Reference to User
  otp: String,               // 6-digit code
  purpose: "password-reset", // Fixed value
  deliveryMethod: String,    // "email" or "sms"
  email: String,            // Email address (if email delivery)
  phone: String,            // Phone number (if SMS delivery)
  createdAt: Date,          // Creation timestamp
  expires: 300,             // 5 minutes TTL
  verified: Boolean,        // Whether OTP was used
  attempts: Number,         // Number of verification attempts
  maxAttempts: 5,           // Maximum attempts allowed
  blockedUntil: Date,       // Blocking timestamp
  lastResendAt: Date        // Last resend timestamp
}
```

## Configuration

### Environment Variables Required
- `ZOHO_USER`: Email account for sending emails
- `ZOHO_PASS`: Email account password
- `SMSAPI_TOKEN`: SMS API token for sending SMS

### OTP Configuration
- **Length**: 6 digits
- **Expiration**: 10 minutes
- **Max Attempts**: 5
- **Block Duration**: 15 minutes
- **Resend Rate Limit**: 1 minute

## Testing

### Test Scenarios

1. **Valid Email Reset**
   - Send reset request with valid doctor email
   - Verify email received with OTP
   - Use OTP to reset password

2. **Valid Phone Reset**
   - Send reset request with valid doctor phone
   - Verify SMS received with OTP
   - Use OTP to reset password

3. **Email Fallback to SMS**
   - Use invalid email for existing user
   - Verify SMS is sent as fallback

4. **Invalid User**
   - Send reset request with non-existent email/phone
   - Verify appropriate error message

5. **Expired OTP**
   - Request OTP, wait 10+ minutes
   - Try to use expired OTP
   - Verify expiration error

6. **Too Many Attempts**
   - Make 5+ failed OTP attempts
   - Verify account blocking

7. **Rate Limiting**
   - Send multiple resend requests quickly
   - Verify rate limiting works

## Monitoring and Logging

The system logs all password reset activities including:
- OTP generation and delivery attempts
- Successful and failed verification attempts
- Account blocking events
- Email/SMS delivery failures

## Security Considerations

1. **OTP Storage**: OTPs are stored with TTL and automatically deleted
2. **Rate Limiting**: Prevents brute force attacks
3. **Account Locking**: Temporary blocking after failed attempts
4. **Secure Delivery**: Email and SMS are secure delivery methods
5. **No Password Exposure**: Passwords are never logged or exposed
6. **Role Restriction**: Only authorized roles can use this feature

## Troubleshooting

### Common Issues

1. **Email Not Received**
   - Check spam folder
   - Verify email address is correct
   - Check SMTP configuration

2. **SMS Not Received**
   - Verify phone number format
   - Check SMS API configuration
   - Verify SMS credits available

3. **OTP Expired**
   - Request new OTP using resend endpoint
   - Complete process within 10 minutes

4. **Account Blocked**
   - Wait 15 minutes for automatic unblocking
   - Contact administrator if needed

## Files

- `controllers/forgotPasswordController.js` - Main controller logic
- `routes/forgot-password-routes.js` - API routes and validation
- `models/otp.js` - OTP database model
- `utils/mailer.js` - Email sending functionality
- `utils/smsapi.js` - SMS sending functionality
- `docs/FORGOT_PASSWORD_API.md` - This documentation
