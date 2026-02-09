# Twilio Proof of Consent - Setup Instructions

This document explains how to submit your SMS consent documentation to Twilio for A2P registration.

## What We've Created

Two HTML pages that serve as proof of consent for Twilio:

1. **`public/sms-consent-policy.html`** - Complete consent policy documentation
2. **`public/sms-consent-form.html`** - Visual representation of the consent form UI

## How to Submit to Twilio

### Step 1: Deploy Your Application

These files are in your `public/` folder and will be automatically deployed with your application.

After deployment, they will be accessible at:
- `https://yourdomain.com/sms-consent-policy.html`
- `https://yourdomain.com/sms-consent-form.html`

### Step 2: Submit URLs to Twilio

When completing your Twilio A2P registration, in the "Proof of Consent" section:

1. Enter the URL: `https://yourdomain.com/sms-consent-policy.html`
2. Click "Add another URL" if available
3. Enter the URL: `https://yourdomain.com/sms-consent-form.html`

**Note:** Replace `yourdomain.com` with your actual domain name.

### Step 3: What Twilio Will See

Twilio reviewers will see:

✅ **Consent Policy Page:**
- Complete documentation of your consent collection process
- All TCPA compliance requirements
- Message frequency, opt-out instructions, and disclaimers
- Database tracking information

✅ **Consent Form Page:**
- Visual proof of the actual consent form interface
- Checkbox consent mechanism (unchecked by default)
- Exact consent language shown to users
- All required disclosures in one place

## Alternative: Use Local Preview

If you need to submit these BEFORE deployment:

1. Open either HTML file in your browser
2. Take a full-page screenshot
3. Upload the screenshot to a public location (Imgur, Google Drive with public link, etc.)
4. Submit that image URL to Twilio

## Testing Locally

To preview these pages:

```bash
npm run dev
```

Then visit:
- http://localhost:5173/sms-consent-policy.html
- http://localhost:5173/sms-consent-form.html

## What Makes This TCPA Compliant

Your consent implementation includes:

- ✅ **Express Written Consent** - Checkbox must be actively checked
- ✅ **Clear Purpose** - Work shift reminders for employees
- ✅ **Frequency Disclosure** - Up to 2 messages per workday
- ✅ **Cost Notice** - Message and data rates may apply
- ✅ **Opt-Out Instructions** - Reply STOP to opt out
- ✅ **Voluntary Statement** - Not required as condition of employment
- ✅ **Not Pre-Checked** - Checkbox defaults to unchecked
- ✅ **Persistent Storage** - Consent tracked in database with timestamps

## Database Consent Tracking

Your system tracks these fields in `user_profiles` table:

```sql
sms_consent_given          -- Boolean flag
sms_consent_date           -- Timestamp of consent
sms_consent_method         -- 'web_form'
sms_consent_ip_address     -- Optional IP tracking
notification_phone         -- Phone number for SMS
sms_notifications_enabled  -- SMS enabled flag
```

## Need Help?

If Twilio requests additional documentation:

1. They may want to see the actual application interface (provide login credentials temporarily)
2. You can provide screenshots from your running application
3. Reference your `TWILIO_SMS_CONSENT_COMPLIANCE.md` for technical implementation details

## Twilio Review Timeline

- Initial review: 1-3 business days
- If they request clarification: Respond within 24-48 hours
- Total approval time: Typically 3-7 business days

## Contact

If you have issues with Twilio's review process, you can:
1. Respond directly to their review feedback in the Twilio console
2. Contact Twilio support with your A2P application ID
3. Reference this documentation and provide additional screenshots if needed
