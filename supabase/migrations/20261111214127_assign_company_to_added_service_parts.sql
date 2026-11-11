UPDATE parts_inventory
SET company_id = (
  SELECT company_id
  FROM parts_inventory
  WHERE company_id IS NOT NULL
  GROUP BY company_id
  ORDER BY count(*) DESC
  LIMIT 1
)
WHERE company_id IS NULL
  AND description = 'Added from engine/generator service parts. Set the price in Parts Inventory.';
