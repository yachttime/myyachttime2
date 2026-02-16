# QuickBooks Integration - Setup Required

## Current Status

The QuickBooks Online integration is now fully implemented and ready to use. However, you need to configure the QuickBooks OAuth credentials before you can connect.

## What You Need to Do

### Step 1: Create a QuickBooks Online App

1. Go to https://developer.intuit.com/
2. Sign in with your Intuit account
3. Click **"My apps"** in the top navigation
4. Click **"Create an app"** (or "+ Create an app")
5. Select **"QuickBooks Online and Payments"**
6. Fill in the app details:
   - **App name**: Yacht Time (or your preferred name)
   - **Description**: Yacht management system integration
7. Click **"Create app"**

### Step 2: Configure Your App

1. Once your app is created, go to the **"Keys & credentials"** section
2. Note down these two values:
   - **Client ID** (starts with AB... or similar)
   - **Client Secret** (keep this secure!)

3. In the **"Redirect URIs"** section, add:
   ```
   https://your-actual-domain.com/quickbooks-callback.html
   ```
   Replace `your-actual-domain.com` with your actual Yacht Time domain.

4. Set the correct **Scopes**:
   - com.intuit.quickbooks.accounting (should be selected by default)

5. Save your changes

### Step 3: Configure Environment Variables in Supabase

You need to set three environment variables in your Supabase project:

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions**
3. Add these three secrets:

   **Variable Name:** `QUICKBOOKS_CLIENT_ID`
   **Value:** Your Client ID from Step 2

   **Variable Name:** `QUICKBOOKS_CLIENT_SECRET`
   **Value:** Your Client Secret from Step 2

   **Variable Name:** `QUICKBOOKS_REDIRECT_URI`
   **Value:** `https://your-actual-domain.com/quickbooks-callback.html`

### Step 4: Test the Connection

1. Log in to Yacht Time as a Master user
2. Navigate to **QuickBooks Integration**
3. Click **"Connect to QuickBooks"**
4. You should see the QuickBooks OAuth popup
5. Sign in and authorize the connection
6. Click **"Sync Accounts"** to download your Chart of Accounts

## What the Integration Does

Once configured, the QuickBooks integration allows you to:

✅ **Connect to QuickBooks Online** via secure OAuth 2.0
✅ **Download Chart of Accounts** from QuickBooks
✅ **Map accounting codes** to QuickBooks accounts
✅ **Map labor codes** to QuickBooks income accounts
✅ **Push completed invoices** to QuickBooks automatically
✅ **Create customers** in QuickBooks if they don't exist
✅ **Record payments** against invoices in QuickBooks

## Security Notes

- OAuth tokens are stored encrypted in the database
- Only Master users can connect/disconnect QuickBooks
- Tokens are automatically refreshed when they expire
- Each company can have its own QuickBooks connection
- All communication uses HTTPS

## Troubleshooting

**Error: "QuickBooks credentials not configured"**
- You haven't set the environment variables in Supabase yet. Complete Step 3 above.

**Error: "Redirect URI mismatch"**
- The redirect URI in your QuickBooks app settings doesn't match the one in your environment variables.
- Make sure both use your actual domain (not localhost).

**Error: "Invalid client credentials"**
- Double-check that you copied the Client ID and Client Secret correctly.
- Make sure there are no extra spaces or characters.

## Production vs Development

For production use:
- Use your production domain in the redirect URI
- Keep your Client Secret secure (don't commit it to git)
- Use QuickBooks Production credentials (not Sandbox)

For development/testing:
- You can use QuickBooks Sandbox credentials
- Use your development domain in the redirect URI
- Test thoroughly before pushing to production

## Need Help?

Refer to the full setup guide in `QUICKBOOKS_INTEGRATION_SETUP.md` for detailed information about using the integration once it's configured.
