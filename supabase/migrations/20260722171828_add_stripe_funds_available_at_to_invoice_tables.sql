/*
# Add Stripe funds availability date to invoice tables

## Purpose
When an ACH/bank transfer payment is in "processing" status, Stripe provides a
date when the funds will become available in the merchant's bank account
(exposed via the Balance Transaction's `available_on` field). This migration
adds a column to store that date so the invoice screen can display it to staff
alongside the "Processing" badge.

## Changes

### estimating_invoices table
- Added `stripe_funds_available_at` (timestamptz, nullable) — the date Stripe
  reports funds will be available for ACH payments in processing status.

### yacht_invoices table
- Added `stripe_funds_available_at` (timestamptz, nullable) — same purpose as
  above for yacht invoices.

## Security
- No RLS policy changes. Existing policies remain in effect.
- The new columns are nullable so existing rows are unaffected.

## Notes
1. Both columns are nullable — no backfill is needed.
2. The columns are populated by the stripe-webhook and sync-stripe-payment
   edge functions when they detect ACH processing payments.
3. When a payment transitions from "processing" to "paid", the column retains
   the historical funds-availability date (it is not cleared).
*/

ALTER TABLE estimating_invoices
  ADD COLUMN IF NOT EXISTS stripe_funds_available_at timestamptz;

ALTER TABLE yacht_invoices
  ADD COLUMN IF NOT EXISTS stripe_funds_available_at timestamptz;