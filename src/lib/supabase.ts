import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eqiecntollhgfxmmbize.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxaWVjbnRvbGxoZ2Z4bW1iaXplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5ODc5ODEsImV4cCI6MjA3NjU2Mzk4MX0.5Y-xXVwjPuD8kVe50BFfg1QwihscdlYk20XCSgG4fOY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    headers: {
      'x-client-info': 'yacht-management-system'
    }
  }
});

export type UserRole = 'owner' | 'manager' | 'staff' | 'mechanic' | 'master';

export interface Yacht {
  id: string;
  name: string;
  model?: string;
  year?: number;
  description?: string;
  image_url?: string;
  owner_id?: string;
  hull_number?: string;
  size?: string;
  port_engine?: string;
  starboard_engine?: string;
  port_generator?: string;
  starboard_generator?: string;
  marina_name?: string;
  slip_location?: string;
  wifi_name?: string;
  wifi_password?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  role: UserRole;
  yacht_id?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  street?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  must_change_password?: boolean;
  notification_email?: string;
  secondary_email?: string;
  email_notifications_enabled?: boolean;
  sms_notifications_enabled?: boolean;
  notification_phone?: string;
  is_active?: boolean;
  last_sign_in_at?: string;
  last_sign_out_at?: string;
  trip_number?: string;
  created_at: string;
  updated_at: string;
}

export interface YachtBookingOwner {
  id: string;
  booking_id: string;
  owner_name: string;
  owner_contact?: string;
  created_at: string;
}

export interface YachtBooking {
  id: string;
  yacht_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  checked_in: boolean;
  checked_out: boolean;
  notes?: string;
  owner_name?: string;
  owner_contact?: string;
  departure_time?: string;
  arrival_time?: string;
  oil_change_needed?: boolean;
  created_at: string;
  updated_at: string;
  yacht_booking_owners?: YachtBookingOwner[];
}

export interface MaintenanceRequest {
  id: string;
  yacht_id: string;
  user_id: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  yacht_name?: string;
}

