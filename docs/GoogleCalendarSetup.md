# Google Calendar Integration Setup

This document explains how to set up Google Calendar integration for creating meeting links in appointments.

## Option 1: Using a Service Account with Domain-Wide Delegation (Recommended)

Using a service account with domain-wide delegation is the most reliable method for Google Calendar integration as it doesn't require OAuth flows and token refreshing. This approach allows your server to act on behalf of a specific user in your organization.

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API for your project:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API" and enable it

### Step 2: Create a Service Account

1. Go to "IAM & Admin" > "Service Accounts"
2. Click "Create Service Account"
3. Enter a name and description for your service account
4. Grant the "Calendar API Editor" role to the service account
5. Click "Done"

### Step 3: Generate a Service Account Key

1. Find your service account in the list and click on it
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key"
4. Select "JSON" format and click "Create"
5. Save the downloaded JSON file securely

### Step 4: Configure Your Service Account

Run the setup script to configure your service account:

```
npm run setup-google
```

When prompted, choose "yes" if you have the downloaded key file and provide its path.

### Step 5: Set Up Domain-Wide Delegation

Domain-wide delegation allows your service account to access user data on behalf of users in your Google Workspace organization.

1. Run the domain delegation setup script:
   ```
   npm run setup-delegation
   ```

2. Enter the email address of the Google Workspace user you want to impersonate (e.g., your admin email)

3. Optionally specify a Calendar ID (leave empty to use the primary calendar)

4. Complete the setup in Google Workspace:
   - Go to your [Google Workspace Admin Console](https://admin.google.com)
   - Navigate to: Security > API Controls > Domain-wide Delegation
   - Click "Add new" and enter:
     - Client ID: Your service account's client ID (found in the JSON key file)
     - OAuth scopes: `https://www.googleapis.com/auth/calendar`
   - Click "Authorize"

### Alternative Configuration Methods

If you prefer not to use the setup scripts, you can manually configure the service account:

#### Option A: Using Environment Variables with Email and Key

Add the following to your `.env` file:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nYour private key content here\n-----END PRIVATE KEY-----\n"
GOOGLE_USER_EMAIL_TO_IMPERSONATE="user@your-domain.com"
```

> **Note:** Make sure to replace newlines in the private key with `\n` characters.

#### Option B: Using JSON Environment Variable

Convert your service account JSON to a string and add it to your `.env` file:

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"your-service-account@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"}
GOOGLE_USER_EMAIL_TO_IMPERSONATE="user@your-domain.com"
```

#### Option C: Using a Key File Path

Add the following to your `.env` file:

```
GOOGLE_SERVICE_ACCOUNT_KEY_PATH="path/to/your-service-account-key.json"
GOOGLE_USER_EMAIL_TO_IMPERSONATE="user@your-domain.com"
```

## Option 2: Using OAuth (Fallback)

If you can't use domain-wide delegation, the application will fall back to OAuth-based authentication.

### Step 1: Configure OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Go to "APIs & Services" > "Credentials" 
3. Click "Create Credentials" > "OAuth client ID"
4. Set Application type to "Web application"
5. Add an authorized redirect URI: `http://localhost:5000/auth/oauth2callback`
6. Click "Create" and note your Client ID and Client Secret

### Step 2: Update Environment Variables

Add the following to your `.env` file:

```
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/oauth2callback
```

### Step 3: Authorize the Application (Admin User)

1. Log in as an admin to your application
2. Visit the route: `/auth/google/auth-url`
3. Follow the OAuth flow to authorize the application
4. After authorization, tokens will be saved and refreshed automatically

## Troubleshooting

### Debugging Google Calendar API Issues

If you encounter issues with the Google Calendar integration:

1. Check for detailed error messages in the server logs
2. Verify that your service account has permission to create events in the calendar
3. Make sure the Google Calendar API is enabled for your project
4. Verify that environment variables are correctly set

For service account issues:
- Ensure the private key format is correct
- Check that domain-wide delegation is properly configured
- Verify the user email you're impersonating has calendar access

For OAuth issues:
- Try reauthenticating to get fresh tokens
- Use the `/auth/google/status` endpoint to check token status

### Common Errors

#### `invalid_grant: Invalid grant: account not found`
- Ensure the user email you're trying to impersonate exists in your Google Workspace
- Verify domain-wide delegation is properly configured
- Check that your service account has the correct scopes authorized

#### `Requested entity was not found`
- Check that the Calendar ID is correct
- Ensure the impersonated user has access to the calendar

#### `insufficient authentication scopes`
- Make sure your domain-wide delegation includes the scope: `https://www.googleapis.com/auth/calendar` 