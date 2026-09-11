export const FEATURE_KEYS = {
  OWNER_TRIPS: 'owner_trips',
  MAINTENANCE: 'maintenance',
  EDUCATION: 'education',
  STAFF_SCHEDULE: 'staff_schedule',
  TIME_CLOCK: 'time_clock',
  ESTIMATING: 'estimating',
  CUSTOMERS: 'customers',
  MASTER_CALENDAR: 'master_calendar',
  MESSAGES: 'messages',
  APPOINTMENTS: 'appointments',
  STAFF_APPOINTMENT: 'staff_appointment',
  INSPECTION: 'inspection',
  OWNER_HANDOFF: 'owner_handoff',
  REPAIR_REQUESTS: 'repair_requests',
  MAINTENANCE_REQUESTS: 'maintenance_requests',
  OWNER_CHAT: 'owner_chat',
  YACHTS: 'yachts',
  ENGINE_CATALOG: 'engine_catalog',
  VESSEL_MONITORING: 'vessel_monitoring',
  SMART_DEVICES: 'smart_devices',
  YEAR_END_OVERVIEW: 'year_end_overview',
  USER_MANAGEMENT: 'user_management',
  SALVAGE_REPORTS: 'salvage_reports',
} as const;

export type FeatureKey = typeof FEATURE_KEYS[keyof typeof FEATURE_KEYS];

export interface FeatureDef {
  key: string;
  label: string;
}

export const SIDEBAR_FEATURES: FeatureDef[] = [
  { key: 'owner_trips', label: 'Owners Trip' },
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'education', label: 'Education' },
  { key: 'staff_schedule', label: 'Staff Schedule' },
  { key: 'time_clock', label: 'Time Clock' },
  { key: 'estimating', label: 'Estimating' },
  { key: 'customers', label: 'Customers' },
];

export const ADMIN_FEATURES: FeatureDef[] = [
  { key: 'master_calendar', label: 'Master Calendar' },
  { key: 'messages', label: 'New Messages' },
  { key: 'appointments', label: 'Create Appointment' },
  { key: 'staff_appointment', label: 'Staff Appointment' },
  { key: 'inspection', label: 'Trip Inspection Form' },
  { key: 'owner_handoff', label: 'Meet the Yacht Owner' },
  { key: 'repair_requests', label: 'Repair Requests' },
  { key: 'maintenance_requests', label: 'Owner Maintenance Requests' },
  { key: 'owner_trips', label: 'Owner Trips' },
  { key: 'owner_chat', label: 'Owner Chat' },
  { key: 'yachts', label: 'Yachts' },
  { key: 'engine_catalog', label: 'Engine Database' },
  { key: 'vessel_monitoring', label: 'Vessel Monitoring' },
  { key: 'smart_devices', label: 'Smart Devices' },
  { key: 'year_end_overview', label: 'Year-End Overview' },
  { key: 'user_management', label: 'User Management' },
  { key: 'salvage_reports', label: 'Salvage Reports' },
];

export const ALL_FEATURES: FeatureDef[] = [...SIDEBAR_FEATURES, ...ADMIN_FEATURES.filter(
  (f) => !SIDEBAR_FEATURES.some((s) => s.key === f.key)
)];

export function isFeatureEnabled(
  flags: Record<string, boolean> | null | undefined,
  key: string
): boolean {
  if (!flags) return true;
  return flags[key] !== false;
}

export function getAllFlagsDefault(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const f of ALL_FEATURES) {
    result[f.key] = true;
  }
  return result;
}
