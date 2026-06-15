
-- Reset jeff@azmarine.net password to AZMarine2026!
UPDATE auth.users 
SET encrypted_password = crypt('AZMarine2026!', gen_salt('bf'))
WHERE email = 'jeff@azmarine.net';
