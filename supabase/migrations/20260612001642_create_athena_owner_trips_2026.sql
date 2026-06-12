
INSERT INTO yacht_bookings (
  yacht_id, user_id, start_date, end_date,
  owner_name, owner_contact,
  departure_time, arrival_time,
  checked_in, checked_out,
  company_id
) VALUES
  -- Turn 1: Mike Bewsey Jun 7-14
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    '906fe4d1-05b7-4bee-b31d-d3a68297ab15',
    '2026-06-07 00:00:00+00', '2026-06-14 00:00:00+00',
    'Mike Bewsey', '949-673-0365',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 2: Stephen Mile Jun 15-22
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    '322ea5a7-6411-4e2e-a436-966a7d3fb5cd',
    '2026-06-15 00:00:00+00', '2026-06-22 00:00:00+00',
    'Stephen Mile', '801-949-8531',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 3: Daren Deru Jun 23-30
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    '7561897e-2234-4d7f-b53d-e18e36cfc8cf',
    '2026-06-23 00:00:00+00', '2026-06-30 00:00:00+00',
    'Daren Deru', '801-807-8321',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 4: Jim Larkin Jul 1-8
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    '0e539474-cc2f-4d79-83c0-c639309ba3eb',
    '2026-07-01 00:00:00+00', '2026-07-08 00:00:00+00',
    'Jim Larkin', '801-870-3385',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 5: Chad Moore Jul 9-16
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    'b9437987-9e11-40dc-87bd-11fdfca9c294',
    '2026-07-09 00:00:00+00', '2026-07-16 00:00:00+00',
    'Chad Moore', '801-557-0011',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 6: John Duffield Jul 17-24
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    '57438307-b0cd-43f4-8aa4-99fdbf3b8634',
    '2026-07-17 00:00:00+00', '2026-07-24 00:00:00+00',
    'John Duffield', '972-979-9601',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 7: Trevis Jensen Jul 25 - Aug 2
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    'fad5d243-0f85-41e7-b3a6-854cf801478d',
    '2026-07-25 00:00:00+00', '2026-08-02 00:00:00+00',
    'Trevis Jensen', '801-638-0405',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 8: Jordan Miller Aug 3-10
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    'a06cd13f-591d-40ef-bb7a-163496ddd592',
    '2026-08-03 00:00:00+00', '2026-08-10 00:00:00+00',
    'Jordan Miller', '385-329-8188',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  ),
  -- Turn 9: Kelly Arends Aug 11-20
  (
    'b30555e7-e631-49cd-9542-e82f13a7c716',
    '18f759fe-1c5d-409b-bf0e-dd1835cd00e5',
    '2026-08-11 00:00:00+00', '2026-08-20 00:00:00+00',
    'Kelly Arends', '949-494-4554',
    '12:00', '12:00',
    false, false,
    '8a2b23cc-f1a1-4b6b-93d0-a1fe30970d93'
  );
