# Security Access Matrix

This document provides a comprehensive overview of role-based access control (RBAC) in the Yacht Management System.

## Table of Contents

1. [Role Definitions](#role-definitions)
2. [Helper Functions](#helper-functions)
3. [Owner Role](#owner-role)
4. [Manager Role](#manager-role)
5. [Staff Role](#staff-role)
6. [Mechanic Role](#mechanic-role)
7. [Storage Bucket Permissions](#storage-bucket-permissions)
8. [Special Conditions](#special-conditions)
9. [Quick Reference Tables](#quick-reference-tables)

---

## Role Definitions

The system has **4 valid roles** defined in the `user_role` enum:

| Role | Description | Access Level |
|------|-------------|--------------|
| **Owner** | Yacht owners | Limited - Own yacht only |
| **Manager** | Yacht managers | High - All staff access + yacht focus |
| **Staff** | Staff members | Full - Complete system access |
| **Mechanic** | Mechanics | Full - Complete system access |

### Important Notes

- **Manager, Staff, and Mechanic** roles all have full administrative access
- The `is_staff()` function returns `TRUE` for: `staff`, `manager`, and `mechanic` roles (when `is_active = true`)
- **Owner** is the only role with restricted access

---

## Helper Functions

These PostgreSQL functions are used throughout the RLS policies:

### `is_staff()`
Returns `true` if the current user has role in `('staff', 'manager', 'mechanic')` AND `is_active = true`

### `user_has_yacht_access(yacht_id UUID)`
Returns `true` if:
- User is staff/manager/mechanic, OR
- User owns the specified yacht

### `user_owns_yacht(user_id UUID, yacht_id UUID)`
Returns `true` if:
- User has role = `'owner'` AND
- User's `yacht_id` matches the specified yacht

---

## Owner Role

Owners have the most restricted access, limited to their own yacht and related data.

### SELECT (Read) Permissions

| Table | Access Scope | Notes |
|-------|--------------|-------|
| `user_profiles` | Own profile only | Via `auth.uid() = user_id` |
| `yachts` | Own yacht only | Via `user_profiles.yacht_id` |
| `yacht_bookings` | Own yacht's bookings | Via `user_has_yacht_access()` |
| `yacht_documents` | Own yacht's documents | Via `user_has_yacht_access()` |
| `yacht_smart_devices` | Own yacht's devices | Via `user_has_yacht_access()` |
| `trip_inspections` | Own yacht's inspections | Via `user_has_yacht_access()` |
| `owner_handoff_inspections` | Own yacht's inspections | Via `user_has_yacht_access()` |
| `repair_requests` | Own yacht's OR submitted by self | Via `user_has_yacht_access()` OR `submitted_by = auth.uid()` |
| `owner_chat_messages` | Own yacht's messages | Via `user_has_yacht_access()` |
| `yacht_history_logs` | Own yacht's history | Via `user_has_yacht_access()` |
| `smart_lock_access_logs` | Own yacht's logs | Via yacht relationship |
| `smart_lock_command_logs` | Own yacht's logs | Via yacht relationship |
| `vessel_management_agreements` | Own yacht's agreements | Via `user_owns_yacht()` |
| `maintenance_requests` | Own requests OR own yacht's | Via `user_id = auth.uid()` OR `user_has_yacht_access()` |
| `education_videos` | All videos | Public access for learning |

### ❌ NO READ ACCESS
- `yacht_budgets` (managers/staff only)
- `yacht_invoices` (managers/staff only)
- `admin_notifications` (staff only)
- `appointments` (staff only)
- `staff_messages` (staff only)
- `video_uploads` (staff only)
- `tuya_device_credentials` (staff only)
- `invoice_engagement_events` (staff only)

### INSERT (Create) Permissions

| Table | Conditions |
|-------|------------|
| `user_profiles` | Own profile only |
| `repair_requests` | `submitted_by = auth.uid()` |
| `owner_chat_messages` | Own yacht only |
| `smart_lock_access_logs` | Own access logs |
| `vessel_management_agreements` | Own yacht only |
| `maintenance_requests` | `user_id = auth.uid()` |

### UPDATE (Modify) Permissions

| Table | Conditions |
|-------|------------|
| `user_profiles` | Own profile only |
| `repair_requests` | Own pending requests only (`status = 'pending'` AND `submitted_by = auth.uid()`) |
| `vessel_management_agreements` | Own draft or rejected agreements (`status IN ('draft', 'rejected')`) |
| `maintenance_requests` | Own requests OR own yacht's requests |

### DELETE (Remove) Permissions

| Table | Conditions |
|-------|------------|
| `vessel_management_agreements` | Own draft agreements only (`status = 'draft'`) |

### Owner UI Access Summary

**Admin Tab - Limited Access:**
- ✅ Master Calendar (view their yacht's bookings only)
- ✅ Owner Chat (communicate with all owners on their yacht)
- ❌ New Messages (staff only)
- ❌ Create Appointment (staff only)
- ❌ Trip Inspection Form (staff only)
- ❌ Meet the Yacht Owner (staff only)
- ❌ Repair Requests (staff only)
- ❌ Owner Trips (staff only)
- ❌ Yachts (staff only)
- ❌ Smart Devices (staff only)
- ❌ User Management (staff only)

**Education Tab:**
- ✅ All categories EXCEPT SignIn and Welcome (staff only)

**Owner Trip Tab:**
- ✅ View only their own bookings
- ✅ View only recent bookings (not all historical bookings)

**Owner Chat:**
- ✅ Chat with ALL yacht owners assigned to their yacht
- ✅ Messages visible to all owners on the yacht

✅ **Can Do:**
- View and manage their own yacht information
- Create and track repair/maintenance requests
- Communicate via owner chat with all yacht owners
- View trip inspections and handoff reports
- Create and manage vessel agreements (draft stage)
- View education videos (except SignIn/Welcome)
- Access smart lock logs for their yacht

❌ **Cannot Do:**
- View or manage budgets
- View or manage invoices
- Access admin notifications or staff messages
- Create or manage appointments
- Manage other yachts or users
- Access payment or billing information
- Update requests after they're in progress

---

## Manager Role

Managers receive **all Staff privileges** via the `is_staff()` function, but with UI restrictions focused on their assigned yacht.

### Access Level
**FULL ADMINISTRATIVE ACCESS** (same as Staff + Mechanic at database level)

### UI Access Restrictions

While managers have full database access via `is_staff()`, the UI restricts them to their assigned yacht:

**Admin Tab - Yacht-Scoped Access:**
- ✅ Master Calendar (all yachts)
- ✅ New Messages (all yachts)
- ✅ Repair Requests (all yachts in database, filtered to their yacht in UI)
- ✅ Owner Trips (all yachts in database, filtered to their yacht in UI)
- ✅ Owner Chat (all yachts)
- ✅ Yachts (filtered to show only their assigned yacht)
- ✅ User Management (can create owner accounts for their yacht)
- ❌ Create Appointment (staff only)
- ❌ Trip Inspection Form (staff only)
- ❌ Meet the Yacht Owner (staff only)
- ❌ Smart Devices (staff only)

**Education Tab:**
- ✅ All categories EXCEPT SignIn and Welcome (staff only)

**Owner Trip Tab:**
- ✅ View ALL bookings on their assigned yacht (not just their own)
- ✅ Recent bookings show all bookings for their yacht

### Database-Level Permissions

Managers can (via `is_staff()`):
- View and manage all yacht data (UI filters to their yacht)
- Complete CRUD access to all system tables
- Handle all repair requests and invoices
- Access all notifications and messages
- Create and manage user accounts (UI restricts to owners only)

### Manager-Specific Policies

These policies provide additional clarity for yacht-scoped operations:

| Table | Additional Access |
|-------|-------------------|
| `yacht_budgets` | Explicit insert/update for assigned yacht |
| `yacht_invoices` | Explicit view for assigned yacht |
| `trip_inspections` | Explicit create/update/view access |
| `repair_requests` | Explicit yacht-scoped access |

**Note:** These additional policies are largely redundant since `is_staff()` already grants full access. They exist for historical/clarity reasons.

---

## Staff Role

Staff members have **complete administrative access** to all system resources.

### SELECT (Read) Permissions
✓ **FULL ACCESS** to all tables including:
- All user profiles
- All yachts and bookings
- All financial data (budgets, invoices)
- All repair and maintenance requests
- All documents and smart devices
- All notifications and messages
- All history logs and audit trails
- All education content
- All system credentials

### INSERT (Create) Permissions
✓ Can create records in:
- `yachts` - New yacht entries
- `yacht_bookings` - Bookings for any yacht
- `yacht_budgets` - Budget records
- `yacht_invoices` - Invoice records
- `yacht_documents` - Documents for any yacht
- `yacht_smart_devices` - Smart devices
- `trip_inspections` - Inspection reports
- `owner_handoff_inspections` - Handoff reports
- `owner_chat_messages` - Messages for any yacht
- `admin_notifications` - System notifications
- `appointments` - Appointments
- `staff_messages` - Internal staff messages
- `smart_lock_command_logs` - Lock commands
- `vessel_management_agreements` - Agreements
- `education_videos` - Education content
- `video_uploads` - Video uploads
- `tuya_device_credentials` - Device credentials
- `invoice_engagement_events` - Email tracking
- `yacht_history_logs` - Audit logs

### UPDATE (Modify) Permissions
✓ Can update ALL records in:
- All user profiles (including role changes)
- All yachts and bookings
- All financial records
- All repair and maintenance requests
- All documents and agreements
- All smart devices and credentials
- All notifications and messages
- All education content
- All system tables

### DELETE (Remove) Permissions
✓ Can delete records from:
- `yachts` - Remove yachts
- `yacht_bookings` - Cancel bookings
- `yacht_budgets` - Remove budgets
- `yacht_invoices` - Delete invoices
- `yacht_documents` - Remove documents
- `yacht_smart_devices` - Remove devices
- `trip_inspections` - Delete inspections
- `owner_handoff_inspections` - Remove handoffs
- `repair_requests` - Delete requests
- `admin_notifications` - Clear notifications
- `appointments` - Cancel appointments
- `staff_messages` - Delete messages
- `maintenance_requests` - Remove requests
- `education_videos` - Delete videos
- `tuya_device_credentials` - Remove credentials

### Staff Capabilities Summary

✅ **Complete System Control:**
- Manage all yachts and users
- Handle all financial operations
- Oversee all maintenance and repairs
- Control smart lock systems
- Manage education content
- Access all audit trails and logs
- Configure system settings

---

## Mechanic Role

Mechanics have **full database access** via `is_staff()`, but with UI restrictions to focus on maintenance operations.

### Access Level
**FULL ADMINISTRATIVE ACCESS** (same as Staff and Manager at database level)

### UI Access Restrictions

While mechanics have full database access via `is_staff()`, the UI restricts certain administrative functions:

**Admin Tab - Maintenance-Focused Access:**
- ✅ Master Calendar (all yachts)
- ✅ New Messages (all yachts)
- ✅ Create Appointment (if staff)
- ✅ Trip Inspection Form (if staff/mechanic)
- ✅ Meet the Yacht Owner (if staff/mechanic)
- ✅ Repair Requests (all yachts)
- ✅ Yachts (all yachts)
- ✅ Smart Devices (all yachts)
- ❌ Owner Trips (staff only - hidden from mechanics)
- ❌ Owner Chat (staff only - hidden from mechanics)
- ❌ User Management (staff/manager only - hidden from mechanics)

**Education Tab:**
- ✅ All categories EXCEPT SignIn and Welcome (staff only)

**Owner Trip Tab:**
- ✅ Full access to all bookings (if accessing the tab)

### Why Mechanics Have Full Database Access

The `is_staff()` function includes mechanics, granting them complete database access. This allows mechanics to:

- View and update all repair requests (including retail customers)
- Access all yacht information and history
- Manage smart lock devices and credentials (if UI allows)
- View and update maintenance records
- Access invoicing and billing information
- Communicate via staff message channels
- View and manage all system data

**Note:** All database permissions listed under the **Staff Role** apply equally to the **Mechanic Role**. UI restrictions focus mechanics on maintenance operations rather than owner relationship management.

---

## Storage Bucket Permissions

### repair-files (Private Bucket)

| Operation | Who Can Access | Conditions |
|-----------|----------------|------------|
| **SELECT** | All authenticated users | Can view all files |
| **INSERT** | All authenticated users | Can upload files |
| **UPDATE** | All authenticated users | Only files in own folder (`name LIKE user_id || '/%'`) |
| **DELETE** | All authenticated users | Only files in own folder (`name LIKE user_id || '/%'`) |

**Use Case:** Repair request attachments, photos, and documentation

---

### yacht-documents (Private Bucket)

| Operation | Who Can Access | Conditions |
|-----------|----------------|------------|
| **SELECT** | All authenticated users | Can view all documents |
| **INSERT** | All authenticated users | Can upload documents |
| **UPDATE** | All authenticated users | Only files in own folder (`name LIKE user_id || '/%'`) |
| **DELETE** | All authenticated users | Only files in own folder (`name LIKE user_id || '/%'`) |

**Use Case:** Yacht documentation, manuals, certificates, and records

---

### invoice-files (Private Bucket)

| Operation | Who Can Access | Conditions |
|-----------|----------------|------------|
| **SELECT** | Staff OR Yacht Owners | Staff: all files<br>Owners: only their yacht's invoices (`name LIKE 'yacht_' || yacht_id || '/%'`) |
| **INSERT** | Staff, Manager, Mechanic | Via `is_staff()` |
| **DELETE** | Staff, Manager, Mechanic | Via `is_staff()` |

**Use Case:** Invoice PDFs and billing documents

---

### education-videos (Public Bucket)

| Operation | Who Can Access | Conditions |
|-----------|----------------|------------|
| **SELECT** | **Public** (anyone, including anonymous) | No authentication required |
| **INSERT** | All authenticated users | Can upload videos |
| **DELETE** | Staff, Manager, Mechanic | Via `is_staff()` |

**Use Case:** Educational content and training videos for yacht operations

---

### temp-chunks (Private Bucket)

| Operation | Who Can Access | Conditions |
|-----------|----------------|------------|
| **SELECT** | All authenticated users | Full access |
| **INSERT** | All authenticated users | Full access |
| **DELETE** | All authenticated users | Full access |
| **ALL** | Service role | Full access for system operations |

**Use Case:** Temporary storage for chunked video uploads before processing

---

## Special Conditions

### Owner-Specific Restrictions

1. **Repair Request Updates**
   - Can only update requests where `status = 'pending'`
   - Once a request moves to 'in_progress' or other status, owners cannot modify it

2. **Vessel Agreement Management**
   - Can only update agreements with `status IN ('draft', 'rejected')`
   - Can only delete agreements with `status = 'draft'`
   - Approved agreements cannot be modified by owners

3. **Financial Visibility**
   - Cannot view yacht budgets (staff/manager only)
   - Cannot view yacht invoices (staff/manager only)
   - Cannot access invoice engagement tracking

4. **Administrative Access**
   - No access to admin notifications
   - No access to staff messages
   - No access to appointments system
   - Cannot view or manage other yachts

5. **Smart Lock Restrictions**
   - Can view access logs but not device credentials
   - Cannot directly control smart locks (managed by staff)

### Manager Enhancements

1. **Budget Management**
   - Explicit policies for inserting/updating budgets for assigned yacht
   - Can view all budgets via `is_staff()` function

2. **Trip Inspections**
   - Explicit create/update policies beyond general staff access
   - Can manage all inspections for all yachts

3. **Dual Access Path**
   - Gets full staff access via `is_staff()` function
   - Additional yacht-specific policies for clarity

### Staff/Mechanic Full Access

1. **User Management**
   - Can update any user's profile including role changes
   - Can activate/deactivate users (`is_active` flag)
   - Can manage password reset requirements

2. **Multi-Yacht Management**
   - Complete access to all yachts simultaneously
   - Can manage bookings across entire fleet
   - Can view consolidated reporting data

3. **Smart Lock Control**
   - Can manage device credentials
   - Can issue lock/unlock commands
   - Can view all access logs and command history

4. **Retail Customer Support**
   - Can create and manage repair requests for non-yacht customers
   - `yacht_id` can be null for retail customer requests

5. **Education Content**
   - Can upload, manage, and delete education videos
   - Can control video visibility and organization

### Anonymous User Access

1. **Yacht Names**
   - Can view yacht names from `yachts` table
   - Required for signup page yacht selection

2. **Education Videos**
   - Full public access to education video bucket
   - No authentication required to view content

### System/Trigger Automatic Access

These operations are performed automatically by database triggers:

1. **yacht_history_logs**
   - Triggers can insert logs on any table changes
   - Tracks all modifications with user, timestamp, and changes

2. **admin_notifications**
   - Created automatically for system events
   - Repair requests, agreements, user signups, etc.

3. **staff_messages**
   - Auto-created from appointments and other events
   - Notification system for staff members

4. **smart_lock_access_logs**
   - Logged automatically when locks are accessed
   - Tracks who accessed what and when

5. **smart_lock_command_logs**
   - Records all lock/unlock commands
   - Audit trail for security events

---

## Quick Reference Tables

### Permission Matrix by Role

| Capability | Owner | Manager | Staff | Mechanic |
|------------|-------|---------|-------|----------|
| View own yacht | ✓ | ✓ | ✓ | ✓ |
| View all yachts | ❌ | ✓ | ✓ | ✓ |
| Manage own yacht | Limited | ✓ | ✓ | ✓ |
| Manage all yachts | ❌ | ✓ | ✓ | ✓ |
| View budgets | ❌ | ✓ | ✓ | ✓ |
| View invoices | ❌ | ✓ | ✓ | ✓ |
| Create repair requests | ✓ | ✓ | ✓ | ✓ |
| Manage all repairs | ❌ | ✓ | ✓ | ✓ |
| Access owner chat | ✓ | ✓ | ✓ | ✓ |
| Access staff messages | ❌ | ✓ | ✓ | ✓ |
| View admin notifications | ❌ | ✓ | ✓ | ✓ |
| Manage appointments | ❌ | ✓ | ✓ | ✓ |
| Control smart locks | ❌ | ✓ | ✓ | ✓ |
| View smart lock logs | ✓ | ✓ | ✓ | ✓ |
| Manage users | ❌ | ✓ | ✓ | ✓ |
| Manage education videos | ❌ | ✓ | ✓ | ✓ |
| View education videos | ✓ | ✓ | ✓ | ✓ |
| Create agreements | ✓ | ✓ | ✓ | ✓ |
| Approve agreements | ❌ | ✓ | ✓ | ✓ |

### Table Access by Role

| Table | Owner | Manager | Staff | Mechanic |
|-------|-------|---------|-------|----------|
| user_profiles | Own only | All | All | All |
| yachts | Own only | All | All | All |
| yacht_bookings | Own yacht | All | All | All |
| yacht_budgets | ❌ | All | All | All |
| yacht_invoices | ❌ | All | All | All |
| yacht_documents | Own yacht | All | All | All |
| yacht_smart_devices | Own yacht | All | All | All |
| trip_inspections | Own yacht | All | All | All |
| owner_handoff_inspections | Own yacht | All | All | All |
| repair_requests | Own/submitted | All | All | All |
| owner_chat_messages | Own yacht | All | All | All |
| admin_notifications | ❌ | All | All | All |
| appointments | ❌ | All | All | All |
| staff_messages | ❌ | All | All | All |
| yacht_history_logs | Own yacht | All | All | All |
| smart_lock_access_logs | Own yacht | All | All | All |
| smart_lock_command_logs | Own yacht | All | All | All |
| vessel_management_agreements | Own yacht | All | All | All |
| maintenance_requests | Own/yacht | All | All | All |
| education_videos | View only | All | All | All |
| video_uploads | ❌ | All | All | All |
| tuya_device_credentials | ❌ | All | All | All |
| invoice_engagement_events | ❌ | All | All | All |

### CRUD Operations Summary

#### Owner Role
- **Create**: Repair requests, maintenance requests, chat messages, agreements (draft)
- **Read**: Own yacht data, education videos, chat messages, inspection reports
- **Update**: Own profile, pending repair requests, draft/rejected agreements
- **Delete**: Draft agreements only

#### Manager/Staff/Mechanic Roles
- **Create**: Everything (all tables)
- **Read**: Everything (all tables)
- **Update**: Everything (all tables)
- **Delete**: Everything (most tables with data safety considerations)

---

## Security Best Practices

### Current Implementation

1. **Row Level Security (RLS) Enabled**
   - All tables have RLS enabled
   - No data accessible without explicit policies

2. **Role-Based Access Control**
   - Clear separation between owner and administrative roles
   - Helper functions for consistent access checks

3. **Yacht-Scoped Access**
   - Owners limited to their assigned yacht
   - Multi-yacht operations for staff roles

4. **Audit Trails**
   - All changes logged in yacht_history_logs
   - Smart lock access fully tracked
   - Invoice engagement monitored

5. **Secure Storage**
   - Private buckets for sensitive documents
   - User-scoped file access in shared buckets
   - Public access only for education content

### Recommendations

1. **Regular Audits**
   - Review access logs periodically
   - Monitor smart lock usage
   - Check for unusual access patterns

2. **Principle of Least Privilege**
   - Owners have minimal necessary access
   - Consider splitting staff roles if more granularity needed

3. **Data Protection**
   - Invoice files restricted to staff and yacht owners
   - Financial data not accessible to yacht owners
   - Sensitive credentials only for staff roles

4. **Monitoring**
   - Track admin notification creation
   - Monitor repair request status changes
   - Review agreement approval workflow

---

## Document Information

**Last Updated:** January 2026
**System Version:** 1.0
**Database:** Supabase PostgreSQL
**Based on Migrations:** Through migration 20260120002008

### Related Documentation
- `NOTIFICATION_SYSTEM.md` - Notification and messaging system
- `database-setup.sql` - Initial database schema
- `/supabase/migrations/` - All RLS policies and schema changes

### Support
For questions about security access or role permissions, contact your system administrator.
