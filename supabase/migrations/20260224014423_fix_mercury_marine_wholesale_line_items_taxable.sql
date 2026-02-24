/*
  # Fix is_taxable for Mercury and Marine Wholesale estimate line items

  ## Summary
  Mercury Marine and Marine Wholesale parts must always be taxable.
  Existing estimate_line_items records where part_source is 'mercury' or
  'marine_wholesale' had is_taxable = false due to a prior bug where the
  package import did not propagate is_taxable correctly.

  ## Changes
  - estimate_line_items: set is_taxable = true for all mercury and marine_wholesale parts
  - work_order_line_items: set is_taxable = true for all mercury and marine_wholesale parts
*/

UPDATE estimate_line_items
SET is_taxable = true
WHERE part_source IN ('mercury', 'marine_wholesale')
  AND is_taxable = false;

UPDATE work_order_line_items
SET is_taxable = true
WHERE part_source IN ('mercury', 'marine_wholesale')
  AND is_taxable = false;
