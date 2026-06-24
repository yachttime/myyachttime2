-- Add review workflow columns to trip_inspections
ALTER TABLE trip_inspections
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'approved')),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes text;

-- Backfill all existing inspections as already approved so history is undisturbed
UPDATE trip_inspections SET review_status = 'approved' WHERE review_status = 'pending_review';

-- Update the trip inspection notification trigger to say "ready for review"
CREATE OR REPLACE FUNCTION create_notifications_for_trip_inspection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yacht_name text;
  inspector_name text;
  notif_message text;
  recipient RECORD;
  yacht_company_id uuid;
BEGIN
  -- Get yacht name and company_id
  SELECT name, company_id INTO yacht_name, yacht_company_id
  FROM yachts WHERE id = NEW.yacht_id;

  -- Get inspector full name
  SELECT COALESCE(first_name || ' ' || last_name, 'Staff') INTO inspector_name
  FROM user_profiles WHERE user_id = NEW.inspector_id;

  notif_message := 'Trip inspection ready for review — ' || COALESCE(yacht_name, 'Unknown Yacht') || ' by ' || COALESCE(inspector_name, 'Inspector');

  -- Create per-recipient admin_notifications for staff, master users in same company
  FOR recipient IN
    SELECT up.user_id
    FROM user_profiles up
    WHERE up.role IN ('staff', 'master')
      AND up.is_active = true
      AND up.company_id = yacht_company_id
      AND up.user_id != NEW.inspector_id
  LOOP
    INSERT INTO admin_notifications (user_id, notification_type, message, reference_id, yacht_id)
    VALUES (recipient.user_id, 'trip_inspection', notif_message, NEW.id, NEW.yacht_id);
  END LOOP;

  -- Also notify managers assigned to this yacht
  FOR recipient IN
    SELECT DISTINCT up.user_id
    FROM user_profiles up
    JOIN yacht_bookings yb ON yb.user_id = up.user_id
    WHERE up.role = 'manager'
      AND yb.yacht_id = NEW.yacht_id
      AND up.is_active = true
      AND up.company_id = yacht_company_id
      AND up.user_id != NEW.inspector_id
  LOOP
    INSERT INTO admin_notifications (user_id, notification_type, message, reference_id, yacht_id)
    VALUES (recipient.user_id, 'trip_inspection', notif_message, NEW.id, NEW.yacht_id);
  END LOOP;

  -- Staff messages broadcast (single row for all staff/master/mechanic)
  INSERT INTO staff_messages (message, notification_type, reference_id, yacht_id)
  VALUES (notif_message, 'trip_inspection', NEW.id, NEW.yacht_id);

  -- Yacht history log
  INSERT INTO yacht_history_logs (yacht_id, action, reference_id, reference_type, user_id)
  VALUES (NEW.yacht_id, 'Trip inspection submitted — ready for review by ' || COALESCE(inspector_name, 'Inspector'), NEW.id, 'trip_inspection', NEW.inspector_id);

  RETURN NEW;
END;
$$;
