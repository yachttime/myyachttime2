# Twilio A2P Registration - Opt-In URLs

## Problem Resolved
Twilio was unable to access the opt-in URLs because the catch-all rewrite rule was redirecting all requests to the React app. This has been fixed.

## URLs to Provide to Twilio

When Twilio asks for your "Opt-In URL" during A2P registration, provide these publicly accessible URLs:

### Primary Opt-In URL (Recommended)
```
https://your-domain.com/sms-consent-policy.html
```

This page contains:
- Full SMS consent policy documentation
- Proof of consent collection methods
- TCPA compliance information
- Message frequency disclosure
- Opt-out instructions
- Contact information

### Alternative Opt-In URL (UI Screenshot)
```
https://your-domain.com/sms-consent-form.html
```

This page shows:
- Visual mockup of the consent form interface
- Exact consent language presented to users
- Database field tracking documentation
- TCPA compliance checklist

## Testing the URLs

Before submitting to Twilio, verify the URLs are publicly accessible:

1. Open an incognito/private browser window
2. Navigate to each URL
3. Confirm the pages load without requiring login
4. Confirm the pages display the consent information

## What Twilio Will Verify

Twilio's verification team will check that your opt-in page includes:

✅ Clear purpose for SMS messages ("work shift reminders")
✅ Message frequency disclosure ("up to 2 per workday")
✅ Cost disclosure ("message and data rates may apply")
✅ Opt-out instructions ("Reply STOP to opt out")
✅ Voluntary consent statement ("not required as a condition of employment")

Both URLs include all required elements.

## Configuration Changes Made

The following files were updated to ensure these URLs are publicly accessible:

1. **vercel.json** - Excluded SMS consent pages from catch-all rewrite
2. **public/_redirects** - Added explicit rules for SMS consent pages
3. **public/_headers** - Added public caching and CORS headers

## Deployment Required

After deploying these changes, the URLs will be publicly accessible and Twilio should be able to verify them successfully.

## Support

If Twilio still reports the URLs as inaccessible:
1. Verify your deployment completed successfully
2. Test the URLs in an incognito browser
3. Check your hosting platform's logs for 404 errors
4. Ensure the files exist in the `public` folder of your deployment

---
**Last Updated:** February 16, 2026
