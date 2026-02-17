# Connecting to AZ Marine's QuickBooks Online Account

## Understanding the Current Setup

Currently, you have:
- ✅ QuickBooks Developer App configured (Client ID & Secret)
- ✅ OAuth flow working
- ⚠️ Connected to a **test/demo QuickBooks company**, NOT AZ Marine's actual books

The `realmId` captured during connection (e.g., `9341456400728537`) is the ID of whatever QuickBooks company you authorized during the OAuth flow.

## What You Need

1. **AZ Marine's QuickBooks Online Account**
   - Must have an active QuickBooks Online subscription
   - You need admin/accountant access to authorize the connection

2. **Production OAuth Flow**
   - Your QuickBooks app may need to be published/approved by Intuit for production use
   - During development, you can use Intuit's Sandbox OR connect to real companies

## Steps to Connect to AZ Marine's Real QuickBooks

### Option 1: Connect to Production QuickBooks (Recommended)

1. **Verify QuickBooks Online Account**
   - Log in to AZ Marine's QuickBooks Online at https://quickbooks.intuit.com
   - Verify you have admin/accountant access
   - Note: This must be QuickBooks **Online**, not Desktop

2. **Update Your QuickBooks App Settings (if needed)**
   - Go to https://developer.intuit.com/app/developer/dashboard
   - Select your app
   - Under "Keys & credentials", make sure:
     - Production keys are generated (not just sandbox)
     - Redirect URI is set correctly: `https://myyachttime.vercel.app/quickbooks-callback.html`

3. **Disconnect Current Test Company**
   - In MyYachtTime app, go to QuickBooks settings
   - Click "Disconnect"

4. **Connect to AZ Marine's QuickBooks**
   - Click "Connect to QuickBooks"
   - **IMPORTANT**: In the QuickBooks login screen that appears:
     - Log in with AZ Marine's QuickBooks Online credentials
     - Select AZ Marine's company if multiple companies are available
     - Click "Authorize" to allow MyYachtTime to access the data

5. **Verify Connection**
   - After connecting, you should see "Connected to **AZ Marine**" (or whatever the company name is in QuickBooks)
   - The `realmId` will now be AZ Marine's company ID
   - Click "Sync Accounts" to pull AZ Marine's Chart of Accounts

### Option 2: Use QuickBooks Sandbox for Testing

If you want to test with sample data first:

1. **Create a Sandbox Company**
   - Go to https://developer.intuit.com/app/developer/dashboard
   - Click on your app
   - Go to "Sandbox" section
   - Create a test company with sample data

2. **Connect to Sandbox**
   - Use sandbox credentials to connect
   - Test all functionality with sample data
   - When ready, disconnect and connect to production (Option 1)

## Important Notes

### About Company IDs

- **MyYachtTime Company ID** (`519b4394-d35c-46d7-997c-db7e46178ef5`): Your internal database ID for AZ Marine
- **QuickBooks Realm ID** (`9341456400728537`): QuickBooks' ID for whatever company you connected to
- These are separate systems - the integration links them together

### About QuickBooks Developer Accounts

- The QuickBooks Developer account is just for managing the OAuth app credentials
- It's NOT the account that contains AZ Marine's financial data
- Think of it like: Developer account = app settings, Real account = actual business data

### Syncing Data

Once connected to AZ Marine's actual QuickBooks:
- **Chart of Accounts**: Pulled from QuickBooks and stored in your database
- **Invoices**: Can be pushed FROM MyYachtTime TO QuickBooks
- **Account Mappings**: Map your internal labor/accounting codes to QuickBooks accounts

### Security & Access

- The OAuth token is encrypted and stored securely
- Tokens automatically refresh (expire after 1 hour, refresh for up to 100 days)
- Only "master" role users can connect/manage QuickBooks integration
- After 100 days, you'll need to reconnect

## Troubleshooting

### "Session not found" Error
- The encrypted session wasn't stored properly
- Try: Disconnect → Clear browser cache → Reconnect

### "Can't connect" Error in QuickBooks
- Redirect URI mismatch
- Verify in QuickBooks Developer Dashboard that redirect URI is EXACTLY:
  `https://myyachttime.vercel.app/quickbooks-callback.html`

### Wrong Company Connected
- Disconnect in MyYachtTime
- When reconnecting, make sure you log in with the CORRECT QuickBooks account
- If you have multiple companies, select the right one during authorization

## Next Steps After Connection

1. **Sync Chart of Accounts** - Pull all accounts from QuickBooks
2. **Set Up Account Mappings** - Map your labor codes and accounting codes to QuickBooks accounts
3. **Configure Default Accounts** - Set defaults for revenue, expenses, taxes, etc.
4. **Test Invoice Push** - Create a test invoice and push it to QuickBooks
5. **Train Staff** - Show them how to create invoices that will sync to QuickBooks
