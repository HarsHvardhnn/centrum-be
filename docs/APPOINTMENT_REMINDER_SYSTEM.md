# Appointment Reminder System

This system automatically sends SMS reminders to patients about their appointments scheduled for the current day.

## Features

- **Automated Cron Job**: Runs daily at 12:00 AM (midnight) to send reminders
- **SMS Consent Check**: Only sends reminders to patients who have agreed to SMS notifications
- **Polish Language**: Sends reminders in Polish as requested
- **Location Information**: Includes Google Maps link to the clinic location
- **Comprehensive Logging**: Detailed logs for every cron job execution with individual results tracking
- **Error Handling**: Comprehensive error handling and logging with stack traces
- **Log Management**: Automatic cleanup of old logs (keeps 30 days)
- **Debugging Tools**: Multiple scripts for viewing and analyzing execution logs

## Message Format

The reminder message sent to patients follows this format:
```
Przypominamy o wizycie u dr [Doctor Surname] {DD.MM.YYYY} godz. {HH.MM} w CM7. Lokalizacja: https://maps.app.goo.gl/pb48tQmCCGgwocWy6
```

Example:
```
Przypominamy o wizycie u dr Kowalski 15.01.2024 godz. 10.00 w CM7. Lokalizacja: https://maps.app.goo.gl/pb48tQmCCGgwocWy6
```

## How It Works

1. **Daily Trigger**: The cron job runs at 12:00 AM every day
2. **Query Appointments**: Finds all appointments for the current day with status "booked"
3. **Check Consent**: Verifies that the patient has `smsConsentAgreed: true`
4. **Send Reminders**: Sends SMS reminders to eligible patients
5. **Logging**: Logs success/failure for each reminder sent

## Configuration

### Cron Schedule
- **Schedule**: `0 0 * * *` (every day at midnight)
- **Timezone**: Europe/Warsaw (configurable in the script)

### Requirements
- Patient must have `smsConsentAgreed: true`
- Patient must have a valid phone number
- Appointment must have status "booked"
- Appointment must be scheduled for the current day

## Files

- `scripts/appointmentReminderCron.js` - Main cron job implementation with comprehensive logging
- `scripts/test-appointment-reminder.js` - Test script for manual testing
- `scripts/view-cron-logs.js` - Log viewer and analyzer
- `scripts/setup-test-sms-consent.js` - Setup script for testing SMS consent
- `scripts/check-sms-consent.js` - Script to check SMS consent status
- `models/cronJobLog.js` - Database model for storing cron job execution logs
- `docs/APPOINTMENT_REMINDER_SYSTEM.md` - This documentation

## Testing

### Manual Test
Run the test script to manually trigger the reminder process:

```bash
# Test the full reminder process
npm run test:appointment-reminders

# Test individual reminder sending
npm run test:appointment-reminders-individual

# Setup test SMS consent for a patient
npm run setup:sms-consent
```

### Test Requirements
- At least one patient with `smsConsentAgreed: true` and a phone number
- At least one doctor in the system
- At least one appointment with status "booked" for today

## Logging and Debugging

### Viewing Logs
The system maintains comprehensive logs of every cron job execution:

```bash
# View recent logs (last 7 days)
npm run view:cron-logs

# View summary statistics
npm run view:cron-logs-summary

# View only failed executions
npm run view:cron-logs-failed

# View detailed logs with individual results
npm run view:cron-logs -- --detailed

# View logs for specific job
npm run view:cron-logs -- --job-name appointment_reminder

# View logs from last 30 days
npm run view:cron-logs -- --days 30
```

### Log Information
Each log entry includes:
- **Execution ID**: Unique identifier for each run
- **Status**: running, completed, failed, or partial
- **Duration**: How long the execution took
- **Record Counts**: Total, processed, successful, failed, skipped
- **Individual Results**: Detailed results for each appointment processed
- **Error Messages**: Full error messages and stack traces
- **Metadata**: Environment, version, trigger source

### Log Cleanup
- Logs are automatically cleaned up weekly (Sundays at 2 AM)
- Keeps only the last 30 days of logs
- Can be manually triggered if needed

## Dependencies

- `node-cron` - For scheduling the daily reminder job
- `mongoose` - For database operations
- `uuid` - For generating unique batch IDs
- Existing SMS functionality (`utils/smsapi.js`)

## Installation

The system is automatically initialized when the main application starts. The cron job will begin running immediately after the application starts.

## Monitoring

The system logs all activities:
- Cron job start/completion
- Number of appointments found
- Success/failure for each reminder sent
- Any errors encountered

Check the application logs to monitor the reminder system's performance.

## Troubleshooting

### Common Issues

1. **No reminders sent**: Check if patients have `smsConsentAgreed: true` and valid phone numbers
2. **SMS sending failures**: Verify SMS API configuration and credits
3. **Cron job not running**: Check application startup logs for initialization errors

### Debug Mode

To test the system without waiting for the cron job:
1. Run the test script: `node scripts/test-appointment-reminder.js`
2. Check the logs for detailed information about the process

## Security

- Only sends reminders to patients who have explicitly consented to SMS notifications
- Uses existing SMS infrastructure with proper authentication
- Logs all activities for audit purposes
