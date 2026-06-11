-- Add FK from repair_request_notes.user_id to user_profiles.user_id
-- so PostgREST can resolve the join user_profiles!user_id
ALTER TABLE repair_request_notes
  ADD CONSTRAINT repair_request_notes_user_id_fkey2
  FOREIGN KEY (user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE;
