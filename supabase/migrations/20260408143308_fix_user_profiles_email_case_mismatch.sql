
/*
  # Fix Email Case Mismatch in user_profiles

  ## Problem
  Several user_profiles rows have mixed-case emails (e.g. "Tgrigg7@gmail.com")
  while the corresponding auth.users row has a lowercase email ("tgrigg7@gmail.com").
  
  When the app performs an exact-match lookup of user_profiles by email after login,
  it finds no row and the user cannot access the app.

  ## Fix
  Update the email column in user_profiles to match the lowercase email stored in auth.users
  for all affected users.

  ## Affected users (8 rows)
  - Tgrigg7@gmail.com → tgrigg7@gmail.com
  - Docjmatthews@gmail.com → docjmatthews@gmail.com
  - Kasey@inramllc.com → kasey@inramllc.com
  - Rjforte@adaptivei.net → rjforte@adaptivei.net
  - Timjr@rgsexteriors.com → timjr@rgsexteriors.com
  - Morganf13@hotmail.com → morganf13@hotmail.com
  - Scott@rockyme.com → scott@rockyme.com
  - andrew@McCubbins.com → andrew@mccubbins.com
*/

UPDATE public.user_profiles up
SET email = au.email
FROM auth.users au
WHERE LOWER(au.email) = LOWER(up.email)
  AND au.email != up.email;
