
-- Chris & D'lane Dreyer is a manager on ALLURE and should receive work order notifications
UPDATE user_profiles
SET can_approve_billing = true
WHERE user_id = '41155fa5-2d5d-4db8-9fb9-35c51e120562'
  AND yacht_id = 'bd8a74e5-3c0f-4b40-8d4b-225ba5aeda51';
