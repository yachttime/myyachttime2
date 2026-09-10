-- Modify get_user_company_id() to support a virtual company context for master users.
-- Masters can switch which company they're viewing without changing their actual company_id.
-- The selected company is stored in a per-session GUC variable set via RPC.
-- If the GUC is not set, falls back to the user's real company_id.

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT COALESCE(
  NULLIF(current_setting('app.selected_company_id', true), '')::uuid,
  (SELECT company_id FROM user_profiles WHERE user_id = auth.uid() LIMIT 1)
);
$function$;

-- Helper function for masters to set their active company context
CREATE OR REPLACE FUNCTION public.set_selected_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow master users to set a virtual company
  IF NOT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_id = auth.uid() AND role = 'master'
  ) THEN
    RAISE EXCEPTION 'Only master users can set company context';
  END IF;

  PERFORM set_config('app.selected_company_id', p_company_id::text, true);
END;
$function$;

-- Revoke public execute, grant only authenticated
REVOKE EXECUTE ON FUNCTION public.set_selected_company(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_selected_company(uuid) TO authenticated;
