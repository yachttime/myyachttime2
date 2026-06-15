
-- Clear any failed login attempts / lockout for jeff
UPDATE auth.users 
SET 
  banned_until = NULL,
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  reauthentication_token = ''
WHERE email = 'jeff@azmarine.net';
