
-- Fix ESCAPADE Trip 4 (Jun 26) - swap transposed generator hours
-- Current: port=10347.5, stbd=12359.9 (transposed)
-- Correct:  port=12359.9, stbd=10347.5
UPDATE trip_inspections
SET 
  port_gen_hours = 12359.9,
  stbd_gen_hours = 10347.5
WHERE id = '3ef1317d-b3d0-4271-81be-ef3c0cfff47e';
