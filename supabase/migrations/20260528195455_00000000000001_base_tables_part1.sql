
/*
  # Base Schema Part 1: Core Tables
  Creates user_profiles, yachts, yacht_bookings tables with RLS
*/

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  yacht_name text,
  role text DEFAULT 'owner' CHECK (role IN ('owner', 'manager', 'staff', 'mechanic', 'master')),
  yacht_id uuid,
  first_name text,
  last_name text,
  phone text,
  email text,
  street text,
  city text,
  state text,
  zip_code text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS yachts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model text,
  year integer,
  description text,
  image_url text,
  owner_id uuid REFERENCES auth.users(id),
  hull_number text,
  size text,
  port_engine text,
  starboard_engine text,
  port_generator text,
  starboard_generator text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE yachts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS yacht_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  yacht_id uuid REFERENCES yachts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  checked_in boolean DEFAULT false,
  checked_out boolean DEFAULT false,
  notes text,
  owner_name text,
  owner_contact text,
  departure_time text,
  arrival_time text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE yacht_bookings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_yacht_bookings_yacht_id ON yacht_bookings(yacht_id);
CREATE INDEX IF NOT EXISTS idx_yacht_bookings_user_id ON yacht_bookings(user_id);
