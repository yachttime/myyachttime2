/*
  # Create generate_pos_for_work_order function

  ## Summary
  Creates a reusable function that generates purchase orders for any work order
  by scanning its part line items and grouping them by vendor.
  This is used both by approve_estimate (going forward) and to backfill
  POs for existing work orders that pre-date the PO system.

  ## Logic
  - Groups all part-type line items by vendor
  - Skips items with no vendor (null part_id, no mercury/wholesale ref)
  - inventory parts: vendor from parts_inventory.vendor_id → vendors
  - mercury parts: vendor = 'Mercury Marine'
  - marine_wholesale parts: vendor = 'Marine Wholesale'
  - custom: skipped
  - One PO per vendor per work order
*/

CREATE OR REPLACE FUNCTION generate_pos_for_work_order(
  p_work_order_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_work_order record;
  v_yacht_name text;
  v_line_item record;
  v_vendor_id uuid;
  v_vendor_name text;
  v_vendor_contact text;
  v_vendor_email text;
  v_vendor_phone text;
  v_vendor_address text;
  v_vendor_city text;
  v_vendor_state text;
  v_vendor_zip text;
  v_vendor_source text;
  v_po_id uuid;
  v_po_number text;
  v_next_po_number integer;
  v_part_number text;
  v_pos_created integer := 0;
BEGIN
  SELECT * INTO v_work_order FROM work_orders WHERE id = p_work_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found';
  END IF;

  IF v_work_order.yacht_id IS NOT NULL THEN
    SELECT name INTO v_yacht_name FROM yachts WHERE id = v_work_order.yacht_id;
  END IF;

  FOR v_line_item IN
    SELECT
      woli.id,
      woli.description,
      woli.quantity,
      woli.unit_price,
      woli.total_price,
      woli.part_source,
      woli.part_id,
      woli.mercury_part_id,
      woli.marine_wholesale_part_id,
      woli.line_order
    FROM work_order_line_items woli
    WHERE woli.work_order_id = p_work_order_id
      AND woli.line_type = 'part'
  LOOP
    v_vendor_id := NULL;
    v_vendor_name := NULL;
    v_vendor_contact := NULL;
    v_vendor_email := NULL;
    v_vendor_phone := NULL;
    v_vendor_address := NULL;
    v_vendor_city := NULL;
    v_vendor_state := NULL;
    v_vendor_zip := NULL;
    v_vendor_source := 'custom';
    v_part_number := NULL;

    IF v_line_item.part_source = 'inventory' AND v_line_item.part_id IS NOT NULL THEN
      SELECT
        pi.part_number, v.id, v.vendor_name, v.contact_name,
        v.email, v.phone, v.address, v.city, v.state, v.zip
      INTO
        v_part_number, v_vendor_id, v_vendor_name, v_vendor_contact,
        v_vendor_email, v_vendor_phone, v_vendor_address, v_vendor_city, v_vendor_state, v_vendor_zip
      FROM parts_inventory pi
      LEFT JOIN vendors v ON pi.vendor_id = v.id
      WHERE pi.id = v_line_item.part_id;
      IF v_vendor_name IS NULL THEN CONTINUE; END IF;
      v_vendor_source := 'vendor';

    ELSIF v_line_item.part_source = 'mercury' AND v_line_item.mercury_part_id IS NOT NULL THEN
      SELECT part_number INTO v_part_number FROM mercury_marine_parts WHERE id = v_line_item.mercury_part_id;
      v_vendor_name := 'Mercury Marine';
      v_vendor_source := 'mercury';

    ELSIF v_line_item.part_source = 'marine_wholesale' AND v_line_item.marine_wholesale_part_id IS NOT NULL THEN
      SELECT sku INTO v_part_number FROM marine_wholesale_parts WHERE id = v_line_item.marine_wholesale_part_id;
      v_vendor_name := 'Marine Wholesale';
      v_vendor_source := 'marine_wholesale';

    ELSE
      CONTINUE;
    END IF;

    -- Find existing PO for this vendor + work order, or create new one
    SELECT id INTO v_po_id
    FROM purchase_orders
    WHERE work_order_id = p_work_order_id AND vendor_name = v_vendor_name
    LIMIT 1;

    IF v_po_id IS NULL THEN
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 3) AS INTEGER)), 0) + 1
      INTO v_next_po_number FROM purchase_orders;
      v_po_number := 'PO' || LPAD(v_next_po_number::text, 6, '0');

      INSERT INTO purchase_orders (
        po_number, work_order_id, work_order_number,
        customer_name, customer_email, customer_phone, yacht_name,
        vendor_id, vendor_name, vendor_contact_name,
        vendor_email, vendor_phone, vendor_address, vendor_city, vendor_state, vendor_zip,
        vendor_source, status, total_cost, company_id, created_by
      ) VALUES (
        v_po_number, p_work_order_id, v_work_order.work_order_number,
        v_work_order.customer_name, v_work_order.customer_email, v_work_order.customer_phone, v_yacht_name,
        v_vendor_id, v_vendor_name, v_vendor_contact,
        v_vendor_email, v_vendor_phone, v_vendor_address, v_vendor_city, v_vendor_state, v_vendor_zip,
        v_vendor_source, 'pending', 0, v_work_order.company_id, p_user_id
      )
      RETURNING id INTO v_po_id;
      v_pos_created := v_pos_created + 1;
    END IF;

    -- Skip if this line item already has a PO entry
    IF EXISTS (SELECT 1 FROM purchase_order_line_items WHERE work_order_line_item_id = v_line_item.id) THEN
      CONTINUE;
    END IF;

    INSERT INTO purchase_order_line_items (
      purchase_order_id, work_order_line_item_id, part_number, description,
      quantity, unit_cost, total_cost, part_source, part_id,
      mercury_part_id, marine_wholesale_part_id, line_order
    ) VALUES (
      v_po_id, v_line_item.id, v_part_number, v_line_item.description,
      v_line_item.quantity, v_line_item.unit_price,
      COALESCE(v_line_item.total_price, v_line_item.quantity * v_line_item.unit_price),
      v_line_item.part_source, v_line_item.part_id,
      v_line_item.mercury_part_id, v_line_item.marine_wholesale_part_id, v_line_item.line_order
    );

    UPDATE purchase_orders
    SET total_cost = total_cost + COALESCE(v_line_item.total_price, v_line_item.quantity * v_line_item.unit_price),
        updated_at = now()
    WHERE id = v_po_id;

  END LOOP;

  RETURN jsonb_build_object('success', true, 'pos_created', v_pos_created);
END;
$$;

GRANT EXECUTE ON FUNCTION generate_pos_for_work_order TO authenticated;

-- Backfill POs for WO000006 (the work order with 37 parts)
SELECT generate_pos_for_work_order(
  'aa41866c-927d-46ab-8a2a-1409842f6d4b',
  '610f94b4-646f-4f5b-b64a-a47723f6e85e'
);
