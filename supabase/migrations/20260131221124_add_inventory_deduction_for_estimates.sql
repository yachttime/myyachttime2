/*
  # Add Inventory Deduction for Estimates

  1. Functions
    - `process_estimate_inventory_deduction` - Deducts parts from inventory when estimate is saved
      - Updates parts_inventory.quantity_on_hand
      - Creates part_transactions records
      - Creates admin_notifications for low stock alerts
      - Returns array of low stock warnings

  2. Business Logic
    - When an estimate is saved, parts used in line items are deducted from inventory
    - If quantity goes below reorder_level, creates notification to order more
    - All transactions are logged in part_transactions table
    - Function can be called after estimate is created
*/

CREATE OR REPLACE FUNCTION process_estimate_inventory_deduction(
  p_estimate_id uuid,
  p_user_id uuid
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
  v_low_stock_alerts jsonb := '[]'::jsonb;
  v_alert jsonb;
BEGIN
  FOR v_part_record IN
    SELECT 
      eli.part_id,
      eli.quantity,
      eli.description,
      pi.quantity_on_hand,
      pi.reorder_level,
      pi.part_number,
      pi.name as part_name
    FROM estimate_line_items eli
    JOIN parts_inventory pi ON eli.part_id = pi.id
    WHERE eli.estimate_id = p_estimate_id
      AND eli.line_type = 'part'
      AND eli.part_id IS NOT NULL
  LOOP
    v_quantity_used := v_part_record.quantity;
    v_current_quantity := v_part_record.quantity_on_hand;
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
        title,
        message,
        category,
        priority,
        reference_id
      ) VALUES (
        CASE 
          WHEN v_new_quantity < 0 THEN 'Negative Inventory - Order Part Immediately'
          ELSE 'Low Stock Alert - Reorder Needed'
        END,
        format(
          'Part #%s (%s) is %s. Current quantity: %s, Reorder level: %s',
          v_part_record.part_number,
          v_part_record.part_name,
          CASE 
            WHEN v_new_quantity < 0 THEN 'NEGATIVE - order immediately'
            ELSE 'below reorder level'
          END,
          v_new_quantity,
          v_part_record.reorder_level
        ),
        'parts',
        CASE 
          WHEN v_new_quantity < 0 THEN 'high'
          ELSE 'medium'
        END,
        v_part_record.part_id::text
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'low_stock_alerts', v_low_stock_alerts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION process_estimate_inventory_deduction TO authenticated;