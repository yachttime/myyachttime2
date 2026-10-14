-- Backfill missing company_id on vessel_management_agreements from the linked yacht
UPDATE vessel_management_agreements vma
SET company_id = y.company_id
FROM yachts y
WHERE vma.yacht_id = y.id
  AND vma.company_id IS NULL
  AND y.company_id IS NOT NULL;

-- Fix SELECT policy: handle legacy rows where company_id may be NULL
-- by falling back to the yacht's company_id
DROP POLICY IF EXISTS "Users can view company vessel agreements" ON vessel_management_agreements;

CREATE POLICY "Users can view company vessel agreements" ON vessel_management_agreements
  FOR SELECT TO authenticated
  USING (
    COALESCE(company_id, (SELECT y.company_id FROM yachts y WHERE y.id = vessel_management_agreements.yacht_id))
    = get_user_company_id()
  );

-- Add trigger to auto-set company_id from yacht on insert (for future agreements)
CREATE OR REPLACE FUNCTION set_vessel_agreement_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.company_id IS NULL AND NEW.yacht_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM yachts WHERE id = NEW.yacht_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_vessel_agreement_company_id ON vessel_management_agreements;
CREATE TRIGGER trg_set_vessel_agreement_company_id
  BEFORE INSERT ON vessel_management_agreements
  FOR EACH ROW EXECUTE FUNCTION set_vessel_agreement_company_id();
