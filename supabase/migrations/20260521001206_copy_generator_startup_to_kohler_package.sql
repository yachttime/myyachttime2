/*
  # Copy Generator Start up Service to Generator Start up Kohler

  ## Changes
  - Creates a new estimate package named "Generator Start up Kohler"
  - Copies all parts (7 line items) from the original "Generator Start up Service" package
  - Copies all labor (1 labor entry) from the original package
  - Same company_id, same pricing, same descriptions
*/

DO $$
DECLARE
  new_package_id uuid := gen_random_uuid();
  source_package_id uuid := 'cffcf9e3-4a88-4acd-82f4-5a364b69e115';
BEGIN

  -- Insert new package
  INSERT INTO estimate_packages (id, name, description, is_active, company_id)
  VALUES (
    new_package_id,
    'Generator Start up Kohler',
    'START OF SEASON GENERATOR SERVICE ,Service kit oil filter, fuel filter, drive belt, air filter, thermostat, impeller, and gaskets',
    true,
    '519b4394-d35c-46d7-997c-db7e46178ef5'
  );

  -- Copy all parts
  INSERT INTO estimate_package_parts (
    package_id, part_id, quantity, unit_price, description,
    company_id, part_source, mercury_part_id, marine_wholesale_part_id,
    part_number_display, description_display, is_taxable
  )
  SELECT
    new_package_id, part_id, quantity, unit_price, description,
    company_id, part_source, mercury_part_id, marine_wholesale_part_id,
    part_number_display, description_display, is_taxable
  FROM estimate_package_parts
  WHERE package_id = source_package_id;

  -- Copy all labor
  INSERT INTO estimate_package_labor (
    package_id, labor_code_id, hours, rate, description, company_id
  )
  SELECT
    new_package_id, labor_code_id, hours, rate, description, company_id
  FROM estimate_package_labor
  WHERE package_id = source_package_id;

END $$;
