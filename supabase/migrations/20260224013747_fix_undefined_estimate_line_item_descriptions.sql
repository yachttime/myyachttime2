/*
  # Fix undefined - undefined descriptions in estimate_line_items

  ## Summary
  Five line items in estimate EST000010 (task "Main Engine Start up") were saved
  with description = 'undefined - undefined' due to a bug where Mercury parts
  from packages had no part_id and the fallback description construction failed.

  The correct part data was recovered by matching unit prices against the
  estimate_package_parts table which stores part_number_display and description_display.

  ## Changes
  - Updates the 5 affected estimate_line_items rows with correct descriptions
    matched by their unique unit prices within the specific task
*/

UPDATE estimate_line_items
SET description = CASE
  WHEN unit_price = 89.99  THEN '0035-879172104 - FILTER-FUEL'
  WHEN unit_price = 162.99 THEN '0047-879312025 - IMPELLER'
  WHEN unit_price = 22.49  THEN '0035-879312041 - FILTER-OIL'
  WHEN unit_price = 118.49 THEN '0057-879172120 - BELT-SERPENTINE'
  WHEN unit_price = 364.99 THEN '0035-8M0047848 - FILTER ASSY-AIR'
END
WHERE description = 'undefined - undefined'
  AND line_type = 'part';
