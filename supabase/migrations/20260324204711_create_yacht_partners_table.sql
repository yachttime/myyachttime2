/*
  # Create yacht_partners table

  Stores the charter/partner schedule for yachts, showing which partner
  has the yacht during specific date ranges along with their contact info.

  ## New Tables
  - `yacht_partners`
    - `id` (uuid, primary key)
    - `yacht_id` (uuid, FK to yachts)
    - `partner_name` (text) - Partner/company name, or 'Available'
    - `week_label` (text) - Human-readable date range e.g. "June 3 - June 12"
    - `phone` (text) - Contact phone with name
    - `email` (text) - Contact email
    - `notes` (text) - Optional notes
    - `sort_order` (int) - Display order
    - `company_id` (uuid, FK to companies)
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled, staff/master can read/write, others read only their yacht's data
*/

CREATE TABLE IF NOT EXISTS yacht_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid NOT NULL REFERENCES yachts(id) ON DELETE CASCADE,
  partner_name text NOT NULL DEFAULT '',
  week_label text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  notes text DEFAULT '',
  sort_order integer DEFAULT 0,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE yacht_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff and master can manage yacht partners"
  ON yacht_partners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff and master can insert yacht partners"
  ON yacht_partners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff and master can update yacht partners"
  ON yacht_partners FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

CREATE POLICY "Staff and master can delete yacht partners"
  ON yacht_partners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('staff', 'mechanic', 'master')
    )
  );

-- Seed ATARAXIA partner data (yacht id: 1f2e511b-42da-4aae-a96a-5d6eb052f9dd)
INSERT INTO yacht_partners (yacht_id, partner_name, week_label, phone, email, sort_order) VALUES
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'ParkBolt LLC',  'June 3 - June 12',   '720-317-9684 Dave',  'parda03@yahoo.com',              1),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'Available',     'June 13 - June 22',  '',                    '',                               2),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'Lovell',        'June 23 - July 2',   '801-706-4693 Brett', 'amberlovell87@gmail.com',        3),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'T. Brown',      'July 3 - July 12',   '801-557-9875 Tim',   'Timjr@rgsexteriors.com',         4),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'Available',     'July 13 - July 22',  '',                    '',                               5),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'Ginger',        'July 23 - Aug 1',    '949-300-1496 John',  'john@johnginger.com',            6),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'Sacalas',       'Aug 2 - Aug 11',     '909-213-5024 Kevin', 'kevinsacalas@hotmail.com',       7),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'H. Brown',      'Sept 18 - Sept 27',  '602-622-4250 Henry', 'henry.brown@henrybrownauto.com', 8),
  ('1f2e511b-42da-4aae-a96a-5d6eb052f9dd', 'Tom Larsen',    'Proprietor',         '801-390-0248 Tom',   'larsen.tom.e@gmail.com',         9);
