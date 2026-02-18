# Estimating Payment System Implementation

## Overview
A comprehensive deposit and payment system has been implemented for the estimating workflow, matching the repair request system functionality. This system handles deposits, invoice payments, QuickBooks integration, and complete email tracking.

## Database Changes

### 1. Estimates Table - New Deposit Fields
- `deposit_required` (boolean) - Whether deposit is required to start work
- `deposit_percentage` (numeric) - Percentage of total for deposit calculation
- `deposit_amount` (numeric) - Fixed deposit amount (alternative to percentage)

### 2. Work Orders Table - Deposit Tracking
Complete deposit payment tracking with all fields needed for Stripe integration:
- `deposit_required`, `deposit_amount`
- `deposit_requested_at`, `deposit_requested_by`
- `deposit_payment_status` ('pending', 'paid', 'failed', 'not_required')
- Stripe fields: `deposit_stripe_checkout_session_id`, `deposit_payment_link_url`, `deposit_stripe_payment_intent_id`
- Email tracking: `deposit_email_sent_at`, `deposit_email_opened_at`, `deposit_email_clicked_at`, `deposit_email_delivered_at`, `deposit_email_bounced_at`
- Payment details: `deposit_paid_at`, `deposit_payment_method_type`, `deposit_link_expires_at`
- Confirmation: `deposit_confirmation_email_sent_at`
- QuickBooks: `deposit_quickbooks_payment_id`, `deposit_quickbooks_synced_at`

### 3. Estimating Invoices Table - Payment Tracking
- `deposit_applied` (numeric) - Deposit amount applied from work order
- `balance_due` (numeric) - Auto-calculated: total - deposit - amount_paid
- `amount_paid` (numeric) - Running total of payments
- Final payment tracking (same fields as deposit but prefixed with `final_payment_*`)
- QuickBooks: `quickbooks_invoice_id`, `quickbooks_invoice_synced_at`

### 4. New Table: estimating_payments
Comprehensive payment tracking table that records all transactions:
- Payment types: 'deposit', 'invoice_payment', 'final_payment'
- Links to: work_order_id, invoice_id, estimate_id, yacht_id
- Customer information (supports both yacht and retail customers)
- Payment details: amount, date, method, method_type
- Stripe integration: checkout_session_id, payment_intent_id, charge_id
- QuickBooks integration: payment_id, synced_at, sync_error
- Accounting: accounting_code_id reference
- Audit: notes, reference_number, recorded_by

## Updated Functions

### 1. approve_estimate()
**Enhanced to transfer deposit settings from estimate to work order:**
- Calculates deposit amount from percentage or uses fixed amount
- Sets `deposit_required` and `deposit_amount` on work order
- Initializes `deposit_payment_status` to 'pending' if required, else 'not_required'

### 2. convert_work_order_to_invoice()
**Enhanced to transfer deposit and create payment record:**
- Applies deposit if paid (`deposit_payment_status` = 'paid')
- Sets `deposit_applied` on invoice
- Calculates `balance_due` automatically
- Creates payment record in `estimating_payments` table for the deposit
- Transfers all Stripe and payment tracking information

### 3. calculate_invoice_balance()
**New trigger function:**
- Auto-calculates `balance_due` on insert/update
- Formula: `total_amount - deposit_applied - amount_paid`

## Edge Functions

### 1. create-work-order-deposit-payment
Creates Stripe checkout session for work order deposits:
- Validates work order and user access
- Supports both card and ACH payment methods
- Creates 30-day expiring payment link
- Updates work order with payment link and tracking fields
- Returns checkout URL for customer

### 2. create-estimating-invoice-payment
Creates Stripe checkout session for invoice final payments:
- Calculates balance due (total - deposit - paid)
- Validates invoice not already paid
- Supports both card and ACH payment methods
- Creates 30-day expiring payment link
- Returns checkout URL for customer

### 3. stripe-webhook (Updated)
Enhanced to handle new payment types:

**Work Order Deposits:**
- Detects `payment_type: 'work_order_deposit'`
- Updates work order status to 'paid'
- Records payment method and Stripe IDs
- Creates admin notification
- Sends confirmation email to customer
- Posts message to owner chat if yacht-based

**Estimating Invoice Payments:**
- Detects `payment_type: 'estimating_invoice_payment'`
- Updates invoice: `amount_paid`, `balance_due`, `payment_status`
- Handles partial payments (status: 'partial')
- Creates admin notification with payment status
- Sends confirmation email showing balance remaining
- Posts message to owner chat if yacht-based

**Duplicate Payment Protection:**
- Checks if payment already processed
- Creates admin notification for duplicates
- Prevents double-charging customers

## Payment Workflow

### Estimate → Work Order → Invoice Flow

1. **Create Estimate**
   - Optionally set `deposit_required = true`
   - Set either `deposit_percentage` or `deposit_amount`

2. **Approve Estimate** (Creates Work Order)
   - Deposit settings transferred to work order
   - If deposit required, status set to 'pending'
   - Deposit amount calculated and stored

3. **Request Deposit** (In Work Orders UI)
   - Staff calls `create-work-order-deposit-payment` function
   - Stripe checkout session created
   - Payment link sent to customer
   - Email tracking begins

4. **Customer Pays Deposit**
   - Customer completes Stripe checkout
   - Webhook updates work order status to 'paid'
   - Confirmation email sent
   - Admin notification created
   - Work can begin

