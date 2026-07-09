-- Sync work_details from work_order_line_items to estimating_invoice_line_items
-- for records where the estimating copy is missing the data.
-- Match by invoice->work_order relationship and description+line_type+quantity.
UPDATE estimating_invoice_line_items eli
SET work_details = wli.work_details
FROM estimating_invoices ei
JOIN work_order_line_items wli ON wli.work_order_id = ei.work_order_id
WHERE eli.invoice_id = ei.id
  AND eli.description = wli.description
  AND eli.line_type = wli.line_type
  AND eli.quantity = wli.quantity
  AND (eli.work_details IS NULL OR eli.work_details = '')
  AND wli.work_details IS NOT NULL
  AND wli.work_details != '';