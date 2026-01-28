/*
  # Make yacht_id nullable in admin_notifications

  1. Changes
    - Alter `yacht_id` column in `admin_notifications` to allow NULL values
    - This allows system-wide notifications and notifications for users without yachts (staff members)
  
  2. Reason
    - Staff users (admin, manager, mechanic) may not have a yacht_id
    - The trigger that creates notifications when a new user is created was failing for these users
    - Some notifications may be system-wide and not yacht-specific
*/

-- Make yacht_id nullable in admin_notifications
ALTER TABLE admin_notifications 
  ALTER COLUMN yacht_id DROP NOT NULL;
