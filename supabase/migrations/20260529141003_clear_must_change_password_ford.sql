-- Clear must_change_password flag for jgforddds@msn.com
-- Their auth password was changed/reset so they need a fresh password reset email,
-- and this flag being stuck true was causing a redirect loop on sign-in.
UPDATE user_profiles
SET must_change_password = false
WHERE email = 'jgforddds@msn.com';