export interface RepairRequest {
  id: string;
  yacht_id?: string;
  submitted_by: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approved_by?: string;
  approval_notes?: string;
  is_retail_customer?: boolean;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  estimated_repair_cost?: string;
  final_invoice_amount?: string;
  invoice_file_url?: string;
  invoice_file_name?: string;
  completed_by?: string;
  completed_at?: string;
  billed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface OwnerChatMessage {
  id: string;
  yacht_id: string;
  user_id: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface EducationVideo {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url?: string;
  category: string;
  yacht_id?: string;
  duration_seconds?: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export type InspectionType = 'check_in' | 'check_out';
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor';

export interface TripInspection {
  id: string;
  booking_id: string | null;
  yacht_id: string;
  inspector_id?: string;
  inspection_type: InspectionType;
  inspection_date: string;
  hull_condition: ConditionRating;
  hull_notes?: string;
  deck_condition: ConditionRating;
  deck_notes?: string;
  cabin_condition: ConditionRating;
  cabin_notes?: string;
  galley_condition: ConditionRating;
  galley_notes?: string;
  head_condition: ConditionRating;
  head_notes?: string;
  navigation_equipment: ConditionRating;
  navigation_notes?: string;
  safety_equipment: ConditionRating;
  safety_notes?: string;
  engine_condition: ConditionRating;
  engine_notes?: string;
  fuel_level?: number;
  water_level?: number;
  overall_condition: ConditionRating;
  additional_notes?: string;
  issues_found: boolean;
  created_at: string;
  updated_at: string;
}

export interface YachtHistoryLog {
  id: string;
  yacht_id: string;
  yacht_name: string;
  action: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
  reference_id?: string;
  reference_type?: string;
}

export interface OwnerHandoffInspection {
  id: string;
  yacht_id: string;
  inspector_id?: string;
  inspection_date: string;
  trip_issues?: string;
  trip_issues_notes?: string;
  boat_damage?: string;
  boat_damage_notes?: string;
  shore_cords_inverters?: string;
  shore_cords_inverters_notes?: string;
  engine_generator_fuel?: string;
  engine_generator_fuel_notes?: string;
  toy_tank_fuel?: string;
  toy_tank_fuel_notes?: string;
  propane_tanks?: string;
  propane_tanks_notes?: string;
  boat_cleaned?: string;
  boat_cleaned_notes?: string;
  repairs_completed?: string;
  repairs_completed_notes?: string;
  owners_called?: string;
  owners_called_notes?: string;
  additional_notes?: string;
  issues_found: boolean;
  created_at: string;
  updated_at: string;
}

export interface YachtDocument {
  id: string;
  yacht_id: string;
  document_name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  uploaded_by_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface YachtInvoice {
  id: string;
  yacht_id: string;
  repair_request_id?: string;
  invoice_amount: string;
  invoice_amount_numeric?: number;
  invoice_file_url?: string;
  invoice_file_name?: string;
  repair_title: string;
  invoice_year: number;
  invoice_date: string;
  completed_by?: string;
  stripe_payment_intent_id?: string;
  stripe_checkout_session_id?: string;
  payment_status?: string;
  payment_method?: string;
  paid_at?: string;
  stripe_customer_id?: string;
  payment_link_url?: string;
  payment_email_sent_at?: string;
  resend_email_id?: string;
  payment_email_delivered_at?: string;
  payment_email_opened_at?: string;
  payment_link_clicked_at?: string;
  payment_email_bounced_at?: string;
  email_open_count?: number;
  email_click_count?: number;
  payment_confirmation_email_sent_at?: string;
  payment_confirmation_resend_id?: string;
  payment_email_recipient?: string;
  created_at: string;
  updated_at: string;
  yachts?: {
    name: string;
  };
}

export interface YachtBudget {
  id: string;
  yacht_id: string;
  budget_year: number;
  budget_amount: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface AdminNotification {
  id: string;
  yacht_id: string;
  user_id: string;
  message: string;
  notification_type?: string;
  reference_id?: string;
  completed_by?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StaffMessage {
  id: string;
  message: string;
  notification_type?: string;
  reference_id?: string;
  created_by: string;
  is_read?: boolean;
  created_at: string;
  updated_at?: string;
  completed_by?: string;
  completed_at?: string;
  email_subject?: string;
  email_body?: string;
  email_recipients?: Array<{ email: string; name: string }>;
  email_cc_recipients?: string[];
  yacht_name?: string;
  email_sent_at?: string;
  resend_email_id?: string;
  email_delivered_at?: string;
  email_opened_at?: string;
  email_clicked_at?: string;
  email_bounced_at?: string;
  email_open_count?: number;
  email_click_count?: number;
}

export interface Appointment {
  id: string;
  yacht_id?: string;
  yacht_name?: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export type AgreementStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'expired';

export interface VesselManagementAgreement {
  id: string;
  yacht_id: string;
  submitted_by: string;
  season_year: number;
  season_name: string;
  start_date: string;
  end_date: string;
  status: AgreementStatus;
  manager_name: string;
  manager_email: string;
  manager_phone?: string;
  manager_address?: string;
  vessel_name: string;
  vessel_make_model?: string;
  vessel_year?: number;
  vessel_length?: string;
  vessel_hull_number?: string;
  management_scope?: string;
  maintenance_plan?: string;
  usage_restrictions?: string;
  financial_terms?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiration?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  special_provisions?: string;
  additional_services?: string;
  estimated_trips?: number;
  per_trip_fee?: number;
  total_trip_cost?: number;
  grand_total?: number;
  contract_date?: string;
  boatco_initial?: string;
  manager_repair_approval_name?: string;
  manager_repair_approval_email?: string;
  manager_repair_approval_phone?: string;
  manager_billing_approval_name?: string;
  manager_billing_approval_email?: string;
  manager_billing_approval_phone?: string;
  boat_wifi_name?: string;
  boat_wifi_password?: string;
  season_trips?: number;
  off_season_trips?: number;
  consent_office_scheduling?: boolean;
  consent_payment_terms?: boolean;
  agreed_arrival_time?: string;
  agreed_departure_time?: string;
  owner_signature_name?: string;
  owner_signature_date?: string;
  owner_signature_ip?: string;
  staff_signature_name?: string;
  staff_signature_date?: string;
  staff_signature_ip?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  manager_notes?: string;
  pdf_document_id?: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  yachts?: {
    name: string;
  };
}

export type TimeOffType = 'vacation' | 'sick_leave' | 'personal_day' | 'unpaid';
export type TimeOffStatus = 'pending' | 'approved' | 'rejected';

export interface StaffTimeOffRequest {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  time_off_type: TimeOffType;
  status: TimeOffStatus;
  reason?: string;
  submitted_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    first_name?: string;
    last_name?: string;
    role: UserRole;
  };
}

export interface StaffSchedule {
  id: string;
  user_id: string;
  day_of_week: number;
  is_working_day: boolean;
  start_time?: string;
  end_time?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  requires_approval?: boolean;
  approval_status?: 'approved' | 'denied' | 'pending' | 'not_required';
  approved_by?: string;
  approved_at?: string;
  denial_reason?: string;
  user_profiles?: {
    first_name: string;
    last_name: string;
    role: string;
  };
  approver?: {
    first_name: string;
    last_name: string;
  };
}

export const isStaffRole = (role?: UserRole): boolean => {
  return role === 'staff' || role === 'mechanic' || role === 'master';
};

export const isManagerRole = (role?: UserRole): boolean => {
  return role === 'manager' || role === 'master';
};

export const isStaffOrManager = (role?: UserRole): boolean => {
  return role === 'staff' || role === 'manager' || role === 'mechanic' || role === 'master';
};

export const isMasterRole = (role?: UserRole): boolean => {
  return role === 'master';
};

export const isOwnerRole = (role?: UserRole): boolean => {
  return role === 'owner';
};

export const canManageUsers = (role?: UserRole): boolean => {
  return role === 'staff' || role === 'master';
};

export const canManageYacht = (role?: UserRole): boolean => {
  return role === 'staff' || role === 'manager' || role === 'master';
};

export const canAccessAllYachts = (role?: UserRole): boolean => {
  return role === 'staff' || role === 'master';
};

export const logYachtActivity = async (
  yachtId: string,
  yachtName: string,
  action: string,
  userId?: string,
  userName?: string,
  referenceId?: string,
  referenceType?: string
) => {
  try {
    const { error } = await supabase.from('yacht_history_logs').insert({
      yacht_id: yachtId,
      yacht_name: yachtName,
      action,
      created_by: userId,
      created_by_name: userName,
      reference_id: referenceId,
      reference_type: referenceType
    });
    if (error) throw error;
  } catch (error) {
    console.error('Error logging yacht activity:', error);
  }
};
