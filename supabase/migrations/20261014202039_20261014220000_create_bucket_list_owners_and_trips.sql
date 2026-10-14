/*
# Create Bucket List Owners and 2027 Season Trips

1. New Data
- Creates 9 owner auth.users + user_profiles for the Bucket List yacht
- Creates 12 yacht_bookings for the 2027 season (non-blank weeks only)
- Creates yacht_booking_owners entries for multi-owner trips

2. Security
- No schema changes. All existing RLS policies apply.
- Users are created with email/password auth, email_confirmed_at = now()
- must_change_password = true so owners set their own password on first login

3. Important Notes
- Password = owner's phone number without dashes (e.g. 4805167194)
- All trips use 10:00 AM departure/arrival times (Arizona MST, UTC-7)
- Week 7 and Week 19 are multi-owner trips (4 owners each)
- Idempotent: checks for existing email before creating each user
*/

DO $$
DECLARE
  v_yacht_id    uuid := '2c0ac664-5eef-4d03-89f8-2de0d370b270';
  v_company_id  uuid := '519b4394-d35c-46d7-997c-db7e46178ef5';
  v_user_id     uuid;
  v_booking_id  uuid;

  owners jsonb := '[
    {"email":"jasonbreinholt@yahoo.com","first":"Jason","last":"Breinholt","phone":"480-516-7194","pw":"4805167194"},
    {"email":"joshhas@gmail.com","first":"Josh","last":"Haslam","phone":"480-586-8022","pw":"4805868022"},
    {"email":"stmaxwell3565@gmail.com","first":"Shawn","last":"Maxwell","phone":"602-647-3565","pw":"6026473565"},
    {"email":"frankie@bdevaz.com","first":"Frankie","last":"Breinholt","phone":"480-268-0811","pw":"4802680811"},
    {"email":"Tbreinholt@cpiaz.com","first":"Tyson","last":"Breinholt","phone":"480-315-7131","pw":"4803157131"},
    {"email":"azurbantactical@gmail.com","first":"Sam","last":"Bollwinkel","phone":"480-236-1544","pw":"4802361544"},
    {"email":"btquack@cox.net","first":"Brett","last":"Quackenbush","phone":"480-855-7635","pw":"4808557635"},
    {"email":"damon@baicins.com","first":"Damon","last":"Breinholt","phone":"602-315-7130","pw":"6023157130"},
    {"email":"Lance@azcomp.com","first":"Lance","last":"Foster","phone":"480-797-5109","pw":"4807975109"}
  ]'::jsonb;

  owner jsonb;
