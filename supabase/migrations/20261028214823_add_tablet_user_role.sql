/*
# Add 'tablet' user role

1. Modified Types
- `user_role` enum gains a new value `tablet`.

2. Purpose
- The shared boat login used by the helm tablets runs with this role.
- Existing company-scoped read policies still apply to it. Staff-only write policies (which check for staff, manager, or master roles) do not match it.
*/

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'tablet';
