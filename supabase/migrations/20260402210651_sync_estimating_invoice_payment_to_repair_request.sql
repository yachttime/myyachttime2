/*
  # Sync Estimating Invoice Payment Status to Repair Request

  ## Overview
  When an estimating invoice's payment_status changes, automatically update the linked
  repair_request's deposit_payment_status to match, so both records stay in sync.

  ## Changes

  ### 1. New trigger function: `sync_invoice_payment_to_repair_request()`
  - Fires AFTER UPDATE on `estimating_invoices` when `payment_status` changes
  - Looks up the repair_request that has `estimating_invoice_id = NEW.id`
  - Maps invoice payment status to repair_request deposit_payment_status:
    - invoice 'paid'       → repair_request deposit_payment_status = 'paid', deposit_paid_at = NOW()
    - invoice 'processing' → repair_request deposit_payment_status = 'processing' (no paid_at)
    - invoice 'partial'    → repair_request deposit_payment_status = 'paid' (partial counts as something received)
    - invoice 'unpaid'     → no change (don't reset a previously paid deposit)

  ### 2. New trigger: `trigger_sync_invoice_payment_to_repair_request`
  - Fires on estimating_invoices AFTER UPDATE when payment_status changes

  ## Notes
  - Only syncs forward (paid/processing), never resets a paid status back to pending
  - Safe to run multiple times (idempotent)
*/

CREATE OR REPLACE FUNCTION sync_invoice_payment_to_repair_request()
RETURNS TRIGGER AS $$
DECLARE
  v_repair_request_id uuid;
BEGIN
  IF NEW.payment_status = OLD.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_repair_request_id
  FROM repair_requests
  WHERE estimating_invoice_id = NEW.id
  LIMIT 1;

  IF v_repair_request_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.payment_status = 'paid' THEN
    UPDATE repair_requests
    SET
      deposit_payment_status = 'paid',
      deposit_paid_at = COALESCE(NEW.paid_at, now()),
      updated_at = now()
    WHERE id = v_repair_request_id
      AND deposit_payment_status != 'paid';

  ELSIF NEW.payment_status = 'processing' THEN
    UPDATE repair_requests
    SET
      deposit_payment_status = 'processing',
      updated_at = now()
    WHERE id = v_repair_request_id
      AND deposit_payment_status NOT IN ('paid');

  ELSIF NEW.payment_status = 'partial' THEN
    UPDATE repair_requests
    SET
      deposit_payment_status = 'paid',
      deposit_paid_at = COALESCE(deposit_paid_at, now()),
      updated_at = now()
    WHERE id = v_repair_request_id
      AND deposit_payment_status NOT IN ('paid');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_sync_invoice_payment_to_repair_request ON estimating_invoices;

CREATE TRIGGER trigger_sync_invoice_payment_to_repair_request
  AFTER UPDATE OF payment_status ON estimating_invoices
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_payment_to_repair_request();
