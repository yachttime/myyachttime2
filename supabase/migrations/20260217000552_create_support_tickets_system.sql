/*
  # Create Support Tickets System

  1. New Tables
    - `support_tickets`
      - `id` (uuid, primary key)
      - `ticket_number` (text, unique) - Auto-generated ticket number
      - `user_id` (uuid, foreign key to user_profiles)
      - `company_id` (uuid, foreign key to companies)
      - `subject` (text) - Ticket subject/title
      - `message` (text) - Detailed message
      - `category` (text) - Type of support request (general, billing, technical, account, other)
      - `priority` (text) - Priority level (low, medium, high, urgent)
      - `status` (text) - Ticket status (open, in_progress, waiting_on_customer, resolved, closed)
      - `assigned_to` (uuid, foreign key to user_profiles) - Staff member assigned
      - `attachment_url` (text) - Optional attachment
      - `last_response_at` (timestamptz) - When last response was made
      - `resolved_at` (timestamptz) - When ticket was resolved
      - `closed_at` (timestamptz) - When ticket was closed
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `support_ticket_responses`
      - `id` (uuid, primary key)
      - `ticket_id` (uuid, foreign key to support_tickets)
      - `user_id` (uuid, foreign key to user_profiles)
      - `message` (text)
      - `attachment_url` (text) - Optional attachment
      - `is_staff_response` (boolean) - Whether response is from staff
      - `created_at` (timestamptz)

  2. Storage
    - Create storage bucket for support ticket attachments

  3. Security
    - Enable RLS on both tables
    - Users can view and create their own tickets
    - Users can add responses to their own tickets
    - Staff (master, manager, staff, mechanic) can view all tickets within their company
    - Staff can add responses and update ticket status

  4. Indexes
    - Add indexes for common queries (user_id, company_id, status, ticket_number)
*/

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'billing', 'technical', 'account', 'feature_request', 'bug_report', 'other')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_on_customer', 'resolved', 'closed')),
  assigned_to uuid REFERENCES user_profiles(user_id) ON DELETE SET NULL,
  attachment_url text,
  last_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create support_ticket_responses table
CREATE TABLE IF NOT EXISTS support_ticket_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  message text NOT NULL,
  attachment_url text,
  is_staff_response boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_company_id ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_ticket_responses_ticket_id ON support_ticket_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_responses_created_at ON support_ticket_responses(created_at DESC);

-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for support attachments
CREATE POLICY "Users can upload their own support attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own support attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
      )
    )
  );

CREATE POLICY "Staff can view all support attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments' AND
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
    )
  );

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_number text;
  counter int;
BEGIN
  -- Get count of existing tickets + 1
  SELECT COUNT(*) + 1 INTO counter FROM support_tickets;
  
  -- Generate ticket number like ST-00001
  new_number := 'ST-' || LPAD(counter::text, 5, '0');
  
  -- Check if it exists (shouldn't, but just in case)
  WHILE EXISTS (SELECT 1 FROM support_tickets WHERE ticket_number = new_number) LOOP
    counter := counter + 1;
    new_number := 'ST-' || LPAD(counter::text, 5, '0');
  END LOOP;
  
  RETURN new_number;
END;
$$;

-- Trigger to auto-generate ticket number
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_number();

-- Trigger to update last_response_at on support_tickets
CREATE OR REPLACE FUNCTION update_ticket_last_response()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE support_tickets
  SET 
    last_response_at = NEW.created_at,
    updated_at = NEW.created_at
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_last_response
  AFTER INSERT ON support_ticket_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_response();

-- Trigger to update resolved_at and closed_at timestamps
CREATE OR REPLACE FUNCTION update_ticket_status_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update resolved_at when status changes to resolved
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    NEW.resolved_at := now();
  END IF;
  
  -- Update closed_at when status changes to closed
  IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
    NEW.closed_at := now();
  END IF;
  
  -- Clear resolved_at if status changes away from resolved/closed
  IF NEW.status NOT IN ('resolved', 'closed') AND OLD.status IN ('resolved', 'closed') THEN
    NEW.resolved_at := NULL;
    NEW.closed_at := NULL;
  END IF;
  
  NEW.updated_at := now();
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ticket_status_timestamps
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_ticket_status_timestamps();

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for support_tickets

-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
      AND user_profiles.company_id = support_tickets.company_id
    )
  );

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tickets (limited fields)
CREATE POLICY "Users can update their own tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Staff can update any ticket in their company
CREATE POLICY "Staff can update tickets in their company"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
      AND user_profiles.company_id = support_tickets.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
      AND user_profiles.company_id = support_tickets.company_id
    )
  );

-- RLS Policies for support_ticket_responses

-- Users can view responses for their tickets
CREATE POLICY "Users can view responses for their tickets"
  ON support_ticket_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_responses.ticket_id
      AND (
        support_tickets.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM user_profiles
          WHERE user_profiles.user_id = auth.uid()
          AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
          AND user_profiles.company_id = support_tickets.company_id
        )
      )
    )
  );

-- Users can create responses to their tickets
CREATE POLICY "Users can create responses to their tickets"
  ON support_ticket_responses FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (
      EXISTS (
        SELECT 1 FROM support_tickets
        WHERE support_tickets.id = support_ticket_responses.ticket_id
        AND support_tickets.user_id = auth.uid()
      ) OR
      EXISTS (
        SELECT 1 FROM user_profiles
        JOIN support_tickets ON support_tickets.company_id = user_profiles.company_id
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('master', 'manager', 'staff', 'mechanic')
        AND support_tickets.id = support_ticket_responses.ticket_id
      )
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE support_ticket_responses;

-- Create notification trigger for new tickets
CREATE OR REPLACE FUNCTION notify_new_support_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_name text;
  v_user_email text;
BEGIN
  -- Get user information
  SELECT full_name, email_address
  INTO v_user_name, v_user_email
  FROM user_profiles
  WHERE user_id = NEW.user_id;
  
  -- Create admin notification for staff
  INSERT INTO admin_notifications (
    type,
    title,
    message,
    reference_id,
    company_id,
    created_at
  ) VALUES (
    'support_ticket',
    'New Support Ticket: ' || NEW.ticket_number,
    v_user_name || ' submitted a support ticket: ' || NEW.subject,
    NEW.id,
    NEW.company_id,
    now()
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_support_ticket
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_support_ticket();