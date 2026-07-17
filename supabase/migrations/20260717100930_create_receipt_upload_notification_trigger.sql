/*
# Create Receipt Upload Notification Trigger

1. New Functions
  - `create_notifications_for_receipt_upload()` - Trigger function that fires when a
    new receipt is inserted into the `receipts` table.

2. Behavior
  - Looks up the uploader's full name from `user_profiles`.
  - Determines the company_id from the receipt (auto-assigned by existing trigger).
  - Builds a notification message: "Receipt uploaded by [Name] - $[Amount] ([Tag Type])"
  - Inserts one `admin_notifications` row per active **staff** and **master** user
    in the same company (no managers, no mechanics).
  - Inserts one `staff_messages` row for the activity feed.
  - Does NOT insert yacht_history_logs (receipts are not yacht-lifecycle events).

3. New Triggers
  - `trigger_receipt_upload_notifications` on `receipts` AFTER INSERT FOR EACH ROW.

4. Security
  - Function runs with SECURITY DEFINER to allow inserting into notification tables
    regardless of the uploader's own RLS permissions.

5. Important Notes
  - Notifications only go to master and staff roles.
  - The existing `trigger_notify_admin_notification` on `admin_notifications` will
    automatically call the `send-message-notification` edge function for email delivery.
  - yacht_id is nullable since not all receipts are yacht-tagged.
  - notification_type is 'receipt_upload'.
*/

CREATE OR REPLACE FUNCTION create_notifications_for_receipt_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uploader_name text;
  v_company_id uuid;
  v_tag_display text;
  v_notification_message text;
  v_recipient RECORD;
BEGIN
  -- Get uploader name and company_id
  SELECT
    COALESCE(first_name || ' ' || last_name, 'Unknown User'),
    company_id
  INTO v_uploader_name, v_company_id
  FROM user_profiles
  WHERE user_id = NEW.user_id;

  -- Format tag type for display
  v_tag_display := CASE
    WHEN NEW.tag_type = 'yacht' THEN 'Yacht'
    WHEN NEW.tag_type = 'customer' THEN 'Customer'
    WHEN NEW.tag_type = 'shop_supplies' THEN 'Shop Supplies'
    WHEN NEW.tag_type = 'fuel_company_vehicle' THEN 'Fuel - Company Vehicle'
    WHEN NEW.tag_type = 'fuel_company_boat' THEN 'Fuel - Company Boat'
    ELSE NEW.tag_type
  END;

  -- Build notification message
  v_notification_message := format(
    'Receipt uploaded by %s - $%s (%s)',
    v_uploader_name,
    TRIM(TO_CHAR(NEW.amount, 'FM999,999,990.00')),
    v_tag_display
  );

  -- Insert one admin_notifications row for each active staff and master user in the company
  FOR v_recipient IN
    SELECT user_id FROM user_profiles
    WHERE role IN ('staff', 'master')
      AND company_id = v_company_id
      AND is_active = true
  LOOP
    INSERT INTO admin_notifications (
      notification_type,
      reference_id,
      message,
      yacht_id,
      user_id,
      company_id
    ) VALUES (
      'receipt_upload',
      NEW.id,
      v_notification_message,
      NEW.yacht_id,
      v_recipient.user_id,
      v_company_id
    );
  END LOOP;

  -- Broadcast to staff_messages feed
  INSERT INTO staff_messages (
    created_by,
    notification_type,
    reference_id,
    message,
    company_id
  ) VALUES (
    NEW.user_id,
    'receipt_upload',
    NEW.id,
    v_notification_message,
    v_company_id
  );

  RETURN NEW;
END;
$$;

-- Drop trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS trigger_receipt_upload_notifications ON receipts;

-- Create trigger for receipt uploads
CREATE TRIGGER trigger_receipt_upload_notifications
  AFTER INSERT ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION create_notifications_for_receipt_upload();
