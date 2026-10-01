export interface BobScreen {
  key: string;
  label: string;
  kind: 'page' | 'form';
  route: string;
  description: string;
  fields?: string[];
}

export const BOB_SCREENS: BobScreen[] = [
  // Main tabs
  { key: 'calendar', label: 'Owner Trips Calendar', kind: 'page', route: '/calendar', description: 'View and manage owner yacht trip bookings' },
  { key: 'maintenance', label: 'Maintenance Request', kind: 'form', route: '/maintenance', description: 'Submit a maintenance request for a yacht', fields: ['subject', 'description', 'location', 'contact_name', 'contact_phone'] },
  { key: 'education', label: 'Education Videos', kind: 'page', route: '/education', description: 'Browse and watch educational boating videos' },
  { key: 'staff-calendar', label: 'Staff Schedule', kind: 'page', route: '/staff-calendar', description: 'View staff schedule and time off requests' },
  { key: 'time-clock', label: 'Time Clock', kind: 'page', route: '/time-clock', description: 'Clock in and out, view time entries and pay periods' },
  { key: 'customers', label: 'Customer Database', kind: 'page', route: '/customers', description: 'Manage customer vessel information' },
  { key: 'support', label: 'Support Tickets', kind: 'page', route: '/support', description: 'View and create support tickets' },

  // Estimating sub-tabs
  { key: 'estimating-dashboard', label: 'Estimating Dashboard', kind: 'page', route: '/estimating/dashboard', description: 'Overview of estimates, work orders, invoices, and parts' },
  { key: 'estimates', label: 'Estimates', kind: 'page', route: '/estimating/estimates', description: 'Create and manage repair estimates' },
  { key: 'new-estimate', label: 'New Estimate', kind: 'form', route: '/estimating/estimates/new', description: 'Create a new repair estimate', fields: ['customer_name', 'vessel_id', 'work_title', 'description'] },
  { key: 'work-orders', label: 'Work Orders', kind: 'page', route: '/estimating/work-orders', description: 'List of all work orders' },
  { key: 'work-order', label: 'Work Order Detail', kind: 'page', route: '/estimating/work-orders/:id', description: 'View a single work order with tasks and line items' },
  { key: 'estimating-invoices', label: 'Invoices', kind: 'page', route: '/estimating/invoices', description: 'List of all estimating invoices' },
  { key: 'estimating-invoice', label: 'Invoice Detail', kind: 'page', route: '/estimating/invoices/:id', description: 'View a single invoice' },
  { key: 'purchase-orders', label: 'Purchase Orders', kind: 'page', route: '/estimating/purchase-orders', description: 'List of all purchase orders' },
  { key: 'parts-inventory', label: 'Parts Inventory', kind: 'page', route: '/estimating/parts', description: 'Manage parts inventory and stock levels' },
  { key: 'estimating-settings', label: 'Estimating Settings', kind: 'page', route: '/estimating/settings', description: 'Configure labor codes, accounting codes, tax settings, packages' },

  // Admin views
  { key: 'admin-menu', label: 'Admin Dashboard', kind: 'page', route: '/admin', description: 'Admin dashboard with links to all management pages' },
  { key: 'master-calendar', label: 'Master Calendar', kind: 'page', route: '/admin/master-calendar', description: 'View all owner trips across all yachts' },
  { key: 'messages', label: 'Messages', kind: 'page', route: '/admin/messages', description: 'View all incoming messages and appointments' },
  { key: 'appointments', label: 'Appointments', kind: 'page', route: '/admin/appointments', description: 'Schedule customer appointments and repairs' },
  { key: 'new-appointment', label: 'New Appointment', kind: 'form', route: '/admin/appointments/new', description: 'Create a new customer appointment', fields: ['yacht_id', 'owner_name', 'problem_description', 'appointment_date', 'departure_time'] },
  { key: 'staff-appointment', label: 'Staff Appointment', kind: 'form', route: '/admin/staff-appointment', description: 'Schedule a meeting with staff or contacts', fields: ['name', 'description', 'appointment_date', 'departure_time'] },
  { key: 'inspection', label: 'Trip Inspection Form', kind: 'form', route: '/admin/inspection', description: 'Complete a trip inspection for a yacht trip', fields: ['yacht_id', 'inspection_type', 'inspector_id', 'owner_name'] },
  { key: 'owner-handoff', label: 'Meet the Yacht Owner', kind: 'form', route: '/admin/owner-handoff', description: 'Complete pre-handoff checklist before owner arrival', fields: ['yacht_id', 'mechanic_id'] },
  { key: 'repair-requests', label: 'Repair Requests', kind: 'page', route: '/admin/repair-requests', description: 'Upload files and request repair approvals' },
  { key: 'new-repair-request', label: 'New Repair Request', kind: 'form', route: '/admin/repair-requests/new', description: 'Create a repair request for owner approval', fields: ['yacht_id', 'title', 'description', 'priority', 'customer_name', 'customer_email', 'customer_phone'] },
  { key: 'maintenance-requests', label: 'Owner Maintenance Requests', kind: 'page', route: '/admin/maintenance-requests', description: 'View maintenance requests submitted by yacht owners' },
  { key: 'owner-trips', label: 'Owner Trips', kind: 'page', route: '/admin/owner-trips', description: 'Schedule and manage owner yacht trips' },
  { key: 'new-owner-trip', label: 'New Owner Trip', kind: 'form', route: '/admin/owner-trips/new', description: 'Schedule a new owner yacht trip', fields: ['yacht_id', 'owner_name', 'start_date', 'end_date', 'departure_time'] },
  { key: 'owner-chat', label: 'Owner Chat', kind: 'page', route: '/admin/owner-chat', description: 'Chat with yacht owners' },
  { key: 'yachts', label: 'Yachts', kind: 'page', route: '/admin/yachts', description: 'Manage yacht fleet and vessel information' },
  { key: 'new-yacht', label: 'Add Yacht', kind: 'form', route: '/admin/yachts/new', description: 'Add a new yacht to the fleet', fields: ['name', 'manufacturer', 'hull_number', 'marina_name', 'marina_slip', 'wifi_network', 'wifi_password'] },
  { key: 'engine-catalog', label: 'Engine Database', kind: 'page', route: '/admin/engine-catalog', description: 'Manage reusable engine, generator, and outboard models with service parts' },
  { key: 'vessel-monitoring', label: 'Vessel Monitoring', kind: 'page', route: '/admin/vessel-monitoring', description: 'Monitor pumps, batteries, GPS, wind, and smart locks' },
  { key: 'smart-devices', label: 'Smart Devices', kind: 'page', route: '/admin/smart-devices', description: 'Manage smart locks and device credentials' },
  { key: 'companies', label: 'Company Management', kind: 'page', route: '/admin/companies', description: 'Manage companies and multi-tenant settings' },
  { key: 'year-end-overview', label: 'Year-End Overview', kind: 'page', route: '/admin/year-end-overview', description: 'Fleet-wide totals for invoices, inspections, and repair requests by year' },
  { key: 'users', label: 'User Management', kind: 'page', route: '/admin/users', description: 'View and edit user profiles and assignments' },
  { key: 'salvage-reports', label: 'Salvage Division', kind: 'page', route: '/admin/salvage-reports', description: 'Create and manage salvage service reports' },
  { key: 'new-salvage-report', label: 'New Salvage Report', kind: 'form', route: '/admin/salvage-reports/new', description: 'Create a new salvage service report', fields: ['customer_name', 'vessel_name', 'description', 'service_date'] },
  { key: 'jarvis', label: 'Bob AI Assistant', kind: 'page', route: '/admin/jarvis', description: 'AI-powered assistant for fleet, repairs, and operations' },
];

export const BOB_SCREEN_MAP: Record<string, BobScreen> = Object.fromEntries(
  BOB_SCREENS.map(s => [s.key, s])
);
