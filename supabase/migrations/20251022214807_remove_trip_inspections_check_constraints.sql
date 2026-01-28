/*
  # Remove Check Constraints from trip_inspections

  1. Changes
    - Drop all check constraints on condition fields
    
  2. Reason
    - Allows forms to start with empty values
    - Users can progressively fill out the inspection form
    - Provides better UX by not pre-selecting values
    
  3. Constraints Removed
    - cabin_condition_check
    - deck_condition_check
    - engine_condition_check
    - galley_condition_check
    - head_condition_check
    - hull_condition_check
    - navigation_equipment_check
    - overall_condition_check
    - safety_equipment_check
*/

DO $$
BEGIN
  -- Drop check constraints if they exist
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_cabin_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_cabin_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_deck_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_deck_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_engine_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_engine_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_galley_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_galley_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_head_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_head_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_hull_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_hull_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_navigation_equipment_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_navigation_equipment_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_overall_condition_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_overall_condition_check;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trip_inspections_safety_equipment_check') THEN
    ALTER TABLE trip_inspections DROP CONSTRAINT trip_inspections_safety_equipment_check;
  END IF;
END $$;