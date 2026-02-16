/*
  # Add Company Details and Address Fields

  1. New Fields Added to companies table
    - `physical_address` (text) - Street address for physical location
    - `physical_city` (text) - City for physical location
    - `physical_state` (text) - State for physical location
    - `physical_zip_code` (text) - ZIP code for physical location
    - `mailing_address` (text) - Street address for mailing
    - `mailing_city` (text) - City for mailing
    - `mailing_state` (text) - State for mailing
    - `mailing_zip_code` (text) - ZIP code for mailing
    - `contact_name` (text) - Primary account contact name
    - `contact_email` (text) - Primary account contact email
    - `contact_phone` (text) - Primary account contact phone
    - `tax_id` (text) - Tax ID/EIN number
    
  2. Changes
    - Add all new fields to companies table
    - Update logo_url to be accessible for forms
*/

-- Add physical address fields
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS physical_address text,
  ADD COLUMN IF NOT EXISTS physical_city text,
  ADD COLUMN IF NOT EXISTS physical_state text,
  ADD COLUMN IF NOT EXISTS physical_zip_code text;

-- Add mailing address fields
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS mailing_address text,
  ADD COLUMN IF NOT EXISTS mailing_city text,
  ADD COLUMN IF NOT EXISTS mailing_state text,
  ADD COLUMN IF NOT EXISTS mailing_zip_code text;

-- Add company contact fields
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text;

-- Add tax ID field
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS tax_id text;