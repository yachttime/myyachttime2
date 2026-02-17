# QuickBooks Authorization Fix - Instructions

## Problem
The QuickBooks connection is completing too fast without asking for login, then showing "authorization expired" when you try to sync.

## Root Cause
An old encrypted session token from a previous connection attempt is still stored in your browser's localStorage. This expired token is being reused instead of creating a new connection.

## Solution
You need to **disconnect and reconnect** to clear the old expired tokens.

## Steps to Fix

### On https://myyachttime.vercel.app:

1. **Sign in as master**

2. **Navigate to QuickBooks Account Mapping** (in Company Management section)

3. **Click "Disconnect from QuickBooks"**
   - This will clear the old expired session
   - This will deactivate the old connection in the database

4. **Click "Connect to QuickBooks"** again
   - This should now prompt you to:
     - Choose your QuickBooks company
     - Authorize the connection
     - Select which company to connect

5. **After successfully connecting, click "Sync Accounts"**
   - This should now work without the authorization error

## What Was Fixed

1. Added proper loading states for sync operation
2. Added finally blocks to ensure loading states are cleared
3. Improved error messages to guide you to reconnect
4. The disconnect function properly clears:
   - The encrypted session from state
   - The encrypted session from localStorage
   - The connection record in the database

## If You Still Have Issues

1. **Clear your browser cache completely**
   - Press Ctrl+Shift+Delete (Windows/Linux) or Cmd+Shift+Delete (Mac)
   - Clear "Cached images and files" and "Cookies and other site data"
   - Or just use Incognito/Private browsing mode

2. **Try in a different browser**
   - Sometimes browser extensions can interfere with OAuth flows

3. **Check the browser console (F12)**
   - Look for any error messages
   - Check if the encrypted session is being stored/loaded properly
   - Look for "[QuickBooks]" prefixed log messages

## Expected Behavior

When you click "Connect to QuickBooks", you should see:
1. A popup window opens
2. QuickBooks asks you to sign in (if not already)
3. QuickBooks asks which company to connect
4. After selecting, the popup closes automatically
5. You see "Connected to QuickBooks successfully"
6. You can then click "Sync Accounts" to load your Chart of Accounts

The key is that **you should be prompted to select a company** - if it auto-closes without that prompt, the old expired session is still interfering.
