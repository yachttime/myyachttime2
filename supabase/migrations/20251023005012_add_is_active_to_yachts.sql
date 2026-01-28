/*
  # Add Active Status to Yachts

  1. Changes
    - Add `is_active` column to yachts table (boolean, default true)
    - This allows yacht management to filter between active and inactive yachts
    - Default true ensures existing yachts remain visible
  
  2. Notes
    - Indexed for efficient filtering queries
    - Existing yachts will automatically be marked as active
    - Status changes will be tracked in yacht_history_logs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE yachts ADD COLUMN is_active boolean DEFAULT true NOT NULL;
    
    -- Create index for efficient filtering
    CREATE INDEX IF NOT EXISTS idx_yachts_is_active ON yachts(is_active);
  END IF;
END $$;