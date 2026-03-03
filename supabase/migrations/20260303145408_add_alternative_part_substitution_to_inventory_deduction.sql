/*
  # Add alternative part substitution to inventory deduction

  When approving an estimate, if a part has insufficient stock (0 or less),
  the system now checks for an alternative part in inventory that:
    1. Is listed in the original part's alternative_part_numbers field, OR
    2. Lists the original part in its own alternative_part_numbers field
  
  If an alternative with sufficient stock is found:
    - The estimate/work order line item's part_id is updated to the alternative
    - Stock is deducted from the alternative part instead
    - A transaction log entry notes the substitution

  ## Changes
  - Replaces process_estimate_inventory_deduction with new version
  - New version checks alternative parts before allowing negative inventory
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
  v_alt_part RECORD;
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
  v_effective_part_id uuid;
  v_effective_part_number text;
  v_effective_part_name text;
  v_effective_vendor_id uuid;
  v_effective_unit_cost numeric;
  v_effective_reorder_level integer;
  v_substituted boolean;
BEGIN
  IF p_company_id IS NOT NULL THEN
    v_resolved_company_id := p_company_id;
  ELSE
    SELECT company_id INTO v_resolved_company_id FROM estimates WHERE id = p_estimate_id;
  END IF;

  FOR v_part_record IN
    SELECT 
      eli.id as line_item_id,
      eli.part_id,
      eli.quantity,
      eli.description,
      pi.quantity_on_hand,
      pi.reorder_level,
      pi.part_number,
      pi.name as part_name,
      pi.unit_cost,
      pi.vendor_id,
      pi.alternative_part_numbers
    FROM estimate_line_items eli
    JOIN parts_inventory pi ON eli.part_id = pi.id
    WHERE eli.estimate_id = p_estimate_id
      AND eli.line_type = 'part'
      AND eli.part_id IS NOT NULL
  LOOP
    v_quantity_used := v_part_record.quantity;
    v_current_quantity := v_part_record.quantity_on_hand;
    v_substituted := false;

    -- If the part has insufficient stock, try to find an alternative with stock
    IF v_current_quantity < v_quantity_used AND v_part_record.alternative_part_numbers IS NOT NULL THEN
      -- Look for an alternative part that has enough stock
      SELECT 
        pi2.id,
        pi2.part_number,
        pi2.name,
        pi2.quantity_on_hand,
        pi2.reorder_level,
        pi2.vendor_id,
        pi2.unit_cost
      INTO v_alt_part
      FROM parts_inventory pi2
      WHERE (
        pi2.part_number = v_part_record.alternative_part_numbers
        OR pi2.alternative_part_numbers = v_part_record.part_number
        OR pi2.alternative_part_numbers = v_part_record.alternative_part_numbers
      )
        AND pi2.id != v_part_record.part_id
        AND pi2.quantity_on_hand >= v_quantity_used
        AND pi2.is_active = true
      ORDER BY pi2.quantity_on_hand DESC
      LIMIT 1;

      IF v_alt_part.id IS NOT NULL THEN
        -- Substitute: update the estimate line item to use the alternative part
        UPDATE estimate_line_items
        SET part_id = v_alt_part.id
        WHERE id = v_part_record.line_item_id;

        -- Also update any matching work order line items
        IF p_work_order_id IS NOT NULL THEN
          UPDATE work_order_line_items
          SET part_id = v_alt_part.id
          WHERE work_order_id = p_work_order_id
            AND part_id = v_part_record.part_id
            AND line_type = 'part';
        END IF;

        v_effective_part_id := v_alt_part.id;
        v_effective_part_number := v_alt_part.part_number;
        v_effective_part_name := v_alt_part.name;
        v_effective_vendor_id := v_alt_part.vendor_id;
        v_effective_unit_cost := v_alt_part.unit_cost;
        v_effective_reorder_level := v_alt_part.reorder_level;
        v_current_quantity := v_alt_part.quantity_on_hand;
        v_substituted := true;
      ELSE
        -- No alternative available, use original part (may go negative)
        v_effective_part_id := v_part_record.part_id;
        v_effective_part_number := v_part_record.part_number;
        v_effective_part_name := v_part_record.part_name;
        v_effective_vendor_id := v_part_record.vendor_id;
        v_effective_unit_cost := v_part_record.unit_cost;
        v_effective_reorder_level := v_part_record.reorder_level;
      END IF;
    ELSE
      v_effective_part_id := v_part_record.part_id;
      v_effective_part_number := v_part_record.part_number;
      v_effective_part_name := v_part_record.part_name;
      v_effective_vendor_id := v_part_record.vendor_id;
      v_effective_unit_cost := v_part_record.unit_cost;
      v_effective_reorder_level := v_part_record.reorder_level;
    END IF;

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
          v_effective_vendor_id,
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
          v_effective_part_id,
          v_effective_part_number,
          v_effective_part_name,
          v_quantity_used,
          v_current_quantity,
          v_quantity_to_order,
          v_effective_unit_cost
        );
      END IF;
    END IF;

    v_new_quantity := v_current_quantity - v_quantity_used;

    UPDATE parts_inventory
    SET 
      quantity_on_hand = v_new_quantity,
      updated_at = now()
    WHERE id = v_effective_part_id;

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
      v_effective_part_id,
      'sale',
      -v_quantity_used,
      v_current_quantity,
      v_new_quantity,
      p_estimate_id,
      p_user_id,
      CASE 
        WHEN v_substituted THEN format('Used in estimate (substituted for %s - out of stock)', v_part_record.part_number)
        ELSE 'Used in estimate'
      END
    );

    IF v_new_quantity <= v_effective_reorder_level THEN
      v_alert := jsonb_build_object(
        'part_id', v_effective_part_id,
        'part_number', v_effective_part_number,
        'part_name', v_effective_part_name,
        'current_quantity', v_new_quantity,
        'reorder_level', v_effective_reorder_level,
        'is_negative', v_new_quantity < 0,
        'substituted', v_substituted
      );
      
      v_low_stock_alerts := v_low_stock_alerts || v_alert;

      INSERT INTO admin_notifications (
        user_id,
        message,
        notification_type,
        reference_id,
        company_id
      ) VALUES (
        p_user_id,
        format(
          '%s - Part #%s (%s). Current qty: %s, Reorder level: %s',
          CASE 
            WHEN v_new_quantity < 0 THEN 'NEGATIVE INVENTORY - Order immediately'
            ELSE 'Low Stock Alert - Reorder Needed'
          END,
          v_effective_part_number,
          v_effective_part_name,
          v_new_quantity,
          v_effective_reorder_level
        ),
        'low_stock',
        v_effective_part_id,
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
