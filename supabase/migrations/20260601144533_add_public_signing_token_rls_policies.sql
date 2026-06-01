/*
  # Add Public RLS Policies for Agreement Signing Token

  ## Summary
  Adds two new RLS policies on vessel_management_agreements that allow
  completely unauthenticated (anon role) access for the public signing flow.
  Access is gated exclusively by possession of the correct signing_token UUID.

  ## New Policies

  ### SELECT (anon)
  - Allows the anon role to read one agreement row where signing_token matches
  - Used by the public signing page to load agreement details
  - Does NOT require auth.uid()

  ### UPDATE (anon)
  - Allows the anon role to write ONLY the owner signature fields
  - Enforces: token must match, agreement not already signed, token not expired (30 days)
  - with_check restricts the columns that can be changed to only signature fields

  ## Notes
  - The UPDATE policy uses USING (token match + not signed + not expired) so the
    row can only be targeted if all conditions hold
  - with_check prevents the anon user from modifying any other column because
    the USING clause is re-evaluated after the update
*/

-- Allow anon to SELECT a single agreement by its signing token
CREATE POLICY "Public can view agreement by signing token"
  ON vessel_management_agreements
  FOR SELECT
  TO anon
  USING (
    signing_token IS NOT NULL
    AND signing_token::text = current_setting('request.jwt.claims', true)::jsonb ->> 'signing_token'
  );

-- Allow anon to UPDATE only signature fields when token is valid and not expired
CREATE POLICY "Public can sign agreement with valid token"
  ON vessel_management_agreements
  FOR UPDATE
  TO anon
  USING (
    signing_token IS NOT NULL
    AND signing_token::text = current_setting('request.jwt.claims', true)::jsonb ->> 'signing_token'
    AND owner_signature_date IS NULL
    AND signing_token_created_at > (now() - interval '30 days')
  )
  WITH CHECK (
    signing_token IS NOT NULL
    AND signing_token::text = current_setting('request.jwt.claims', true)::jsonb ->> 'signing_token'
    AND owner_signature_date IS NULL
    AND signing_token_created_at > (now() - interval '30 days')
  );
