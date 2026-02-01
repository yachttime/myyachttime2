/*
  # Enable Realtime for Work Orders

  1. Changes
    - Enable realtime publication for work_orders table
    - Enable realtime publication for work_order_task_assignments table
    - This allows employees to see work order updates in real-time on their time clock

  2. Security
    - No changes to RLS policies
*/

-- Enable realtime for work_orders
ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;

-- Enable realtime for work_order_task_assignments
ALTER PUBLICATION supabase_realtime ADD TABLE work_order_task_assignments;
