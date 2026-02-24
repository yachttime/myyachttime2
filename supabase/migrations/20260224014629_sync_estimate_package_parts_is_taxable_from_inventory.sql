/*
  # Sync estimate_package_parts.is_taxable from parts_inventory

  ## Summary
  Package parts of source 'inventory' had is_taxable = false even when the
  underlying inventory item had is_taxable = true. This migration syncs the
  package part taxable flag from the inventory record so future package imports
  reflect the correct value.

  ## Changes
  - estimate_package_parts: update is_taxable from parts_inventory for inventory-sourced parts
*/

UPDATE estimate_package_parts epp
SET is_taxable = pi.is_taxable
FROM parts_inventory pi
WHERE epp.part_id = pi.id
  AND epp.part_source = 'inventory'
  AND epp.is_taxable IS DISTINCT FROM pi.is_taxable;
