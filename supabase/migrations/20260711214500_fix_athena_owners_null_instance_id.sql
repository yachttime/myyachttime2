-- Fix Athena owners who cannot sign in because instance_id is NULL.
-- GoTrue requires instance_id = '00000000-0000-0000-0000-000000000000' for authentication.
-- The original migration (20260611233320) omitted instance_id when inserting into auth.users.

UPDATE auth.users
SET instance_id = '00000000-0000-0000-0000-000000000000'
WHERE instance_id IS NULL;