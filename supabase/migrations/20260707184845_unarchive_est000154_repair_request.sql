-- Unarchive EST000154 repair request so it shows in the active list
UPDATE repair_requests
SET archived = false
WHERE id = '5b13d39d-81c5-4399-8873-c3e0106b7c67'
  AND estimate_id = '5594f092-3e90-48c6-90bf-eb4cd4efa1e6';