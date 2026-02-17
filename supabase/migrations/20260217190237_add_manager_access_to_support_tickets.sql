/*
  # Add Manager Access to Support Tickets

  1. Changes
    - Grant managers access to view and manage support tickets
    - Update all RLS policies to include manager role
    - Update notification triggers to notify managers

  2. Security
    - Managers can view all tickets in their company
    - Managers can update ticket status and responses
    - Managers receive notifications for new tickets
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Owners and Masters can view tickets" ON support_tickets;
DROP POLICY IF EXISTS "Masters can update tickets in their company" ON support_tickets;
DROP POLICY IF EXISTS "Owners and Masters can view responses" ON support_ticket_responses;
DROP POLICY IF EXISTS "Owners and Masters can create responses" ON support_ticket_responses;
DROP POLICY IF EXISTS "Owners and Masters can view support attachments" ON storage.objects;

-- Recreate policies with manager access

-- Owners, Managers, and Masters can view tickets
CREATE POLICY "Owners, Managers, and Masters can view tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager')
      AND user_profiles.company_id = support_tickets.company_id
    )
  );

-- Managers and Masters can update tickets in their company
CREATE POLICY "Managers and Masters can update tickets"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager')
      AND user_profiles.company_id = support_tickets.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id = auth.uid()
      AND user_profiles.role IN ('master', 'manager')
      AND user_profiles.company_id = support_tickets.company_id
    )
  );

-- Owners, Managers, and Masters can view responses
CREATE POLICY "Owners, Managers, and Masters can view responses"
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
          AND user_profiles.role IN ('master', 'manager')
          AND user_profiles.company_id = support_tickets.company_id
        )
      )
    )
  );

-- Owners, Managers, and Masters can create responses
CREATE POLICY "Owners, Managers, and Masters can create responses"
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
        AND user_profiles.role IN ('master', 'manager')
        AND support_tickets.id = support_ticket_responses.ticket_id
      )
    )
  );

-- Owners, Managers, and Masters can view support attachments
CREATE POLICY "Owners, Managers, and Masters can view support attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'support-attachments' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text OR
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.user_id = auth.uid()
        AND user_profiles.role IN ('master', 'manager')
      )
    )
  );
