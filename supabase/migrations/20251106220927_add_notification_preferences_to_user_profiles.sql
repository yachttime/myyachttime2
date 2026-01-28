/*
  # Add Notification Preferences to User Profiles

  1. Changes
    - Add `email_notifications_enabled` (boolean) - Whether user wants email notifications (default true)
    - Add `sms_notifications_enabled` (boolean) - Whether user wants SMS notifications (default false)
    - Add `notification_email` (text, nullable) - Alternative email for notifications (uses email if null)
    - Add `notification_phone` (text, nullable) - Phone number for SMS notifications
    
  2. Notes
    - Email notifications are enabled by default for staff/managers/mechanics
    - SMS notifications are disabled by default (requires phone number setup)
    - Users can use different email/phone for notifications than their primary contact
    - Only staff, manager, and mechanic roles will receive notifications
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'email_notifications_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN email_notifications_enabled boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'sms_notifications_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN sms_notifications_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notification_email'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notification_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notification_phone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notification_phone text;
  END IF;
END $$;