/*
  # Add Additional Trip Inspection Fields

  1. New Columns
    - Main Cabin fields:
      - `inverter_system` (text) - Inverter system condition
      - `inverter_notes` (text) - Inverter system notes
      - `master_bathroom` (text) - Master bathroom condition
      - `master_bathroom_notes` (text) - Master bathroom notes
      - `secondary_bathroom` (text) - Secondary bathroom condition
      - `secondary_bathroom_notes` (text) - Secondary bathroom notes
      - `lower_sinks` (text) - Lower sinks condition
      - `lower_sinks_notes` (text) - Lower sinks notes
      - `kitchen_sink` (text) - Kitchen sink condition
      - `kitchen_sink_notes` (text) - Kitchen sink notes
      - `garbage_disposal` (text) - Garbage disposal condition
      - `garbage_disposal_notes` (text) - Garbage disposal notes
      - `stove_top` (text) - Stove top condition
      - `stove_top_notes` (text) - Stove top notes
      - `dishwasher` (text) - Dishwasher condition
      - `dishwasher_notes` (text) - Dishwasher notes
      - `trash_compactor` (text) - Trash compactor condition
      - `trash_compactor_notes` (text) - Trash compactor notes
      - `volt_fans` (text) - 12 Volt fans condition
      - `volt_fans_notes` (text) - 12 Volt fans notes
    - Lower Basement Equipment fields:
      - `ac_filters` (text) - A/C filters condition
      - `ac_filters_notes` (text) - A/C filters notes
      - `ac_water_pumps` (text) - A/C water pumps condition
      - `ac_water_pumps_notes` (text) - A/C water pumps notes
      - `water_filters` (text) - Water filters condition
      - `water_filters_notes` (text) - Water filters notes
      - `water_pumps_controls` (text) - Water pumps and controls condition
      - `water_pumps_controls_notes` (text) - Water pumps and controls notes
    - Upper Deck fields:
      - `upper_deck_bathroom` (text) - Upper deck bathroom condition
      - `upper_deck_bathroom_notes` (text) - Upper deck bathroom notes
      - `upper_kitchen_sink` (text) - Upper deck kitchen sink condition
      - `upper_kitchen_sink_notes` (text) - Upper deck kitchen sink notes
      - `upper_disposal` (text) - Upper deck disposal condition
      - `upper_disposal_notes` (text) - Upper deck disposal notes
      - `icemaker` (text) - Icemaker condition
      - `icemaker_notes` (text) - Icemaker notes
      - `upper_stove_top` (text) - Upper deck stove top condition
      - `upper_stove_top_notes` (text) - Upper deck stove top notes
      - `propane` (text) - Propane condition
      - `propane_notes` (text) - Propane notes
      - `windless_port` (text) - Windless anchors port side condition
      - `windless_port_notes` (text) - Windless anchors port side notes
      - `windless_starboard` (text) - Windless anchor starboard condition
      - `windless_starboard_notes` (text) - Windless anchor starboard notes
      - `anchor_lines` (text) - Anchor lines condition
      - `anchor_lines_notes` (text) - Anchor lines notes
      - `upper_ac_filter` (text) - Upper A/C filter condition
      - `upper_ac_filter_notes` (text) - Upper A/C filter notes
    - Engine Compartment fields:
      - `port_engine_oil` (text) - Port engine oil condition
      - `port_engine_oil_notes` (text) - Port engine oil notes
      - `port_generator_oil` (text) - Port generator oil condition
      - `port_generator_oil_notes` (text) - Port generator oil notes
      - `starboard_generator_oil` (text) - Starboard generator oil condition
      - `starboard_generator_oil_notes` (text) - Starboard generator oil notes
      - `starboard_engine_oil` (text) - Starboard engine oil condition
      - `starboard_engine_oil_notes` (text) - Starboard engine oil notes
      - `sea_strainers` (text) - Sea strainers condition
      - `sea_strainers_notes` (text) - Sea strainers notes
      - `engine_batteries` (text) - Engine batteries condition
      - `engine_batteries_notes` (text) - Engine batteries notes

  2. Notes
    - All columns are nullable to allow partial form submissions
    - Condition fields store values like 'ok', 'needs service', etc.
    - Notes fields store detailed observations from the inspector
*/

