/*
# Create jarvis_unanswered_questions

1. New Tables
- `jarvis_unanswered_questions`: questions staff asked Bob that he could not answer from the business data or the knowledge base.
  - `id` (uuid, primary key)
  - `question` (text): the question as asked
  - `attempted_note` (text, optional): what Bob tried or why he could not answer
  - `asked_by` (uuid, optional): the user who asked
  - `status` (text): 'open', 'resolved' or 'dismissed'
  - `created_at`, `resolved_at`

2. Security
- Enable RLS.
- Only the server (edge function, service_role) reads and writes this table. Staff never query it directly.
- Master users review the list through the jarvis-chat edge function, which checks the master role before returning data.
*/

CREATE TABLE IF NOT EXISTS jarvis_unanswered_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  attempted_note text,
  asked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS jarvis_unanswered_questions_status_created_idx
  ON jarvis_unanswered_questions (status, created_at DESC);

ALTER TABLE jarvis_unanswered_questions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON jarvis_unanswered_questions TO service_role;
