# Twilio SMS Consent Compliance Documentation

## Overview
This document provides proof of SMS opt-in consent collection for Twilio compliance and TCPA (Telephone Consumer Protection Act) requirements.

## SMS Use Case
**Purpose:** Time Clock Reminders for Employees
**Message Type:** Transactional/Operational
**Frequency:** Up to 2 messages per scheduled workday (punch-in and punch-out reminders)

## Sample Messages

### Punch-In Reminder
```
Time Clock Reminder: You were scheduled to start work at 8:00 AM today. Please remember to punch in using the Time Clock in the app.
```

### Punch-Out Reminder
```
Time Clock Reminder: Your shift was scheduled to end at 5:00 PM today. Please remember to punch out using the Time Clock in the app.
```

## Consent Collection Methods

Our system supports multiple methods for collecting explicit SMS opt-in consent:

### 1. Web Form Opt-In (Primary Method)
- **Location:** User Profile Settings page in the application
- **Process:**
  1. User navigates to their profile settings
  2. User enters their phone number
  3. User checks a checkbox with clear language: "I consent to receive SMS text message reminders for my scheduled work shifts. Message frequency varies (up to 2 per workday). Message and data rates may apply. Reply STOP to opt out."
  4. User clicks "Save" to submit consent
  5. System records: timestamp, IP address, method (web_form)
- **Audit Trail:** All consent stored in `user_profiles` table with fields:
  - `sms_consent_given` = true
  - `sms_consent_date` = timestamp of consent
  - `sms_consent_method` = 'web_form'
  - `sms_consent_ip_address` = IP address
  - `notification_phone` = phone number

### 2. Employee Onboarding Form
- **Location:** During new employee onboarding process
- **Process:**
  1. During onboarding, employee fills out consent form
  2. Form includes checkbox: "I consent to receive work schedule reminders via SMS"
  3. Form includes phone number field
  4. Form is signed and dated by employee
  5. HR/Admin enters consent into system
  6. System records: date, method (employee_onboarding)
- **Audit Trail:** Physical form stored in employee file, digital record in database

### 3. Written Consent Form
- **Location:** Standalone consent form (paper or digital)
- **Process:**
  1. Employee fills out SMS Consent Form
  2. Form clearly states purpose, frequency, and opt-out instructions
  3. Employee signs and dates form
  4. Admin enters consent into system
  5. System records: date, method (written_form)
- **Audit Trail:** Signed form stored in employee records

### 4. Verbal Consent (Documented)
- **Location:** Phone call or in-person conversation
- **Process:**
  1. Admin explains SMS reminder program to employee
  2. Employee verbally agrees
  3. Admin documents: date, time, employee name, consent given
  4. Admin enters consent into system within 24 hours
  5. System records: date, method (verbal)
- **Audit Trail:** Written documentation of verbal consent stored

## Consent Language (Required Elements)

All consent collection methods include:
1. **Clear Purpose:** "Receive time clock reminders for your scheduled work shifts"
2. **Frequency:** "Up to 2 messages per scheduled workday"
3. **Opt-Out Instructions:** "Reply STOP to opt out at any time"
4. **Standard Disclaimer:** "Message and data rates may apply"
5. **Company Name:** Identified as sender
6. **Voluntary Nature:** "Consent is not required as a condition of employment"

## Technical Implementation

### Database Schema
```sql
-- SMS Consent fields in user_profiles table
sms_consent_given boolean DEFAULT false
sms_consent_date timestamptz
sms_consent_method text CHECK (sms_consent_method IN ('web_form', 'written_form', 'verbal', 'employee_onboarding'))
sms_consent_ip_address text
sms_consent_withdrawn_date timestamptz
notification_phone text
```

### Message Sending Logic
```typescript
// Only send SMS if consent is given
if (user.sms_consent_given &&
    user.notification_phone &&
    !user.sms_consent_withdrawn_date) {
  // Send SMS reminder
}
```

## Opt-Out Handling

### Automatic Opt-Out (STOP Keywords)
- Twilio automatically handles: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT
- When received, Twilio prevents further messages
- System webhook updates: `sms_consent_withdrawn_date` = current timestamp

### Manual Opt-Out
- Users can opt out via web application settings
- System sets: `sms_consent_withdrawn_date` = current timestamp
- No further messages sent to that user

### Re-Opt-In
- Users can re-opt-in through any consent collection method
- System clears: `sms_consent_withdrawn_date` = null
- System updates: `sms_consent_given` = true, `sms_consent_date` = new timestamp

## Compliance Checklist

- ✅ **Prior Express Consent:** Users must opt-in before receiving messages
- ✅ **Clear Disclosure:** Purpose, frequency, and charges disclosed
- ✅ **Opt-Out Method:** Reply STOP to opt out
- ✅ **Audit Trail:** Timestamp, method, and IP address recorded
- ✅ **Respect Opt-Outs:** System prevents messages after opt-out
- ✅ **Employee Communications:** Exemption for employer-employee communications (time clock is operational)
- ✅ **Data Retention:** Consent records retained for duration of relationship + 4 years

## Record Retention

- **Active Employees:** Consent records maintained indefinitely while employed
- **Former Employees:** Consent records retained for 4 years after separation
- **Audit Access:** Master role can access consent audit trail via user profiles

## Contact Information

**Company Name:** [Your Company Name]
**Support Contact:** [Support Email/Phone]
**Privacy Policy:** [URL to Privacy Policy]
**Opt-Out Support:** "Reply STOP or contact [support email]"

## Verification Statement

This system implements SMS opt-in consent collection in compliance with:
- Telephone Consumer Protection Act (TCPA)
- Cellular Telecommunications Industry Association (CTIA) guidelines
- Twilio's Messaging Policy
- Mobile Marketing Association (MMA) Consumer Best Practices

All SMS messages are sent only to users who have provided explicit prior consent through documented opt-in methods.

---

**Last Updated:** 2026-02-09
**Document Version:** 1.0
