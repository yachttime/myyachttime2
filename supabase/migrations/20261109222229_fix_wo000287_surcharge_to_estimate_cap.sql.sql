/*
# Correct WO000287 surcharge to the approved estimate cap

1. Modified Data
- `work_orders` row WO000287: surcharge_amount changed from 14267.89 to 7500.00 (the cap in estimate_settings), and total_amount recalculated to 116272.33 so it matches its source estimate EST000317.

2. Security
- No policy or grant changes.

3. Important Notes
- The update is guarded by the old surcharge value, so re-running it does nothing once corrected.
- No invoice was created from this work order, so no customer-facing amounts change.
*/

UPDATE work_orders
SET surcharge_amount = 7500.00,
    total_amount = 116272.33
WHERE work_order_number = 'WO000287'
  AND surcharge_amount = 14267.89;
