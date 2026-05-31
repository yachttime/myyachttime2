
/*
  # Clear must_change_password flag for James Sullivan

  James Sullivan (jms2119@gmail.com) has must_change_password = true which
  is preventing login. This clears the flag so he can log in normally.
*/

UPDATE user_profiles
SET must_change_password = false
WHERE user_id = '6c14dda6-34a6-471e-8093-9337ba4e90c1';