5. **Complete Work Order** (Creates Invoice)
   - Deposit automatically applied to invoice
   - `balance_due` calculated
   - Payment record created in `estimating_payments`
   - All deposit tracking data transferred

6. **Request Final Payment** (In Invoices UI)
   - Staff calls `create-estimating-invoice-payment` function
   - Amount = balance_due (total - deposit - prior payments)
   - Payment link sent to customer

7. **Customer Pays Invoice**
   - Webhook updates invoice payment fields
   - `amount_paid` incremented
   - `balance_due` recalculated
   - Status updated: 'partial' or 'paid'
   - Confirmation email sent with balance info

## QuickBooks Integration (Ready for Implementation)

The system is designed for QuickBooks sync with these fields:

**Customers:**
- Customer info stored with each payment
- Ready to sync to QuickBooks customer records

**Deposits:**
- `deposit_quickbooks_payment_id` - QuickBooks payment record ID
- `deposit_quickbooks_synced_at` - Sync timestamp
- Can be synced as "Payment" applied to customer account

**Invoices:**
- `quickbooks_invoice_id` - QuickBooks invoice ID
- `quickbooks_invoice_synced_at` - Sync timestamp
- Invoice line items already structured for sync
- `estimating_payments` table tracks all payments with accounting codes

**Payments Table:**
- `quickbooks_payment_id` - QuickBooks payment ID
- `quickbooks_synced_at` - Sync timestamp
- `quickbooks_sync_error` - Error tracking
- `accounting_code_id` - Links to accounting code for proper categorization

## Email Tracking

All payment emails include full tracking:
- Sent timestamp
- Resend email ID
- Delivered/bounced tracking (via Resend webhooks)
- Opened timestamp (via Resend webhooks)
- Clicked timestamp (via Resend webhooks)
- Confirmation email sent timestamp

## Security

- All payment tables use RLS (Row Level Security)
- Master role has full access within their company
- Payment links expire after 30 days
- Duplicate payment detection and alerts
- Stripe webhook signature verification
- reCAPTCHA verification on payment creation

## Next Steps for UI Implementation

### Estimates Component
Add deposit configuration section:
```tsx
// In estimate form
<div className="deposit-section">
  <label>
    <input type="checkbox" checked={depositRequired} />
    Require Deposit to Start Work
  </label>

  {depositRequired && (
    <>
      <label>
        Deposit Type:
        <select>
          <option value="percentage">Percentage</option>
          <option value="fixed">Fixed Amount</option>
        </select>
      </label>

      {depositType === 'percentage' ? (
        <input type="number" placeholder="Percentage (e.g., 50)" />
      ) : (
        <input type="number" placeholder="Fixed Amount" />
      )}
    </>
  )}
</div>
```

### WorkOrders Component
Add deposit payment section:
```tsx
// Show deposit status and request button
{workOrder.deposit_required && (
  <div className="deposit-card">
    <div>Deposit Amount: ${workOrder.deposit_amount}</div>
    <div>Status: {workOrder.deposit_payment_status}</div>

    {workOrder.deposit_payment_status === 'pending' && (
      <button onClick={handleRequestDeposit}>
        Send Payment Link
      </button>
    )}

    {workOrder.deposit_payment_link_url && (
      <div>
        <a href={workOrder.deposit_payment_link_url}>
          Payment Link
        </a>
        <span>Expires: {workOrder.deposit_link_expires_at}</span>
      </div>
    )}
  </div>
)}
```

### Invoices Component
Add payment section:
```tsx
// Show payment status and request button
<div className="payment-card">
  <div>Total: ${invoice.total_amount}</div>
  {invoice.deposit_applied > 0 && (
    <div>Deposit Applied: ${invoice.deposit_applied}</div>
  )}
  {invoice.amount_paid > 0 && (
    <div>Amount Paid: ${invoice.amount_paid}</div>
  )}
  <div className="balance">
    Balance Due: ${invoice.balance_due}
  </div>

  {invoice.balance_due > 0 && (
    <button onClick={handleRequestPayment}>
      Send Payment Link
    </button>
  )}

  {invoice.payment_status === 'paid' && (
    <div className="paid-badge">✓ PAID IN FULL</div>
  )}
</div>
```

## Function Calls for UI

```typescript
// Request work order deposit
const response = await fetch(`${supabaseUrl}/functions/v1/create-work-order-deposit-payment`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    workOrderId: workOrder.id,
  }),
});
const { checkoutUrl } = await response.json();
// Display or email checkoutUrl to customer

// Request invoice payment
const response = await fetch(`${supabaseUrl}/functions/v1/create-estimating-invoice-payment`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    invoiceId: invoice.id,
  }),
});
const { checkoutUrl, balanceDue } = await response.json();
// Display or email checkoutUrl to customer
```

## Summary

The backend infrastructure for the complete payment system is now in place:

✅ Database schema with deposit and payment tracking
✅ Estimate → Work Order deposit transfer
✅ Work Order → Invoice deposit application
✅ Stripe payment session creation for deposits
✅ Stripe payment session creation for invoices
✅ Stripe webhook handling for both payment types
✅ Email notifications and tracking
✅ Duplicate payment protection
✅ QuickBooks integration fields
✅ Payment history tracking
✅ Automatic balance calculations

The system is ready for UI implementation to enable staff to request deposits, send payment links, and track payment status throughout the estimating workflow.
