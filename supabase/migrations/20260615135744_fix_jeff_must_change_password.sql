
UPDATE public.user_profiles
SET must_change_password = false
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'jeff@azmarine.net'
);
