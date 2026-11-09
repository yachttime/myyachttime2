# Project memory

## Product intent & audience

- Business application for managing work orders, estimates, invoices, and payment links
- Internal/staff users managing work order lifecycle from estimate → work order → invoice → payment

## Brand personality & voice

- Practical, operational tone; direct status updates about data corrections and fixes

## Visual design & UX direction

- Built with Vite + React frontend
- Includes a work order editor view with surcharge calculation on save
- Numeric displays use USD currency formatting (e.g. $116,272.33)

## Decisions, constraints & rationale

- Surcharge setting: 15% of subtotal with a configurable cap (current cap: $7,500)
- Surcharge cap is applied at work order creation; editor recalculation must also respect the cap
- Data corrections to existing records are guarded to only change uncapped/incorrect values
- Work order total = subtotal + capped surcharge
- Build verification is run after code changes to confirm compilation

## Open questions & assumptions

- Surcharge percentage (15%) and cap ($7,500) may be user-configurable in settings; current values are inferred from this specific fix
- Payment links are generated from invoices, not directly from work orders
- No invoice existed for WO000287, so no payment link was actually sent — correction was safe