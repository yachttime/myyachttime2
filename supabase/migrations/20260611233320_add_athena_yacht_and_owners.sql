DO $$
DECLARE
  v_yacht_id uuid;
  v_user_id  uuid;
  v_company_id uuid := '519b4394-d35c-46d7-997c-db7e46178ef5';

  owners JSONB := '[
    {"email":"michaelbewsey@gmail.com","first":"Mike","last":"Bewsey","phone":"949-673-0365","trip":"1"},
    {"email":"steven@wslm.biz","first":"Stephen","last":"Mile","phone":"801-949-8531","trip":"2"},
    {"email":"bulldogsod@gmail.com","first":"Daren","last":"Deru","phone":"801-807-8321","trip":"3"},
    {"email":"larkinjf@gmail.com","first":"Jim","last":"Larkin","phone":"801-870-3385","trip":"4"},
    {"email":"cmoore@mtnwest.com","first":"Chad","last":"Moore","phone":"801-557-0011","trip":"5"},
    {"email":"john@duffield.us","first":"John","last":"Duffield","phone":"972-979-9601","trip":"6"},
    {"email":"trevisdjensen@yahoo.com","first":"Trevis","last":"Jensen","phone":"801-638-0405","trip":"7"},
    {"email":"jrdn.miller4@gmail.com","first":"Jordan","last":"Miller","phone":"385-329-8188","trip":"8"},
    {"email":"kellypcornwell@gmail.com","first":"Kelly","last":"Arends","phone":"949-494-4554","trip":"9"}
  ]'::jsonb;

  owner JSONB;
BEGIN
  -- Create the Athena yacht
  INSERT INTO yachts (name, is_active, company_id)
  VALUES ('ATHENA', true, v_company_id)
  RETURNING id INTO v_yacht_id;

  -- Create each owner
  FOR owner IN SELECT * FROM jsonb_array_elements(owners)
  LOOP
    -- Create auth user
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      email_confirmed_at,
      encrypted_password,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      owner->>'email',
      now(),
      '',
      '{"provider":"email","providers":["email"]}',
      '{}',
      false,
      now(),
      now()
    )
    RETURNING id INTO v_user_id;

    -- Create identity record (required for email/password login)
    PERFORM create_user_identity(v_user_id, owner->>'email');

    -- Set password to Athena123
    PERFORM update_user_password(v_user_id, 'Athena123');

    -- Create user profile
    INSERT INTO user_profiles (
      user_id,
      role,
      yacht_id,
      first_name,
      last_name,
      phone,
      email,
      must_change_password,
      trip_number,
      company_id,
      is_active,
      employee_type
    ) VALUES (
      v_user_id,
      'owner',
      v_yacht_id,
      owner->>'first',
      owner->>'last',
      owner->>'phone',
      owner->>'email',
      true,
      owner->>'trip',
      v_company_id,
      true,
      'hourly'
    );
  END LOOP;
END $$;
