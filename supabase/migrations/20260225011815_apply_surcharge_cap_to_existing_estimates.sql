/*
  # Apply Surcharge Cap to Existing Estimates

  ## Summary
  Updates all existing non-archived, non-converted estimates to use the current
  surcharge cap from estimate_settings ($7,500). For any estimate whose surcharge_amount
  exceeds the cap, the surcharge_amount is reduced to the cap and total_amount is
  recalculated accordingly. All estimates get the cap value stamped on them so
  historical records reflect the cap that is now in effect.

  ## Changes
  - `estimates.surcharge_cap` — set to current value from estimate_settings for all rows
  - `estimates.surcharge_amount` — capped at $7,500 where it previously exceeded
  - `estimates.total_amount` — recalculated to reflect the new surcharge_amount
  - `estimates.updated_at` — updated to now() for any modified rows
*/

DO $$
DECLARE
  v_cap numeric;
BEGIN
  SELECT surcharge_cap INTO v_cap FROM estimate_settings LIMIT 1;

  IF v_cap IS NOT NULL THEN
    UPDATE estimates
    SET
      surcharge_cap    = v_cap,
      surcharge_amount = LEAST(surcharge_amount, v_cap),
      total_amount     = total_amount - surcharge_amount + LEAST(surcharge_amount, v_cap),
      updated_at       = now()
    WHERE
      archived = false
      AND status != 'converted';
  END IF;
END $$;
