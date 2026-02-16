# QuickBooks Integration Troubleshooting

## Common Error: "AppConnection flow landed on Error screen"

This error means QuickBooks rejected the OAuth connection attempt. Here are the most common causes and solutions:

---

## ✅ Checklist Before Connecting

### 1. **Verify Redirect URI Matches EXACTLY**

In your QuickBooks Developer Dashboard, you MUST add this **exact** redirect URI:

```
https://myyachttime.vercel.app/quickbooks-callback.html
```

**Important Notes:**
- No trailing slash
- Must use HTTPS (not HTTP)
- Case-sensitive
- Must match character-for-character

**Where to add it:**
1. Go to [developer.intuit.com](https://developer.intuit.com/app/developer/dashboard)
2. Click on your app
3. Go to "Keys & credentials" tab
4. Under "Redirect URIs", click "Add URI"
5. Paste the URL exactly as shown above
6. Click "Save"

---

### 2. **Environment Settings**

You need to configure these in **QuickBooks Developer Dashboard** under "Keys & OAuth":

**Host domain (Required):**
```
myyachttime.com
```

**Launch URL (Required):**
```
https://myyachttime.vercel.app
```

**Disconnect URL (Required):**
```
https://myyachttime.vercel.app
```

---

### 3. **Add Secrets to Supabase Edge Functions**

1. Go to your Supabase Project Dashboard
2. Navigate to **Edge Functions** → **Manage Secrets**
3. Add these three secrets:

```
QUICKBOOKS_CLIENT_ID = (your Client ID from QuickBooks)
QUICKBOOKS_CLIENT_SECRET = (your Client Secret from QuickBooks)
QUICKBOOKS_REDIRECT_URI = https://myyachttime.vercel.app/quickbooks-callback.html
```

**Important:** The `QUICKBOOKS_REDIRECT_URI` must match EXACTLY what you added in QuickBooks Developer Dashboard.

---

### 4. **Sandbox vs Production**

QuickBooks has two environments:

- **Sandbox (Development):** For testing - uses test companies
- **Production:** For real companies

**Default Configuration:**
- The app is currently configured for **Production** mode
- OAuth URL: `https://appcenter.intuit.com/connect/oauth2`
- API URL: `https://quickbooks.api.intuit.com`

**If you need Sandbox mode:**
- Use Sandbox keys from QuickBooks Developer Dashboard
- Change OAuth URL to: `https://appcenter-sandbox.intuit.com/connect/oauth2`
- Change API URL to: `https://sandbox-quickbooks.api.intuit.com`

---

### 5. **App Status**

Make sure your QuickBooks app is in the correct state:

1. **Development:** App is in development, can only connect to your test companies
2. **Production:** App is published, can connect to any QuickBooks company

For development/testing, you can connect before publishing the app, but only to test companies in the sandbox.

---

## 🔍 Debugging Steps

### Step 1: Check Browser Console in Callback Window
When the error occurs, open the callback window and press F12, look for:
- Network tab: Check for 400/401 errors
- Console tab: Look for specific error messages

### Step 2: Verify Environment Variables
Run this from your Supabase project to verify the Edge Function secrets are set correctly.

### Step 3: Test with QuickBooks Sandbox First
1. Get **Sandbox** keys from QuickBooks Developer Dashboard
2. Create a test company in QuickBooks Sandbox
3. Try connecting - this helps identify if it's an environment issue

### Step 4: Check Scopes
The app requests this scope:
```
com.intuit.quickbooks.accounting
```

This is the standard scope for QuickBooks Online API. Make sure your app type supports this scope.

---

## 🚨 Most Common Issues

### Issue 1: Redirect URI Mismatch
**Symptom:** "AppConnection flow landed on Error screen" immediately after clicking "Connect"

**Solution:**
- Verify the redirect URI in QuickBooks Developer Dashboard matches EXACTLY
- Remember: `quickbooks-callback.html` (not `callback.html`)

### Issue 2: Missing Environment Variables
**Symptom:** Error message in callback window saying credentials not configured

**Solution:**
- Add all three secrets to Supabase Edge Functions
- Redeploy the `quickbooks-oauth` function after adding secrets

### Issue 3: Wrong Environment
**Symptom:** Connected successfully but can't see your company data

**Solution:**
- Make sure you're using Production keys for production companies
- Or Sandbox keys for test companies

### Issue 4: App Not Approved
**Symptom:** Can connect in development but not production

**Solution:**
- Complete the QuickBooks app review process
- Or use sandbox mode for testing

---

## 📝 Quick Reference

**Your Current Configuration:**
- Redirect URI: `https://myyachttime.vercel.app/quickbooks-callback.html`
- Host Domain: `myyachttime.com`
- Launch URL: `https://myyachttime.vercel.app`
- Environment: Production (default)
- Scopes: `com.intuit.quickbooks.accounting`

---

## 🆘 Still Having Issues?

1. Take a screenshot of the QuickBooks error screen
2. Check the browser console in both the main app and callback window
3. Verify all URLs match exactly (no typos, extra spaces, or differences)
4. Make sure you're using the correct Client ID and Client Secret for the environment you're connecting to
