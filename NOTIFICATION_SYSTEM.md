# Notification System for Admin Messages

## Overview
This system automatically sends email and SMS notifications to staff members (staff, managers, and mechanics) when new messages arrive in the Admin tab's "New Messages" section.

## Components Implemented

### 1. Database Schema Updates
- Added notification preference columns to `user_profiles` table:
  - `email_notifications_enabled` (boolean, default: true)
  - `sms_notifications_enabled` (boolean, default: false)
  - `notification_email` (text, optional - alternative email for notifications)
  - `notification_phone` (text, optional - alternative phone for SMS)

### 2. Edge Function: send-message-notification
- Location: `supabase/functions/send-message-notification/`
- Purpose: Sends email and SMS notifications to all staff members
- Triggered by: Database triggers on new message inserts
- Features:
  - Respects user notification preferences
  - Supports alternative email/phone for notifications
  - Includes message details (yacht name, sender, content, type)
  - Logs all notification attempts to console

### 3. Database Triggers
- **Yacht Messages Trigger**: Fires when new records are inserted into `admin_notifications` table
- **Staff Messages Trigger**: Fires when new records are inserted into `staff_messages` table
- Both triggers automatically call the edge function to send notifications

### 4. User Interface Updates
- Added "Notification Settings" section in User Management
- Only visible for staff, manager, and mechanic roles
- Features:
  - Toggle email notifications on/off
  - Optional alternative email address
  - Toggle SMS notifications on/off
  - Optional alternative phone number
  - Helpful instructions and placeholders

## How It Works

1. **New Message Created**: When a new message is added to either `admin_notifications` or `staff_messages` table
2. **Trigger Fires**: The appropriate database trigger detects the new insert
3. **Edge Function Called**: The trigger invokes the `send-message-notification` edge function with yacht_id (for yacht messages)
4. **Recipients Identified**: The function queries all staff/manager/mechanic users who have notifications enabled
5. **Manager Filtering Applied**:
   - **Staff and Mechanics**: Receive ALL notifications regardless of yacht
   - **Managers**: Only receive notifications for messages related to their assigned yacht
6. **Notifications Sent**:
   - Email: Sent to users with `email_notifications_enabled = true`
   - SMS: Sent to users with `sms_notifications_enabled = true`
7. **Logs Created**: All notification attempts are logged to console for debugging

## Email and SMS Configuration

### Current Status
The edge function is fully implemented and logs notification details to the console. To enable actual email and SMS delivery, you need to:

### Email Setup (Choose One):
1. **Resend** (Recommended)
   - Sign up at https://resend.com
   - Get API key
   - Add code to edge function to send via Resend API

2. **SendGrid**
   - Sign up at https://sendgrid.com
   - Get API key
   - Add code to edge function to send via SendGrid API

3. **AWS SES**
   - Configure AWS SES
   - Add credentials as Supabase secrets
   - Add code to edge function to send via AWS SDK

### SMS Setup:
1. **Twilio** (Recommended)
   - Sign up at https://twilio.com
   - Get Account SID and Auth Token
   - Get a Twilio phone number
   - Add code to edge function to send via Twilio API

### Configuration Steps:
1. Choose your email/SMS provider(s)
2. Get API credentials from the provider
3. Update the edge function code to use the provider's API
4. Test with a small group before rolling out to all users

## Usage

### For Administrators:
1. Go to Admin Tab → User Management
2. Select a staff, manager, or mechanic user
3. Scroll to "Notification Settings" section
4. Configure notification preferences:
   - Enable/disable email notifications
   - Optionally set alternative email
   - Enable/disable SMS notifications
   - Optionally set alternative phone number
5. Save changes

### For Staff Members:
- Once configured, staff members will automatically receive notifications when:
  - New yacht messages arrive (check-in/check-out alerts, owner messages)
  - New staff messages arrive (appointments, general notifications)
- Notifications include:
  - Sender name
  - Yacht name (if applicable)
  - Message content
  - Timestamp
  - Link/instruction to log in

## Testing

To test the notification system:

1. **Create a test staff user** with notifications enabled
2. **Trigger a new message** by:
   - Having an owner send a yacht message
   - Creating a new appointment (generates staff message)
   - Manually inserting a test record into `admin_notifications` or `staff_messages`
3. **Check the console logs** in Supabase Edge Functions to see notification attempts
4. **Review the notification details** in the logs

## Security

- Only staff, managers, and mechanics receive notifications (owners do not)
- Managers only receive notifications for their assigned yacht (not all yachts)
- Database triggers run with proper security context
- Edge function validates user roles before sending notifications
- Personal email/phone data is protected by RLS policies
- Notifications are sent asynchronously without blocking message creation

## Future Enhancements

Potential improvements:
- Notification digest (batch multiple messages)
- Quiet hours (suppress notifications during specific times)
- Rate limiting (prevent notification spam)
- Read receipts (track which notifications were opened)
- Notification history log table
- User-configurable notification types (choose which message types to receive)
- In-app notifications (browser notifications)
- Mobile push notifications

## Troubleshooting

### Notifications Not Being Sent
1. Check edge function logs in Supabase dashboard
2. Verify database triggers are active
3. Confirm user has notification preferences enabled
4. Check that user has valid email/phone number

### Wrong Recipients Receiving Notifications
1. Verify user roles are correct (staff/manager/mechanic)
2. Check notification preference settings for each user
3. Review edge function logic for recipient filtering

### Email/SMS Provider Issues
1. Verify API credentials are correct
2. Check provider rate limits
3. Review provider logs for delivery failures
4. Ensure sender email/phone is verified with provider
