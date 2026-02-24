/*
  # Fix process_estimate_inventory_deduction - remove non-existent admin_notifications columns

  The admin_notifications table does not have 'title', 'category', or 'priority' columns.
  This fixes the function to only insert columns that actually exist on the table:
  message, notification_type, reference_id, company_id.
*/

DROP FUNCTION IF EXISTS process_estimate_inventory_deduction(uuid, uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION process_estimate_inventory_deduction(
  p_estimate_id uuid,
  p_user_id uuid,
  p_work_order_id uuid DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_part_record RECORD;
  v_current_quantity integer;
  v_new_quantity integer;
  v_quantity_used integer;
  v_quantity_available integer;
  v_quantity_to_order integer;
  v_low_stock_alerts jsonb := '[]'::jsonb;
  v_alert jsonb;
  v_po_id uuid;
  v_po_number text;
  v_has_shortfall boolean := false;
  v_resolved_company_id uuid;
BEGIN
  IF p_company_id IS NOT NULL THEN
    v_resolved_company_id := p_company_id;
  ELSE
    SELECT company_id INTO v_resolved_company_id FROM estimates WHERE id = p_estimate_id;
  END IF;

  FOR v_part_record IN
    SELECT 
      eli.part_id,
      eli.quantity,
      eli.description,
      pi.quantity_on_hand,
      pi.reorder_level,
      pi.part_number,
      pi.name as part_name,
      pi.unit_cost,
      pi.vendor_id
    FROM estimate_line_items eli
    JOIN parts_inventory pi ON eli.part_id = pi.id
    WHERE eli.estimate_id = p_estimate_id
      AND eli.line_type = 'part'
      AND eli.part_id IS NOT NULL
  LOOP
    v_quantity_used := v_part_record.quantity;
    v_current_quantity := v_part_record.quantity_on_hand;
    v_quantity_available := GREATEST(v_current_quantity, 0);
    v_quantity_to_order := GREATEST(v_quantity_used - v_quantity_available, 0);

    IF v_quantity_to_order > 0 THEN
      v_has_shortfall := true;

      IF v_po_id IS NULL AND v_resolved_company_id IS NOT NULL THEN
        v_po_number := generate_po_number(v_resolved_company_id);
        INSERT INTO purchase_orders (
          po_number,
          company_id,
          vendor_id,
          status,
          work_order_id,
          estimate_id,
          notes,
          created_by
        ) VALUES (
          v_po_number,
          v_resolved_company_id,
          v_part_record.vendor_id,
          'pending',
          p_work_order_id,
          p_estimate_id,
          'Auto-generated from estimate approval - parts shortage',
          p_user_id
        )
        RETURNING id INTO v_po_id;
      END IF;

      IF v_po_id IS NOT NULL THEN
        INSERT INTO purchase_order_items (
          purchase_order_id,
          part_id,
          part_number,
          part_name,
          quantity_needed,
          quantity_on_hand,
          quantity_to_order,
          unit_cost
        ) VALUES (
          v_po_id,
          v_part_record.part_id,
          v_part_record.part_number,
          v_part_record.part_name,
          v_quantity_used,
          v_current_quantity,
          v_quantity_to_order,
          v_part_record.unit_cost
        );
      END IF;
    END IF;

    v_new_quantity := v_current_quantity - v_quantity_used;

    UPDATE parts_inventory
    SET 
      quantity_on_hand = v_new_quantity,
      updated_at = now()
    WHERE id = v_part_record.part_id;

    INSERT INTO part_transactions (
      part_id,
      transaction_type,
      quantity_change,
      before_quantity,
      after_quantity,
      estimate_id,
      performed_by,
      reason
    ) VALUES (
      v_part_record.part_id,
      'sale',
      -v_quantity_used,
      v_current_quantity,
      v_new_quantity,
      p_estimate_id,
      p_user_id,
      'Used in estimate'
    );

    IF v_new_quantity <= v_part_record.reorder_level THEN
      v_alert := jsonb_build_object(
        'part_id', v_part_record.part_id,
        'part_number', v_part_record.part_number,
        'part_name', v_part_record.part_name,
        'current_quantity', v_new_quantity,
        'reorder_level', v_part_record.reorder_level,
        'is_negative', v_new_quantity < 0
      );
      
      v_low_stock_alerts := v_low_stock_alerts || v_alert;

      INSERT INTO admin_notifications (
        message,
        notification_type,
        reference_id,
        company_id
      ) VALUES (
        format(
          '%s - Part #%s (%s). Current qty: %s, Reorder level: %s',
          CASE 
            WHEN v_new_quantity < 0 THEN 'NEGATIVE INVENTORY - Order immediately'
            ELSE 'Low Stock Alert - Reorder Needed'
          END,
          v_part_record.part_number,
          v_part_record.part_name,
          v_new_quantity,
          v_part_record.reorder_level
        ),
        'low_stock',
        v_part_record.part_id::text,
        v_resolved_company_id
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'low_stock_alerts', v_low_stock_alerts,
    'purchase_order_created', v_has_shortfall,
    'purchase_order_id', v_po_id,
    'purchase_order_number', v_po_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_estimate_inventory_deduction(uuid, uuid, uuid, uuid) TO authenticated;
