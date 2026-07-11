-- Delete duplicate trip 6 inspection for Destiny (created 7 min after trip 5 with identical data)
DELETE FROM inspection_time_entries WHERE inspection_id = '729aea86-1789-41f8-a6b1-76998e9f9e58';
DELETE FROM trip_inspections WHERE id = '729aea86-1789-41f8-a6b1-76998e9f9e58';