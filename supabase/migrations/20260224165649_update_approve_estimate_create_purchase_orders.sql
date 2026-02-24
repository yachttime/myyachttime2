/*
  # Update approve_estimate to Auto-Create Purchase Orders

  ## Summary
  Updates the approve_estimate function to automatically generate purchase orders
  when an estimate is converted to a work order.

  ## Logic
  - For each part-type line item on the estimate, determine the vendor:
    - parts_inventory parts: use parts_inventory.vendor_id → vendors table
    - mercury parts: vendor_name = 'Mercury Marine'
    - marine_wholesale parts: vendor_name = 'Marine Wholesale'
    - custom parts: skip (no vendor to order from) unless vendor name exists
  - Group parts by vendor, creating one PO per vendor per work order
  - PO number format: PO000001
  - All POs start in 'draft' status

  ## Important Notes
  1. Only 'part' line_type items are included in POs
  2. Items already in inventory (part_source = 'inventory') that have sufficient stock
     are still included so the shop knows what was consumed
  3. PO totals are calculated from unit_price (cost to shop) of line items
*/

CREATE OR REPLACE FUNCTION approve_estimate(
  p_estimate_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_estimate record;
  v_work_order_id uuid;
  v_work_order_number text;
  v_next_number integer;
  v_inventory_result jsonb;
  v_line_item record;
  v_vendor_name text;
  v_vendor_id uuid;
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
  v_work_order_line_item_id uuid;
  v_part_number text;
  v_yacht_name text;
  v_company_id uuid;
  v_work_order_task_id uuid;
BEGIN
  -- Check if user has permission
  -- Allowed: staff, mechanic, master, OR manager with can_approve_repairs
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = p_user_id 
    AND is_active = true
    AND (
      role IN ('staff', 'mechanic', 'master')
      OR (role = 'manager' AND can_approve_repairs = true)
    )
  ) THEN
    RAISE EXCEPTION 'You do not have permission to approve estimates';
  END IF;

  -- Get estimate details
  SELECT * INTO v_estimate
  FROM estimates
  WHERE id = p_estimate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estimate not found';
  END IF;

  -- Check if estimate can be approved
  IF v_estimate.status NOT IN ('draft', 'sent') THEN
    RAISE EXCEPTION 'Estimate cannot be approved. Current status: %', v_estimate.status;
  END IF;

  -- Get company_id from estimate
  v_company_id := v_estimate.company_id;

  -- Get yacht name if applicable
  IF v_estimate.yacht_id IS NOT NULL THEN
    SELECT name INTO v_yacht_name FROM yachts WHERE id = v_estimate.yacht_id;
  END IF;

  -- Update estimate status to approved (use user_id directly)
  UPDATE estimates
  SET 
    status = 'approved',
    approved_by = p_user_id,
    approved_at = now(),
    updated_at = now()
  WHERE id = p_estimate_id;

  -- Generate work order number
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 3) AS INTEGER)), 0) + 1
  INTO v_next_number
  FROM work_orders;
  
  v_work_order_number := 'WO' || LPAD(v_next_number::text, 6, '0');

  -- Create work order (use user_id directly)
  INSERT INTO work_orders (
    work_order_number,
    estimate_id,
    yacht_id,
    customer_name,
    customer_email,
    customer_phone,
    is_retail_customer,
    status,
    total_hours_worked,
    subtotal,
    sales_tax_rate,
    sales_tax_amount,
    shop_supplies_rate,
    shop_supplies_amount,
    park_fees_rate,
    park_fees_amount,
    surcharge_rate,
    surcharge_amount,
    total_amount,
    notes,
    customer_notes,
    created_by
  ) VALUES (
    v_work_order_number,
    p_estimate_id,
    v_estimate.yacht_id,
    v_estimate.customer_name,
    v_estimate.customer_email,
    v_estimate.customer_phone,
    v_estimate.is_retail_customer,
    'pending',
    0,
    v_estimate.subtotal,
    v_estimate.sales_tax_rate,
    v_estimate.sales_tax_amount,
    v_estimate.shop_supplies_rate,
    v_estimate.shop_supplies_amount,
    v_estimate.park_fees_rate,
    v_estimate.park_fees_amount,
    v_estimate.surcharge_rate,
    v_estimate.surcharge_amount,
    v_estimate.total_amount,
    v_estimate.notes,
    v_estimate.customer_notes,
    p_user_id
  )
  RETURNING id INTO v_work_order_id;

  -- Copy estimate tasks to work order tasks
  INSERT INTO work_order_tasks (
    work_order_id,
    task_name,
    task_overview,
    task_order,
    apply_surcharge,
    is_completed
  )
  SELECT
    v_work_order_id,
    task_name,
    task_overview,
    task_order,
    apply_surcharge,
    false
  FROM estimate_tasks
  WHERE estimate_id = p_estimate_id;

  -- Copy estimate line items to work order line items
  INSERT INTO work_order_line_items (
    work_order_id,
    task_id,
    line_type,
    description,
    quantity,
    unit_price,
    total_price,
    is_taxable,
    labor_code_id,
    part_id,
    line_order,
    work_details
  )
  SELECT
    v_work_order_id,
    wot.id,
    eli.line_type,
    eli.description,
    eli.quantity,
    eli.unit_price,
    eli.total_price,
    eli.is_taxable,
    eli.labor_code_id,
    eli.part_id,
    eli.line_order,
    eli.work_details
  FROM estimate_line_items eli
  JOIN estimate_tasks et ON eli.task_id = et.id
  JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id 
    AND wot.task_name = et.task_name 
    AND wot.task_order = et.task_order
  WHERE et.estimate_id = p_estimate_id;

  -- Process inventory deductions (use user_id directly)
  SELECT process_estimate_inventory_deduction(p_estimate_id, p_user_id)
  INTO v_inventory_result;

  -- =============================================
  -- AUTO-CREATE PURCHASE ORDERS BY VENDOR
  -- =============================================
  -- Loop through all part-type line items on the estimate
  FOR v_line_item IN
    SELECT 
      eli.id AS estimate_line_item_id,
      eli.description,
      eli.quantity,
      eli.unit_price,
      eli.total_price,
      eli.part_source,
      eli.part_id,
      eli.mercury_part_id,
      eli.marine_wholesale_part_id,
      eli.line_order,
      -- Get work order line item id
      woli.id AS work_order_line_item_id
    FROM estimate_line_items eli
    JOIN estimate_tasks et ON eli.task_id = et.id
    JOIN work_order_tasks wot ON wot.work_order_id = v_work_order_id 
      AND wot.task_name = et.task_name 
      AND wot.task_order = et.task_order
    LEFT JOIN work_order_line_items woli ON woli.work_order_id = v_work_order_id
      AND woli.task_id = wot.id
      AND woli.description = eli.description
      AND woli.line_order = eli.line_order
    WHERE et.estimate_id = p_estimate_id
      AND eli.line_type = 'part'
  LOOP
    -- Reset vendor variables
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

    -- Determine vendor based on part_source
    IF v_line_item.part_source = 'inventory' AND v_line_item.part_id IS NOT NULL THEN
      -- Get vendor from parts_inventory
      SELECT 
        pi.part_number,
        v.id,
        v.vendor_name,
        v.contact_name,
        v.email,
        v.phone,
        v.address,
        v.city,
        v.state,
        v.zip
      INTO 
        v_part_number,
        v_vendor_id,
        v_vendor_name,
        v_vendor_contact,
        v_vendor_email,
        v_vendor_phone,
        v_vendor_address,
        v_vendor_city,
        v_vendor_state,
        v_vendor_zip
      FROM parts_inventory pi
      LEFT JOIN vendors v ON pi.vendor_id = v.id
      WHERE pi.id = v_line_item.part_id;
      
      -- If no vendor assigned to this part, skip PO creation for it
      IF v_vendor_name IS NULL THEN
        CONTINUE;
      END IF;
      v_vendor_source := 'vendor';

    ELSIF v_line_item.part_source = 'mercury' AND v_line_item.mercury_part_id IS NOT NULL THEN
      -- Mercury Marine vendor
      SELECT part_number INTO v_part_number
      FROM mercury_marine_parts WHERE id = v_line_item.mercury_part_id;
      v_vendor_name := 'Mercury Marine';
      v_vendor_source := 'mercury';

    ELSIF v_line_item.part_source = 'marine_wholesale' AND v_line_item.marine_wholesale_part_id IS NOT NULL THEN
      -- Marine Wholesale vendor
      SELECT sku INTO v_part_number
      FROM marine_wholesale_parts WHERE id = v_line_item.marine_wholesale_part_id;
      v_vendor_name := 'Marine Wholesale';
      v_vendor_source := 'marine_wholesale';

    ELSE
      -- Custom part - skip (no vendor info available)
      CONTINUE;
    END IF;

    -- Find or create PO for this vendor + work order combination
    SELECT id INTO v_po_id
    FROM purchase_orders
    WHERE work_order_id = v_work_order_id
      AND vendor_name = v_vendor_name
    LIMIT 1;

    IF v_po_id IS NULL THEN
      -- Generate new PO number
      SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 3) AS INTEGER)), 0) + 1
      INTO v_next_po_number
      FROM purchase_orders;
      
      v_po_number := 'PO' || LPAD(v_next_po_number::text, 6, '0');

      -- Create new PO
      INSERT INTO purchase_orders (
        po_number,
        work_order_id,
        work_order_number,
        customer_name,
        customer_email,
        customer_phone,
        yacht_name,
        vendor_id,
        vendor_name,
        vendor_contact_name,
        vendor_email,
        vendor_phone,
        vendor_address,
        vendor_city,
        vendor_state,
        vendor_zip,
        vendor_source,
        status,
        total_cost,
        company_id,
        created_by
      ) VALUES (
        v_po_number,
        v_work_order_id,
        v_work_order_number,
        v_estimate.customer_name,
        v_estimate.customer_email,
        v_estimate.customer_phone,
        v_yacht_name,
        v_vendor_id,
        v_vendor_name,
        v_vendor_contact,
        v_vendor_email,
        v_vendor_phone,
        v_vendor_address,
        v_vendor_city,
        v_vendor_state,
        v_vendor_zip,
        v_vendor_source,
        'draft',
        0,
        v_company_id,
        p_user_id
      )
      RETURNING id INTO v_po_id;
    END IF;

    -- Add line item to PO
    INSERT INTO purchase_order_line_items (
      purchase_order_id,
      work_order_line_item_id,
      part_number,
      description,
      quantity,
      unit_cost,
      total_cost,
      part_source,
      part_id,
      mercury_part_id,
      marine_wholesale_part_id,
      line_order
    ) VALUES (
      v_po_id,
      v_line_item.work_order_line_item_id,
      v_part_number,
      v_line_item.description,
      v_line_item.quantity,
      v_line_item.unit_price,
      v_line_item.total_price,
      v_line_item.part_source,
      v_line_item.part_id,
      v_line_item.mercury_part_id,
      v_line_item.marine_wholesale_part_id,
      v_line_item.line_order
    );

    -- Update PO total cost
    UPDATE purchase_orders
    SET total_cost = total_cost + v_line_item.total_price,
        updated_at = now()
    WHERE id = v_po_id;

  END LOOP;

  -- Update estimate status to converted
  UPDATE estimates
  SET 
    status = 'converted',
    updated_at = now()
  WHERE id = p_estimate_id;

  -- Return success with work order info and inventory alerts
  RETURN jsonb_build_object(
    'success', true,
    'work_order_id', v_work_order_id,
    'work_order_number', v_work_order_number,
    'low_stock_alerts', COALESCE(v_inventory_result->'low_stock_alerts', '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_estimate TO authenticated;
