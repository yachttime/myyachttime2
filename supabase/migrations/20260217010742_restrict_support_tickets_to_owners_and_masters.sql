/*
  # Restrict Support Tickets to Owners and Masters Only

  1. Changes
    - Remove access for manager, staff, and mechanic roles from support tickets
    - Only boat owners (who create tickets) and Masters can view/manage support tickets
    - Update all RLS policies to reflect this restriction
    - Update storage policies for support attachments

  2. Security
    - Drop existing policies that grant access to all staff
    - Create new policies that only allow:
      - Owners: Can view and manage their own tickets
      - Masters: Can view and manage all tickets in their company
*/

-- Drop existing RLS policies for support_tickets
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Staff can update tickets in their company" ON support_tickets;

-- Drop existing RLS policies for support_ticket_responses
DROP POLICY IF EXISTS "Users can view responses for their tickets" ON support_ticket_responses;
DROP POLICY IF EXISTS "Users can create responses to their tickets" ON support_ticket_responses;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Users can view their own support attachments" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view all support attachments" ON storage.objects;

-- Create new RLS policies for support_tickets

-- Owners and Masters can view tickets
CREATE POLICY "Owners and Masters can view tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.company_id = support_tickets.company_id
    )
  );

-- Only Masters can update any ticket in their company (besides the owner updating their own)
CREATE POLICY "Masters can update tickets in their company"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.company_id = support_tickets.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role = 'master'
      AND user_profiles.company_id = support_tickets.company_id
    )
  );

-- Create new RLS policies for support_ticket_responses

-- Owners and Masters can view responses
CREATE POLICY "Owners and Masters can view responses"
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
          AND user_profiles.role = 'master'
          AND user_profiles.company_id = support_tickets.company_id
        )
      )
    )
  );

-- Owners and Masters can create responses
CREATE POLICY "Owners and Masters can create responses"
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
        AND user_profiles.role = 'master'
        AND support_tickets.id = support_ticket_responses.ticket_id
      )
    )
  );

-- Create new storage policies for support attachments

-- Users can view their own attachments or Masters can view all
CREATE POLICY "Owners and Masters can view support attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role = 'master'
      )
    )
  );

-- Update notification trigger to only notify Masters
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
  
  -- Create admin notification for Masters only
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
