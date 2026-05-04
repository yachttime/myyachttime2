/*
  # Add repair request deposit sync columns to estimates

  ## Overview
  Estimates need visibility into whether their linked repair request has collected
  a deposit. Previously this info lived only on repair_requests and never propagated
  back to the estimate record.

  ## New Columns on `estimates`
  - `repair_request_deposit_status` (text) - mirrors repair_requests.deposit_payment_status
  - `repair_request_deposit_amount` (numeric) - amount collected via repair request
  - `repair_request_deposit_paid_at` (timestamptz) - when it was paid
  - `repair_request_deposit_method` (text) - card/ach/check

  ## New Trigger: `sync_repair_request_deposit_to_estimate`
  - Fires AFTER UPDATE of deposit_payment_status on repair_requests
  - When deposit becomes 'paid': writes deposit info back to linked estimate
  - When deposit becomes 'paid': also updates linked work_order if one exists
    and the work_order deposit was not already marked paid

  ## Notes
  - Only syncs forward (paid), never resets already-paid deposits
  - Safe if estimate_id or work_order_id is NULL on repair_request
*/

-- Add sync columns to estimates
ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS repair_request_deposit_status text,
  ADD COLUMN IF NOT EXISTS repair_request_deposit_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS repair_request_deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS repair_request_deposit_method text;

-- Trigger function: when repair_request deposit is paid, sync to linked estimate and work_order
CREATE OR REPLACE FUNCTION sync_repair_request_deposit_to_estimate()
RETURNS TRIGGER AS $$
DECLARE
  v_work_order_id uuid;
BEGIN
  -- Only act when deposit_payment_status changes
  IF NEW.deposit_payment_status = OLD.deposit_payment_status THEN
    RETURN NEW;
  END IF;

  -- Sync to linked estimate when deposit is paid
  IF NEW.deposit_payment_status = 'paid' AND NEW.estimate_id IS NOT NULL THEN
    UPDATE estimates
    SET
      repair_request_deposit_status = 'paid',
      repair_request_deposit_amount = NEW.deposit_amount,
      repair_request_deposit_paid_at = COALESCE(NEW.deposit_paid_at, now()),
      repair_request_deposit_method = NEW.deposit_payment_method_type,
      updated_at = now()
    WHERE id = NEW.estimate_id
      AND (repair_request_deposit_status IS NULL OR repair_request_deposit_status != 'paid');
  END IF;

  -- Also sync to work_order if one is linked and its deposit wasn't already marked paid
  IF NEW.deposit_payment_status = 'paid' AND NEW.deposit_amount IS NOT NULL THEN
    -- Find work_order via estimate_id or work_order_id
    IF NEW.work_order_id IS NOT NULL THEN
      v_work_order_id := NEW.work_order_id;
    ELSIF NEW.estimate_id IS NOT NULL THEN
      SELECT id INTO v_work_order_id
      FROM work_orders
      WHERE estimate_id = NEW.estimate_id
      LIMIT 1;
    END IF;

    IF v_work_order_id IS NOT NULL THEN
      UPDATE work_orders
      SET
        deposit_required = true,
        deposit_amount = NEW.deposit_amount,
        deposit_payment_status = 'paid',
        deposit_paid_at = COALESCE(NEW.deposit_paid_at, now()),
        deposit_payment_method_type = COALESCE(NEW.deposit_payment_method_type, 'card'),
        updated_at = now()
      WHERE id = v_work_order_id
        AND (deposit_payment_status IS NULL OR deposit_payment_status != 'paid');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_repair_request_deposit_to_estimate ON repair_requests;

CREATE TRIGGER trigger_sync_repair_request_deposit_to_estimate
  AFTER UPDATE OF deposit_payment_status ON repair_requests
  FOR EACH ROW
  EXECUTE FUNCTION sync_repair_request_deposit_to_estimate();
