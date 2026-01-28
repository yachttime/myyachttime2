/*
  # Add WiFi Information to Yachts

  1. Changes
    - Add `wifi_name` column to store the WiFi network name
    - Add `wifi_password` column to store the WiFi password
  
  2. Security
    - WiFi information will be protected by existing RLS policies
    - Only authorized users can view yacht details including WiFi info
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'wifi_name'
  ) THEN
    ALTER TABLE yachts ADD COLUMN wifi_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'yachts' AND column_name = 'wifi_password'
  ) THEN
    ALTER TABLE yachts ADD COLUMN wifi_password text;
  END IF;
END $$;