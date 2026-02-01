/*
  # Add Financial Fields to Work Orders

  1. Changes
    - Add financial fields to work_orders table to preserve estimate pricing
    - These fields track the original estimate amounts for taxes, fees, and surcharges
    
  2. New Columns
    - `subtotal` (numeric) - Subtotal before taxes and fees
    - `sales_tax_rate` (numeric) - Sales tax percentage
    - `sales_tax_amount` (numeric) - Calculated sales tax amount
    - `shop_supplies_rate` (numeric) - Shop supplies percentage
    - `shop_supplies_amount` (numeric) - Calculated shop supplies amount
    - `park_fees_rate` (numeric) - Park fees percentage
    - `park_fees_amount` (numeric) - Calculated park fees amount
    - `surcharge_rate` (numeric) - Surcharge percentage
    - `surcharge_amount` (numeric) - Calculated surcharge amount
    - `total_amount` (numeric) - Grand total including all taxes and fees
    - `marina_name` (text) - Marina name from estimate
    - `manager_name` (text) - Manager name from estimate
    - `manager_email` (text) - Manager email from estimate
    - `manager_phone` (text) - Manager phone from estimate
*/

-- Add financial fields to work_orders table
DO $$
BEGIN
  -- Add subtotal if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'subtotal'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN subtotal numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add sales_tax_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'sales_tax_rate'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN sales_tax_rate numeric(5, 4) DEFAULT 0 NOT NULL;
  END IF;

  -- Add sales_tax_amount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'sales_tax_amount'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN sales_tax_amount numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add shop_supplies_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'shop_supplies_rate'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN shop_supplies_rate numeric(5, 4) DEFAULT 0 NOT NULL;
  END IF;

  -- Add shop_supplies_amount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'shop_supplies_amount'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN shop_supplies_amount numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add park_fees_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'park_fees_rate'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN park_fees_rate numeric(5, 4) DEFAULT 0 NOT NULL;
  END IF;

  -- Add park_fees_amount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'park_fees_amount'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN park_fees_amount numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add surcharge_rate if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'surcharge_rate'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN surcharge_rate numeric(5, 4) DEFAULT 0 NOT NULL;
  END IF;

  -- Add surcharge_amount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'surcharge_amount'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN surcharge_amount numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add total_amount if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN total_amount numeric(10, 2) DEFAULT 0 NOT NULL;
  END IF;

  -- Add marina_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'marina_name'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN marina_name text;
  END IF;

  -- Add manager_name if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'manager_name'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN manager_name text;
  END IF;

  -- Add manager_email if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'manager_email'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN manager_email text;
  END IF;

  -- Add manager_phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_orders' AND column_name = 'manager_phone'
  ) THEN
    ALTER TABLE work_orders ADD COLUMN manager_phone text;
  END IF;
END $$;
