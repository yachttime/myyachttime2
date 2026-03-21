/*
  # Fix notify_staff_repair_invoice_paid trigger - wrong column name

  1. Problem
    - The trigger function references NEW.billed_by which does not exist on yacht_invoices
    - The correct column is completed_by
    - This causes any UPDATE to yacht_invoices to fail with a column-not-found error

  2. Fix
    - Replace NEW.billed_by with NEW.completed_by in the trigger function
*/

CREATE OR REPLACE FUNCTION notify_staff_repair_invoice_paid()
RETURNS TRIGGER AS $$
DECLARE
  v_repair_request record;
  v_yacht_name text;
  v_customer_name text;
  v_display_name text;
  v_actor_name text;
  v_supabase_url text;
BEGIN
  IF NEW.payment_status = 'paid'
    AND (OLD.payment_status IS NULL OR OLD.payment_status != 'paid')
    AND NEW.repair_request_id IS NOT NULL
  THEN
    SELECT id, title, yacht_id, submitted_by, customer_name
    INTO v_repair_request
    FROM repair_requests
    WHERE id = NEW.repair_request_id;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    IF v_repair_request.yacht_id IS NOT NULL THEN
      SELECT name INTO v_yacht_name
      FROM yachts WHERE id = v_repair_request.yacht_id;
    END IF;

    v_customer_name := v_repair_request.customer_name;

    IF v_yacht_name IS NOT NULL AND v_customer_name IS NOT NULL THEN
      v_display_name := v_yacht_name || ' (' || v_customer_name || ')';
    ELSIF v_yacht_name IS NOT NULL THEN
      v_display_name := v_yacht_name;
    ELSIF v_customer_name IS NOT NULL THEN
      v_display_name := v_customer_name;
    ELSE
      v_display_name := 'Retail Customer';
    END IF;

    IF NEW.completed_by IS NOT NULL THEN
      SELECT COALESCE(up.first_name || ' ' || up.last_name, u.email, 'System')
      INTO v_actor_name
      FROM auth.users u
      LEFT JOIN user_profiles up ON up.user_id = u.id
      WHERE u.id = NEW.completed_by;
    ELSE
      v_actor_name := 'System';
    END IF;

    BEGIN
      SELECT COALESCE(
        current_setting('app.settings.supabase_url', true),
        'https://eqiecntollhgfxmmbize.supabase.co'
      ) INTO v_supabase_url;

      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/send-repair-approval-notification',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'repairRequestId', v_repair_request.id,
          'repairTitle', v_repair_request.title,
          'yachtName', v_display_name,
          'customerName', COALESCE(v_customer_name, ''),
          'actorName', v_actor_name,
          'eventType', 'paid',
          'finalAmount', NEW.invoice_amount_numeric::text
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error calling send-repair-approval-notification (paid): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
