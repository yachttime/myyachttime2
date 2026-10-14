/*
# Fix Bucket List 2027 Trip Dates

Corrects all 12 trip dates based on the actual week schedule:
- Week 1: May 26 - June 1 (Memorial Day)
- Week 3: June 9 - June 15
- Week 5: June 23 - June 29
- Week 6: June 30 - July 6
- Week 7: July 7 - July 13
- Week 8: July 14 - July 20
- Week 9: July 21 - July 27
- Week 12: August 11 - August 17
- Week 15: September 1 - September 7 (Labor Day)
- Week 16: September 8 - September 14
- Week 17: September 15 - September 21
- Week 19: September 29 - October 5

All times remain 10:00 AM Arizona (UTC-7).
*/

-- Trip 1 (Week 1): Jason Breinholt — May 26 to June 1
UPDATE yacht_bookings SET
  start_date = '2027-05-26 10:00:00-07:00',
  end_date = '2027-06-01 10:00:00-07:00'
WHERE id = '65b553ed-25f3-4d3c-a9ab-eadcba0bd3a4';

-- Trip 2 (Week 3): Josh Haslam + Shawn Maxwell — June 9 to June 15
UPDATE yacht_bookings SET
  start_date = '2027-06-09 10:00:00-07:00',
  end_date = '2027-06-15 10:00:00-07:00'
WHERE id = '74f431ca-9fc9-44d3-bc7b-9eb6a1083a55';

-- Trip 3 (Week 5): Frankie Breinholt + Tyson Breinholt — June 23 to June 29
UPDATE yacht_bookings SET
  start_date = '2027-06-23 10:00:00-07:00',
  end_date = '2027-06-29 10:00:00-07:00'
WHERE id = '75bb4c7b-f1b3-42c7-82a5-2eaefc3c9d42';

-- Trip 4 (Week 6): Sam Bollwinkel + Brett Quackenbush — June 30 to July 6
UPDATE yacht_bookings SET
  start_date = '2027-06-30 10:00:00-07:00',
  end_date = '2027-07-06 10:00:00-07:00'
WHERE id = 'b33c8f76-546e-46b9-96a2-5ecad83ed737';

-- Trip 5 (Week 7): Tyson + Frankie + Damon + Lance — July 7 to July 13
UPDATE yacht_bookings SET
  start_date = '2027-07-07 10:00:00-07:00',
  end_date = '2027-07-13 10:00:00-07:00'
WHERE id = 'a5bb852e-f6fc-40ee-9081-b29b0bb2f924';

-- Trip 6 (Week 8): Damon Breinholt + Lance Foster — July 14 to July 20
UPDATE yacht_bookings SET
  start_date = '2027-07-14 10:00:00-07:00',
  end_date = '2027-07-20 10:00:00-07:00'
WHERE id = '82a84c19-2b87-4ad2-bee0-e03f902a7223';

-- Trip 7 (Week 9): Jason Breinholt — July 21 to July 27
UPDATE yacht_bookings SET
  start_date = '2027-07-21 10:00:00-07:00',
  end_date = '2027-07-27 10:00:00-07:00'
WHERE id = 'cc759160-d649-4d6b-89dc-36e110c5f76e';

-- Trip 8 (Week 12): Sam Bollwinkel + Brett Quackenbush — August 11 to August 17
UPDATE yacht_bookings SET
  start_date = '2027-08-11 10:00:00-07:00',
  end_date = '2027-08-17 10:00:00-07:00'
WHERE id = 'e2bf6ee4-35b4-415a-b356-97ffd4cb2f3e';

-- Trip 9 (Week 15 - Labor Day): Frankie + Tyson — September 1 to September 7
UPDATE yacht_bookings SET
  start_date = '2027-09-01 10:00:00-07:00',
  end_date = '2027-09-07 10:00:00-07:00'
WHERE id = 'f76e7bdd-309d-4f92-a0c9-ba2f185dcf6e';

-- Trip 10 (Week 16): Damon + Lance — September 8 to September 14
UPDATE yacht_bookings SET
  start_date = '2027-09-08 10:00:00-07:00',
  end_date = '2027-09-14 10:00:00-07:00'
WHERE id = 'f62e5792-ac33-43bc-a1ee-63745b3aea0a';

-- Trip 11 (Week 17): Josh Haslam + Shawn Maxwell — September 15 to September 21
UPDATE yacht_bookings SET
  start_date = '2027-09-15 10:00:00-07:00',
  end_date = '2027-09-21 10:00:00-07:00'
WHERE id = '3c2001e8-f4f0-4d95-9cd2-9b2f0281ecc3';

-- Trip 12 (Week 19): Tyson + Frankie + Damon + Lance — September 29 to October 5
UPDATE yacht_bookings SET
  start_date = '2027-09-29 10:00:00-07:00',
  end_date = '2027-10-05 10:00:00-07:00'
WHERE id = 'd5316620-096e-4f1c-8905-08144d2133cc';