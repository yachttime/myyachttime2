-- Delete trip 7 for ALLURE (uploaded incorrectly)
DELETE FROM inspection_time_entries WHERE inspection_id = '4894e7fd-8714-40ea-b169-5150c47187b8';
DELETE FROM inspection_photos WHERE inspection_id = '4894e7fd-8714-40ea-b169-5150c47187b8';
DELETE FROM trip_inspections WHERE id = '4894e7fd-8714-40ea-b169-5150c47187b8';
