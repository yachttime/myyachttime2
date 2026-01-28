/*
  # Enable Realtime for Yacht Invoices

  1. Changes
    - Enable realtime on yacht_invoices table to allow frontend to receive live updates when email engagement tracking updates occur
    - This allows the dashboard to instantly reflect when customers open or click payment emails

  2. Security
    - Realtime subscriptions respect existing RLS policies
    - No changes to existing RLS policies needed
*/

-- Enable realtime for yacht_invoices table
ALTER PUBLICATION supabase_realtime ADD TABLE yacht_invoices;
