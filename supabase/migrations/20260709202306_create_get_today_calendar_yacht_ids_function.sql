CREATE OR REPLACE FUNCTION get_today_calendar_yacht_ids()
RETURNS TABLE(yacht_id uuid) AS $$
DECLARE
  user_company uuid;
  today_start timestamptz;
  today_end timestamptz;
BEGIN
  SELECT up.company_id INTO user_company FROM user_profiles up WHERE up.user_id = auth.uid();
  today_start := (now() AT TIME ZONE 'America/Phoenix')::date::timestamptz;
  today_end := today_start + interval '1 day' - interval '1 millisecond';

  RETURN QUERY
  SELECT DISTINCT yb.yacht_id
  FROM yacht_bookings yb
  WHERE yb.company_id = user_company
    AND yb.start_date <= today_end
    AND yb.end_date >= today_start;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;