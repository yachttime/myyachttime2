CREATE OR REPLACE FUNCTION get_today_calendar_yacht_ids()
RETURNS TABLE(yacht_id uuid) AS $$
DECLARE
  user_company uuid;
  today_date date;
BEGIN
  SELECT up.company_id INTO user_company FROM user_profiles up WHERE up.user_id = auth.uid();
  today_date := (now() AT TIME ZONE 'America/Phoenix')::date;

  RETURN QUERY
  SELECT DISTINCT yb.yacht_id
  FROM yacht_bookings yb
  JOIN yachts y ON y.id = yb.yacht_id AND y.is_active = true
  WHERE yb.company_id = user_company
    AND (
      (yb.start_date AT TIME ZONE 'America/Phoenix')::date = today_date
      OR (yb.end_date AT TIME ZONE 'America/Phoenix')::date = today_date
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;