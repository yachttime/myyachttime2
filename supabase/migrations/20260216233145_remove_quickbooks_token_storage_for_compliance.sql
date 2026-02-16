/*
  # QuickBooks OAuth Compliance Update
  
  1. Changes
    - Remove `access_token` and `refresh_token` columns from `quickbooks_connection` table
    - Tokens will now be stored only in encrypted volatile memory (edge function sessions)
    - Keep only connection metadata: realm_id, expires_at, connected status
    
  2. Security
    - This change ensures compliance with QuickBooks payment processing requirements:
      * Tokens encrypted before storage (encryption in edge functions)
      * Tokens stored in volatile memory only (no persistent database storage)
    
  3. Notes
    - Existing tokens will be removed - users will need to reconnect
    - Connection status and metadata remain for tracking purposes
    - Token management moved to secure edge function layer
*/

-- Remove token columns from quickbooks_connection table
ALTER TABLE quickbooks_connection 
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

-- Add migration note
COMMENT ON TABLE quickbooks_connection IS 'Stores QuickBooks connection metadata only. Tokens are stored in encrypted volatile memory for compliance.';
