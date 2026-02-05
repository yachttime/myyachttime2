/*
  # Enable realtime for repair_requests table

  1. Changes
    - Enable realtime updates for the repair_requests table
    - This allows the frontend to receive instant updates when repair request status changes
    - Required for email approval links to update the UI in real-time
*/

-- Enable realtime for repair_requests
ALTER PUBLICATION supabase_realtime ADD TABLE repair_requests;