DO $$
BEGIN
  -- Main Cabin fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'inverter_system') THEN
    ALTER TABLE trip_inspections ADD COLUMN inverter_system text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'inverter_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN inverter_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'master_bathroom') THEN
    ALTER TABLE trip_inspections ADD COLUMN master_bathroom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'master_bathroom_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN master_bathroom_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'secondary_bathroom') THEN
    ALTER TABLE trip_inspections ADD COLUMN secondary_bathroom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'secondary_bathroom_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN secondary_bathroom_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'lower_sinks') THEN
    ALTER TABLE trip_inspections ADD COLUMN lower_sinks text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'lower_sinks_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN lower_sinks_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'kitchen_sink') THEN
    ALTER TABLE trip_inspections ADD COLUMN kitchen_sink text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'kitchen_sink_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN kitchen_sink_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'garbage_disposal') THEN
    ALTER TABLE trip_inspections ADD COLUMN garbage_disposal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'garbage_disposal_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN garbage_disposal_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'stove_top') THEN
    ALTER TABLE trip_inspections ADD COLUMN stove_top text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'stove_top_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN stove_top_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'dishwasher') THEN
    ALTER TABLE trip_inspections ADD COLUMN dishwasher text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'dishwasher_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN dishwasher_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'trash_compactor') THEN
    ALTER TABLE trip_inspections ADD COLUMN trash_compactor text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'trash_compactor_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN trash_compactor_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'volt_fans') THEN
    ALTER TABLE trip_inspections ADD COLUMN volt_fans text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'volt_fans_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN volt_fans_notes text;
  END IF;

  -- Lower Basement Equipment fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'ac_filters') THEN
    ALTER TABLE trip_inspections ADD COLUMN ac_filters text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'ac_filters_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN ac_filters_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'ac_water_pumps') THEN
    ALTER TABLE trip_inspections ADD COLUMN ac_water_pumps text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'ac_water_pumps_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN ac_water_pumps_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'water_filters') THEN
    ALTER TABLE trip_inspections ADD COLUMN water_filters text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'water_filters_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN water_filters_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'water_pumps_controls') THEN
    ALTER TABLE trip_inspections ADD COLUMN water_pumps_controls text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'water_pumps_controls_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN water_pumps_controls_notes text;
  END IF;

  -- Upper Deck fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_deck_bathroom') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_deck_bathroom text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_deck_bathroom_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_deck_bathroom_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_kitchen_sink') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_kitchen_sink text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_kitchen_sink_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_kitchen_sink_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_disposal') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_disposal text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_disposal_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_disposal_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'icemaker') THEN
    ALTER TABLE trip_inspections ADD COLUMN icemaker text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'icemaker_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN icemaker_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_stove_top') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_stove_top text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_stove_top_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_stove_top_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'propane') THEN
    ALTER TABLE trip_inspections ADD COLUMN propane text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'propane_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN propane_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'windless_port') THEN
    ALTER TABLE trip_inspections ADD COLUMN windless_port text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'windless_port_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN windless_port_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'windless_starboard') THEN
    ALTER TABLE trip_inspections ADD COLUMN windless_starboard text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'windless_starboard_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN windless_starboard_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'anchor_lines') THEN
    ALTER TABLE trip_inspections ADD COLUMN anchor_lines text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'anchor_lines_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN anchor_lines_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_ac_filter') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_ac_filter text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'upper_ac_filter_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN upper_ac_filter_notes text;
  END IF;

  -- Engine Compartment fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'port_engine_oil') THEN
    ALTER TABLE trip_inspections ADD COLUMN port_engine_oil text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'port_engine_oil_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN port_engine_oil_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'port_generator_oil') THEN
    ALTER TABLE trip_inspections ADD COLUMN port_generator_oil text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'port_generator_oil_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN port_generator_oil_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'starboard_generator_oil') THEN
    ALTER TABLE trip_inspections ADD COLUMN starboard_generator_oil text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'starboard_generator_oil_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN starboard_generator_oil_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'starboard_engine_oil') THEN
    ALTER TABLE trip_inspections ADD COLUMN starboard_engine_oil text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'starboard_engine_oil_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN starboard_engine_oil_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'sea_strainers') THEN
    ALTER TABLE trip_inspections ADD COLUMN sea_strainers text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'sea_strainers_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN sea_strainers_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'engine_batteries') THEN
    ALTER TABLE trip_inspections ADD COLUMN engine_batteries text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trip_inspections' AND column_name = 'engine_batteries_notes') THEN
    ALTER TABLE trip_inspections ADD COLUMN engine_batteries_notes text;
  END IF;
END $$;