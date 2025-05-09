# Zoho SMTP Email Setup

This document explains how to set up Zoho SMTP for sending emails from your application.

## Steps to Configure Zoho SMTP

### 1. Create or Use an Existing Zoho Mail Account

If you don't already have a Zoho Mail account:
- Go to [Zoho Mail](https://www.zoho.com/mail/)
- Sign up for an account appropriate for your needs (free or paid)
- Verify your domain if using a custom domain

### 2. Generate an App Password (Recommended)

For better security, it's recommended to use an app password instead of your main account password:

1. Log in to your Zoho Mail account
2. Go to Account Settings (click on your profile picture)
3. Navigate to Security or Connected Applications
4. Generate a new app password for your application
5. Save this password securely

### 3. Enable IMAP/POP in Zoho Mail (Required)

**Important:** SMTP access must be explicitly enabled in your Zoho Mail settings:

1. Log in to your Zoho Mail account
2. Go to Settings (gear icon) > Mail Accounts
3. Select your email account
4. Go to the "POP/IMAP" tab
5. Enable "IMAP Access" and "Authentication for Outgoing Mails (SMTP)"
6. Save changes

### 4. Update Environment Variables

Add the following variables to your `.env` file:

```
# Zoho SMTP Configuration
ZOHO_USER=your_email@yourdomain.com
ZOHO_PASS=your_zoho_password_or_app_password
```

### 5. Testing the SMTP Configuration

After setting up the environment variables, you can test the SMTP configuration by:

```bash
# Test with a single configuration
npm run test-email your_test_email@example.com

# Try multiple configurations to find what works best
npm run debug-smtp your_test_email@example.com
```

## Troubleshooting Authentication Failures

### 1. "535 Authentication Failed" Error

This is the most common error and can be caused by several issues:

#### a. Incorrect Password

- Double-check that your password is entered correctly with no extra spaces
- Try using an app password instead of your main account password
- Copy and paste the password to avoid typos

#### b. SMTP Access Not Enabled

- Ensure you've enabled SMTP authentication in Zoho Mail settings (see Step 3 above)
- This setting is often disabled by default for security reasons

#### c. Login Authentication Method

Try different SMTP configurations (our debug script will help with this):
- SSL on port 465 (most secure and recommended)
- TLS on port 587 (alternative)

#### d. Account Security Settings

- Check if your Zoho account has security settings that might be blocking SMTP access
- Temporarily disable 2FA to test (re-enable it after testing)
- Check if your account restricts access from unknown locations

#### e. Different Zoho Mail Server

Depending on your region, you might need to use a different server:
- US/Global: smtp.zoho.com
- EU: smtp.zoho.eu
- India: smtp.zoho.in
- Australia: smtp.zoho.com.au
- China: smtp.zoho.com.cn

### 2. Connection Timeouts

If you experience connection timeouts:
- Ensure your server allows outbound connections on ports 465 or 587
- Check if any firewall is blocking SMTP traffic
- Try a different network if possible

### 3. Using Zoho With Nodejs

Zoho may require specific TLS settings with Node.js:

```javascript
// Try these TLS settings if you're having issues
tls: {
  rejectUnauthorized: false,
  ciphers: 'SSLv3'
}
```

## SMTP Settings Reference

| Setting | Value |
|---------|-------|
| SMTP Host (Global) | smtp.zoho.com |
| SMTP Host (EU) | smtp.zoho.eu |
| Port (SSL) | 465 |
| Port (TLS) | 587 |
| Security | SSL or TLS |
| Authentication | Required | 