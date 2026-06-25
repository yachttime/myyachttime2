
INSERT INTO estimating_invoice_line_items (invoice_id, task_name, line_type, description, quantity, unit_price, total_price, is_taxable, line_order)
VALUES
  ('70428723-0fe6-44d7-a129-4499fac54e12', 'A/C Repair', 'part',  'A/C WATER PUMP', 1.00, 1890.80, 1890.80, true,  6),
  ('70428723-0fe6-44d7-a129-4499fac54e12', 'A/C Repair', 'labor', 'A/C LABOR',      1.00,  350.00,  350.00, false, 7);

UPDATE estimating_invoices
SET
  subtotal             = 3007.50,
  tax_amount           = 202.46,
  shop_supplies_amount = 150.38,
  park_fees_amount     = 90.23,
  surcharge_amount     = 336.12,
  total_amount         = 3786.67,
  balance_due          = 3786.67,
  updated_at           = now()
WHERE id = '70428723-0fe6-44d7-a129-4499fac54e12';
