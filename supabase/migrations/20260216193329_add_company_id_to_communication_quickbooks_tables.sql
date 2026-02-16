/*
  # Add company_id to Communication, QuickBooks, and Miscellaneous Tables - Part 5

  1. Tables Updated
    - admin_notifications - Add company_id, index
    - staff_messages - Add company_id, index
    - owner_chat_messages - Add company_id, index
    - invoice_engagement_events - Add company_id, index
    - quickbooks_accounts - Add company_id, index
    - quickbooks_account_mappings - Add company_id, index
    - quickbooks_connection - Add company_id, index
    - quickbooks_settings - Add company_id, index
    - quickbooks_export_log - Add company_id, index
    - education_videos - Add company_id, index
    - video_uploads - Add company_id, index
    - vessel_management_agreements - Add company_id, index

  2. Notes
    - Each company has separate QuickBooks integration
    - Notifications and messages are company-isolated
    - Education content can be shared or company-specific
*/

-- Admin notifications
ALTER TABLE admin_notifications ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_company_id ON admin_notifications(company_id);

-- Staff messages
ALTER TABLE staff_messages ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_staff_messages_company_id ON staff_messages(company_id);

-- Owner chat messages
ALTER TABLE owner_chat_messages ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_owner_chat_messages_company_id ON owner_chat_messages(company_id);

-- Invoice engagement events
ALTER TABLE invoice_engagement_events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_invoice_engagement_events_company_id ON invoice_engagement_events(company_id);

-- QuickBooks accounts
ALTER TABLE quickbooks_accounts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_accounts_company_id ON quickbooks_accounts(company_id);

-- QuickBooks account mappings
ALTER TABLE quickbooks_account_mappings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_account_mappings_company_id ON quickbooks_account_mappings(company_id);

-- QuickBooks connection
ALTER TABLE quickbooks_connection ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_connection_company_id ON quickbooks_connection(company_id);

-- QuickBooks settings
ALTER TABLE quickbooks_settings ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_settings_company_id ON quickbooks_settings(company_id);

-- QuickBooks export log
ALTER TABLE quickbooks_export_log ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_quickbooks_export_log_company_id ON quickbooks_export_log(company_id);

-- Education videos
ALTER TABLE education_videos ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_education_videos_company_id ON education_videos(company_id);

-- Video uploads
ALTER TABLE video_uploads ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_video_uploads_company_id ON video_uploads(company_id);

-- Vessel management agreements
ALTER TABLE vessel_management_agreements ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_vessel_management_agreements_company_id ON vessel_management_agreements(company_id);
