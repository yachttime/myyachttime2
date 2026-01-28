/*
  # Fix Security and Performance Issues - Part 2: Functions

  ## Security Improvements
  
  Set immutable search_path for all functions to prevent SQL injection via search_path manipulation.
  Each function now has `SET search_path = public, pg_temp` to ensure it only uses trusted schemas.
*/

-- Fix is_staff function (no parameters version)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'staff', 'manager', 'mechanic')
    AND is_active = true
  );
END;
$$;

-- Fix is_staff function (with user_uuid parameter)
CREATE OR REPLACE FUNCTION public.is_staff(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = user_uuid
    AND role IN ('admin', 'staff', 'manager', 'mechanic')
    AND is_active = true
  );
END;
$$;

-- Fix user_has_yacht_access function
CREATE OR REPLACE FUNCTION public.user_has_yacht_access(yacht_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND (
      user_profiles.yacht_id = yacht_uuid
      OR role IN ('admin', 'staff')
    )
    AND is_active = true
  );
END;
$$;

-- Fix user_owns_yacht function
CREATE OR REPLACE FUNCTION public.user_owns_yacht(check_user_id uuid, check_yacht_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = check_user_id
    AND user_profiles.yacht_id = check_yacht_id
    AND role = 'owner'
    AND is_active = true
  );
END;
$$;

-- Fix get_user_role function (keeping original return type)
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  role_value user_role;
BEGIN
  SELECT role INTO role_value
  FROM user_profiles
  WHERE id = user_uuid
  AND is_active = true;
  
  RETURN role_value;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_vessel_agreement_updated_at function
CREATE OR REPLACE FUNCTION public.update_vessel_agreement_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_smart_device_updated_at function
CREATE OR REPLACE FUNCTION public.update_smart_device_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix notify_admin_new_user function
CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO admin_notifications (
    type,
    title,
    message,
    user_id,
    yacht_id
  )
  VALUES (
    'new_user',
    'New User Registration',
    'A new user has registered: ' || NEW.first_name || ' ' || NEW.last_name,
    NEW.id,
    NEW.yacht_id
  );
  
  RETURN NEW;
END;
$$;

-- Fix log_new_user_activity function
CREATE OR REPLACE FUNCTION public.log_new_user_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO yacht_history_logs (
    yacht_id,
    action,
    details,
    created_by
  )
  VALUES (
    NEW.yacht_id,
    'user_registered',
    'New user registered: ' || NEW.first_name || ' ' || NEW.last_name || ' (' || NEW.role || ')',
    NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Fix create_staff_message_for_appointment function
CREATE OR REPLACE FUNCTION public.create_staff_message_for_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO staff_messages (
    message_type,
    title,
    message,
    created_by
  )
  VALUES (
    'appointment',
    'New Appointment: ' || NEW.title,
    'Appointment scheduled for ' || NEW.appointment_date || ' at ' || NEW.appointment_time,
    NEW.created_by
  );
  
  RETURN NEW;
END;
$$;

-- Fix create_notifications_for_repair_request function
CREATE OR REPLACE FUNCTION public.create_notifications_for_repair_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert admin notification
  INSERT INTO admin_notifications (
    type,
    title,
    message,
    user_id,
    yacht_id,
    reference_id
  )
  VALUES (
    'repair_request',
    'New Repair Request',
    NEW.description,
    NEW.submitted_by,
    NEW.yacht_id,
    NEW.id
  );
  
  -- Insert yacht history log if yacht_id exists
  IF NEW.yacht_id IS NOT NULL THEN
    INSERT INTO yacht_history_logs (
      yacht_id,
      action,
      details,
      created_by,
      reference_id
    )
    VALUES (
      NEW.yacht_id,
      'repair_request_created',
      'Repair request submitted: ' || NEW.description,
      NEW.submitted_by,
      NEW.id
    );
  END IF;
  
  -- Insert owner chat message if yacht_id exists
  IF NEW.yacht_id IS NOT NULL THEN
    INSERT INTO owner_chat_messages (
      yacht_id,
      user_id,
      message
    )
    VALUES (
      NEW.yacht_id,
      NEW.submitted_by,
      'Repair request submitted: ' || NEW.description
    );
  END IF;
  
  RETURN NEW;
END;
$$;
