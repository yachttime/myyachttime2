# QuickBooks Online Integration Setup Guide

## Overview

Yacht Time now includes full QuickBooks Online integration that allows you to:
- Connect to QuickBooks Online via OAuth 2.0
- Download and sync your QuickBooks Chart of Accounts
- Map Yacht Time accounting codes and labor codes to QuickBooks accounts
- Automatically push completed invoices and payments to QuickBooks

## Prerequisites

Before you can use the QuickBooks integration, you need to:

1. Have a QuickBooks Online account
2. Create a QuickBooks Online app in the Intuit Developer Portal
3. Configure OAuth credentials in your Supabase environment

## Step 1: Create a QuickBooks Online App

1. Go to the [Intuit Developer Portal](https://developer.intuit.com/)
2. Sign in with your Intuit account
3. Click "Create an app" or "My apps"
4. Create a new app and select "QuickBooks Online" as the platform
5. Complete the app setup and get your credentials:
   - **Client ID**
   - **Client Secret**

## Step 2: Configure OAuth Redirect URI

In your QuickBooks app settings, add the following as a Redirect URI:
```
https://your-yacht-time-domain.com/quickbooks-callback.html
```

Replace `your-yacht-time-domain.com` with your actual domain.

## Step 3: Configure Environment Variables

You need to set these environment variables in your Supabase project:

- `QUICKBOOKS_CLIENT_ID` - Your QuickBooks app Client ID
- `QUICKBOOKS_CLIENT_SECRET` - Your QuickBooks app Client Secret
- `QUICKBOOKS_REDIRECT_URI` - The callback URL (e.g., `https://your-domain.com/quickbooks-callback.html`)

**Note:** The edge functions will automatically have access to these environment variables.

## Step 4: Using the QuickBooks Integration

### Connecting to QuickBooks

1. Log in as a **Master** user (only Master users can connect QuickBooks)
2. Go to **QuickBooks Integration** in the main menu
3. Click the **"Connect to QuickBooks"** button
4. A popup window will open with QuickBooks login
5. Sign in to QuickBooks and authorize the connection
6. The popup will close automatically when complete

### Syncing Chart of Accounts

After connecting:

1. Click the **"Sync Accounts"** button
2. Wait for the sync to complete (typically 5-10 seconds)
3. You'll see a success message with the number of accounts synced
4. The QuickBooks Chart of Accounts is now available for mapping

### Mapping Accounts

The system has three types of mappings:

#### 1. Default Accounts
These are system-wide default accounts used for different transaction types:
- **Service Income** - Default revenue account for services
- **Parts Sales** - Default revenue account for parts
- **Labor Income** - Default revenue account for labor
- **Cost of Goods Sold** - Default COGS account for parts
- **Inventory Asset** - Default asset account for inventory
- **Sales Tax Payable** - Default account for sales tax
- **Operating Expenses** - Default account for expenses

#### 2. Labor Codes
Map each labor code to a specific QuickBooks income account for detailed revenue tracking by service type.

#### 3. Accounting Codes
Map your accounting codes to QuickBooks accounts for precise financial tracking and reporting.

### Pushing Invoices to QuickBooks

Once you have configured the mappings, you can push completed invoices to QuickBooks:

1. **Only paid invoices** can be pushed to QuickBooks
2. When you push an invoice:
   - If the customer doesn't exist in QuickBooks, they will be created automatically
   - An invoice is created in QuickBooks
   - A payment is recorded against that invoice
   - The invoice is marked as synced in Yacht Time

**Note:** Each invoice can only be pushed once. Already-synced invoices will show a "Synced to QuickBooks" indicator.

## Architecture

### Edge Functions

The integration uses three Supabase Edge Functions:

1. **quickbooks-oauth** - Handles OAuth authentication flow
   - Generates authorization URLs
   - Exchanges authorization codes for access tokens
   - Refreshes expired tokens
   - Handles disconnection

2. **quickbooks-sync-accounts** - Syncs Chart of Accounts
   - Fetches all accounts from QuickBooks
   - Updates the local database with account information
   - Maintains sync timestamps

3. **quickbooks-push-invoice** - Pushes invoices to QuickBooks
   - Creates customers if they don't exist
   - Creates invoices in QuickBooks
   - Records payments
   - Updates sync status

### Database Tables

- **quickbooks_connection** - Stores OAuth credentials and connection status
- **quickbooks_accounts** - Local cache of QuickBooks Chart of Accounts
- **quickbooks_account_mappings** - Maps internal codes to QuickBooks accounts
- **customers** - Extended with `qbo_customer_id` field
- **yacht_invoices** - Extended with `qbo_invoice_id` and `qbo_synced_at` fields

## Security

- OAuth tokens are stored encrypted in the database
- Only Master users can connect/disconnect QuickBooks
- Only Master, Staff, and Manager users can push invoices
- All API calls use HTTPS
- Tokens are automatically refreshed when they expire
- Access is restricted by company (multi-company isolation)

## Troubleshooting

### Connection Issues

**Problem:** "No active QuickBooks connection found"
- **Solution:** Make sure you've clicked "Connect to QuickBooks" and completed the OAuth flow

**Problem:** "Failed to refresh QuickBooks token"
- **Solution:** Disconnect and reconnect to QuickBooks to get new credentials

### Sync Issues

**Problem:** "Failed to sync QuickBooks accounts"
- **Solution:** Check that your QuickBooks connection is still active and try again

**Problem:** No accounts appear after syncing
- **Solution:** Make sure your QuickBooks company has a Chart of Accounts set up

### Invoice Push Issues

**Problem:** "Only paid invoices can be pushed to QuickBooks"
- **Solution:** Make sure the invoice payment status is "paid" before pushing

**Problem:** "No default income account mapping found"
- **Solution:** Configure at least the default account mappings before pushing invoices

## Best Practices

1. **Set up default mappings first** before pushing any invoices
2. **Map all your labor codes** for better revenue tracking
3. **Test with a few invoices** before doing bulk pushes
4. **Regularly sync your Chart of Accounts** to keep mappings up to date
5. **Use QuickBooks reports** to verify pushed transactions
6. **Don't delete customers in QuickBooks** that are linked to Yacht Time

## Limitations

- Only paid invoices can be pushed to QuickBooks
- Each invoice can only be pushed once
- Customer information must be complete before pushing
- The integration uses a simplified invoice format (one line item per invoice)
- Deleting records in QuickBooks won't delete them in Yacht Time

## Support

For issues or questions about the QuickBooks integration, contact your system administrator or refer to the QuickBooks Online API documentation.
