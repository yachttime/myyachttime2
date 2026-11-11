/*
# Add missing engine and generator service parts to Parts Inventory

1. Plain-English summary
- Looks at every service part number saved on engines and generators (primary and alternate fields).
- If a part number has no matching Parts Inventory entry, it is added at $0 so it can be priced later.
- Existing inventory rows and their prices are never changed.

2. Matching rule (same rule the estimate buttons use)
- Numbers are split into pieces on spaces, commas, semicolons and slashes.
- Dashes and other punctuation are ignored and letters are lowercased.
- Only pieces that contain a digit and are at least 3 characters long count, so brand words such as NAPA or WIX do not cause false matches.

3. Changes
- parts_inventory: new rows only (part_number, name, description, quantity 0, cost 0, price 0, taxable, active).
- No columns, policies or grants are changed.

4. Notes
- Safe to re-run: a part number already in inventory is skipped.
- Company ownership is assigned by the existing automatic company trigger on inventory inserts.
- Prices for the new rows must be set in Parts Inventory.
*/

DO $$
DECLARE
  r record;
  already_in_inventory boolean;
BEGIN
  FOR r IN
    WITH src AS (
      SELECT e.model_number AS model, x.label, btrim(x.val) AS val
      FROM customer_vessel_engines e
      CROSS JOIN LATERAL (VALUES
        ('Oil filter', e.oil_filter_part_number),
        ('Oil filter alt 1', e.oil_filter_alt1),
        ('Oil filter alt 2', e.oil_filter_alt2),
        ('Fuel filter', e.fuel_filter_part_number),
        ('Fuel filter alt 1', e.fuel_filter_alt1),
        ('Fuel filter alt 2', e.fuel_filter_alt2),
        ('Impeller', e.impeller_part_number),
        ('Impeller alt 1', e.impeller_alt1),
        ('Impeller alt 2', e.impeller_alt2),
        ('Belt 1', e.belt1_part_number),
        ('Belt 1 alt 1', e.belt1_alt1),
        ('Belt 1 alt 2', e.belt1_alt2),
        ('Belt 2', e.belt2_part_number),
        ('Belt 2 alt 1', e.belt2_alt1),
        ('Belt 2 alt 2', e.belt2_alt2)
      ) AS x(label, val)
      UNION ALL
      SELECT g.model_number, x.label, btrim(x.val)
      FROM customer_vessel_generators g
      CROSS JOIN LATERAL (VALUES
        ('Oil filter', g.oil_filter_part_number),
        ('Oil filter alt 1', g.oil_filter_alt1),
        ('Oil filter alt 2', g.oil_filter_alt2),
        ('Fuel filter', g.fuel_filter_part_number),
        ('Fuel filter alt 1', g.fuel_filter_alt1),
        ('Fuel filter alt 2', g.fuel_filter_alt2),
        ('Impeller', g.impeller_part_number),
        ('Impeller alt 1', g.impeller_alt1),
        ('Impeller alt 2', g.impeller_alt2),
        ('Belt 1', g.belt1_part_number),
        ('Belt 1 alt 1', g.belt1_alt1),
        ('Belt 1 alt 2', g.belt1_alt2),
        ('Belt 2', g.belt2_part_number),
        ('Belt 2 alt 1', g.belt2_alt1),
        ('Belt 2 alt 2', g.belt2_alt2)
      ) AS x(label, val)
    )
    SELECT DISTINCT ON (val) model, label, val
    FROM src
    WHERE val <> ''
    ORDER BY val, model, label
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM regexp_split_to_table(lower(r.val), '[[:space:],;/]+') AS vt(t)
      WHERE length(regexp_replace(vt.t, '[^a-z0-9]', '', 'g')) >= 3
        AND regexp_replace(vt.t, '[^a-z0-9]', '', 'g') ~ '[0-9]'
        AND regexp_replace(vt.t, '[^a-z0-9]', '', 'g') IN (
          SELECT regexp_replace(lower(it.t), '[^a-z0-9]', '', 'g')
          FROM parts_inventory p
          CROSS JOIN LATERAL regexp_split_to_table(
            p.part_number || ' ' || coalesce(p.alternative_part_numbers, ''),
            '[[:space:],;/]+'
          ) AS it(t)
        )
    ) INTO already_in_inventory;

    IF NOT already_in_inventory THEN
      INSERT INTO parts_inventory (part_number, name, description, quantity_on_hand, unit_cost, unit_price, is_taxable, is_active)
      VALUES (
        r.val,
        r.label || ' - ' || r.model,
        'Added from engine/generator service parts. Set the price in Parts Inventory.',
        0, 0, 0, true, true
      )
      ON CONFLICT (part_number) DO NOTHING;
    END IF;
  END LOOP;
END $$;