BEGIN
  -- ---- Create 9 owner accounts ----
  FOR owner IN SELECT * FROM jsonb_array_elements(owners)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = owner->>'email') THEN
      INSERT INTO auth.users (
        id, aud, role, email, email_confirmed_at,
        encrypted_password, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), 'authenticated', 'authenticated',
        owner->>'email', now(),
        '', '{"provider":"email","providers":["email"]}', '{}',
        false, now(), now()
      )
      RETURNING id INTO v_user_id;

      PERFORM create_user_identity(v_user_id, owner->>'email');
      PERFORM update_user_password(v_user_id, owner->>'pw');

      INSERT INTO user_profiles (
        user_id, role, yacht_id, first_name, last_name,
        phone, email, must_change_password,
        company_id, is_active, employee_type
      ) VALUES (
        v_user_id, 'owner', v_yacht_id,
        owner->>'first', owner->>'last',
        owner->>'phone', owner->>'email',
        true, v_company_id, true, 'hourly'
      );
    END IF;
  END LOOP;

  -- ---- Create 12 trips for 2027 season ----

  -- Trip 1 (Week 1): Jason Breinholt
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'jasonbreinholt@yahoo.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-05-28 10:00:00-07:00', '2027-06-04 10:00:00-07:00',
    'Jason Breinholt', '480-516-7194', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact)
  VALUES (v_booking_id, 'Jason Breinholt', '480-516-7194');

  -- Trip 2 (Week 3): Josh Haslam + Shawn Maxwell
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'joshhas@gmail.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-06-11 10:00:00-07:00', '2027-06-18 10:00:00-07:00',
    'Josh Haslam', '480-586-8022', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Josh Haslam', '480-586-8022'),
    (v_booking_id, 'Shawn Maxwell', '602-647-3565');

  -- Trip 3 (Week 5): Frankie Breinholt + Tyson Breinholt
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'frankie@bdevaz.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-06-25 10:00:00-07:00', '2027-07-02 10:00:00-07:00',
    'Frankie Breinholt', '480-268-0811', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Frankie Breinholt', '480-268-0811'),
    (v_booking_id, 'Tyson Breinholt', '480-315-7131');

  -- Trip 4 (Week 6): Sam Bollwinkel + Brett Quackenbush
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'azurbantactical@gmail.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-07-02 10:00:00-07:00', '2027-07-09 10:00:00-07:00',
    'Sam Bollwinkel', '480-236-1544', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Sam Bollwinkel', '480-236-1544'),
    (v_booking_id, 'Brett Quackenbush', '480-855-7635');

  -- Trip 5 (Week 7): Tyson Breinholt + Frankie Breinholt + Damon Breinholt + Lance Foster
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'Tbreinholt@cpiaz.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-07-09 10:00:00-07:00', '2027-07-16 10:00:00-07:00',
    'Tyson Breinholt', '480-315-7131', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Tyson Breinholt', '480-315-7131'),
    (v_booking_id, 'Frankie Breinholt', '480-268-0811'),
    (v_booking_id, 'Damon Breinholt', '602-315-7130'),
    (v_booking_id, 'Lance Foster', '480-797-5109');

  -- Trip 6 (Week 8): Damon Breinholt + Lance Foster
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'damon@baicins.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-07-16 10:00:00-07:00', '2027-07-23 10:00:00-07:00',
    'Damon Breinholt', '602-315-7130', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Damon Breinholt', '602-315-7130'),
    (v_booking_id, 'Lance Foster', '480-797-5109');

  -- Trip 7 (Week 9): Jason Breinholt
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'jasonbreinholt@yahoo.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-07-23 10:00:00-07:00', '2027-07-30 10:00:00-07:00',
    'Jason Breinholt', '480-516-7194', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact)
  VALUES (v_booking_id, 'Jason Breinholt', '480-516-7194');

  -- Trip 8 (Week 12): Sam Bollwinkel + Brett Quackenbush
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'azurbantactical@gmail.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-08-13 10:00:00-07:00', '2027-08-20 10:00:00-07:00',
    'Sam Bollwinkel', '480-236-1544', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Sam Bollwinkel', '480-236-1544'),
    (v_booking_id, 'Brett Quackenbush', '480-855-7635');

  -- Trip 9 (Week 15 - Labor Day): Frankie Breinholt + Tyson Breinholt
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'frankie@bdevaz.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-09-03 10:00:00-07:00', '2027-09-10 10:00:00-07:00',
    'Frankie Breinholt', '480-268-0811', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Frankie Breinholt', '480-268-0811'),
    (v_booking_id, 'Tyson Breinholt', '480-315-7131');

  -- Trip 10 (Week 16): Damon Breinholt + Lance Foster
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'damon@baicins.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-09-10 10:00:00-07:00', '2027-09-17 10:00:00-07:00',
    'Damon Breinholt', '602-315-7130', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Damon Breinholt', '602-315-7130'),
    (v_booking_id, 'Lance Foster', '480-797-5109');

  -- Trip 11 (Week 17): Josh Haslam + Shawn Maxwell
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'joshhas@gmail.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-09-17 10:00:00-07:00', '2027-09-24 10:00:00-07:00',
    'Josh Haslam', '480-586-8022', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Josh Haslam', '480-586-8022'),
    (v_booking_id, 'Shawn Maxwell', '602-647-3565');

  -- Trip 12 (Week 19): Tyson Breinholt + Frankie Breinholt + Damon Breinholt + Lance Foster
  SELECT user_id INTO v_user_id FROM user_profiles WHERE email = 'Tbreinholt@cpiaz.com';
  INSERT INTO yacht_bookings (
    yacht_id, user_id, start_date, end_date,
    owner_name, owner_contact, departure_time, arrival_time,
    checked_in, checked_out, company_id
  ) VALUES (
    v_yacht_id, v_user_id,
    '2027-10-01 10:00:00-07:00', '2027-10-08 10:00:00-07:00',
    'Tyson Breinholt', '480-315-7131', '10:00:00', '10:00:00',
    false, false, v_company_id
  ) RETURNING id INTO v_booking_id;
  INSERT INTO yacht_booking_owners (booking_id, owner_name, owner_contact) VALUES
    (v_booking_id, 'Tyson Breinholt', '480-315-7131'),
    (v_booking_id, 'Frankie Breinholt', '480-268-0811'),
    (v_booking_id, 'Damon Breinholt', '602-315-7130'),
    (v_booking_id, 'Lance Foster', '480-797-5109');
END $$;