import { useState, useEffect } from 'react';
import { Anchor, Calendar, CheckCircle, AlertCircle, BookOpen, LogOut, Wrench, Send, Play, Shield, ClipboardCheck, Ship, CalendarPlus, FileUp, MessageCircle, Mail, CreditCard as Edit2, Trash2, ChevronLeft, ChevronRight, History, UserCheck, FileText, Upload, Download, X, Users, Save, RefreshCw, Clock, Thermometer, Camera, Receipt, Pencil, Lock, CreditCard, Eye, EyeOff, MousePointer, Ligature as FileSignature, Folder, Menu, Phone, Printer, Plus, QrCode, CircleUser as UserCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRoleImpersonation } from '../contexts/RoleImpersonationContext';
import { useYachtImpersonation } from '../contexts/YachtImpersonationContext';
import { supabase, YachtBooking, MaintenanceRequest, EducationVideo, TripInspection, ConditionRating, InspectionType, RepairRequest, OwnerChatMessage, YachtHistoryLog, OwnerHandoffInspection, YachtDocument, YachtInvoice, YachtBudget, AdminNotification, StaffMessage, Appointment, Yacht, UserProfile, VesselManagementAgreement, logYachtActivity, isStaffRole, isManagerRole, isStaffOrManager, isMasterRole, isOwnerRole, canManageUsers, canManageYacht, canAccessAllYachts } from '../lib/supabase';
import { InspectionPDFView } from './InspectionPDFView';
import { OwnerHandoffPDFView } from './OwnerHandoffPDFView';
import { FileUploadDropzone } from './FileUploadDropzone';
import { SmartLockControls } from './SmartLockControls';
import { SmartDeviceManagement } from './SmartDeviceManagement';
import { VesselManagementAgreementForm } from './VesselManagementAgreementForm';
import { VesselAgreementViewer } from './VesselAgreementViewer';
import { PrintableUserList } from './PrintableUserList';
import { PrintableOwnerTrips } from './PrintableOwnerTrips';
import { EmailComposeModal } from './EmailComposeModal';
import { YachtQRCode } from './YachtQRCode';
import { StaffCalendar } from './StaffCalendar';
import { TimeClock } from './TimeClock';
import { EstimatingDashboard } from './EstimatingDashboard';
import CustomerManagement from './CustomerManagement';
import { uploadFileToStorage, deleteFileFromStorage, isStorageUrl, UploadProgress, isTokenExpiredError } from '../utils/fileUpload';

interface DashboardProps {
  onNavigate: (page: 'maintenance' | 'education' | 'staffCalendar') => void;
}

export const Dashboard = ({ onNavigate }: DashboardProps) => {
  const { user, userProfile, yacht, signOut, refreshProfile } = useAuth();
  const { impersonatedRole, setImpersonatedRole, getEffectiveRole, isImpersonating } = useRoleImpersonation();
  const { impersonatedYacht, setImpersonatedYacht, getEffectiveYacht, isImpersonatingYacht } = useYachtImpersonation();

  const effectiveRole = getEffectiveRole(userProfile?.role);
  const effectiveYacht = getEffectiveYacht(yacht, userProfile?.role);

  // Helper function to set active tab and persist to localStorage
  const setActiveTabPersisted = (tab: 'calendar' | 'maintenance' | 'education' | 'admin' | 'staffCalendar' | 'timeClock' | 'estimating' | 'customers') => {
    setActiveTab(tab);
    try {
      localStorage.setItem('activeTab', tab);
    } catch (error) {
      console.error('Error saving active tab to localStorage:', error);
    }
  };

  const [bookings, setBookings] = useState<YachtBooking[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [videos, setVideos] = useState<EducationVideo[]>([]);
  const [welcomeVideo, setWelcomeVideo] = useState<EducationVideo | null>(null);
  const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);
  const [qrScannedYachtName, setQrScannedYachtName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'calendar' | 'maintenance' | 'education' | 'admin' | 'staffCalendar' | 'timeClock' | 'estimating' | 'customers'>(() => {
    try {
      const stored = localStorage.getItem('activeTab');
      if (stored && ['calendar', 'maintenance', 'education', 'admin', 'staffCalendar', 'timeClock', 'estimating', 'customers'].includes(stored)) {
        return stored as 'calendar' | 'maintenance' | 'education' | 'admin' | 'staffCalendar' | 'timeClock' | 'estimating' | 'customers';
      }
    } catch (error) {
      console.error('Error loading active tab from localStorage:', error);
    }
    return 'calendar';
  });
  const [activeBooking, setActiveBooking] = useState<YachtBooking | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<EducationVideo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showVideoUploadModal, setShowVideoUploadModal] = useState(false);
  const [videoUploadForm, setVideoUploadForm] = useState({
    title: '',
    description: '',
    category: '',
    order_index: 0,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<UploadProgress | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingVideos, setEditingVideos] = useState<{[key: string]: {title: string; description: string; category: string; order_index: number; thumbnail_url?: string}}>({});
  const [editingThumbnails, setEditingThumbnails] = useState<{[key: string]: File}>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showYachtDropdown, setShowYachtDropdown] = useState(false);
  const [bulkEmailRecipients, setBulkEmailRecipients] = useState<Array<{ email: string; name: string }>>([]);
  const [bulkEmailCcRecipients, setBulkEmailCcRecipients] = useState<string[]>([]);
  const [bulkEmailYachtName, setBulkEmailYachtName] = useState<string>('');

  const convertTo12Hour = (time24: string): string => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatPhoneNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const isAntelopePoint = () => {
    if (!yacht?.marina_name) return false;
    const marinaName = yacht.marina_name.toLowerCase().trim();
    return marinaName.includes('antelope') || marinaName.includes('antilope');
  };

  const isWithinBookingPeriod = (booking: YachtBooking | null): boolean => {
    if (!booking) return false;
    const now = new Date();
    const start = new Date(booking.start_date);
    const end = new Date(booking.end_date);
    return now >= start && now <= end;
  };

  const [waterLevelData, setWaterLevelData] = useState<{elevation: string; date: string} | null>(null);
  const [waterLevelLoading, setWaterLevelLoading] = useState(true);
  const [weather, setWeather] = useState<{temperature: number} | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => {
    const fetchWaterLevel = async () => {
      try {
        // USGS site 09379900 for Lake Powell at Glen Canyon Dam
        const response = await fetch(
          'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=09379900'
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Find the elevation data (looking for NGVD 1929 or NAVD 1988 elevation)
        const timeSeries = data.value.timeSeries;
        if (timeSeries && timeSeries.length > 0) {
          // Use the first timeSeries which should be elevation data
          const elevationSeries = timeSeries[0];
          if (elevationSeries.values && elevationSeries.values[0].value.length > 0) {
            const latest = elevationSeries.values[0].value[0];
            setWaterLevelData({
              elevation: latest.value,
              date: new Date(latest.dateTime).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })
            });
          }
        }
      } catch (error) {
        console.error('Error fetching water level:', error);
      } finally {
        setWaterLevelLoading(false);
      }
    };

    fetchWaterLevel();
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=36.9147&longitude=-111.4558&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America/Phoenix'
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.current && data.current.temperature_2m !== null) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m)
          });
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, []);

  const [maintenanceSubject, setMaintenanceSubject] = useState('');
  const [maintenanceDescription, setMaintenanceDescription] = useState('');
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState(false);
  const [maintenanceError, setMaintenanceError] = useState('');
  const [maintenancePhoto, setMaintenancePhoto] = useState<File | null>(null);
  const [maintenancePhotoPreview, setMaintenancePhotoPreview] = useState<string | null>(null);

  const [selectedYachtForInspection, setSelectedYachtForInspection] = useState<string>('');
  const [inspectionType, setInspectionType] = useState<InspectionType>('check_in');
  const [selectedMechanicId, setSelectedMechanicId] = useState<string>('');
  const [mechanics, setMechanics] = useState<UserProfile[]>([]);
  const [inspectionForm, setInspectionForm] = useState({
    hull_condition: '' as ConditionRating,
    hull_notes: '',
    deck_condition: '' as ConditionRating,
    deck_notes: '',
    cabin_condition: '' as ConditionRating,
    cabin_notes: '',
    galley_condition: '' as ConditionRating,
    galley_notes: '',
    head_condition: '' as ConditionRating,
    head_notes: '',
    navigation_equipment: '' as ConditionRating,
    navigation_notes: '',
    safety_equipment: '' as ConditionRating,
    safety_notes: '',
    engine_condition: '' as ConditionRating,
    engine_notes: '',
    fuel_level: 100,
    water_level: 100,
    overall_condition: '' as ConditionRating,
    additional_notes: '',
    issues_found: false,
    inverter_system: '' as ConditionRating,
    inverter_notes: '',
    master_bathroom: '' as ConditionRating,
    master_bathroom_notes: '',
    secondary_bathroom: '' as ConditionRating,
    secondary_bathroom_notes: '',
    lower_sinks: '' as ConditionRating,
    lower_sinks_notes: '',
    kitchen_sink: '' as ConditionRating,
    kitchen_sink_notes: '',
    garbage_disposal: '' as ConditionRating,
    garbage_disposal_notes: '',
    stove_top: '' as ConditionRating,
    stove_top_notes: '',
    dishwasher: '' as ConditionRating,
    dishwasher_notes: '',
    trash_compactor: '' as ConditionRating,
    trash_compactor_notes: '',
    volt_fans: '' as ConditionRating,
    volt_fans_notes: '',
    ac_filters: '' as ConditionRating,
    ac_filters_notes: '',
    ac_water_pumps: '' as ConditionRating,
    ac_water_pumps_notes: '',
    water_filters: '' as ConditionRating,
    water_filters_notes: '',
    water_pumps_controls: '' as ConditionRating,
    water_pumps_controls_notes: '',
    upper_deck_bathroom: '' as ConditionRating,
    upper_deck_bathroom_notes: '',
    upper_kitchen_sink: '' as ConditionRating,
    upper_kitchen_sink_notes: '',
    upper_disposal: '' as ConditionRating,
    upper_disposal_notes: '',
    icemaker: '' as ConditionRating,
    icemaker_notes: '',
    upper_stove_top: '' as ConditionRating,
    upper_stove_top_notes: '',
    propane: '' as ConditionRating,
    propane_notes: '',
    windless_port: '' as ConditionRating,
    windless_port_notes: '',
    windless_starboard: '' as ConditionRating,
    windless_starboard_notes: '',
    anchor_lines: '' as ConditionRating,
    anchor_lines_notes: '',
    upper_ac_filter: '' as ConditionRating,
    upper_ac_filter_notes: '',
    port_engine_oil: '' as ConditionRating,
    port_engine_oil_notes: '',
    port_generator_oil: '' as ConditionRating,
    port_generator_oil_notes: '',
    starboard_generator_oil: '' as ConditionRating,
    starboard_generator_oil_notes: '',
    starboard_engine_oil: '' as ConditionRating,
    starboard_engine_oil_notes: '',
    sea_strainers: '' as ConditionRating,
    sea_strainers_notes: '',
    engine_batteries: '' as ConditionRating,
    engine_batteries_notes: '',
  });
  const [inspectionLoading, setInspectionLoading] = useState(false);
  const [inspectionSuccess, setInspectionSuccess] = useState(false);
  const [inspectionError, setInspectionError] = useState('');
  const [adminView, setAdminView] = useState<'menu' | 'inspection' | 'yachts' | 'ownertrips' | 'repairs' | 'ownerchat' | 'messages' | 'mastercalendar' | 'ownerhandoff' | 'users' | 'appointments' | 'smartdevices'>('menu');
  const [allYachts, setAllYachts] = useState<Yacht[]>([]);
  const [selectedYachtForHandoff, setSelectedYachtForHandoff] = useState<string>('');
  const [selectedMechanicForHandoff, setSelectedMechanicForHandoff] = useState<string>('');
  const [handoffForm, setHandoffForm] = useState({
    trip_issues: '',
    trip_issues_notes: '',
    boat_damage: '',
    boat_damage_notes: '',
    shore_cords_inverters: '',
    shore_cords_inverters_notes: '',
    engine_generator_fuel: '',
    engine_generator_fuel_notes: '',
    toy_tank_fuel: '',
    toy_tank_fuel_notes: '',
    propane_tanks: '',
    propane_tanks_notes: '',
    boat_cleaned: '',
    boat_cleaned_notes: '',
    repairs_completed: '',
    repairs_completed_notes: '',
    owners_called: '',
    owners_called_notes: '',
    additional_notes: '',
    issues_found: false,
  });
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [handoffSuccess, setHandoffSuccess] = useState(false);
  const [handoffError, setHandoffError] = useState('');
  const [yachtForm, setYachtForm] = useState({
    name: '',
    hull_number: '',
    manufacturer: '',
    year: '',
    size: '',
    port_engine: '',
    starboard_engine: '',
    port_generator: '',
    starboard_generator: '',
    marina_name: '',
    slip_location: '',
    wifi_name: '',
    wifi_password: ''
  });
  const [yachtLoading, setYachtLoading] = useState(false);
  const [yachtSuccess, setYachtSuccess] = useState(false);
  const [yachtError, setYachtError] = useState('');
  const [showYachtForm, setShowYachtForm] = useState(false);
  const [editingYacht, setEditingYacht] = useState<Yacht | null>(null);
  const [showOwnerTripForm, setShowOwnerTripForm] = useState(false);
  const [ownerTripForm, setOwnerTripForm] = useState({
    start_date: '',
    departure_time: '',
    end_date: '',
    arrival_time: '',
    owners: [{ owner_name: '', owner_contact: '' }]
  });
  const [selectedOwnerYachtId, setSelectedOwnerYachtId] = useState<string | null>(null);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState<string | null>(null);
  const [ownerTripLoading, setOwnerTripLoading] = useState(false);
  const [ownerTripSuccess, setOwnerTripSuccess] = useState(false);
  const [ownerTripError, setOwnerTripError] = useState('');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [ownerCountsByYacht, setOwnerCountsByYacht] = useState<Record<string, number>>({});
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [customerType, setCustomerType] = useState<'yacht' | 'customer'>('yacht');
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerVessels, setCustomerVessels] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [showQuickAddVessel, setShowQuickAddVessel] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    customer_type: 'individual' as 'individual' | 'business',
    first_name: '',
    last_name: '',
    business_name: '',
    email: '',
    phone: ''
  });
  const [quickVesselForm, setQuickVesselForm] = useState({
    vessel_name: '',
    manufacturer: '',
    model: '',
    year: ''
  });
  const [repairForm, setRepairForm] = useState({
    yacht_id: '',
    title: '',
    description: '',
    estimated_repair_cost: '',
    file: null as File | null,
    customer_id: '',
    vessel_id: ''
  });
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairSuccess, setRepairSuccess] = useState(false);
  const [repairError, setRepairError] = useState('');
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([]);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalAction, setApprovalAction] = useState<{ requestId: string; status: 'approved' | 'rejected' } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedRepairForInvoice, setSelectedRepairForInvoice] = useState<RepairRequest | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    final_invoice_amount: '',
    invoice_file: null as File | null,
    payment_method_type: 'card' as 'card' | 'ach' | 'both'
  });
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [repairInvoices, setRepairInvoices] = useState<{ [repairRequestId: string]: YachtInvoice }>({});
  const [showEditRepairModal, setShowEditRepairModal] = useState(false);
  const [editingRepairRequest, setEditingRepairRequest] = useState<RepairRequest | null>(null);
  const [editRepairForm, setEditRepairForm] = useState({
    title: '',
    description: '',
    file: null as File | null,
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    estimated_repair_cost: ''
  });
  const [editRepairLoading, setEditRepairLoading] = useState(false);
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<YachtInvoice | null>(null);
  const [isAddingInvoiceToCompleted, setIsAddingInvoiceToCompleted] = useState(false);
  const [paymentLinkLoading, setPaymentLinkLoading] = useState<{ [invoiceId: string]: boolean }>({});
  const [deletePaymentLinkLoading, setDeletePaymentLinkLoading] = useState<{ [invoiceId: string]: boolean }>({});
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState<YachtInvoice | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [emailRecipientName, setEmailRecipientName] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEstimateEmailModal, setShowEstimateEmailModal] = useState(false);
  const [selectedRepairForEstimateEmail, setSelectedRepairForEstimateEmail] = useState<RepairRequest | null>(null);
  const [estimateEmailRecipient, setEstimateEmailRecipient] = useState('');
  const [estimateEmailRecipientName, setEstimateEmailRecipientName] = useState('');
  const [sendingEstimateEmail, setSendingEstimateEmail] = useState(false);
  const [chatMessages, setChatMessages] = useState<OwnerChatMessage[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [masterCalendarBookings, setMasterCalendarBookings] = useState<(YachtBooking | Appointment)[]>([]);
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingBooking, setEditingBooking] = useState<(YachtBooking | Appointment) | null>(null);
  const [editingBookingClickedDate, setEditingBookingClickedDate] = useState<Date | null>(null);
  const [editBookingForm, setEditBookingForm] = useState({
    owner_name: '',
    owner_contact: '',
    start_date: '',
    departure_time: '',
    end_date: '',
    arrival_time: ''
  });
  const [editBookingLoading, setEditBookingLoading] = useState(false);
  const [selectedChatYachtId, setSelectedChatYachtId] = useState<string | null>(null);
  const [selectedMessagesYachtId, setSelectedMessagesYachtId] = useState<string | null>(null);
  const [appointmentForm, setAppointmentForm] = useState({
    date: '',
    time: '',
    name: '',
    phone: '',
    email: '',
    yacht_id: '',
    problem_description: '',
    createRepairRequest: false
  });
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentSuccess, setAppointmentSuccess] = useState(false);
  const [appointmentError, setAppointmentError] = useState('');
  const [editBookingError, setEditBookingError] = useState('');
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editAppointmentForm, setEditAppointmentForm] = useState({
    date: '',
    time: '',
    name: '',
    phone: '',
    email: '',
    yacht_name: '',
    problem_description: ''
  });
  const [editAppointmentLoading, setEditAppointmentLoading] = useState(false);
  const [editAppointmentError, setEditAppointmentError] = useState('');
  const [staffMessages, setStaffMessages] = useState<StaffMessage[]>([]);
  const [messagesTab, setMessagesTab] = useState<'yacht' | 'staff'>('yacht');
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<{date: Date, bookings: (YachtBooking | Appointment)[]} | null>(null);
  const [showQuickAppointmentModal, setShowQuickAppointmentModal] = useState(false);
  const [quickAppointmentDate, setQuickAppointmentDate] = useState<Date | null>(null);
  const [selectedInspectionForPDF, setSelectedInspectionForPDF] = useState<TripInspection | null>(null);
  const [selectedHandoffForPDF, setSelectedHandoffForPDF] = useState<OwnerHandoffInspection | null>(null);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);
  const [yachtHistoryLogs, setYachtHistoryLogs] = useState<Record<string, YachtHistoryLog[]>>({});
  const [expandedYachtId, setExpandedYachtId] = useState<string | null>(null);
  const [yachtDocuments, setYachtDocuments] = useState<Record<string, YachtDocument[]>>({});
  const [documentYachtId, setDocumentYachtId] = useState<string | null>(null);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [documentForm, setDocumentForm] = useState({
    document_name: '',
    file_url: '',
    notes: ''
  });
  const [yachtInvoices, setYachtInvoices] = useState<Record<string, YachtInvoice[]>>({});
  const [invoiceYachtId, setInvoiceYachtId] = useState<string | null>(null);
  const [selectedInvoiceYear, setSelectedInvoiceYear] = useState<number>(new Date().getFullYear());
  const [yachtBudgets, setYachtBudgets] = useState<Record<string, YachtBudget | null>>({});
  const [budgetBreakdownInput, setBudgetBreakdownInput] = useState({
    management_fees: '',
    trip_inspection_fees: '',
    spring_startup_cost: '',
    oil_change_200hr: '',
    oil_change_600hr: '',
    preventive_maintenance: '',
    winter_repairs_upgrades: '',
    winterizations: '',
    water_filters: '',
    misc_1: '',
    misc_1_notes: '',
    misc_2: '',
    misc_2_notes: ''
  });
  const [yachtTrips, setYachtTrips] = useState<Record<string, any[]>>({});
  const [tripsYachtId, setTripsYachtId] = useState<string | null>(null);
  const [budgetEditMode, setBudgetEditMode] = useState<Record<string, boolean>>({});
  const [budgetSaving, setBudgetSaving] = useState<Record<string, boolean>>({});
  const [paymentProcessing, setPaymentProcessing] = useState<Record<string, boolean>>({});
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ progress: 0, status: 'idle' });
  const [useManualUrl, setUseManualUrl] = useState(false);
  const [yachtFilter, setYachtFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isCreatingNewUser, setIsCreatingNewUser] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserGroup, setSelectedUserGroup] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userEditForm, setUserEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    trip_number: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip_code: '',
    yacht_id: '',
    role: 'owner',
    employee_type: 'hourly',
    email_notifications_enabled: true,
    sms_notifications_enabled: false,
    notification_email: '',
    notification_phone: '',
    secondary_email: '',
    can_approve_repairs: false,
    can_approve_billing: false
  });
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zip_code: '',
    secondary_email: '',
    email_notifications_enabled: false,
    notification_email: ''
  });
  const [profileEditLoading, setProfileEditLoading] = useState(false);
  const [profileEditError, setProfileEditError] = useState('');
  const [profileEditSuccess, setProfileEditSuccess] = useState('');
  const [showEmailChangeConfirm, setShowEmailChangeConfirm] = useState(false);
  const [newEmailAddress, setNewEmailAddress] = useState('');
  const [vesselAgreements, setVesselAgreements] = useState<Record<string, VesselManagementAgreement[]>>({});
  const [agreementYachtId, setAgreementYachtId] = useState<string | null>(null);
  const [qrCodeYacht, setQrCodeYacht] = useState<{ id: string; name: string } | null>(null);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [showAgreementViewer, setShowAgreementViewer] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<VesselManagementAgreement | null>(null);
  const [agreementFilter, setAgreementFilter] = useState<'all' | 'draft' | 'pending' | 'approved'>('all');
  const [hasSmartDevices, setHasSmartDevices] = useState(false);
  const [showUserPrintView, setShowUserPrintView] = useState(false);
  const [usersToPrint, setUsersToPrint] = useState<(UserProfile & { yachts?: Yacht })[]>([]);
  const [printTitle, setPrintTitle] = useState('User List');
  const [printYachtFilter, setPrintYachtFilter] = useState<string>('all');
  const [showTripsPrintView, setShowTripsPrintView] = useState(false);
  const [tripsToPrint, setTripsToPrint] = useState<YachtBooking[]>([]);
  const [printYachtName, setPrintYachtName] = useState('');

  useEffect(() => {
    const handleQRScannedYacht = async () => {
      const scannedYachtId = localStorage.getItem('qr_scanned_yacht_id');
      console.log('[Dashboard QR] Checking for scanned yacht ID:', scannedYachtId);

      if (!scannedYachtId || !user) {
        console.log('[Dashboard QR] No yacht ID or no user');
        return;
      }

      try {
        const { data: scannedYacht, error } = await supabase
          .from('yachts')
          .select('*')
          .eq('id', scannedYachtId)
          .maybeSingle();

        console.log('[Dashboard QR] Yacht lookup result:', { scannedYacht, error });

        if (!error && scannedYacht) {
          // Set yacht name for display
          setQrScannedYachtName(scannedYacht.name);
          console.log('[Dashboard QR] Set yacht name:', scannedYacht.name);

          // Fetch yacht-specific welcome video
          console.log('[Dashboard QR] Fetching welcome video for yacht:', scannedYachtId);
          const { data: videoData, error: videoError } = await supabase
            .from('education_videos')
            .select('*')
            .eq('category', 'SignIn')
            .eq('yacht_id', scannedYachtId)
            .order('order_index', { ascending: true })
            .limit(1)
            .maybeSingle();

          console.log('[Dashboard QR] Video query result:', { videoData, videoError });

          if (!videoError && videoData) {
            console.log('[Dashboard QR] Setting welcome video:', videoData.title);
            console.log('[Dashboard QR] Video URL:', videoData.video_url);
            setWelcomeVideo(videoData);
            setShowWelcomeVideo(true);
          } else {
            console.log('[Dashboard QR] No video found or error occurred');
          }

          // For master users, also set the impersonated yacht
          if (userProfile?.role === 'master') {
            setImpersonatedYacht(scannedYacht);
            console.log('[Dashboard QR] Set impersonated yacht for master user');
          }
        }
      } catch (err) {
        console.error('[Dashboard QR] Error handling QR scanned yacht:', err);
      } finally {
        localStorage.removeItem('qr_scanned_yacht_id');
        console.log('[Dashboard QR] Removed yacht ID from localStorage');
      }
    };

    handleQRScannedYacht();
  }, [user, userProfile]);

  useEffect(() => {
    loadBookings();
    loadMaintenanceRequests();
    loadVideos();
    loadWelcomeVideo();
    loadUsers();
    loadRepairRequests();
    loadChatMessages();
    loadAdminNotifications();
    loadMasterCalendar();
    loadAllYachts();
    loadMechanics();
    loadCustomers();
    loadStaffMessages();
    checkSmartDevices();
  }, [user, yacht, effectiveRole, effectiveYacht, impersonatedYacht]);

  useEffect(() => {
    if (activeTab === 'admin' && adminView === 'repairs') {
      loadRepairRequests();
    }
    if (activeTab === 'trip') {
      checkSmartDevices();
    }
  }, [activeTab, adminView]);

  // Set up realtime subscription for yacht_invoices to track email engagement
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('yacht_invoices_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'yacht_invoices',
        },
        (payload) => {
          const updatedInvoice = payload.new as YachtInvoice;

          // Update the repairInvoices state with the new data
          setRepairInvoices((prev) => {
            if (updatedInvoice.repair_request_id) {
              return {
                ...prev,
                [updatedInvoice.repair_request_id]: updatedInvoice,
              };
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  // Set up realtime subscription for staff_messages to track new bulk emails and updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('staff_messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'staff_messages',
        },
        () => {
          loadStaffMessages();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  const loadBookings = async () => {
    const userIsStaff = isStaffRole(effectiveRole);
    const userIsManager = isManagerRole(effectiveRole);

    // Staff can access without a yacht, owners/managers need a yacht
    if (!user || (!effectiveYacht && !userIsStaff)) {
      setLoading(false);
      return;
    }

    try {
      // For owners, only show their bookings. For managers, show yacht bookings. For staff, show all bookings
      let query = supabase
        .from('yacht_bookings')
        .select(`
          *,
          user_profiles!yacht_bookings_user_id_user_profiles_fkey (
            first_name,
            last_name,
            email
          ),
          yacht_booking_owners (
            id,
            owner_name,
            owner_contact,
            created_at
          )
        `);

      // Managers see all bookings for their assigned yacht
      if (userIsManager && effectiveYacht) {
        query = query.eq('yacht_id', effectiveYacht.id);
      }

      // Owners see only their own bookings for their yacht
      if (!userIsStaff && !userIsManager && effectiveYacht) {
        query = query.eq('yacht_id', effectiveYacht.id).eq('user_id', user.id);
      }

      const { data, error } = await query.order('start_date', { ascending: false });

      if (error) {
        console.error('Error loading bookings:', error);
        throw error;
      }
      setBookings(data || []);

      // Find active or upcoming booking (current trip or next scheduled trip)
      const now = new Date();
      const userBookings = data?.filter(booking => booking.user_id === user.id) || [];

      // First try to find an active booking (currently ongoing)
      let current = userBookings.find(booking => {
        const start = new Date(booking.start_date);
        const end = new Date(booking.end_date);
        return now >= start && now <= end;
      });

      // If no active booking, find the next upcoming booking
      if (!current) {
        const upcomingBookings = userBookings
          .filter(booking => new Date(booking.start_date) > now)
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
        current = upcomingBookings[0] || null;
      }

      setActiveBooking(current || null);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceRequests = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('repair_requests')
        .select(`
          *,
          yachts:yacht_id (name)
        `);

      // When impersonating a yacht, filter by that yacht (for all roles)
      if (isImpersonatingYacht && effectiveYacht) {
        // User is impersonating - show only this yacht's requests
        query = query.eq('yacht_id', effectiveYacht.id);
      } else if (['staff', 'mechanic', 'master'].includes(effectiveRole)) {
        // Staff, mechanic, and master (not impersonating) see all requests
        // No filter - show all requests
      } else if (effectiveRole === 'manager' && effectiveYacht) {
        // Managers see requests for their assigned yacht
        query = query.eq('yacht_id', effectiveYacht.id);
      } else if (isOwnerRole(effectiveRole) && effectiveYacht) {
        // Owners see all requests for their yacht
        query = query.eq('yacht_id', effectiveYacht.id);
      } else {
        // Others see only their own
        query = query.eq('submitted_by', user.id);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user profiles separately for each request
      const requestsWithUsers = await Promise.all(
        (data || []).map(async (request: any) => {
          const { data: userProfileData } = await supabase
            .from('user_profiles')
            .select('first_name, last_name')
            .eq('user_id', request.submitted_by)
            .maybeSingle();

          return {
            ...request,
            subject: request.title,
            user_id: request.submitted_by,
            first_name: userProfileData?.first_name,
            last_name: userProfileData?.last_name,
            yacht_name: request.yachts?.name,
            yachts: undefined
          };
        })
      );

      setMaintenanceRequests(requestsWithUsers || []);
    } catch (error) {
      console.error('Error loading maintenance requests:', error);
    }
  };

  const checkSmartDevices = async () => {
    if (!effectiveYacht) {
      setHasSmartDevices(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('yacht_smart_devices')
        .select('id')
        .eq('yacht_id', effectiveYacht.id)
        .eq('is_active', true)
        .limit(1);

      if (error) throw error;

      setHasSmartDevices(data && data.length > 0);
    } catch (error) {
      console.error('Error checking smart devices:', error);
      setHasSmartDevices(false);
    }
  };

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('education_videos')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setVideos(data || []);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const loadWelcomeVideo = async () => {
    try {
      const { data, error } = await supabase
        .from('education_videos')
        .select('*')
        .eq('category', 'Welcome')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setWelcomeVideo(data);
    } catch (error) {
      console.error('Error loading welcome video:', error);
    }
  };

  const uploadLargeVideoChunked = async (file: File): Promise<string> => {
    console.log('Starting chunked video upload for file:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

    // Refresh session to get a fresh token
    const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();

    if (sessionError || !session) {
      console.error('Session refresh failed:', sessionError);
      throw new Error('Unable to authenticate. Please log out and log back in.');
    }

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    console.log(`Splitting into ${totalChunks} chunks of ${(CHUNK_SIZE / 1024 / 1024).toFixed(2)}MB each`);

    const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-large-video`;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append('yachtId', effectiveYacht!.id);
      formData.append('fileName', file.name);
      formData.append('chunkIndex', i.toString());
      formData.append('totalChunks', totalChunks.toString());
      formData.append('chunk', chunk, `chunk-${i}`);
      formData.append('mimeType', file.type);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to upload chunk ${i + 1}`);
      }

      const percentage = Math.round(((i + 1) / totalChunks) * 95);
      console.log(`Uploaded chunk ${i + 1}/${totalChunks} (${percentage}%)`);
      setVideoUploadProgress({
        progress: percentage,
        status: 'uploading'
      });

      // If this was the last chunk, get the final URL from the response
      if (i === totalChunks - 1) {
        const result = await response.json();
        console.log('Upload complete, final URL:', result.url);
        return result.url;
      }
    }

    throw new Error('Upload completed but no URL returned');
  };

  const handleUploadVideo = async () => {
    if (!videoFile || !user || !yacht) {
      setUploadError('Please select a video file');
      return;
    }

    if (!videoUploadForm.title || !videoUploadForm.category) {
      setUploadError('Please fill in all required fields');
      return;
    }

    if (!videoFile.type.startsWith('video/')) {
      setUploadError('Please select a valid video file (MP4, MOV, etc.)');
      return;
    }

    try {
      setUploadError('');
      setVideoUploadProgress({ progress: 0, status: 'uploading' });

      let videoUrl: string;

      // Use chunked upload for large files (over 50MB)
      if (videoFile.size > 50 * 1024 * 1024) {
        videoUrl = await uploadLargeVideoChunked(videoFile);
      } else {
        const videoFileName = `${Date.now()}-${videoFile.name}`;
        const videoPath = `${effectiveYacht.id}/${videoFileName}`;
        videoUrl = await uploadFileToStorage(
          'education-videos',
          videoPath,
          videoFile,
          (progress) => setVideoUploadProgress(progress)
        );
      }

      let thumbnailUrl = null;
      if (thumbnailFile) {
        const thumbnailFileName = `${Date.now()}-thumbnail-${thumbnailFile.name}`;
        const thumbnailPath = `${effectiveYacht.id}/${thumbnailFileName}`;
        thumbnailUrl = await uploadFileToStorage(
          'education-videos',
          thumbnailPath,
          thumbnailFile
        );
      }

      const { error: insertError } = await supabase
        .from('education_videos')
        .insert({
          title: videoUploadForm.title,
          description: videoUploadForm.description,
          category: videoUploadForm.category,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          yacht_id: effectiveYacht.id,
          order_index: videoUploadForm.order_index,
        });

      if (insertError) throw insertError;

      setVideoUploadProgress({ progress: 100, status: 'complete' });

      await loadVideos();

      setShowVideoUploadModal(false);
      setVideoFile(null);
      setThumbnailFile(null);
      setVideoUploadForm({
        title: '',
        description: '',
        category: '',
        order_index: 0,
      });
      setVideoUploadProgress(null);
    } catch (error: any) {
      console.error('Error uploading video:', error);

      const isAuthError = isTokenExpiredError(error);
      let errorMessage = error.message || 'Failed to upload video';

      if (isAuthError) {
        errorMessage = 'Your session has expired. Please log out and log back in to continue uploading.';
      }

      setUploadError(errorMessage);
      setVideoUploadProgress({ progress: 0, status: 'error', error: errorMessage, isAuthError });
    }
  };

  const handleEnterEditMode = () => {
    const editData: {[key: string]: {title: string; description: string; category: string; order_index: number}} = {};
    videos.forEach(video => {
      editData[video.id] = {
        title: video.title,
        description: video.description,
        category: video.category,
        order_index: video.order_index
      };
    });
    setEditingVideos(editData);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingVideos({});
    setEditingThumbnails({});
  };

  const handleSaveVideos = async () => {
    try {
      for (const videoId in editingVideos) {
        let { title, description, category, order_index, thumbnail_url } = editingVideos[videoId];

        // If there's a new thumbnail file, upload it first
        if (editingThumbnails[videoId]) {
          const file = editingThumbnails[videoId];
          const fileExt = file.name.split('.').pop();
          const fileName = `${videoId}-${Date.now()}.${fileExt}`;
          const filePath = `thumbnails/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('education-videos')
            .upload(filePath, file, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('education-videos')
            .getPublicUrl(filePath);

          thumbnail_url = publicUrl;
        }

        const { error } = await supabase
          .from('education_videos')
          .update({ title, description, category, order_index, thumbnail_url, updated_at: new Date().toISOString() })
          .eq('id', videoId);

        if (error) throw error;
      }

      await loadVideos();
      setEditMode(false);
      setEditingVideos({});
      setEditingThumbnails({});
    } catch (error) {
      console.error('Error saving videos:', error);
      alert('Failed to save changes');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) return;

    try {
      const { error } = await supabase
        .from('education_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;

      await loadVideos();
      if (editMode) {
        const newEditingVideos = { ...editingVideos };
        delete newEditingVideos[videoId];
        setEditingVideos(newEditingVideos);
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Failed to delete video');
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          phone,
          email,
          trip_number,
          street,
          city,
          state,
          zip_code,
          yacht_id,
          role,
          email_notifications_enabled,
          sms_notifications_enabled,
          notification_email,
          notification_phone,
          secondary_email,
          last_sign_in_at,
          last_sign_out_at,
          is_active,
          yachts (name)
        `)
        .order('first_name', { ascending: true });

      if (error) throw error;
      setAllUsers(data || []);

      const ownerCounts: Record<string, number> = {};
      (data || []).forEach((user: UserProfile) => {
        if (user.role === 'owner' && user.yacht_id) {
          ownerCounts[user.yacht_id] = (ownerCounts[user.yacht_id] || 0) + 1;
        }
      });
      setOwnerCountsByYacht(ownerCounts);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleUserEdit = (user: any) => {
    setSelectedUser(user);
    setIsCreatingNewUser(false);
    setSelectedUserGroup(null);
    setUserEditForm({
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      password: '',
      trip_number: user.trip_number || '',
      phone: user.phone || '',
      street: user.street || '',
      city: user.city || '',
      state: user.state || '',
      zip_code: user.zip_code || '',
      yacht_id: user.yacht_id || '',
      role: user.role || 'owner',
      employee_type: user.employee_type || 'hourly',
      email_notifications_enabled: user.email_notifications_enabled !== undefined ? user.email_notifications_enabled : true,
      sms_notifications_enabled: user.sms_notifications_enabled !== undefined ? user.sms_notifications_enabled : false,
      notification_email: user.notification_email || '',
      notification_phone: user.notification_phone || '',
      secondary_email: user.secondary_email || '',
      can_approve_repairs: user.can_approve_repairs || false,
      can_approve_billing: user.can_approve_billing || false
    });
    setUserError('');
    setUserSuccess('');
  };

  const handleUserDelete = async (userToDelete: any) => {
    if (!confirm(`Are you sure you want to deactivate ${userToDelete.first_name} ${userToDelete.last_name}? This will remove them from the active user list.`)) {
      return;
    }

    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ is_active: false })
        .eq('user_id', userToDelete.user_id);

      if (profileError) throw profileError;

      if (userToDelete.yacht_id) {
        await logYachtActivity(
          userToDelete.yacht_id,
          'user_deactivated',
          `User deactivated: ${userToDelete.first_name} ${userToDelete.last_name}`,
          user?.id
        );
      }

      await loadUsers();
      alert('User deactivated successfully.');
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      alert('Failed to deactivate user: ' + (error.message || 'Unknown error'));
    }
  };

  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    setUserLoading(true);
    setUserError('');
    setUserSuccess('');

    try {
      if (isCreatingNewUser) {
        if (!userEditForm.password || userEditForm.password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        // First check if a profile already exists for this email
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('email', userEditForm.email)
          .maybeSingle();

        let userId: string;

        if (existingProfile) {
          // Profile exists, just update it
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({
              first_name: userEditForm.first_name,
              last_name: userEditForm.last_name,
              phone: userEditForm.phone,
              trip_number: userEditForm.trip_number || null,
              street: userEditForm.street,
              city: userEditForm.city,
              state: userEditForm.state,
              zip_code: userEditForm.zip_code,
              yacht_id: userEditForm.yacht_id || null,
              role: userEditForm.role,
              employee_type: userEditForm.employee_type,
              email_notifications_enabled: userEditForm.email_notifications_enabled,
              sms_notifications_enabled: userEditForm.sms_notifications_enabled,
              notification_email: userEditForm.notification_email || null,
              notification_phone: userEditForm.notification_phone || null,
              secondary_email: userEditForm.secondary_email || null,
              can_approve_repairs: userEditForm.can_approve_repairs || false,
              can_approve_billing: userEditForm.can_approve_billing || false,
              must_change_password: true
            })
            .eq('user_id', existingProfile.user_id);

          if (updateError) throw updateError;
          userId = existingProfile.user_id;
          setUserSuccess('User profile restored and updated successfully!');
        } else {
          // Create new user using edge function (does not sign them in)
          const createUserUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;
          const { data: { session } } = await supabase.auth.getSession();

          const response = await fetch(createUserUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: userEditForm.email,
              password: userEditForm.password,
              first_name: userEditForm.first_name,
              last_name: userEditForm.last_name,
              phone: userEditForm.phone,
              trip_number: userEditForm.trip_number || null,
              street: userEditForm.street,
              city: userEditForm.city,
              state: userEditForm.state,
              zip_code: userEditForm.zip_code,
              yacht_id: userEditForm.yacht_id || null,
              role: userEditForm.role,
              employee_type: userEditForm.employee_type,
              email_notifications_enabled: userEditForm.email_notifications_enabled,
              sms_notifications_enabled: userEditForm.sms_notifications_enabled,
              notification_email: userEditForm.notification_email || null,
              notification_phone: userEditForm.notification_phone || null,
              secondary_email: userEditForm.secondary_email || null,
              can_approve_repairs: userEditForm.can_approve_repairs || false,
              can_approve_billing: userEditForm.can_approve_billing || false
            })
          });

          if (!response.ok) {
            const errorData = await response.json();

            // If user already exists, try to restore their profile
            if (errorData.error?.includes('already') || errorData.error?.includes('exists')) {
              try {
                const restoreUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-user-profile`;
                const restoreResponse = await fetch(restoreUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    email: userEditForm.email,
                    first_name: userEditForm.first_name,
                    last_name: userEditForm.last_name,
                    phone: userEditForm.phone,
                    trip_number: userEditForm.trip_number || null,
                    street: userEditForm.street,
                    city: userEditForm.city,
                    state: userEditForm.state,
                    zip_code: userEditForm.zip_code,
                    yacht_id: userEditForm.yacht_id || null,
                    role: userEditForm.role,
                    employee_type: userEditForm.employee_type,
                    can_approve_repairs: userEditForm.can_approve_repairs || false,
                    can_approve_billing: userEditForm.can_approve_billing || false
                  })
                });

                if (!restoreResponse.ok) {
                  const restoreError = await restoreResponse.json();
                  throw new Error(restoreError.error || 'Failed to restore user profile');
                }

                if (userEditForm.yacht_id) {
                  await logYachtActivity(
                    userEditForm.yacht_id,
                    'user_restored',
                    `User profile restored: ${userEditForm.first_name} ${userEditForm.last_name}`,
                    user?.id
                  );
                }

                setUserSuccess('User profile restored successfully!');
                await loadUsers();
                setUserLoading(false);
                setTimeout(() => {
                  setSelectedUser(null);
                  setIsCreatingNewUser(false);
                  setSelectedUserGroup(null);
                  setUserSuccess('');
                }, 2000);

                return;
              } catch (restoreError: any) {
                throw new Error(`Failed to restore user: ${restoreError.message}`);
              }
            }

            throw new Error(errorData.error || 'Failed to create user');
          }

          const result = await response.json();
          userId = result.user_id;
          setUserSuccess('User created successfully!');
        }

        if (userEditForm.yacht_id) {
          await logYachtActivity(
            userEditForm.yacht_id,
            'user_created',
            `New user created: ${userEditForm.first_name} ${userEditForm.last_name}`,
            user?.id
          );
        }
      } else {
        if (!selectedUser) return;

        const { error } = await supabase
          .from('user_profiles')
          .update({
            first_name: userEditForm.first_name,
            last_name: userEditForm.last_name,
            email: userEditForm.email,
            phone: userEditForm.phone,
            trip_number: userEditForm.trip_number || null,
            street: userEditForm.street,
            city: userEditForm.city,
            state: userEditForm.state,
            zip_code: userEditForm.zip_code,
            yacht_id: userEditForm.yacht_id || null,
            role: userEditForm.role,
            email_notifications_enabled: userEditForm.email_notifications_enabled,
            sms_notifications_enabled: userEditForm.sms_notifications_enabled,
            notification_email: userEditForm.notification_email || null,
            notification_phone: userEditForm.notification_phone || null,
            secondary_email: userEditForm.secondary_email || null,
            can_approve_repairs: userEditForm.can_approve_repairs || false,
            can_approve_billing: userEditForm.can_approve_billing || false
          })
          .eq('user_id', selectedUser.user_id);

        if (error) throw error;

        await logYachtActivity(
          userEditForm.yacht_id || selectedUser.yacht_id,
          'user_updated',
          `User profile updated for ${userEditForm.first_name} ${userEditForm.last_name}`,
          user?.id
        );

        setUserSuccess('User updated successfully!');
      }

      await loadUsers();
      setTimeout(() => {
        setSelectedUser(null);
        setIsCreatingNewUser(false);
        setSelectedUserGroup(null);
        setUserSuccess('');
      }, 2000);
    } catch (error: any) {
      console.error('Error saving user:', error);
      setUserError(error.message || `Failed to ${isCreatingNewUser ? 'create' : 'update'} user`);
    } finally {
      setUserLoading(false);
    }
  };

  const handleOpenProfileEdit = () => {
    if (userProfile) {
      setProfileEditForm({
        first_name: userProfile.first_name || '',
        last_name: userProfile.last_name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        street: userProfile.street || '',
        city: userProfile.city || '',
        state: userProfile.state || '',
        zip_code: userProfile.zip_code || '',
        secondary_email: userProfile.secondary_email || '',
        email_notifications_enabled: userProfile.email_notifications_enabled || false,
        notification_email: userProfile.notification_email || ''
      });
      setShowProfileEdit(true);
      setProfileEditError('');
      setProfileEditSuccess('');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileEditLoading(true);
    setProfileEditError('');
    setProfileEditSuccess('');

    try {
      if (!user || !userProfile) throw new Error('User not found');

      const emailChanged = profileEditForm.email !== userProfile.email;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          first_name: profileEditForm.first_name,
          last_name: profileEditForm.last_name,
          email: profileEditForm.email,
          phone: profileEditForm.phone,
          street: profileEditForm.street,
          city: profileEditForm.city,
          state: profileEditForm.state,
          zip_code: profileEditForm.zip_code,
          secondary_email: profileEditForm.secondary_email || null,
          email_notifications_enabled: profileEditForm.email_notifications_enabled,
          notification_email: profileEditForm.notification_email || null
        })
        .eq('user_id', user.id);

      if (profileError) throw profileError;

      if (emailChanged) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profileEditForm.email
        });

        if (emailError) throw emailError;

        setNewEmailAddress(profileEditForm.email);
        setShowEmailChangeConfirm(true);
      }

      setProfileEditSuccess('Profile updated successfully!');

      await refreshProfile();

      if (!emailChanged) {
        setTimeout(() => {
          setShowProfileEdit(false);
          setProfileEditSuccess('');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setProfileEditError(error.message || 'Failed to update profile');
    } finally {
      setProfileEditLoading(false);
    }
  };

  const loadAllYachts = async () => {
    try {
      let query = supabase
        .from('yachts')
        .select('*');

      // Master role: see ALL yachts (active and inactive)
      if (isMasterRole(effectiveRole)) {
        // No filter - master sees everything
      }
      // Manager role: see only their assigned yacht (or impersonated yacht)
      else if (effectiveRole === 'manager') {
        if (effectiveYacht?.id) {
          query = query.eq('id', effectiveYacht.id).eq('is_active', true);
        } else {
          setAllYachts([]);
          return;
        }
      }
      // Staff/Mechanic: see all active yachts
      else {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        console.error('Error loading yachts:', error);
        throw error;
      }
      setAllYachts(data || []);
    } catch (error) {
      console.error('Error loading yachts:', error);
    }
  };

  const loadMechanics = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, user_id, first_name, last_name, email, role')
        .in('role', ['mechanic', 'staff', 'manager', 'master'])
        .order('first_name', { ascending: true});

      if (error) throw error;
      setMechanics(data || []);
    } catch (error) {
      console.error('Error loading mechanics:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadCustomerVessels = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('customer_vessels')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('vessel_name', { ascending: true });

      if (error) throw error;
      setCustomerVessels(data || []);
    } catch (error) {
      console.error('Error loading customer vessels:', error);
      setCustomerVessels([]);
    }
  };

  const loadYachtHistory = async (yachtId: string) => {
    try {
      const { data, error } = await supabase
        .from('yacht_history_logs')
        .select('*')
        .eq('yacht_id', yachtId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setYachtHistoryLogs(prev => ({ ...prev, [yachtId]: data || [] }));
    } catch (error) {
      console.error('Error loading yacht history:', error);
    }
  };

  const toggleYachtHistory = async (yachtId: string) => {
    if (expandedYachtId === yachtId) {
      setExpandedYachtId(null);
    } else {
      setExpandedYachtId(yachtId);
      if (!yachtHistoryLogs[yachtId]) {
        await loadYachtHistory(yachtId);
      }
    }
  };

  const loadYachtTrips = async (yachtId: string) => {
    try {
      const { data, error } = await supabase
        .from('yacht_bookings')
        .select(`
          *,
          user_profiles(trip_number, first_name, last_name, phone, email),
          yacht_booking_owners (
            id,
            owner_name,
            owner_contact,
            created_at
          )
        `)
        .eq('yacht_id', yachtId)
        .order('start_date', { ascending: true });

      if (error) throw error;

      setYachtTrips(prev => ({
        ...prev,
        [yachtId]: data || []
      }));
    } catch (error) {
      console.error('Error loading yacht trips:', error);
    }
  };

  const toggleYachtTrips = async (yachtId: string) => {
    if (tripsYachtId === yachtId) {
      setTripsYachtId(null);
    } else {
      setTripsYachtId(yachtId);
      if (!yachtTrips[yachtId]) {
        await loadYachtTrips(yachtId);
      }
    }
  };

  const loadYachtDocuments = async (yachtId: string) => {
    try {
      const { data, error } = await supabase
        .from('yacht_documents')
        .select('*')
        .eq('yacht_id', yachtId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setYachtDocuments(prev => ({
        ...prev,
        [yachtId]: data || []
      }));
    } catch (error) {
      console.error('Error loading yacht documents:', error);
    }
  };

  const loadYachtInvoices = async (yachtId: string) => {
    try {
      const { data, error } = await supabase
        .from('yacht_invoices')
        .select('*')
        .eq('yacht_id', yachtId)
        .order('invoice_date', { ascending: false });

      if (error) throw error;

      setYachtInvoices(prev => ({
        ...prev,
        [yachtId]: data || []
      }));
    } catch (error) {
      console.error('Error loading yacht invoices:', error);
    }
  };

  const toggleYachtInvoices = async (yachtId: string) => {
    if (invoiceYachtId === yachtId) {
      setInvoiceYachtId(null);
    } else {
      setInvoiceYachtId(yachtId);
      if (!yachtInvoices[yachtId]) {
        await loadYachtInvoices(yachtId);
      }
      await loadYachtBudget(yachtId, selectedInvoiceYear);
    }
  };

  const loadVesselAgreements = async (yachtId: string, forceRefresh = false) => {
    try {
      const query = supabase
        .from('vessel_management_agreements')
        .select('*')
        .eq('yacht_id', yachtId)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      // Filter out draft agreements if there's an approved agreement
      let filteredAgreements = data || [];
      const hasApprovedAgreement = filteredAgreements.some(a => a.status === 'approved');

      if (hasApprovedAgreement) {
        filteredAgreements = filteredAgreements.filter(a => a.status !== 'draft');
      }

      setVesselAgreements(prev => ({
        ...prev,
        [yachtId]: filteredAgreements
      }));
    } catch (error) {
      console.error('Error loading vessel agreements:', error);
    }
  };

  const toggleVesselAgreements = async (yachtId: string) => {
    if (agreementYachtId === yachtId) {
      setAgreementYachtId(null);
      setShowAgreementForm(false);
      setSelectedAgreement(null);
    } else {
      setAgreementYachtId(yachtId);
      if (!vesselAgreements[yachtId]) {
        await loadVesselAgreements(yachtId);
      }
      if (isManagerRole(effectiveRole) && !hasSubmittedAgreement(yachtId)) {
        setSelectedAgreement(null);
        setShowAgreementForm(true);
      }
    }
  };

  const handleAgreementSuccess = async () => {
    setShowAgreementForm(false);
    setSelectedAgreement(null);
    if (agreementYachtId) {
      await loadVesselAgreements(agreementYachtId);
      if (isManagerRole(effectiveRole) && hasSubmittedAgreement(agreementYachtId)) {
        setAgreementYachtId(null);
      }
    }
  };

  const getAgreementStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-slate-600/30 text-slate-400';
      case 'pending_approval': return 'bg-yellow-500/20 text-yellow-500';
      case 'approved': return 'bg-emerald-500/20 text-emerald-500';
      case 'rejected': return 'bg-red-500/20 text-red-500';
      case 'expired': return 'bg-slate-600/30 text-slate-500';
      default: return 'bg-slate-600/30 text-slate-400';
    }
  };

  const hasSubmittedAgreement = (yachtId: string) => {
    const agreements = vesselAgreements[yachtId];
    if (!agreements || agreements.length === 0) {
      return false;
    }
    return agreements.some(agreement =>
      agreement.status === 'pending_approval' ||
      agreement.status === 'approved'
    );
  };

  const shouldShowAgreementsButton = (yachtId: string) => {
    if (canAccessAllYachts(effectiveRole)) {
      return true;
    }
    if (isManagerRole(effectiveRole)) {
      const agreements = vesselAgreements[yachtId];
      if (!agreements) {
        return true;
      }
      return !hasSubmittedAgreement(yachtId);
    }
    return false;
  };

  const getAgreementStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'pending_approval': return 'Pending';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'expired': return 'Expired';
      default: return status;
    }
  };

  const loadYachtBudget = async (yachtId: string, year: number) => {
    try {
      const { data, error } = await supabase
        .from('yacht_budgets')
        .select('*')
        .eq('yacht_id', yachtId)
        .eq('budget_year', year)
        .maybeSingle();

      if (error) throw error;

      setYachtBudgets(prev => ({
        ...prev,
        [`${yachtId}-${year}`]: data || null
      }));

      if (data) {
        setBudgetBreakdownInput({
          management_fees: data.management_fees?.toString() || '0',
          trip_inspection_fees: data.trip_inspection_fees?.toString() || '0',
          spring_startup_cost: data.spring_startup_cost?.toString() || '0',
          oil_change_200hr: data.oil_change_200hr?.toString() || '0',
          oil_change_600hr: data.oil_change_600hr?.toString() || '0',
          preventive_maintenance: data.preventive_maintenance?.toString() || '0',
          winter_repairs_upgrades: data.winter_repairs_upgrades?.toString() || '0',
          winterizations: data.winterizations?.toString() || '0',
          water_filters: data.water_filters?.toString() || '0',
          misc_1: data.misc_1?.toString() || '0',
          misc_1_notes: data.misc_1_notes || '',
          misc_2: data.misc_2?.toString() || '0',
          misc_2_notes: data.misc_2_notes || ''
        });
      } else {
        setBudgetBreakdownInput({
          management_fees: '',
          trip_inspection_fees: '',
          spring_startup_cost: '',
          oil_change_200hr: '',
          oil_change_600hr: '',
          preventive_maintenance: '',
          winter_repairs_upgrades: '',
          winterizations: '',
          water_filters: '',
          misc_1: '',
          misc_1_notes: '',
          misc_2: '',
          misc_2_notes: ''
        });
      }
    } catch (error) {
      console.error('Error loading yacht budget:', error);
    }
  };

  const saveBudget = async (yachtId: string, year: number) => {
    if (!user) return;

    const budgetKey = `${yachtId}-${year}`;
    setBudgetSaving(prev => ({ ...prev, [budgetKey]: true }));

    try {
      const managementFees = parseFloat(budgetBreakdownInput.management_fees) || 0;
      const tripInspectionFees = parseFloat(budgetBreakdownInput.trip_inspection_fees) || 0;
      const springStartupCost = parseFloat(budgetBreakdownInput.spring_startup_cost) || 0;
      const oilChange200hr = parseFloat(budgetBreakdownInput.oil_change_200hr) || 0;
      const oilChange600hr = parseFloat(budgetBreakdownInput.oil_change_600hr) || 0;
      const preventiveMaintenance = parseFloat(budgetBreakdownInput.preventive_maintenance) || 0;
      const winterRepairsUpgrades = parseFloat(budgetBreakdownInput.winter_repairs_upgrades) || 0;
      const winterizations = parseFloat(budgetBreakdownInput.winterizations) || 0;
      const waterFilters = parseFloat(budgetBreakdownInput.water_filters) || 0;
      const misc1 = parseFloat(budgetBreakdownInput.misc_1) || 0;
      const misc2 = parseFloat(budgetBreakdownInput.misc_2) || 0;

      if (
        managementFees < 0 || tripInspectionFees < 0 || springStartupCost < 0 ||
        oilChange200hr < 0 || oilChange600hr < 0 || preventiveMaintenance < 0 ||
        winterRepairsUpgrades < 0 || winterizations < 0 || waterFilters < 0 || misc1 < 0 || misc2 < 0
      ) {
        alert('Please enter valid budget amounts (no negative values)');
        return;
      }

      const totalBudget = managementFees + tripInspectionFees + springStartupCost +
        oilChange200hr + oilChange600hr + preventiveMaintenance +
        winterRepairsUpgrades + winterizations + waterFilters + misc1 + misc2;

      const existingBudget = yachtBudgets[budgetKey];

      const budgetData = {
        management_fees: managementFees,
        trip_inspection_fees: tripInspectionFees,
        spring_startup_cost: springStartupCost,
        oil_change_200hr: oilChange200hr,
        oil_change_600hr: oilChange600hr,
        preventive_maintenance: preventiveMaintenance,
        winter_repairs_upgrades: winterRepairsUpgrades,
        winterizations: winterizations,
        water_filters: waterFilters,
        misc_1: misc1,
        misc_1_notes: budgetBreakdownInput.misc_1_notes,
        misc_2: misc2,
        misc_2_notes: budgetBreakdownInput.misc_2_notes,
        budget_amount: totalBudget,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };

      if (existingBudget) {
        const { error } = await supabase
          .from('yacht_budgets')
          .update(budgetData)
          .eq('id', existingBudget.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('yacht_budgets')
          .insert({
            yacht_id: yachtId,
            budget_year: year,
            ...budgetData,
            created_by: user.id
          });

        if (error) throw error;
      }

      await loadYachtBudget(yachtId, year);
      setBudgetEditMode(prev => ({ ...prev, [budgetKey]: false }));
    } catch (error: any) {
      console.error('Error saving budget:', error);
      alert(`Error saving budget: ${error.message}`);
    } finally {
      setBudgetSaving(prev => ({ ...prev, [budgetKey]: false }));
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    setPaymentProcessing(prev => ({ ...prev, [invoiceId]: true }));

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-invoice-payment`;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoiceId }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create payment');
      }

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      }
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setPaymentProcessing(prev => ({ ...prev, [invoiceId]: false }));
    }
  };

  const handleDocumentUpload = async (yachtId: string) => {
    if (!user || !documentForm.document_name) {
      setDocumentError('Please enter a document name');
      return;
    }

    if (!selectedFile && !documentForm.file_url) {
      setDocumentError('Please select a file or enter a URL');
      return;
    }

    setDocumentLoading(true);
    setDocumentError('');

    try {
      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || 'Unknown';

      let fileUrl = documentForm.file_url;

      if (selectedFile) {
        fileUrl = await uploadFileToStorage(selectedFile, user.id, setUploadProgress);
      }

      const { error } = await supabase.from('yacht_documents').insert({
        yacht_id: yachtId,
        document_name: documentForm.document_name,
        file_url: fileUrl,
        notes: documentForm.notes,
        uploaded_by: user.id,
        uploaded_by_name: userName
      });

      if (error) throw error;

      const yacht = allYachts.find(y => y.id === yachtId);
      if (yacht) {
        await logYachtActivity(
          yachtId,
          yacht.name,
          `Document "${documentForm.document_name}" uploaded`,
          user.id,
          userName
        );
      }

      setDocumentForm({ document_name: '', file_url: '', notes: '' });
      setSelectedFile(null);
      setUploadProgress({ progress: 0, status: 'idle' });
      setUseManualUrl(false);
      setShowDocumentForm(false);
      await loadYachtDocuments(yachtId);
    } catch (err: any) {
      setDocumentError(err.message || 'Failed to upload document');
    } finally {
      setDocumentLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string, yachtId: string, documentName: string, fileUrl: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      if (isStorageUrl(fileUrl)) {
        await deleteFileFromStorage(fileUrl);
      }

      const { error } = await supabase
        .from('yacht_documents')
        .delete()
        .eq('id', documentId);

      if (error) throw error;

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || 'Unknown';

      const yacht = allYachts.find(y => y.id === yachtId);
      if (yacht) {
        await logYachtActivity(
          yachtId,
          yacht.name,
          `Document "${documentName}" deleted`,
          user?.id,
          userName
        );
      }

      await loadYachtDocuments(yachtId);
    } catch (err: any) {
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  const loadRepairRequests = async () => {
    try {
      if (!user) return;

      let query = supabase
        .from('repair_requests')
        .select(`
          *,
          yachts:yacht_id (name),
          yacht_invoices!repair_request_id (*),
          customers:customer_id (id, customer_type, first_name, last_name, business_name, email, phone),
          customer_vessels:vessel_id (id, vessel_name, manufacturer, model, year)
        `)
        .order('created_at', { ascending: false });

      // When impersonating a yacht, filter by that yacht (for all roles)
      if (isImpersonatingYacht && effectiveYacht) {
        // User is impersonating - show only this yacht's requests
        query = query.eq('yacht_id', effectiveYacht.id);
      } else if (['staff', 'mechanic', 'master'].includes(effectiveRole)) {
        // Staff, mechanic, and master (not impersonating) see all requests
        // No filter - show all requests
      } else if (isManagerRole(effectiveRole) && effectiveYacht) {
        // Managers see requests for their assigned yacht
        query = query.eq('yacht_id', effectiveYacht.id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading repair requests:', error);
        throw error;
      }

      // Enrich with completed_by user data (optimized to avoid N+1 queries)
      if (data && data.length > 0) {
        // Collect all unique completed_by IDs
        const completedByIds = [...new Set(
          data
            .filter(request => request.completed_by)
            .map(request => request.completed_by)
        )];

        // Fetch all user profiles in one query
        let userProfilesMap: { [userId: string]: any } = {};
        if (completedByIds.length > 0) {
          const { data: profiles } = await supabase
            .from('user_profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', completedByIds);

          if (profiles) {
            profiles.forEach(profile => {
              userProfilesMap[profile.user_id] = profile;
            });
          }
        }

        // Map profiles to requests and extract invoices
        const invoicesMap: { [repairRequestId: string]: YachtInvoice } = {};

        const enrichedRequests = data.map(request => {
          // Extract invoice from the joined data
          if (request.yacht_invoices && request.yacht_invoices.length > 0) {
            // Take the first invoice (should only be one per repair request)
            invoicesMap[request.id] = request.yacht_invoices[0];
          }

          return {
            ...request,
            completed_by_profile: request.completed_by ? userProfilesMap[request.completed_by] : null
          };
        });

        setRepairRequests(enrichedRequests);
        setRepairInvoices(invoicesMap);
      } else {
        setRepairRequests([]);
        setRepairInvoices({});
      }
    } catch (error) {
      console.error('Error loading repair requests:', error);
    }
  };

  const handleRepairApproval = async (notes?: string) => {
    if (!approvalAction) return;

    try {
      const { requestId, status } = approvalAction;

      const { data: request, error: fetchError } = await supabase
        .from('repair_requests')
        .select('yacht_id, title, submitted_by')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('repair_requests')
        .update({
          status,
          approved_by: user?.id,
          approval_notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId);

      if (error) throw error;

      if (request && user) {
        const statusText = status === 'approved' ? 'approved' : 'denied';
        const statusEmoji = status === 'approved' ? '✓' : '✗';

        try {
          await supabase.from('admin_notifications').insert({
            user_id: user.id,
            yacht_id: request.yacht_id,
            notification_type: 'repair_request',
            message: `Repair request ${statusText}: "${request.title}"`,
            reference_id: requestId
          });
        } catch (notificationError) {
          console.error('Error creating admin notification:', notificationError);
        }

        const userName = userProfile?.first_name && userProfile?.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : userProfile?.email || user.email || 'Staff';

        const ownerMessage = `Repair Request ${statusText === 'approved' ? 'Approved' : 'Denied'}: ${request.title}\n\n${statusEmoji} This repair request has been ${statusText} by ${userName}.${notes ? `\n\nNotes: ${notes}` : ''}`;

        try {
          const { error: chatError } = await supabase.from('owner_chat_messages').insert({
            yacht_id: request.yacht_id,
            user_id: user.id,
            message: ownerMessage
          });

          if (chatError) {
            console.error('Error creating owner chat message:', chatError);
          }
        } catch (chatError) {
          console.error('Error creating owner chat message:', chatError);
        }
      }

      await loadRepairRequests();
      await loadChatMessages();
      await loadAdminNotifications();

      setShowApprovalModal(false);
      setApprovalAction(null);
      setApprovalNotes('');
    } catch (error) {
      console.error('Error updating repair request:', error);
      alert('An error occurred while updating the repair request. Please try again.');
    }
  };

  const handleRepairCompletion = async (requestId: string) => {
    try {
      const { data: request, error: fetchError } = await supabase
        .from('repair_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      setSelectedRepairForInvoice(request);
      setInvoiceForm({
        final_invoice_amount: request.estimated_repair_cost || '',
        invoice_file: null,
        payment_method_type: 'card'
      });
      setIsAddingInvoiceToCompleted(false);
      setShowInvoiceModal(true);
    } catch (error) {
      console.error('Error loading repair request:', error);
    }
  };


  const handleAddInvoiceToCompletedRepairSubmit = async () => {
    if (!selectedRepairForInvoice || !user) return;

    setInvoiceLoading(true);
    try {
      let invoiceFileUrl = null;
      let invoiceFileName = null;

      if (invoiceForm.invoice_file) {
        const fileExt = invoiceForm.invoice_file.name.split('.').pop();
        const filePath = `${selectedRepairForInvoice.yacht_id}/${Date.now()}.${fileExt}`;
        invoiceFileName = invoiceForm.invoice_file.name;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice-files')
          .upload(filePath, invoiceForm.invoice_file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('invoice-files')
          .getPublicUrl(filePath);

        invoiceFileUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('repair_requests')
        .update({
          final_invoice_amount: invoiceForm.final_invoice_amount,
          invoice_file_url: invoiceFileUrl,
          invoice_file_name: invoiceFileName,
          billed_at: new Date().toISOString(),
          billed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRepairForInvoice.id);

      if (updateError) throw updateError;

      const invoiceYear = new Date().getFullYear();
      const invoiceAmountNumeric = parseFloat(invoiceForm.final_invoice_amount.replace(/[^0-9.-]+/g, ''));

      const { error: invoiceInsertError } = await supabase.from('yacht_invoices').insert({
        yacht_id: selectedRepairForInvoice.yacht_id,
        repair_request_id: selectedRepairForInvoice.id,
        invoice_amount: invoiceForm.final_invoice_amount,
        invoice_amount_numeric: isNaN(invoiceAmountNumeric) ? null : invoiceAmountNumeric,
        invoice_file_url: invoiceFileUrl,
        invoice_file_name: invoiceFileName,
        repair_title: selectedRepairForInvoice.title,
        payment_method_type: invoiceForm.payment_method_type,
        invoice_year: invoiceYear,
        invoice_date: new Date().toISOString(),
        completed_by: user.id
      });

      if (invoiceInsertError) {
        console.error('Error inserting invoice record:', invoiceInsertError);
      }

      await supabase.from('admin_notifications').insert({
        user_id: user.id,
        yacht_id: selectedRepairForInvoice.yacht_id,
        notification_type: 'repair_request',
        message: `Invoice added to completed repair: "${selectedRepairForInvoice.title}" - ${invoiceForm.final_invoice_amount}`,
        reference_id: selectedRepairForInvoice.id
      });

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || user.email || 'Staff';

      if (!selectedRepairForInvoice.is_retail_customer) {
        const ownerMessage = `Invoice Added to Repair: ${selectedRepairForInvoice.title}\n\n✓ An invoice has been added to this completed repair by ${userName}.\n\nFinal Invoice Amount: ${invoiceForm.final_invoice_amount}${invoiceFileName ? `\nInvoice File: ${invoiceFileName}` : ''}`;

        await supabase.from('owner_chat_messages').insert({
          yacht_id: selectedRepairForInvoice.yacht_id,
          user_id: user.id,
          message: ownerMessage
        });
      }

      const recipientEmail = selectedRepairForInvoice.customer_id && selectedRepairForInvoice.customers
        ? selectedRepairForInvoice.customers.email
        : selectedRepairForInvoice.is_retail_customer
        ? selectedRepairForInvoice.customer_email
        : null;

      if ((selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer) && recipientEmail) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const yacht = allYachts.find(y => y.id === selectedRepairForInvoice.yacht_id);

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-notification`;

          await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              managerEmails: [recipientEmail],
              repairTitle: selectedRepairForInvoice.title,
              yachtName: yacht?.name || 'Retail Service',
              invoiceAmount: invoiceForm.final_invoice_amount,
              invoiceFileUrl: invoiceFileUrl,
              completedBy: userName,
              isRetailCustomer: true,
              customerName: selectedRepairForInvoice.customers
                ? (selectedRepairForInvoice.customers.customer_type === 'business'
                  ? selectedRepairForInvoice.customers.business_name
                  : `${selectedRepairForInvoice.customers.first_name} ${selectedRepairForInvoice.customers.last_name}`)
                : selectedRepairForInvoice.customer_name
            })
          });
        } catch (emailError) {
          console.error('Failed to send email notification:', emailError);
        }
      } else {
        const { data: managers } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, email_address')
          .eq('yacht_id', selectedRepairForInvoice.yacht_id)
          .eq('role', 'manager');

        if (managers && managers.length > 0) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const yacht = allYachts.find(y => y.id === selectedRepairForInvoice.yacht_id);

            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-notification`;

            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                managerEmails: managers.map(m => m.email_address).filter(Boolean),
                repairTitle: selectedRepairForInvoice.title,
                yachtName: yacht?.name || 'Unknown Yacht',
                invoiceAmount: invoiceForm.final_invoice_amount,
                invoiceFileUrl: invoiceFileUrl,
                completedBy: userName
              })
            });
          } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
          }
        }
      }

      setShowInvoiceModal(false);
      setSelectedRepairForInvoice(null);
      setInvoiceForm({ final_invoice_amount: '', invoice_file: null, payment_method_type: 'card' });
      setIsEditingInvoice(false);
      setSelectedInvoiceForEdit(null);
      setIsAddingInvoiceToCompleted(false);
      await loadRepairRequests();
      await loadChatMessages();
      await loadAdminNotifications();
    } catch (error: any) {
      console.error('Error adding invoice:', error);
      alert(`Error: ${error.message || 'Failed to process invoice'}`);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleBillYachtManager = async () => {
    if (!selectedRepairForInvoice || !user) return;

    setInvoiceLoading(true);
    try {
      let invoiceFileUrl = null;
      let invoiceFileName = null;

      if (invoiceForm.invoice_file) {
        const fileExt = invoiceForm.invoice_file.name.split('.').pop();
        const filePath = `${selectedRepairForInvoice.yacht_id}/${Date.now()}.${fileExt}`;
        invoiceFileName = invoiceForm.invoice_file.name;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice-files')
          .upload(filePath, invoiceForm.invoice_file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('invoice-files')
          .getPublicUrl(filePath);

        invoiceFileUrl = urlData.publicUrl;
      }

      const { error: updateError } = await supabase
        .from('repair_requests')
        .update({
          status: 'completed',
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          final_invoice_amount: invoiceForm.final_invoice_amount,
          invoice_file_url: invoiceFileUrl,
          invoice_file_name: invoiceFileName,
          billed_at: new Date().toISOString(),
          billed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRepairForInvoice.id);

      if (updateError) throw updateError;

      const invoiceYear = new Date().getFullYear();
      const invoiceAmountNumeric = parseFloat(invoiceForm.final_invoice_amount.replace(/[^0-9.-]+/g, ''));

      const { data: newInvoice, error: invoiceInsertError } = await supabase.from('yacht_invoices').insert({
        yacht_id: selectedRepairForInvoice.yacht_id,
        repair_request_id: selectedRepairForInvoice.id,
        invoice_amount: invoiceForm.final_invoice_amount,
        invoice_amount_numeric: isNaN(invoiceAmountNumeric) ? null : invoiceAmountNumeric,
        invoice_file_url: invoiceFileUrl,
        invoice_file_name: invoiceFileName,
        repair_title: selectedRepairForInvoice.title,
        payment_method_type: invoiceForm.payment_method_type,
        invoice_year: invoiceYear,
        invoice_date: new Date().toISOString(),
        completed_by: user.id
      })
      .select()
      .single();

      if (invoiceInsertError) throw invoiceInsertError;

      const notificationMessage = (selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer)
        ? `Repair completed for walk-in customer: "${selectedRepairForInvoice.title}" - ${invoiceForm.final_invoice_amount}`
        : `Repair completed and invoice sent: "${selectedRepairForInvoice.title}" - ${invoiceForm.final_invoice_amount}`;

      await supabase.from('admin_notifications').insert({
        user_id: user.id,
        yacht_id: selectedRepairForInvoice.yacht_id,
        notification_type: 'repair_request',
        message: notificationMessage,
        reference_id: selectedRepairForInvoice.id
      });

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || user.email || 'Staff';

      if (!selectedRepairForInvoice.is_retail_customer) {
        const ownerMessage = `Repair Request Completed & Invoice Sent: ${selectedRepairForInvoice.title}\n\n✓ This repair has been completed by ${userName}.\n\nFinal Invoice Amount: ${invoiceForm.final_invoice_amount}${invoiceFileName ? `\nInvoice File: ${invoiceFileName}` : ''}`;

        await supabase.from('owner_chat_messages').insert({
          yacht_id: selectedRepairForInvoice.yacht_id,
          user_id: user.id,
          message: ownerMessage
        });

        const { data: managers } = await supabase
          .from('user_profiles')
          .select('user_id, first_name, last_name, email_address')
          .eq('yacht_id', selectedRepairForInvoice.yacht_id)
          .eq('role', 'manager');

        if (managers && managers.length > 0) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const yacht = allYachts.find(y => y.id === selectedRepairForInvoice.yacht_id);

            const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-notification`;

            await fetch(apiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                managerEmails: managers.map(m => m.email_address).filter(Boolean),
                repairTitle: selectedRepairForInvoice.title,
                yachtName: yacht?.name || 'Unknown Yacht',
                invoiceAmount: invoiceForm.final_invoice_amount,
                invoiceFileUrl: invoiceFileUrl,
                completedBy: userName
              })
            });
          } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
          }
        }
      }

      if (selectedRepairForInvoice.is_retail_customer && newInvoice) {
        try {
          const { data: { session } } = await supabase.auth.getSession();

          if (!session?.access_token) {
            throw new Error('No active session. Please sign in again.');
          }

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-invoice-payment`;

          const paymentResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoiceId: newInvoice.id
            })
          });

          if (!paymentResponse.ok) {
            const contentType = paymentResponse.headers.get('content-type');
            let errorMessage = 'Failed to create payment link';

            if (contentType?.includes('application/json')) {
              const errorData = await paymentResponse.json();
              errorMessage = errorData.error || errorMessage;
            }

            throw new Error(errorMessage);
          }

          const recipientEmail = selectedRepairForInvoice.customer_id && selectedRepairForInvoice.customers
            ? selectedRepairForInvoice.customers.email
            : selectedRepairForInvoice.customer_email;
          if (recipientEmail) {
            const yacht = allYachts.find(y => y.id === selectedRepairForInvoice.yacht_id);
            const invoiceApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invoice-notification`;

            const customerName = selectedRepairForInvoice.customers
              ? (selectedRepairForInvoice.customers.customer_type === 'business'
                ? selectedRepairForInvoice.customers.business_name
                : `${selectedRepairForInvoice.customers.first_name} ${selectedRepairForInvoice.customers.last_name}`)
              : selectedRepairForInvoice.customer_name;

            await fetch(invoiceApiUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipientEmail: recipientEmail,
                recipientName: customerName,
                repairTitle: selectedRepairForInvoice.title,
                yachtName: yacht?.name || 'Unknown Yacht',
                invoiceAmount: invoiceForm.final_invoice_amount,
                invoiceFileUrl: invoiceFileUrl,
                completedBy: userName,
                isRetailCustomer: true
              })
            });
          }
        } catch (error: any) {
          console.error('Error creating payment link for retail customer:', error);
          alert(`Invoice created but payment link failed: ${error.message}. You can generate the payment link manually from the repair details.`);
        }
      }

      setShowInvoiceModal(false);
      setSelectedRepairForInvoice(null);
      setInvoiceForm({ final_invoice_amount: '', invoice_file: null, payment_method_type: 'card' });
      setIsEditingInvoice(false);
      setSelectedInvoiceForEdit(null);
      setIsAddingInvoiceToCompleted(false);
      await loadRepairRequests();
      await loadChatMessages();
      await loadAdminNotifications();
    } catch (error: any) {
      console.error('Error billing yacht manager:', error);
      alert(`Error: ${error.message || 'Failed to process invoice'}`);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleEditRepairRequest = (request: RepairRequest) => {
    setEditingRepairRequest(request);
    setEditRepairForm({
      title: request.title,
      description: request.description || '',
      file: null,
      customer_name: request.customer_name || '',
      customer_phone: request.customer_phone || '',
      customer_email: request.customer_email || '',
      estimated_repair_cost: request.estimated_repair_cost?.toString() || ''
    });
    setShowEditRepairModal(true);
  };

  const handleSubmitEditRepair = async () => {
    if (!editingRepairRequest || !user) return;

    setEditRepairLoading(true);
    try {
      let fileUrl = editingRepairRequest.file_url;
      let fileName = editingRepairRequest.file_name;

      if (editRepairForm.file) {
        const fileExt = editRepairForm.file.name.split('.').pop();
        const filePath = `${editingRepairRequest.yacht_id || 'retail'}/${Date.now()}.${fileExt}`;
        fileName = editRepairForm.file.name;

        const { error: uploadError } = await supabase.storage
          .from('repair-files')
          .upload(filePath, editRepairForm.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('repair-files')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
      }

      const updateData: any = {
        title: editRepairForm.title,
        description: editRepairForm.description,
        estimated_repair_cost: editRepairForm.estimated_repair_cost ? parseFloat(editRepairForm.estimated_repair_cost) : null,
        updated_at: new Date().toISOString()
      };

      if (editingRepairRequest.is_retail_customer) {
        updateData.customer_name = editRepairForm.customer_name;
        updateData.customer_phone = editRepairForm.customer_phone;
        updateData.customer_email = editRepairForm.customer_email;
      }

      if (fileUrl) {
        updateData.file_url = fileUrl;
        updateData.file_name = fileName;
      }

      const { error: updateError } = await supabase
        .from('repair_requests')
        .update(updateData)
        .eq('id', editingRepairRequest.id);

      if (updateError) throw updateError;

      setShowEditRepairModal(false);
      setEditingRepairRequest(null);
      setEditRepairForm({
        title: '',
        description: '',
        file: null,
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        estimated_repair_cost: ''
      });
      await loadRepairRequests();
    } catch (error: any) {
      console.error('Error updating repair request:', error);
      alert(`Error: ${error.message || 'Failed to update repair request'}`);
    } finally {
      setEditRepairLoading(false);
    }
  };

  const handleSaveAndSendEstimate = async () => {
    if (!editingRepairRequest || !user) return;

    setEditRepairLoading(true);
    try {
      let fileUrl = editingRepairRequest.file_url;
      let fileName = editingRepairRequest.file_name;

      if (editRepairForm.file) {
        const fileExt = editRepairForm.file.name.split('.').pop();
        const filePath = `${editingRepairRequest.yacht_id || 'retail'}/${Date.now()}.${fileExt}`;
        fileName = editRepairForm.file.name;

        const { error: uploadError } = await supabase.storage
          .from('repair-files')
          .upload(filePath, editRepairForm.file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('repair-files')
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
      }

      const updateData: any = {
        title: editRepairForm.title,
        description: editRepairForm.description,
        estimated_repair_cost: editRepairForm.estimated_repair_cost ? parseFloat(editRepairForm.estimated_repair_cost) : null,
        updated_at: new Date().toISOString()
      };

      if (editingRepairRequest.is_retail_customer) {
        updateData.customer_name = editRepairForm.customer_name;
        updateData.customer_phone = editRepairForm.customer_phone;
        updateData.customer_email = editRepairForm.customer_email;
      }

      if (fileUrl) {
        updateData.file_url = fileUrl;
        updateData.file_name = fileName;
      }

      const { error: updateError } = await supabase
        .from('repair_requests')
        .update(updateData)
        .eq('id', editingRepairRequest.id);

      if (updateError) throw updateError;

      await loadRepairRequests();

      setShowEditRepairModal(false);
      setEditingRepairRequest(null);
      setEditRepairForm({
        title: '',
        description: '',
        file: null,
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        estimated_repair_cost: ''
      });

      const updatedRequest = {
        ...editingRepairRequest,
        ...updateData
      };
      setSelectedRepairForEstimateEmail(updatedRequest);
      setEstimateEmailRecipient(updateData.customer_email || '');
      setEstimateEmailRecipientName(updateData.customer_name || '');
      setShowEstimateEmailModal(true);
    } catch (error: any) {
      console.error('Error updating repair request:', error);
      alert(`Error: ${error.message || 'Failed to update repair request'}`);
    } finally {
      setEditRepairLoading(false);
    }
  };

  const handleAddInvoiceToCompletedRepair = async (request: RepairRequest) => {
    setSelectedRepairForInvoice(request);
    setInvoiceForm({
      final_invoice_amount: request.final_invoice_amount || request.estimated_repair_cost || '',
      invoice_file: null,
      payment_method_type: 'card'
    });
    setIsEditingInvoice(false);
    setSelectedInvoiceForEdit(null);
    setIsAddingInvoiceToCompleted(true);
    setShowInvoiceModal(true);
  };

  const handleEditExistingInvoice = async (invoice: YachtInvoice, request: RepairRequest) => {
    setSelectedRepairForInvoice(request);
    setSelectedInvoiceForEdit(invoice);
    setInvoiceForm({
      final_invoice_amount: invoice.invoice_amount || '',
      invoice_file: null,
      payment_method_type: (invoice as any).payment_method_type || 'card'
    });
    setIsEditingInvoice(true);
    setIsAddingInvoiceToCompleted(false);
    setShowInvoiceModal(true);
  };

  const handleUpdateInvoice = async () => {
    if (!selectedInvoiceForEdit || !selectedRepairForInvoice || !user) return;

    setInvoiceLoading(true);
    try {
      let invoiceFileUrl = selectedInvoiceForEdit.invoice_file_url;
      let invoiceFileName = selectedInvoiceForEdit.invoice_file_name;

      if (invoiceForm.invoice_file) {
        const fileExt = invoiceForm.invoice_file.name.split('.').pop();
        const filePath = `${selectedRepairForInvoice.yacht_id}/${Date.now()}.${fileExt}`;
        invoiceFileName = invoiceForm.invoice_file.name;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('invoice-files')
          .upload(filePath, invoiceForm.invoice_file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('invoice-files')
          .getPublicUrl(filePath);

        invoiceFileUrl = urlData.publicUrl;
      }

      const invoiceAmountNumeric = parseFloat(invoiceForm.final_invoice_amount.replace(/[^0-9.-]+/g, ''));

      const { error: updateError } = await supabase
        .from('yacht_invoices')
        .update({
          invoice_amount: invoiceForm.final_invoice_amount,
          invoice_amount_numeric: isNaN(invoiceAmountNumeric) ? null : invoiceAmountNumeric,
          invoice_file_url: invoiceFileUrl,
          invoice_file_name: invoiceFileName,
          payment_method_type: invoiceForm.payment_method_type,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInvoiceForEdit.id);

      if (updateError) throw updateError;

      // Also update repair request
      const { error: repairUpdateError } = await supabase
        .from('repair_requests')
        .update({
          final_invoice_amount: invoiceForm.final_invoice_amount,
          invoice_file_url: invoiceFileUrl,
          invoice_file_name: invoiceFileName,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRepairForInvoice.id);

      if (repairUpdateError) throw repairUpdateError;

      setShowInvoiceModal(false);
      setSelectedRepairForInvoice(null);
      setSelectedInvoiceForEdit(null);
      setInvoiceForm({ final_invoice_amount: '', invoice_file: null, payment_method_type: 'card' });
      setIsEditingInvoice(false);
      setIsAddingInvoiceToCompleted(false);
      await loadRepairRequests();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      alert(`Error: ${error.message || 'Failed to update invoice'}`);
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleGeneratePaymentLink = async (invoice: YachtInvoice) => {
    if (!invoice.id) return;

    setPaymentLinkLoading({ ...paymentLinkLoading, [invoice.id]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-invoice-payment`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate payment link');
      }

      await loadRepairRequests();
      alert('Payment link generated successfully!');
    } catch (error: any) {
      console.error('Error generating payment link:', error);
      alert(`Error: ${error.message || 'Failed to generate payment link'}`);
    } finally {
      setPaymentLinkLoading({ ...paymentLinkLoading, [invoice.id]: false });
    }
  };

  const handleDeletePaymentLink = async (invoice: YachtInvoice) => {
    if (!invoice.id) return;

    const confirmed = confirm('Are you sure you want to delete this payment link? You can generate a new one after making changes to the invoice.');
    if (!confirmed) return;

    setDeletePaymentLinkLoading({ ...deletePaymentLinkLoading, [invoice.id]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-invoice-payment-link`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete payment link');
      }

      await loadRepairRequests();
      alert('Payment link deleted successfully! You can now edit the invoice and generate a new payment link.');
    } catch (error: any) {
      console.error('Error deleting payment link:', error);
      alert(`Error: ${error.message || 'Failed to delete payment link'}`);
    } finally {
      setDeletePaymentLinkLoading({ ...deletePaymentLinkLoading, [invoice.id]: false });
    }
  };

  const handleRegeneratePaymentLink = async (invoice: YachtInvoice) => {
    if (!invoice.id) return;

    const confirmed = confirm('This will delete the expired payment link and create a new one. Continue?');
    if (!confirmed) return;

    setPaymentLinkLoading({ ...paymentLinkLoading, [invoice.id]: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const deleteApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-invoice-payment-link`;
      const deleteResponse = await fetch(deleteApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id
        })
      });

      const deleteResult = await deleteResponse.json();
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete old payment link');
      }

      const createApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-invoice-payment`;
      const createResponse = await fetch(createApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id
        })
      });

      const createResult = await createResponse.json();

      if (!createResult.success) {
        throw new Error(createResult.error || 'Failed to create new payment link');
      }

      await loadRepairRequests();
      alert('Payment link regenerated successfully! The new link is ready to use.');
    } catch (error: any) {
      console.error('Error regenerating payment link:', error);
      alert(`Error: ${error.message || 'Failed to regenerate payment link'}`);
    } finally {
      setPaymentLinkLoading({ ...paymentLinkLoading, [invoice.id]: false });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy:', err);
    });
  };

  const handleOpenEmailModal = (invoice: YachtInvoice) => {
    setSelectedInvoiceForEmail(invoice);
    setEmailRecipient('');
    setEmailRecipientName('');
    setShowEmailModal(true);
  };

  const handleSendPaymentEmail = async () => {
    if (!selectedInvoiceForEmail || !emailRecipient) return;

    setSendingEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-payment-link-email`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: selectedInvoiceForEmail.id,
          recipientEmail: emailRecipient,
          recipientName: emailRecipientName || undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error response:', errorText);
        let errorMessage = 'Failed to send email';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = `Server error (${response.status}): ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.success) {
        if (result.message?.includes('Resend not configured') || result.error?.includes('not configured')) {
          setShowEmailModal(false);
          setSelectedInvoiceForEmail(null);
          setEmailRecipient('');
          setEmailRecipientName('');
          alert('⚠️ Email Service Not Configured\n\nThe email was not sent because Resend API is not set up.\n\nTo enable email sending:\n1. Sign up at resend.com\n2. Get your API key from the dashboard\n3. In Supabase dashboard, go to Edge Functions\n4. Add RESEND_API_KEY as a secret\n\nFor now, please copy the payment link and send it manually.');
          return;
        }
        throw new Error(result.error || 'Failed to send email');
      }

      setShowEmailModal(false);
      setSelectedInvoiceForEmail(null);
      setEmailRecipient('');
      setEmailRecipientName('');

      await loadChatMessages();
      await loadRepairRequests();

      alert('✓ Payment link email sent successfully!');
    } catch (error: any) {
      console.error('Error sending payment email:', error);
      alert(`Error sending email: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleSendEstimateEmail = async () => {
    if (!selectedRepairForEstimateEmail || !estimateEmailRecipient) return;

    setSendingEstimateEmail(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-repair-estimate-email`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repairRequestId: selectedRepairForEstimateEmail.id,
          recipientEmail: estimateEmailRecipient,
          recipientName: estimateEmailRecipientName || undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error response:', errorText);
        let errorMessage = 'Failed to send email';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch {
          errorMessage = `Server error (${response.status}): ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (!result.success) {
        if (result.message?.includes('Resend not configured') || result.error?.includes('not configured')) {
          setShowEstimateEmailModal(false);
          setSelectedRepairForEstimateEmail(null);
          setEstimateEmailRecipient('');
          setEstimateEmailRecipientName('');
          alert('⚠️ Email Service Not Configured\n\nThe email was not sent because Resend API is not set up.\n\nTo enable email sending:\n1. Sign up at resend.com\n2. Get your API key from the dashboard\n3. In Supabase dashboard, go to Edge Functions\n4. Add RESEND_API_KEY as a secret\n\nFor now, please contact the customer directly.');
          return;
        }
        throw new Error(result.error || 'Failed to send email');
      }

      setShowEstimateEmailModal(false);
      setSelectedRepairForEstimateEmail(null);
      setEstimateEmailRecipient('');
      setEstimateEmailRecipientName('');

      await loadRepairRequests();

      alert('✓ Estimate email sent successfully to customer!');
    } catch (error: any) {
      console.error('Error sending estimate email:', error);
      alert(`Error sending email: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setSendingEstimateEmail(false);
    }
  };

  const loadChatMessages = async () => {
    try {
      if (!user) return;

      // Load owner chat messages (only for owner chat feature)
      let messagesQuery = supabase
        .from('owner_chat_messages')
        .select('*')
        .order('created_at', { ascending: false });

      // Don't filter for master, staff, or mechanic - they should see all messages
      // Only filter by yacht_id for managers who are yacht-specific
      if (isManagerRole(effectiveRole) && effectiveYacht && !isMasterRole(effectiveRole) && !isStaffRole(effectiveRole)) {
        messagesQuery = messagesQuery.eq('yacht_id', effectiveYacht.id);
      }

      const { data: messagesData, error: messagesError } = await messagesQuery;

      if (messagesError) {
        console.error('Error loading chat messages:', messagesError);
        throw messagesError;
      }

      // Then, enrich with user and yacht data
      if (messagesData && messagesData.length > 0) {
        const enrichedMessages = await Promise.all(
          messagesData.map(async (msg) => {
            // Get user profile
            const { data: profileData } = await supabase
              .from('user_profiles')
              .select('first_name, last_name')
              .eq('user_id', msg.user_id)
              .single();

            // Get yacht name
            const { data: yachtData } = await supabase
              .from('yachts')
              .select('name')
              .eq('id', msg.yacht_id)
              .single();

            return {
              ...msg,
              user_profiles: profileData,
              yachts: yachtData
            };
          })
        );

        setChatMessages(enrichedMessages);
      } else {
        setChatMessages([]);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
    }
  };

  const loadAdminNotifications = async () => {
    try {
      if (!user) return;

      // Load admin notifications (check-in/check-out alerts) from new table
      let notificationsQuery = supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false });

      // Don't filter for master, staff, or mechanic - they should see all notifications
      // Only filter by yacht_id for managers who are yacht-specific
      if (isManagerRole(effectiveRole) && effectiveYacht && !isMasterRole(effectiveRole) && !isStaffRole(effectiveRole)) {
        notificationsQuery = notificationsQuery.eq('yacht_id', effectiveYacht.id);
      }

      const { data: notificationsData, error: notificationsError } = await notificationsQuery;

      if (notificationsError) {
        console.error('Error loading admin notifications:', notificationsError);
        throw notificationsError;
      }

      // Also load legacy check-in/check-out messages from owner_chat_messages for backwards compatibility
      let legacyQuery = supabase
        .from('owner_chat_messages')
        .select('*')
        .or('message.ilike.%Check-In Alert:%,message.ilike.%Check-Out Alert:%')
        .order('created_at', { ascending: false });

      // Don't filter for master, staff, or mechanic - they should see all legacy messages
      // Only filter by yacht_id for managers who are yacht-specific
      if (isManagerRole(effectiveRole) && effectiveYacht && !isMasterRole(effectiveRole) && !isStaffRole(effectiveRole)) {
        legacyQuery = legacyQuery.eq('yacht_id', effectiveYacht.id);
      }

      const { data: legacyMessages, error: legacyError } = await legacyQuery;

      if (legacyError) {
        console.error('Error loading legacy messages:', legacyError);
      }

      // Combine both sources
      const allNotifications = [
        ...(notificationsData || []),
        ...(legacyMessages || [])
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Enrich with user and yacht data
      if (allNotifications && allNotifications.length > 0) {
        const uniqueUserIds = [...new Set(allNotifications.flatMap(n => [n.user_id, n.completed_by].filter(Boolean)))];
        const uniqueYachtIds = [...new Set(allNotifications.map(n => n.yacht_id).filter(Boolean))];

        const [usersResult, yachtsResult] = await Promise.all([
          supabase.from('user_profiles').select('user_id, first_name, last_name').in('user_id', uniqueUserIds),
          supabase.from('yachts').select('id, name').in('id', uniqueYachtIds)
        ]);

        const usersMap = new Map(usersResult.data?.map(u => [u.user_id, u]) || []);
        const yachtsMap = new Map(yachtsResult.data?.map(y => [y.id, y]) || []);

        const enrichedNotifications = allNotifications.map(notif => ({
          ...notif,
          user_profiles: usersMap.get(notif.user_id) || null,
          yachts: yachtsMap.get(notif.yacht_id) || null,
          completed_by_profile: notif.completed_by ? usersMap.get(notif.completed_by) || null : null
        }));

        setAdminNotifications(enrichedNotifications);
      } else {
        setAdminNotifications([]);
      }
    } catch (error) {
      console.error('Error loading admin notifications:', error);
    }
  };

  const loadStaffMessages = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('staff_messages')
        .select(`
          *,
          user_profiles:created_by (first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with completed_by user data
      if (data && data.length > 0) {
        const enrichedMessages = await Promise.all(
          data.map(async (msg) => {
            let completedByData = null;
            if (msg.completed_by) {
              const { data: completedProfile } = await supabase
                .from('user_profiles')
                .select('first_name, last_name')
                .eq('user_id', msg.completed_by)
                .maybeSingle();
              completedByData = completedProfile;
            }

            return {
              ...msg,
              completed_by_profile: completedByData
            };
          })
        );
        setStaffMessages(enrichedMessages);
      } else {
        setStaffMessages([]);
      }
    } catch (error) {
      console.error('Error loading staff messages:', error);
    }
  };

  const markYachtMessageComplete = async (messageId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('admin_notifications')
        .update({
          completed_by: user.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      await loadAdminNotifications();
    } catch (error) {
      console.error('Error marking yacht message as complete:', error);
    }
  };

  const markStaffMessageComplete = async (messageId: string) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('staff_messages')
        .update({
          completed_by: user.id,
          completed_at: new Date().toISOString()
        })
        .eq('id', messageId);

      if (error) throw error;

      await loadStaffMessages();
    } catch (error) {
      console.error('Error marking staff message as complete:', error);
    }
  };

  const loadMasterCalendar = async () => {
    try {
      if (!user) {
        console.log('Master Calendar: No user logged in');
        return;
      }

      console.log('Master Calendar: Loading data for user:', user.id, 'Role:', effectiveRole, 'Profile:', userProfile?.role);

      let bookingsQuery = supabase
        .from('yacht_bookings')
        .select(`
          *,
          yachts:yacht_id (name),
          yacht_booking_owners (
            id,
            owner_name,
            owner_contact,
            created_at
          ),
          user_profiles:user_id (
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .order('start_date', { ascending: false });

      // Filter by yacht_id for managers and owners (but not master role)
      if ((effectiveRole === 'manager' || effectiveRole === 'owner') && effectiveYacht) {
        console.log('Master Calendar: Filtering for yacht:', effectiveYacht.id);
        bookingsQuery = bookingsQuery.eq('yacht_id', effectiveYacht.id);
      }

      const { data: bookingsData, error: bookingsError } = await bookingsQuery;

      if (bookingsError) {
        console.error('Master Calendar Error:', bookingsError);
        console.error('Master Calendar Error Details:', JSON.stringify(bookingsError, null, 2));
        throw bookingsError;
      }

      console.log('Master Calendar: Fetched', bookingsData?.length || 0, 'bookings from database');

      let appointmentsQuery = supabase
        .from('appointments')
        .select('*')
        .order('date', { ascending: false });

      if ((effectiveRole === 'manager' || effectiveRole === 'owner') && effectiveYacht) {
        appointmentsQuery = appointmentsQuery.eq('yacht_name', effectiveYacht.name);
      }

      const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery;

      if (appointmentsError) {
        console.error('Appointments Error:', appointmentsError);
      }

      console.log('Master Calendar: Fetched', appointmentsData?.length || 0, 'appointments from database');

      const formattedAppointments = (appointmentsData || []).map(apt => ({
        ...apt,
        start_date: apt.date,
        end_date: apt.date,
        owner_name: apt.name,
        owner_contact: apt.phone,
        email: apt.email,
        problem_description: apt.problem_description,
        departure_time: apt.time,
        arrival_time: apt.time,
        is_appointment: true,
        yachts: { name: apt.yacht_name }
      }));

      const combinedData = [...(bookingsData || []), ...formattedAppointments];

      console.log('Master Calendar: Total combined data:', combinedData.length, 'bookings/appointments');
      console.log('Master Calendar: Sample data:', combinedData.slice(0, 3));
      setMasterCalendarBookings(combinedData);
    } catch (error) {
      console.error('Error loading master calendar:', error);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !user || !yacht) return;

    setChatLoading(true);
    try {
      const { error } = await supabase
        .from('owner_chat_messages')
        .insert({
          yacht_id: yacht.id,
          user_id: user.id,
          message: newMessage.trim()
        });

      if (error) throw error;

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || user.email || 'Unknown';

      await logYachtActivity(
        yacht.id,
        yacht.name,
        `New message from ${userName}`,
        user.id,
        userName
      );

      setNewMessage('');
      await loadChatMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setChatLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!activeBooking || !user || !yacht) return;

    if (!isWithinBookingPeriod(activeBooking)) {
      alert('You can only check in during your scheduled booking period.');
      return;
    }

    try {
      const { error } = await supabase
        .from('yacht_bookings')
        .update({ checked_in: true })
        .eq('id', activeBooking.id);

      if (error) throw error;

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : user.email;

      const now = new Date();
      const checkInMessage = `Check-In Alert: ${userName} checked in to ${yacht.name} on ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const { error: msgError } = await supabase
        .from('admin_notifications')
        .insert({
          yacht_id: yacht.id,
          user_id: user.id,
          message: checkInMessage,
          notification_type: 'check_in'
        });

      if (msgError) {
        console.error('Error inserting check-in notification:', msgError);
        alert('Warning: Check-in recorded but notification failed to send. Please refresh the page.');
      }

      await logYachtActivity(
        yacht.id,
        yacht.name,
        `${userName} checked in at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        user.id,
        userName
      );

      await loadBookings();
      await loadAdminNotifications();
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const handleCheckOut = async () => {
    if (!activeBooking || !user || !yacht) return;

    if (!isWithinBookingPeriod(activeBooking)) {
      alert('You can only check out during your scheduled booking period.');
      return;
    }

    try {
      const { error } = await supabase
        .from('yacht_bookings')
        .update({ checked_out: true })
        .eq('id', activeBooking.id);

      if (error) throw error;

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : user.email;

      const now = new Date();
      const checkOutMessage = `Check-Out Alert: ${userName} checked out from ${yacht.name} on ${now.toLocaleDateString()} at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      const { error: msgError } = await supabase
        .from('admin_notifications')
        .insert({
          yacht_id: yacht.id,
          user_id: user.id,
          message: checkOutMessage,
          notification_type: 'check_out'
        });

      if (msgError) {
        console.error('Error inserting check-out notification:', msgError);
        alert('Warning: Check-out recorded but notification failed to send. Please refresh the page.');
      }

      await logYachtActivity(
        yacht.id,
        yacht.name,
        `${userName} checked out at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        user.id,
        userName
      );

      await loadBookings();
      await loadAdminNotifications();
    } catch (error) {
      console.error('Error checking out:', error);
    }
  };

  const handleMaintenancePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setMaintenanceError('Photo must be less than 10MB');
        return;
      }

      setMaintenancePhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMaintenancePhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveMaintenancePhoto = () => {
    setMaintenancePhoto(null);
    setMaintenancePhotoPreview(null);
  };

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !effectiveYacht) return;

    setMaintenanceLoading(true);
    setMaintenanceError('');
    setMaintenanceSuccess(false);

    try {
      let photoUrl = null;

      if (maintenancePhoto) {
        const fileExt = maintenancePhoto.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const filePath = `maintenance-photos/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('yacht-documents')
          .upload(filePath, maintenancePhoto);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('yacht-documents')
          .getPublicUrl(filePath);

        photoUrl = urlData.publicUrl;
      }

      const { error: dbError } = await supabase.from('maintenance_requests').insert({
        user_id: user.id,
        yacht_id: effectiveYacht.id,
        subject: maintenanceSubject,
        description: maintenanceDescription,
        priority: 'medium',
        status: 'pending',
        photo_url: photoUrl,
      });

      if (dbError) throw dbError;

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || user.email || 'Unknown';

      const maintenanceMessage = `Maintenance Request: ${maintenanceSubject}\n\n${maintenanceDescription}`;

      const { error: notifError } = await supabase
        .from('admin_notifications')
        .insert({
          yacht_id: effectiveYacht.id,
          user_id: user.id,
          message: maintenanceMessage,
          notification_type: 'maintenance_request'
        });

      if (notifError) {
        console.error('Error creating admin notification:', notifError);
      }

      await logYachtActivity(
        effectiveYacht.id,
        effectiveYacht.name,
        `Maintenance request submitted: "${maintenanceSubject}"`,
        user.id,
        userName
      );

      setMaintenanceSuccess(true);
      setMaintenanceSubject('');
      setMaintenanceDescription('');
      setMaintenancePhoto(null);
      setMaintenancePhotoPreview(null);
      await loadMaintenanceRequests();
      await loadAdminNotifications();

      setTimeout(() => {
        setMaintenanceSuccess(false);
      }, 3000);
    } catch (err: any) {
      setMaintenanceError(err.message || 'Failed to submit request');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleInspectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedYachtForInspection || !selectedMechanicId) return;

    setInspectionLoading(true);
    setInspectionError('');
    setInspectionSuccess(false);

    try {
      const { data: insertedInspection, error: dbError } = await supabase.from('trip_inspections').insert({
        booking_id: null,
        yacht_id: selectedYachtForInspection,
        inspector_id: selectedMechanicId,
        inspection_type: inspectionType,
        ...inspectionForm,
      }).select().single();

      if (dbError) throw dbError;

      await loadAdminNotifications();

      setInspectionSuccess(true);
      setSelectedYachtForInspection('');
      setSelectedMechanicId('');
      setInspectionForm({
        hull_condition: 'good',
        hull_notes: '',
        deck_condition: 'good',
        deck_notes: '',
        cabin_condition: 'good',
        cabin_notes: '',
        galley_condition: 'good',
        galley_notes: '',
        head_condition: 'good',
        head_notes: '',
        navigation_equipment: 'good',
        navigation_notes: '',
        safety_equipment: 'good',
        safety_notes: '',
        engine_condition: 'good',
        engine_notes: '',
        fuel_level: 100,
        water_level: 100,
        overall_condition: 'good',
        additional_notes: '',
        issues_found: false,
      });

      setTimeout(() => {
        setInspectionSuccess(false);
        setAdminView('menu');
      }, 2000);
    } catch (err: any) {
      setInspectionError(err.message || 'Failed to submit inspection');
    } finally {
      setInspectionLoading(false);
    }
  };

  const handleOwnerHandoffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedYachtForHandoff || !selectedMechanicForHandoff) return;

    setHandoffLoading(true);
    setHandoffError('');
    setHandoffSuccess(false);

    try {
      const { data: insertedHandoff, error: dbError } = await supabase.from('owner_handoff_inspections').insert({
        yacht_id: selectedYachtForHandoff,
        inspector_id: selectedMechanicForHandoff,
        ...handoffForm,
      }).select().single();

      if (dbError) throw dbError;

      const selectedYacht = allYachts.find(y => y.id === selectedYachtForHandoff);
      const selectedMechanic = mechanics.find(m => m.user_id === selectedMechanicForHandoff);
      if (selectedYacht && insertedHandoff) {
        const mechanicName = selectedMechanic?.first_name && selectedMechanic?.last_name
          ? `${selectedMechanic.first_name} ${selectedMechanic.last_name}`
          : 'Unknown';
        await logYachtActivity(
          selectedYacht.id,
          selectedYacht.name,
          `Owner handoff inspection completed by ${mechanicName}`,
          user?.id,
          mechanicName,
          insertedHandoff.id,
          'owner_handoff'
        );

        await supabase.from('admin_notifications').insert({
          user_id: selectedMechanicForHandoff,
          yacht_id: selectedYacht.id,
          notification_type: 'owner_handoff',
          reference_id: insertedHandoff.id,
          message: `Meet the Yacht Owner inspection completed for ${selectedYacht.name} by ${mechanicName}`,
        });

        await loadAdminNotifications();
      }

      setHandoffSuccess(true);
      setSelectedYachtForHandoff('');
      setSelectedMechanicForHandoff('');
      setHandoffForm({
        trip_issues: '',
        trip_issues_notes: '',
        boat_damage: '',
        boat_damage_notes: '',
        shore_cords_inverters: '',
        shore_cords_inverters_notes: '',
        engine_generator_fuel: '',
        engine_generator_fuel_notes: '',
        toy_tank_fuel: '',
        toy_tank_fuel_notes: '',
        propane_tanks: '',
        propane_tanks_notes: '',
        boat_cleaned: '',
        boat_cleaned_notes: '',
        repairs_completed: '',
        repairs_completed_notes: '',
        owners_called: '',
        owners_called_notes: '',
        additional_notes: '',
        issues_found: false,
      });

      setTimeout(() => {
        setHandoffSuccess(false);
        setAdminView('menu');
      }, 2000);
    } catch (err: any) {
      setHandoffError(err.message || 'Failed to submit owner handoff inspection');
    } finally {
      setHandoffLoading(false);
    }
  };

  const handleAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setAppointmentLoading(true);
    setAppointmentError('');
    setAppointmentSuccess(false);

    try {
      const appointmentData = {
        date: appointmentForm.date,
        time: appointmentForm.time,
        name: appointmentForm.name,
        phone: appointmentForm.phone,
        email: appointmentForm.email,
        yacht_name: appointmentForm.yacht_id,
        problem_description: appointmentForm.problem_description,
        created_by: user.id
      };

      const { data: appointment, error: dbError } = await supabase.from('appointments').insert(appointmentData).select().single();

      if (dbError) throw dbError;

      if (appointment) {
        const userName = userProfile?.first_name && userProfile?.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : 'Staff';

        const selectedYacht = allYachts.find(y => y.name.toLowerCase() === appointmentForm.yacht_id.toLowerCase());

        if (selectedYacht) {
          await logYachtActivity(
            selectedYacht.id,
            selectedYacht.name,
            `Appointment scheduled for ${appointmentForm.name} on ${appointmentForm.date} at ${appointmentForm.time}`,
            user?.id,
            userName,
            appointment.id,
            'appointment'
          );

          await supabase.from('admin_notifications').insert({
            user_id: user.id,
            yacht_id: selectedYacht.id,
            notification_type: 'appointment',
            reference_id: appointment.id,
            message: `New appointment scheduled: ${appointmentForm.name} for ${appointmentForm.yacht_id} on ${appointmentForm.date} at ${appointmentForm.time}. Issue: ${appointmentForm.problem_description}`,
          });
        }

        if (appointmentForm.createRepairRequest) {
          const repairData = {
            title: `Appointment: ${appointmentForm.problem_description.substring(0, 50)}${appointmentForm.problem_description.length > 50 ? '...' : ''}`,
            description: `Yacht: ${appointmentForm.yacht_id}\nCustomer: ${appointmentForm.name}\nPhone: ${appointmentForm.phone}\nEmail: ${appointmentForm.email}\nScheduled: ${appointmentForm.date} at ${appointmentForm.time}\n\nProblem: ${appointmentForm.problem_description}`,
            status: 'pending',
            is_retail_customer: true,
            customer_name: appointmentForm.name,
            customer_email: appointmentForm.email,
            customer_phone: appointmentForm.phone,
            submitted_by: user.id
          };

          const { error: repairError } = await supabase.from('repair_requests').insert(repairData);
          if (repairError) throw repairError;

          await loadRepairRequests();
        }

        await loadAdminNotifications();
        await loadMasterCalendar();
        await loadStaffMessages();
      }

      setAppointmentSuccess(true);
      setAppointmentForm({
        date: '',
        time: '',
        name: '',
        phone: '',
        email: '',
        yacht_id: '',
        problem_description: '',
        createRepairRequest: false
      });

      setTimeout(() => {
        setAppointmentSuccess(false);
        if (showQuickAppointmentModal) {
          setShowQuickAppointmentModal(false);
          setQuickAppointmentDate(null);
        } else {
          setAdminView('menu');
        }
      }, 2000);
    } catch (err: any) {
      setAppointmentError(err.message || 'Failed to create appointment');
    } finally {
      setAppointmentLoading(false);
    }
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setEditAppointmentForm({
      date: appointment.start_date.slice(0, 10),
      time: appointment.departure_time,
      name: appointment.owner_name,
      phone: appointment.owner_contact || '',
      email: appointment.email || '',
      yacht_name: appointment.yachts?.name || '',
      problem_description: appointment.problem_description || ''
    });
  };

  const handleCalendarDateClick = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;

    setQuickAppointmentDate(date);
    setAppointmentForm({
      name: '',
      phone: '',
      email: '',
      yacht_id: '',
      date: dateString,
      time: '09:00',
      problem_description: '',
      createRepairRequest: false
    });
    setShowQuickAppointmentModal(true);
    setAppointmentSuccess(false);
    setAppointmentError('');
  };

  const handleUpdateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAppointment) return;

    setEditAppointmentLoading(true);
    setEditAppointmentError('');

    try {
      const { error } = await supabase
        .from('appointments')
        .update({
          date: editAppointmentForm.date,
          time: editAppointmentForm.time,
          name: editAppointmentForm.name,
          phone: editAppointmentForm.phone,
          email: editAppointmentForm.email,
          yacht_name: editAppointmentForm.yacht_name,
          problem_description: editAppointmentForm.problem_description
        })
        .eq('id', editingAppointment.id);

      if (error) throw error;

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || 'Unknown';

      const selectedYacht = allYachts.find(y => y.name.toLowerCase() === editAppointmentForm.yacht_name.toLowerCase());
      if (selectedYacht) {
        await logYachtActivity(
          selectedYacht.id,
          selectedYacht.name,
          `Appointment updated for ${editAppointmentForm.name} on ${editAppointmentForm.date} at ${editAppointmentForm.time}`,
          user?.id,
          userName,
          editingAppointment.id,
          'appointment'
        );
      }

      await loadMasterCalendar();
      setEditingAppointment(null);
    } catch (err: any) {
      setEditAppointmentError(err.message || 'Failed to update appointment');
    } finally {
      setEditAppointmentLoading(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    if (!confirm('Are you sure you want to delete this appointment?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      await loadMasterCalendar();
      setEditingAppointment(null);
    } catch (err: any) {
      alert(`Failed to delete appointment: ${err.message}`);
    }
  };

  const viewInspectionPDF = async (inspectionId: string) => {
    try {
      const { data: inspection, error } = await supabase
        .from('trip_inspections')
        .select('*, yachts(name)')
        .eq('id', inspectionId)
        .single();

      if (error) throw error;

      // Get inspector info from user_profiles
      if (inspection.inspector_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('user_id', inspection.inspector_id)
          .single();

        if (profile) {
          (inspection as any).user_profiles = profile;
        }
      }

      setSelectedInspectionForPDF(inspection);
    } catch (err) {
      console.error('Error loading inspection:', err);
    }
  };

  const viewOwnerHandoffPDF = async (handoffId: string) => {
    try {
      const { data: handoff, error } = await supabase
        .from('owner_handoff_inspections')
        .select('*, yachts(name)')
        .eq('id', handoffId)
        .single();

      if (error) throw error;

      // Get inspector info from user_profiles
      if (handoff.inspector_id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('first_name, last_name')
          .eq('user_id', handoff.inspector_id)
          .single();

        if (profile) {
          (handoff as any).user_profiles = profile;
        }
      }

      setSelectedHandoffForPDF(handoff);
    } catch (err) {
      console.error('Error loading owner handoff inspection:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'in_progress': return 'text-blue-400';
      case 'cancelled': return 'text-slate-500';
      default: return 'text-amber-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  const getBookingDisplayName = (booking: any): string => {
    if (booking.yacht_booking_owners && booking.yacht_booking_owners.length > 0) {
      return booking.yacht_booking_owners.map((o: any) => o.owner_name).join(', ');
    } else if (booking.user_profiles) {
      const firstName = booking.user_profiles.first_name || '';
      const lastName = booking.user_profiles.last_name || '';
      return `${firstName} ${lastName}`.trim() || booking.user_profiles.email || 'Unknown';
    } else if (booking.owner_name) {
      return booking.owner_name;
    }
    return 'Unknown';
  };

  const handleEditBooking = (booking: any, clickedDate?: Date) => {
    setEditingBooking(booking);
    setEditingBookingClickedDate(clickedDate || null);
    const startDate = new Date(booking.start_date);
    const endDate = new Date(booking.end_date);

    // Determine owner name and contact from either yacht_booking_owners or user_profiles
    let ownerName = '';
    let ownerContact = '';

    if (booking.yacht_booking_owners && booking.yacht_booking_owners.length > 0) {
      // Legacy booking with yacht_booking_owners
      ownerName = booking.yacht_booking_owners[0].owner_name || '';
      ownerContact = booking.yacht_booking_owners[0].owner_contact || '';
    } else if (booking.user_profiles) {
      // New booking with user_id reference
      ownerName = `${booking.user_profiles.first_name || ''} ${booking.user_profiles.last_name || ''}`.trim();
      ownerContact = booking.user_profiles.phone || booking.user_profiles.email || '';
    } else if (booking.owner_name) {
      // Fallback to direct properties
      ownerName = booking.owner_name;
      ownerContact = booking.owner_contact || '';
    }

    setEditBookingForm({
      owner_name: ownerName,
      owner_contact: ownerContact,
      start_date: startDate.toISOString().slice(0, 10),
      departure_time: startDate.toTimeString().slice(0, 5),
      end_date: endDate.toISOString().slice(0, 10),
      arrival_time: endDate.toTimeString().slice(0, 5)
    });
  };

  const handleToggleOilChange = async () => {
    if (!editingBooking) return;

    try {
      const newOilChangeStatus = !editingBooking.oil_change_needed;

      const { error } = await supabase
        .from('yacht_bookings')
        .update({ oil_change_needed: newOilChangeStatus })
        .eq('id', editingBooking.id);

      if (error) throw error;

      setEditingBooking({ ...editingBooking, oil_change_needed: newOilChangeStatus });

      // Update master calendar bookings immediately
      setMasterCalendarBookings(prevBookings =>
        prevBookings.map(booking =>
          booking.id === editingBooking.id
            ? { ...booking, oil_change_needed: newOilChangeStatus }
            : booking
        )
      );

      await loadMasterCalendar();
    } catch (error) {
      console.error('Error toggling oil change status:', error);
    }
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking) return;

    setEditBookingLoading(true);
    setEditBookingError('');

    try {
      const startDateTime = new Date(`${editBookingForm.start_date}T${editBookingForm.departure_time}:00`);
      const endDateTime = new Date(`${editBookingForm.end_date}T${editBookingForm.arrival_time}:00`);

      const { error } = await supabase
        .from('yacht_bookings')
        .update({
          owner_name: editBookingForm.owner_name,
          owner_contact: editBookingForm.owner_contact,
          start_date: startDateTime.toISOString(),
          end_date: endDateTime.toISOString(),
        })
        .eq('id', editingBooking.id);

      if (error) throw error;

      const yacht = allYachts.find(y => y.id === editingBooking.yacht_id);
      if (yacht) {
        const userName = userProfile?.first_name && userProfile?.last_name
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : userProfile?.email || 'Unknown';
        await logYachtActivity(
          yacht.id,
          yacht.name,
          `Trip updated for ${editBookingForm.owner_name} (${startDateTime.toLocaleDateString()} - ${endDateTime.toLocaleDateString()})`,
          user?.id,
          userName
        );
      }

      // Reload yacht trips if that yacht's trips section is currently open
      if (tripsYachtId === editingBooking.yacht_id) {
        await loadYachtTrips(editingBooking.yacht_id);
      }

      setEditingBooking(null);
      await loadMasterCalendar();
    } catch (err: any) {
      setEditBookingError(err.message || 'Failed to update booking');
    } finally {
      setEditBookingLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      return;
    }

    try {
      const bookingToDelete = masterCalendarBookings.find(b => b.id === bookingId);

      const { error } = await supabase
        .from('yacht_bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      if (bookingToDelete) {
        const yacht = allYachts.find(y => y.id === bookingToDelete.yacht_id);
        if (yacht) {
          const userName = userProfile?.first_name && userProfile?.last_name
            ? `${userProfile.first_name} ${userProfile.last_name}`
            : userProfile?.email || 'Unknown';
          await logYachtActivity(
            yacht.id,
            yacht.name,
            `Trip deleted for ${getBookingDisplayName(bookingToDelete)}`,
            user?.id,
            userName
          );
        }

        // Reload yacht trips if that yacht's trips section is currently open
        if (tripsYachtId === bookingToDelete.yacht_id) {
          await loadYachtTrips(bookingToDelete.yacht_id);
        }
      }

      await loadMasterCalendar();
    } catch (err: any) {
      console.error('Error deleting booking:', err);
      alert('Failed to delete booking: ' + (err.message || 'Unknown error'));
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, firstDay, lastDay };
  };

  const getWeekDays = (date: Date) => {
    const dayOfWeek = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - dayOfWeek);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const formatTimeOnly = (timeString: string | null) => {
    if (!timeString) return '';
    // Handle both "HH:MM:SS" and "HH:MM" formats
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      const hour = parseInt(parts[0]);
      const minute = parts[1];
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute} ${ampm}`;
    }
    return timeString;
  };

  const getBookingsForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return masterCalendarBookings.filter(booking => {
      // Filter by yacht if user is owner or manager (but not staff, mechanic, or master)
      if ((effectiveRole === 'owner' || effectiveRole === 'manager') && effectiveYacht && booking.yacht_id !== effectiveYacht.id) {
        return false;
      }

      // Parse dates in local timezone to avoid timezone offset issues
      // Only add time component if the date string doesn't already have one
      const startDateStr = booking.start_date.includes('T') ? booking.start_date : booking.start_date + 'T00:00:00';
      const endDateStr = booking.end_date.includes('T') ? booking.end_date : booking.end_date + 'T00:00:00';

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      return checkDate.getTime() === startDate.getTime() || checkDate.getTime() === endDate.getTime();
    }).sort((a, b) => {
      // Sort by time - earliest time first
      const getTimeValue = (booking: any) => {
        // Determine if this is a departure or arrival for the given date
        const startDateStr = booking.start_date.includes('T') ? booking.start_date : booking.start_date + 'T00:00:00';
        const endDateStr = booking.end_date.includes('T') ? booking.end_date : booking.end_date + 'T00:00:00';
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        const checkDate = new Date(date);
        checkDate.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);

        const isDeparture = checkDate.getTime() === startDate.getTime();

        // Use departure_time for departures, arrival_time for arrivals
        const timeStr = isDeparture ? booking.departure_time : booking.arrival_time;

        if (timeStr) {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        }

        // Default to midnight if no time specified
        return 0;
      };

      return getTimeValue(a) - getTimeValue(b);
    });
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (calendarView === 'day') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (calendarView === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatCalendarTitle = () => {
    if (calendarView === 'day') {
      return currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } else if (calendarView === 'week') {
      const weekDays = getWeekDays(currentDate);
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white flex">
      {/* Welcome Video Modal */}
      {showWelcomeVideo && welcomeVideo && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="flex items-center justify-between p-6 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
              <Anchor className="w-6 h-6 text-amber-500" />
              <div>
                <h2 className="text-xl font-bold">Welcome to {qrScannedYachtName}</h2>
                <p className="text-sm text-slate-300">{welcomeVideo.title}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowWelcomeVideo(false);
                setWelcomeVideo(null);
                setQrScannedYachtName(null);
              }}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-6 py-3 rounded-lg transition-all duration-300 shadow-lg"
            >
              Skip to Dashboard
              <X className="w-4 h-4" />
            </button>
          </div>

          <video
            src={welcomeVideo.video_url}
            className="w-full h-full object-contain"
            autoPlay
            playsInline
            poster={welcomeVideo.thumbnail_url || undefined}
            onEnded={() => {
              setShowWelcomeVideo(false);
              setWelcomeVideo(null);
              setQrScannedYachtName(null);
            }}
            onError={(e) => {
              console.error('[Dashboard QR] Video failed to load:', e);
              setTimeout(() => {
                setShowWelcomeVideo(false);
                setWelcomeVideo(null);
                setQrScannedYachtName(null);
              }, 2000);
            }}
          >
            Your browser does not support the video tag.
          </video>

          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-center">
            <p className="text-sm text-slate-400">Video will auto-advance to dashboard when complete</p>
          </div>
        </div>
      )}

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`w-64 bg-slate-900/90 border-r border-slate-700 flex flex-col fixed h-full z-40 transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo/Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Anchor className="w-7 h-7 text-amber-500" />
              <div>
                <h1 className="text-lg font-bold tracking-wide">MY YACHT TIME</h1>
                {yacht && <p className="text-xs text-amber-500 mt-0.5">{yacht.name}</p>}
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-1 rounded inline-block">v2026.02.01.A</div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => {
              setActiveTabPersisted('calendar');
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'calendar'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="font-medium">Owners Trip</span>
          </button>
          <button
            onClick={() => {
              setActiveTabPersisted('maintenance');
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'maintenance'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Wrench className="w-5 h-5" />
            <span className="font-medium">Maintenance</span>
          </button>
          {yacht?.name !== 'LOVIN LIFE' && (
            <button
              onClick={() => {
                setActiveTabPersisted('education');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'education'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BookOpen className="w-5 h-5" />
              <span className="font-medium">Education</span>
            </button>
          )}
          {isStaffRole(effectiveRole) && (
            <button
              onClick={() => {
                setActiveTabPersisted('staffCalendar');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'staffCalendar'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CalendarPlus className="w-5 h-5" />
              <span className="font-medium">Staff Schedule</span>
            </button>
          )}
          {isStaffRole(effectiveRole) && (
            <button
              onClick={() => {
                setActiveTabPersisted('timeClock');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'timeClock'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span className="font-medium">Time Clock</span>
            </button>
          )}
          {isMasterRole(effectiveRole) && (
            <button
              onClick={() => {
                setActiveTabPersisted('estimating');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'estimating'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Receipt className="w-5 h-5" />
              <span className="font-medium">Estimating</span>
            </button>
          )}

          {isStaffOrManager(effectiveRole) && (
            <button
              onClick={() => {
                setActiveTabPersisted('customers');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'customers'
                  ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="font-medium">Customers</span>
            </button>
          )}
          {(isStaffOrManager(effectiveRole) || isOwnerRole(effectiveRole)) && (
            <button
              onClick={() => {
                setActiveTabPersisted('admin');
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeTab === 'admin'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Shield className="w-5 h-5" />
              <span className="font-medium">Admin</span>
            </button>
          )}
        </nav>

        {/* User Profile & Actions */}
        <div className="p-4 border-t border-slate-700 space-y-2">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-sm font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
              <p className="text-xs text-slate-400 capitalize">{userProfile?.role || 'User'}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await refreshProfile();
              window.location.reload();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-amber-400 hover:bg-slate-800/50 rounded-lg transition-colors"
            title="Refresh profile data"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          {userProfile?.role === 'master' && (
            <div className="relative">
              <button
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-purple-400 hover:bg-slate-800/50 rounded-lg transition-colors"
                title="View as different role"
              >
                <UserCircle2 className="w-4 h-4" />
                <span>View As: {impersonatedRole ? impersonatedRole.charAt(0).toUpperCase() + impersonatedRole.slice(1) : 'Master'}</span>
              </button>

              {showRoleDropdown && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 z-50">
                  <div className="px-3 py-2 text-xs text-slate-500 border-b border-slate-700 mb-1">
                    Switch Role View
                  </div>
                  {(['owner', 'manager', 'staff', 'mechanic', 'master'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => {
                        setImpersonatedRole(role === 'master' ? null : role);
                        setShowRoleDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        (impersonatedRole === role || (role === 'master' && !impersonatedRole))
                          ? 'bg-purple-600/20 text-purple-400'
                          : 'text-slate-300 hover:bg-slate-700/50'
                      }`}
                    >
                      <span className="capitalize">{role}</span>
                      {(impersonatedRole === role || (role === 'master' && !impersonatedRole)) && (
                        <span className="ml-2 text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleOpenProfileEdit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-blue-400 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            <span>Edit Profile</span>
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 w-full">
        {isImpersonating && (
          <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 border-b border-purple-500 shadow-lg fixed top-0 left-0 lg:left-64 right-0 z-40">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5" />
                <div>
                  <span className="font-semibold">Role Impersonation Active</span>
                  <span className="ml-2 text-purple-100">
                    Viewing as: <span className="font-bold capitalize">{impersonatedRole}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setImpersonatedRole(null)}
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Exit Impersonation
              </button>
            </div>
          </div>
        )}
        {isImpersonatingYacht && (
          <div className={`bg-gradient-to-r from-teal-600 to-teal-700 text-white px-6 py-3 border-b border-teal-500 shadow-lg fixed ${isImpersonating ? 'top-12' : 'top-0'} left-0 lg:left-64 right-0 z-40`}>
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <Ship className="w-5 h-5" />
                <div>
                  <span className="font-semibold">Yacht View Active</span>
                  <span className="ml-2 text-teal-100">
                    Viewing: <span className="font-bold">{impersonatedYacht?.name}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setImpersonatedYacht(null)}
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
              >
                Exit Yacht View
              </button>
            </div>
          </div>
        )}
        <div className={`p-6 ${isImpersonating && isImpersonatingYacht ? 'pt-32' : isImpersonating || isImpersonatingYacht ? 'pt-20' : 'pt-20 lg:pt-6'}`}>
        <div className="max-w-7xl">
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-semibold">
                      {effectiveYacht?.name || 'Your Yacht'}
                    </h2>
                  </div>
                  {isMasterRole(userProfile?.role) && allYachts.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowYachtDropdown(!showYachtDropdown)}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <Ship className="w-4 h-4" />
                        Switch Yacht
                      </button>
                      {showYachtDropdown && (
                        <div className="absolute right-0 mt-2 w-64 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 z-50 overflow-hidden">
                          <div className="p-2 bg-slate-700/50 border-b border-slate-600">
                            <p className="text-xs text-slate-400 font-medium">Select Yacht to View</p>
                          </div>
                          <div className="max-h-96 overflow-y-auto">
                            {yacht && (
                              <button
                                onClick={() => {
                                  setImpersonatedYacht(null);
                                  setShowYachtDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 ${
                                  !isImpersonatingYacht ? 'bg-teal-600/20 text-teal-400' : 'text-white'
                                }`}
                              >
                                <div className="font-medium">{yacht.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5">Your Assigned Yacht</div>
                              </button>
                            )}
                            {allYachts
                              .filter((y) => y.id !== yacht?.id)
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((y) => (
                                <button
                                  key={y.id}
                                  onClick={() => {
                                    setImpersonatedYacht(y);
                                    setShowYachtDropdown(false);
                                  }}
                                  className={`w-full text-left px-4 py-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 ${
                                    impersonatedYacht?.id === y.id ? 'bg-teal-600/20 text-teal-400' : 'text-white'
                                  }`}
                                >
                                  <div className="font-medium">{y.name}</div>
                                  {y.marina_name && (
                                    <div className="text-xs text-slate-400 mt-0.5">{y.marina_name}</div>
                                  )}
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {effectiveYacht?.marina_name && (
                  <div className="mb-2 text-sm text-slate-400">
                    Marina: {effectiveYacht.marina_name}
                  </div>
                )}
                {effectiveYacht?.wifi_name && (
                  <div className="mb-2 text-sm">
                    <span className="text-slate-400">WiFi: </span>
                    <span className="text-white font-medium">{effectiveYacht.wifi_name}</span>
                  </div>
                )}
                {effectiveYacht?.wifi_password && (
                  <div className="mb-4 text-sm">
                    <span className="text-slate-400">WiFi Password: </span>
                    <span className="text-white font-medium">{effectiveYacht.wifi_password}</span>
                  </div>
                )}

                {welcomeVideo && effectiveYacht?.name !== 'LOVIN LIFE' && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Play className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-semibold text-white">Welcome Video</h3>
                    </div>
                    <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700 shadow-lg">
                      <video
                        controls
                        className="w-full aspect-video bg-black"
                        preload="metadata"
                        poster={welcomeVideo.thumbnail_url}
                        playsInline
                      >
                        <source src={welcomeVideo.video_url} type="video/mp4" />
                        <source src={welcomeVideo.video_url} type="video/quicktime" />
                        <source src={welcomeVideo.video_url} type="video/webm" />
                        Your browser does not support the video tag.
                      </video>
                      <div className="p-4 bg-gradient-to-b from-slate-800/50 to-slate-900/50">
                        <h4 className="font-semibold text-white text-sm mb-1">{welcomeVideo.title}</h4>
                        <p className="text-xs text-slate-400 leading-relaxed">{welcomeVideo.description}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!weatherLoading && weather && (
                  <div className="mb-4 space-y-3">
                    <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2 w-fit">
                      <Thermometer className="w-4 h-4 text-amber-500" />
                      <div>
                        <div className="text-xl font-bold text-white">{weather.temperature}°F</div>
                        <div className="text-xs text-slate-400">Page, AZ</div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <a
                        href="https://www.nps.gov/media/webcam/view.htm?id=81B467A0-1DD8-B71B-0B51A102635DCA0A&r=/glca/learn/photosmultimedia/webcams.htm"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Wahweap Launch Ramp Webcam
                      </a>
                      <a
                        href="https://www.nps.gov/media/webcam/view.htm?id=81B467AE-1DD8-B71B-0B226302ED38EEA5&r=/glca/learn/photosmultimedia/webcams.htm"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Stateline Launch Ramp Webcam
                      </a>
                      <a
                        href="https://www.youtube.com/watch?v=N9tH-8UOFasll"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Antelope Point Webcam
                      </a>
                    </div>
                  </div>
                )}

                {loading ? (
                  <p className="text-slate-400">Loading booking information...</p>
                ) : activeBooking ? (
                  <>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Trip Departure</p>
                        <div className="text-2xl font-bold">
                          {formatDate(activeBooking.start_date)}
                        </div>
                        <div className="text-xl text-slate-300">
                          {formatTime(activeBooking.start_date)}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 mb-1">Trip Arrival</p>
                        <div className="text-2xl font-bold">
                          {formatDate(activeBooking.end_date)}
                        </div>
                        <div className="text-xl text-slate-300">
                          {formatTime(activeBooking.end_date)}
                        </div>
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-4">
                      <p className="text-amber-200 text-sm text-center font-medium">
                        Please do not Check In until you are on the boat, and wait to Check Out until the Yacht is in its slip. We can't change it once pressed.
                      </p>
                    </div>

                    {!isWithinBookingPeriod(activeBooking) && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                        <p className="text-blue-200 text-sm text-center font-medium">
                          Check-in and check-out are only available during your scheduled booking period.
                        </p>
                      </div>
                    )}

                    <div className="space-y-3 pt-4">
                      <button
                        onClick={handleCheckIn}
                        disabled={activeBooking.checked_in || !isWithinBookingPeriod(activeBooking)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {activeBooking.checked_in ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            Checked In
                          </>
                        ) : (
                          'Check In'
                        )}
                      </button>

                      <button
                        onClick={handleCheckOut}
                        disabled={activeBooking.checked_out || !activeBooking.checked_in || !isWithinBookingPeriod(activeBooking)}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {activeBooking.checked_out ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-green-400" />
                            Checked Out
                          </>
                        ) : (
                          'Check Off Departure'
                        )}
                      </button>

                      {!activeBooking.checked_out && (
                        <button
                          onClick={() => setActiveTabPersisted('maintenance')}
                          className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-all duration-300"
                        >
                          Make Maintenance Request
                        </button>
                      )}
                    </div>
                  </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                    <p className="text-slate-400">No active bookings scheduled</p>
                  </div>
                )}
              </div>

              {/* Lake Powell Water Level */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Lake Powell Water Level</h3>
                  <a
                    href="https://powell.uslakes.info/Level/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    View Full Chart
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>

                {waterLevelLoading ? (
                  <div className="text-center py-8 text-slate-400">
                    Loading current water level...
                  </div>
                ) : waterLevelData ? (
                  <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-lg p-6 border border-blue-700/50">
                    <div className="text-center">
                      <div className="text-sm text-slate-400 mb-2">Current Elevation</div>
                      <div className="text-5xl font-bold text-blue-300 mb-1">
                        {parseFloat(waterLevelData.elevation).toFixed(2)}
                      </div>
                      <div className="text-xl text-slate-300 mb-4">feet</div>
                      <div className="text-xs text-slate-400">
                        Last updated: {waterLevelData.date}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        Glen Canyon Dam • USGS Data
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    Unable to load water level data
                  </div>
                )}

                <div className="mt-6 pt-6 border-t border-slate-700">
                  <h4 className="text-sm font-semibold text-slate-300 mb-3">Minimum Access Levels</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Wahweap Ramp</span>
                      <span className="text-blue-300 font-medium">3550 ft</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Stateline Ramp</span>
                      <span className="text-blue-300 font-medium">3520 ft</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Antelope Point Public Ramp</span>
                      <span className="text-blue-300 font-medium">3588 ft</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Valet Ramp</span>
                      <span className="text-blue-300 font-medium">3540 ft</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Castle Rock Cut</span>
                      <span className="text-blue-300 font-medium">3583 ft</span>
                    </div>
                  </div>
                </div>

                <a
                  href="https://powell.uslakes.info/Level/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold py-3 rounded-lg transition-all duration-300"
                >
                  View Historical Chart & Trends
                </a>
              </div>
              </div>

              {/* Smart Lock Controls */}
              {yacht && hasSmartDevices && (
                <SmartLockControls
                  yachtId={effectiveYacht.id}
                  userId={user!.id}
                  userName={`${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim() || userProfile?.email || 'Unknown'}
                  hasActiveBooking={activeBooking ? !activeBooking.checked_out : false}
                />
              )}

              {bookings.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Recent Bookings</h3>
                  <div className="space-y-3">
                    {bookings.slice(0, 3).map((booking) => (
                      <div
                        key={booking.id}
                        className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">
                              {formatDate(booking.start_date)} - {formatDate(booking.end_date)}
                            </div>
                            {(booking as any).user_profiles && (
                              <div className="text-sm text-slate-300 mt-1">
                                {(booking as any).user_profiles.first_name} {(booking as any).user_profiles.last_name}
                              </div>
                            )}
                            <div className="text-sm text-slate-400 mt-1">
                              {booking.checked_in && 'Checked In'}
                              {booking.checked_out && ' • Checked Out'}
                            </div>
                          </div>
                          {booking.checked_in && booking.checked_out && (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isAntelopePoint() && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Antelope Point</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => window.open('https://share.hsforms.com/1saGMMmyZSRu6bgPwR2YC3Aqgylg', '_blank')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                    >
                      Book Trip including Cathedral Cleaning Package
                    </button>
                    <button
                      onClick={() => window.open('https://share.hsforms.com/1wLei4o0HTL6knc738ffwXQqgylg', '_blank')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                    >
                      Book Trip & Turnaround without Cleaning Package
                    </button>
                    <button
                      onClick={() => window.open('https://share.hsforms.com/13sFPShojQni7ZaOfBJB5mAqgylg', '_blank')}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                    >
                      Update your trips deliverables
                    </button>

                    <button
                      onClick={() => window.open('https://beachbagsanchors.com/', '_blank')}
                      className="w-full mt-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 rounded-lg transition-all duration-300"
                    >
                      Beach Bags Anchors
                    </button>

                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <h4 className="font-semibold text-lg mb-3">Hours of Operation</h4>
                      <p className="text-slate-300 mb-4">Antelope Point Marina runs on Arizona time zone 928-645-5900</p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h5 className="font-semibold text-amber-500 mb-2">On-season – May 6th to Sept. 31st</h5>
                          <div className="space-y-1 text-sm text-slate-300">
                            <p><span className="text-slate-400">APEX office:</span> 8:00am – 6:00pm, 7 days a week</p>
                            <p><span className="text-slate-400">Pilot service:</span> 7:00am – 6:00pm, 7 days a week</p>
                            <p><span className="text-slate-400">Cart Service:</span> 24/7</p>
                            <p><span className="text-slate-400">Valet Launch:</span> 7:00am – 7:00pm, 7 days a week</p>
                          </div>
                        </div>

                        <div>
                          <h5 className="font-semibold text-amber-500 mb-2">Off-season – Oct 1st to May 1st</h5>
                          <div className="space-y-1 text-sm text-slate-300">
                            <p><span className="text-slate-400">APEX office:</span> 9:00am – 4:00pm, M-F</p>
                            <p><span className="text-slate-400">Pilot service:</span> 9:00am – 4:00pm, M-F</p>
                            <p><span className="text-slate-400">Cart Service:</span> 24/7</p>
                            <p><span className="text-slate-400">Valet Launch:</span> 9:00am – 3:00pm, 7 days a week</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <h4 className="font-semibold text-lg mb-3">Other Important Contacts</h4>

                      <div className="mb-6 bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-300 mb-3 flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                          </svg>
                          Marine Radio
                        </h5>
                        <div className="text-sm text-slate-200 space-y-2">
                          <p className="font-medium text-blue-200">Call from channel 16</p>
                          <ul className="space-y-1.5 ml-4">
                            <li><span className="font-medium text-amber-400">Emergency:</span> Hail National Park Service</li>
                            <li><span className="font-medium text-amber-400">Pilot Service, Docks 3 & 4:</span> Hail Apex Pilot Service</li>
                            <li className="ml-6"><span className="font-medium text-amber-400">Dock 2:</span> Hail Turnaround Pilot Service</li>
                            <li><span className="font-medium text-amber-400">Valet Service:</span> Hail Antelope Valet</li>
                            <li><span className="font-medium text-amber-400">Cart Service:</span> Hail Antelope Cart Service</li>
                          </ul>
                          <p className="mt-3 pt-3 border-t border-blue-700/50 text-slate-300 italic">
                            No matter who you are calling, always say your yacht name when hailing the service you want to speak to. When they call you back they will tell you to switch to a different channel. Go to that channel to finish your conversation.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div className="space-y-2">
                          <div className="py-2 border-b border-slate-700/50">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-slate-300 font-medium">Valet Service</span>
                              <a href="tel:928-608-4491" className="text-blue-400 hover:text-blue-300 font-medium">928-608-4491</a>
                            </div>
                            <div className="text-xs text-slate-400">
                              <a href="mailto:jtsinijinni@apmlp.com" className="hover:text-blue-400">jtsinijinni@apmlp.com</a>
                            </div>
                          </div>
                          <div className="py-2 border-b border-slate-700/50">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-slate-300 font-medium">Guest Service</span>
                              <a href="tel:928-608-4457" className="text-blue-400 hover:text-blue-300 font-medium">928-608-4457</a>
                            </div>
                            <div className="text-xs text-slate-400">
                              <a href="mailto:guestservices@apmlp.com" className="hover:text-blue-400">guestservices@apmlp.com</a>
                            </div>
                          </div>
                          <div className="py-2 border-b border-slate-700/50">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-slate-300 font-medium">APEX</span>
                              <a href="tel:928-645-5900" className="text-blue-400 hover:text-blue-300 font-medium">928-645-5900 ext. 5088</a>
                            </div>
                            <div className="text-xs text-slate-400">
                              <a href="mailto:APEX@apmlp.com" className="hover:text-blue-400">APEX@apmlp.com</a>
                            </div>
                          </div>
                          <div className="py-2 border-b border-slate-700/50">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-slate-300 font-medium">Turnaround Service</span>
                              <a href="tel:928-608-4482" className="text-blue-400 hover:text-blue-300 font-medium">928-608-4482</a>
                            </div>
                            <div className="text-xs text-slate-400">
                              <a href="mailto:Turnaround@apmlp.com" className="hover:text-blue-400">Turnaround@apmlp.com</a>
                            </div>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                            <span className="text-slate-300">AZ Marine</span>
                            <a href="tel:928-637-6500" className="text-blue-400 hover:text-blue-300 font-medium">928-637-6500</a>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-slate-300">Wahweap Exec. Service</span>
                            <a href="tel:928-645-1037" className="text-blue-400 hover:text-blue-300 font-medium">928-645-1037</a>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                            <span className="text-slate-300">Poison Control</span>
                            <a href="tel:800-222-1222" className="text-blue-400 hover:text-blue-300 font-medium">800-222-1222</a>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                            <span className="text-slate-300">National Park Service</span>
                            <a href="tel:928-608-6200" className="text-blue-400 hover:text-blue-300 font-medium">928-608-6200</a>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                            <span className="text-slate-300">Page, AZ Police</span>
                            <a href="tel:928-645-4355" className="text-blue-400 hover:text-blue-300 font-medium">928-645-4355</a>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                            <span className="text-slate-300">Kane County Sheriff</span>
                            <a href="tel:435-644-2349" className="text-blue-400 hover:text-blue-300 font-medium">435-644-2349</a>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-slate-300">San Juan County Sheriff</span>
                            <a href="tel:435-587-2237" className="text-blue-400 hover:text-blue-300 font-medium">435-587-2237</a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                <div className="mb-4">
                  <p className="text-slate-400">Yacht:</p>
                  <p className="text-lg font-semibold">{effectiveYacht?.name || 'No yacht assigned'}</p>
                </div>
                <div>
                  <p className="text-slate-400">Owner Email:</p>
                  <p className="text-lg font-semibold">{user?.email}</p>
                </div>
              </div>

              <form onSubmit={handleMaintenanceSubmit} className="space-y-6">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-xl font-semibold mb-4">New Maintenance Request</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Urgency
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setMaintenanceSubject('Repair ASAP')}
                          className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                            maintenanceSubject === 'Repair ASAP'
                              ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                              : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div className="font-semibold">Repair ASAP</div>
                          <div className="text-xs mt-1 opacity-80">Needs immediate attention</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setMaintenanceSubject('Can be repaired after my trip')}
                          className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                            maintenanceSubject === 'Can be repaired after my trip'
                              ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                              : 'border-slate-600 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          <div className="font-semibold">After My Trip</div>
                          <div className="text-xs mt-1 opacity-80">Not urgent, can wait</div>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium mb-2">
                        Description
                      </label>
                      <textarea
                        id="description"
                        value={maintenanceDescription}
                        onChange={(e) => setMaintenanceDescription(e.target.value)}
                        placeholder="Provide detailed information about the maintenance request..."
                        rows={8}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="maintenancePhoto" className="block text-sm font-medium mb-2">
                        Photo (Optional)
                      </label>
                      <div className="space-y-3">
                        {!maintenancePhotoPreview ? (
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-amber-500 transition-colors bg-slate-900/30">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 mb-2 text-slate-400" />
                              <p className="text-sm text-slate-400">Click to upload photo</p>
                              <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                            </div>
                            <input
                              id="maintenancePhoto"
                              type="file"
                              accept="image/*"
                              onChange={handleMaintenancePhotoChange}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <div className="relative">
                            <img
                              src={maintenancePhotoPreview}
                              alt="Preview"
                              className="w-full h-48 object-cover rounded-lg border border-slate-600"
                            />
                            <button
                              type="button"
                              onClick={handleRemoveMaintenancePhoto}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {maintenanceError && (
                  <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                    {maintenanceError}
                  </div>
                )}

                {maintenanceSuccess && (
                  <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                    Maintenance request submitted successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={maintenanceLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" />
                  {maintenanceLoading ? 'Sending...' : 'Send to Manager'}
                </button>
              </form>

              {maintenanceRequests.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Your Requests</h3>
                  <div className="space-y-3">
                    {maintenanceRequests.slice(0, 5).map((request) => (
                      <div
                        key={request.id}
                        className="bg-slate-900/50 rounded-lg p-4 border border-slate-700"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium">{request.subject}</h4>
                            {request.yacht_name && (
                              <p className="text-xs text-slate-400 mt-1">
                                Yacht: {request.yacht_name}
                              </p>
                            )}
                            {request.first_name && request.last_name && (
                              <p className="text-xs text-slate-500 mt-1">
                                Submitted by: {request.first_name} {request.last_name}
                              </p>
                            )}
                          </div>
                          <span className={`text-sm ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2 line-clamp-2">{request.description}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className={getPriorityColor(request.priority)}>
                            {request.priority} priority
                          </span>
                          <span>{formatDate(request.created_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'education' && yacht?.name !== 'LOVIN LIFE' && (
            <div className="space-y-6">
              {selectedVideo ? (
                <>
                  <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl mb-6">
                    {selectedVideo.video_url ? (
                      <video
                        src={selectedVideo.video_url}
                        controls
                        autoPlay
                        playsInline
                        preload="metadata"
                        crossOrigin="anonymous"
                        className="w-full aspect-video bg-black"
                        poster={selectedVideo.thumbnail_url}
                      />
                    ) : (
                      <div className="aspect-video bg-slate-800 flex items-center justify-center">
                        <div className="text-center">
                          <Play className="w-20 h-20 text-amber-500 mx-auto mb-4" />
                          <p className="text-slate-400">No video URL available</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 mb-6">
                    <div className="inline-block bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-sm font-medium mb-4">
                      {selectedVideo.category}
                    </div>
                    <h2 className="text-2xl font-bold mb-3">{selectedVideo.title}</h2>
                    <p className="text-slate-300 leading-relaxed">{selectedVideo.description}</p>
                  </div>

                  <button
                    onClick={() => setSelectedVideo(null)}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                  >
                    Back to Videos
                  </button>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">Education</h2>
                      <p className="text-slate-400">{editMode ? 'Edit video details and order' : 'Click any video to watch'}</p>
                    </div>
                    {isStaffOrManager(effectiveRole) && (
                      <div className="flex items-center gap-3">
                        {editMode ? (
                          <>
                            <button
                              onClick={handleCancelEdit}
                              className="flex items-center gap-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                              <X className="w-5 h-5" />
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveVideos}
                              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                              <Save className="w-5 h-5" />
                              Save Changes
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleEnterEditMode}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                              <Pencil className="w-5 h-5" />
                              Edit Videos
                            </button>
                            <button
                              onClick={() => setShowVideoUploadModal(true)}
                              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-4 py-2 rounded-lg transition-colors"
                            >
                              <Upload className="w-5 h-5" />
                              Add Video
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {videos.length === 0 ? (
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-12 border border-slate-700 text-center">
                      <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">No educational content available</p>
                    </div>
                  ) : selectedCategory ? (
                    <>
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className="flex items-center gap-2 text-amber-500 hover:text-amber-400 mb-6 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                        Back to Categories
                      </button>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.filter(v => {
                          if (v.category !== selectedCategory) return false;
                          if (!canAccessAllYachts(effectiveRole) && (v.category === 'SignIn' || v.category === 'Welcome')) {
                            return false;
                          }
                          return true;
                        }).map((video) => (
                          <div
                            key={video.id}
                            className="relative group bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20"
                          >
                            <div
                              onClick={() => setSelectedVideo(video)}
                              className="cursor-pointer overflow-hidden rounded-2xl"
                            >
                              <div className="relative aspect-video bg-slate-900 overflow-hidden">
                                {video.thumbnail_url ? (
                                  <>
                                    <img
                                      src={video.thumbnail_url}
                                      alt={video.title}
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent pointer-events-none"></div>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="bg-amber-500 rounded-full p-4 group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                                        <Play className="w-6 h-6 text-slate-900 fill-slate-900" />
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <Play className="w-16 h-16 text-amber-500" />
                                  </div>
                                )}
                              </div>
                              <div className="p-4">
                                <h4 className="text-lg font-bold mb-1 group-hover:text-amber-500 transition-colors">
                                  {video.title}
                                </h4>
                                <p className="text-slate-400 text-sm line-clamp-2">{video.description}</p>
                              </div>
                            </div>
                            {isStaffOrManager(effectiveRole) && !editMode && (
                              <div className="absolute top-2 right-2 flex gap-2 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingVideos({
                                      [video.id]: {
                                        title: video.title,
                                        description: video.description,
                                        category: video.category,
                                        order_index: video.order_index || 0,
                                        thumbnail_url: video.thumbnail_url || ''
                                      }
                                    });
                                    setEditMode(true);
                                  }}
                                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors shadow-lg"
                                  title="Edit video"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteVideo(video.id);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors shadow-lg"
                                  title="Delete video"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : editMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {videos.map((video) => (
                        <div
                          key={video.id}
                          className="bg-slate-800/50 backdrop-blur-sm rounded-xl overflow-hidden border border-slate-700 text-left"
                        >
                          <div className="relative">
                            <img
                              src={video.thumbnail_url || 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=400'}
                              alt={video.title}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-48 object-cover"
                            />
                            <div className="absolute top-2 right-2">
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Order</label>
                              <input
                                type="number"
                                value={editingVideos[video.id]?.order_index ?? 0}
                                onChange={(e) => setEditingVideos({
                                  ...editingVideos,
                                  [video.id]: {
                                    ...editingVideos[video.id],
                                    order_index: parseInt(e.target.value) || 0
                                  }
                                })}
                                className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Category</label>
                              <input
                                type="text"
                                value={editingVideos[video.id]?.category ?? ''}
                                onChange={(e) => setEditingVideos({
                                  ...editingVideos,
                                  [video.id]: {
                                    ...editingVideos[video.id],
                                    category: e.target.value
                                  }
                                })}
                                className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Title</label>
                              <input
                                type="text"
                                value={editingVideos[video.id]?.title ?? ''}
                                onChange={(e) => setEditingVideos({
                                  ...editingVideos,
                                  [video.id]: {
                                    ...editingVideos[video.id],
                                    title: e.target.value
                                  }
                                })}
                                className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-1">Description</label>
                              <textarea
                                value={editingVideos[video.id]?.description ?? ''}
                                onChange={(e) => setEditingVideos({
                                  ...editingVideos,
                                  [video.id]: {
                                    ...editingVideos[video.id],
                                    description: e.target.value
                                  }
                                })}
                                rows={3}
                                className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-400 block mb-2">Thumbnail Image</label>
                              <div className="space-y-2">
                                {(editingThumbnails[video.id] || video.thumbnail_url) && (
                                  <div className="relative w-full h-32 bg-slate-900 rounded-lg overflow-hidden">
                                    <img
                                      src={editingThumbnails[video.id] ? URL.createObjectURL(editingThumbnails[video.id]) : video.thumbnail_url}
                                      alt="Thumbnail preview"
                                      loading="lazy"
                                      decoding="async"
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setEditingThumbnails({
                                        ...editingThumbnails,
                                        [video.id]: file
                                      });
                                    }
                                  }}
                                  className="w-full bg-slate-700 text-white px-3 py-2 rounded-lg text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-slate-900 hover:file:bg-amber-600 file:cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                    ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from(new Set(videos.map(v => v.category)))
                        .filter(category => {
                          if (!canAccessAllYachts(effectiveRole) && (category === 'SignIn' || category === 'Welcome')) {
                            return false;
                          }
                          return true;
                        })
                        .sort((a, b) => {
                          const categoryOrder = ['Introduction', 'General Systems', 'Generators'];
                          const indexA = categoryOrder.indexOf(a);
                          const indexB = categoryOrder.indexOf(b);

                          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                          if (indexA !== -1) return -1;
                          if (indexB !== -1) return 1;
                          return a.localeCompare(b);
                        }).map((category) => {
                          const videoCount = videos.filter(v => v.category === category).length;
                          const firstVideo = videos.find(v => v.category === category);
                          const categoryThumbnail = firstVideo?.thumbnail_url || 'https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=400';

                          return (
                            <div
                              key={category}
                              onClick={() => setSelectedCategory(category)}
                              className="group cursor-pointer bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/20"
                            >
                              <div className="relative aspect-video bg-slate-900 overflow-hidden rounded-t-2xl">
                                <img
                                  src={categoryThumbnail}
                                  alt={category}
                                  loading="eager"
                                  decoding="async"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="bg-amber-500 rounded-2xl p-5 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300 shadow-2xl inline-block">
                                      <Folder className="w-10 h-10 text-slate-900" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="p-6">
                                <h4 className="text-xl font-bold mb-2 group-hover:text-amber-500 transition-colors">
                                  {category}
                                </h4>
                                <p className="text-slate-400 text-sm">
                                  {videoCount} {videoCount === 1 ? 'video' : 'videos'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'staffCalendar' && (
            <div>
              <StaffCalendar onBack={() => setActiveTabPersisted('calendar')} />
            </div>
          )}

          {activeTab === 'timeClock' && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
              <TimeClock />
            </div>
          )}

          {activeTab === 'estimating' && (
            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
              <EstimatingDashboard userId={user?.id || ''} />
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="bg-white rounded-2xl border border-slate-300 overflow-hidden">
              <CustomerManagement />
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-6">
              {adminView === 'menu' ? (
                <>
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
                    <p className="text-slate-400">Manage yacht operations and inspections</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <button
                      onClick={() => setAdminView('mastercalendar')}
                      className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-teal-500/20 p-4 rounded-xl group-hover:bg-teal-500/30 transition-colors">
                          <Calendar className="w-8 h-8 text-teal-500" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-2">Master Calendar</h3>
                      <p className="text-slate-400 text-sm">{isOwnerRole(effectiveRole) ? 'View your yacht trip schedule' : 'View all owner trips across all yachts'}</p>
                    </button>

                    {!isOwnerRole(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('messages')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-cyan-500/20 p-4 rounded-xl group-hover:bg-cyan-500/30 transition-colors">
                            <Mail className="w-8 h-8 text-cyan-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">New Messages</h3>
                        <p className="text-slate-400 text-sm">View all incoming messages and appointments</p>
                      </button>
                    )}

                    {canAccessAllYachts(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('appointments')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-orange-500/20 p-4 rounded-xl group-hover:bg-orange-500/30 transition-colors">
                            <CalendarPlus className="w-8 h-8 text-orange-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Create Appointment</h3>
                        <p className="text-slate-400 text-sm">Schedule customer appointments and repairs</p>
                      </button>
                    )}

                    {canManageYacht(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('inspection')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-amber-500/20 p-4 rounded-xl group-hover:bg-amber-500/30 transition-colors">
                            <ClipboardCheck className="w-8 h-8 text-amber-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Trip Inspection Form</h3>
                        <p className="text-slate-400 text-sm">Complete check-in and check-out inspections for yacht trips</p>
                      </button>
                    )}

                    {canManageYacht(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('ownerhandoff')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-emerald-500/20 p-4 rounded-xl group-hover:bg-emerald-500/30 transition-colors">
                            <UserCheck className="w-8 h-8 text-emerald-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Meet the Yacht Owner</h3>
                        <p className="text-slate-400 text-sm">Complete pre-handoff checklist before owner arrival</p>
                      </button>
                    )}

                    {isStaffOrManager(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('repairs')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-orange-500/20 p-4 rounded-xl group-hover:bg-orange-500/30 transition-colors">
                            <FileUp className="w-8 h-8 text-orange-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Repair Requests</h3>
                        <p className="text-slate-400 text-sm">Upload files and request repair approvals</p>
                      </button>
                    )}

                    {canManageYacht(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('ownertrips')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-green-500/20 p-4 rounded-xl group-hover:bg-green-500/30 transition-colors">
                            <CalendarPlus className="w-8 h-8 text-green-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Owner Trips</h3>
                        <p className="text-slate-400 text-sm">Schedule and manage owner yacht trips</p>
                      </button>
                    )}

                    {(isOwnerRole(effectiveRole) || canManageYacht(effectiveRole)) && (
                      <button
                        onClick={() => setAdminView('ownerchat')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-purple-500/20 p-4 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                          <MessageCircle className="w-8 h-8 text-purple-500" />
                        </div>
                      </div>
                        <h3 className="text-xl font-bold mb-2">Owner Chat</h3>
                        <p className="text-slate-400 text-sm">{isOwnerRole(effectiveRole) ? 'Chat with all owners on your yacht' : 'Connect and chat with all yacht owners'}</p>
                      </button>
                    )}

                    {isStaffOrManager(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('yachts')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-blue-500/20 p-4 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                            <Ship className="w-8 h-8 text-blue-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Yachts</h3>
                        <p className="text-slate-400 text-sm">Manage yacht fleet and vessel information</p>
                      </button>
                    )}

                    {isMasterRole(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('smartdevices')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-green-500/20 p-4 rounded-xl group-hover:bg-green-500/30 transition-colors">
                            <Lock className="w-8 h-8 text-green-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">Smart Devices</h3>
                        <p className="text-slate-400 text-sm">Manage smart locks and device credentials</p>
                      </button>
                    )}

                    {canManageYacht(effectiveRole) && (
                      <button
                        onClick={() => setAdminView('users')}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-blue-500/20 p-4 rounded-xl group-hover:bg-blue-500/30 transition-colors">
                            <Users className="w-8 h-8 text-blue-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">User Management</h3>
                        <p className="text-slate-400 text-sm">View and edit user profiles and assignments</p>
                      </button>
                    )}
                  </div>
                </>
              ) : adminView === 'inspection' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center gap-3 mb-6">
                    <ClipboardCheck className="w-8 h-8 text-amber-500" />
                    <div>
                      <h2 className="text-2xl font-bold">Trip Inspection Form</h2>
                      <p className="text-slate-400">Post trip inspection form</p>
                    </div>
                  </div>

                  <form onSubmit={handleInspectionSubmit} className="space-y-6">
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-xl font-semibold mb-4">Inspection Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="yacht" className="block text-sm font-medium mb-2">
                        Select Yacht
                      </label>
                      <select
                        id="yacht"
                        value={selectedYachtForInspection}
                        onChange={(e) => setSelectedYachtForInspection(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white"
                        required
                      >
                        <option value="">Choose a yacht...</option>
                        {allYachts.map((yacht) => (
                          <option key={yacht.id} value={yacht.id}>
                            {yacht.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="mechanic" className="block text-sm font-medium mb-2">
                        Mechanic completing Inspection
                      </label>
                      <select
                        id="mechanic"
                        value={selectedMechanicId}
                        onChange={(e) => setSelectedMechanicId(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white"
                        required
                      >
                        <option value="">Choose a mechanic...</option>
                        {mechanics.map((mechanic) => (
                          <option key={mechanic.id} value={mechanic.user_id}>
                            {mechanic.first_name} {mechanic.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Exterior Hull</h3>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Hull Damage</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <button
                          type="button"
                          onClick={() => setInspectionForm({ ...inspectionForm, hull_condition: 'excellent' })}
                          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                            inspectionForm.hull_condition === 'excellent'
                              ? 'bg-amber-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          No new damage
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectionForm({ ...inspectionForm, hull_condition: 'poor' })}
                          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                            inspectionForm.hull_condition === 'poor'
                              ? 'bg-amber-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          New damage
                        </button>
                      </div>
                      <textarea
                        value={inspectionForm.hull_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, hull_notes: e.target.value })}
                        placeholder="Notate new damage here"
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Shore Cords</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <button
                          type="button"
                          onClick={() => setInspectionForm({ ...inspectionForm, deck_condition: 'excellent' })}
                          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                            inspectionForm.deck_condition === 'excellent'
                              ? 'bg-amber-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectionForm({ ...inspectionForm, deck_condition: 'poor' })}
                          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                            inspectionForm.deck_condition === 'poor'
                              ? 'bg-amber-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          Need repairs
                        </button>
                      </div>
                      <textarea
                        value={inspectionForm.deck_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, deck_notes: e.target.value })}
                        placeholder="Notate repairs need or replacement"
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Trash Removed from Storage Compartment</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <button
                          type="button"
                          onClick={() => setInspectionForm({ ...inspectionForm, trash_removed: 'ok' })}
                          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                            inspectionForm.trash_removed === 'ok'
                              ? 'bg-amber-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          OK
                        </button>
                        <button
                          type="button"
                          onClick={() => setInspectionForm({ ...inspectionForm, trash_removed: 'needs_service' })}
                          className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                            inspectionForm.trash_removed === 'needs_service'
                              ? 'bg-amber-500 text-slate-900'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}
                        >
                          Needs Service
                        </button>
                      </div>
                      <textarea
                        value={inspectionForm.trash_removed_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, trash_removed_notes: e.target.value })}
                        placeholder="Additional notes"
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Engine Hours</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Port Engine Hours</label>
                      <input
                        type="text"
                        value={inspectionForm.cabin_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, cabin_notes: e.target.value })}
                        placeholder="Enter hours"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Starboard Engine Hours</label>
                      <input
                        type="text"
                        value={inspectionForm.galley_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, galley_notes: e.target.value })}
                        placeholder="Enter hours"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Port Generator Hours</label>
                      <input
                        type="text"
                        value={inspectionForm.head_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, head_notes: e.target.value })}
                        placeholder="Enter hours"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Starboard Generator Hours</label>
                      <input
                        type="text"
                        value={inspectionForm.cabin_condition}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, cabin_condition: e.target.value as ConditionRating })}
                        placeholder="Enter hours"
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Main Cabin</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Inverter System</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, inverter_system: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.inverter_system === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.inverter_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, inverter_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Master Bedroom Bathroom</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, master_bathroom: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.master_bathroom === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.master_bathroom_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, master_bathroom_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Secondary Bathroom</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, secondary_bathroom: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.secondary_bathroom === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.secondary_bathroom_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, secondary_bathroom_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Lower Sinks</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, lower_sinks: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.lower_sinks === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.lower_sinks_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, lower_sinks_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Kitchen Sink</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, kitchen_sink: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.kitchen_sink === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.kitchen_sink_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, kitchen_sink_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Garbage Disposal</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, garbage_disposal: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.garbage_disposal === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.garbage_disposal_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, garbage_disposal_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Stove Top</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, stove_top: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.stove_top === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.stove_top_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, stove_top_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Dishwasher</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, dishwasher: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.dishwasher === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.dishwasher_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, dishwasher_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Trash Compactor</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, trash_compactor: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.trash_compactor === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.trash_compactor_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, trash_compactor_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">12 Volt Fans</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, volt_fans: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.volt_fans === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.volt_fans_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, volt_fans_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Lower Basement Equipment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">A/C Filters</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, ac_filters: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.ac_filters === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.ac_filters_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, ac_filters_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">A/C Water Pumps</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, ac_water_pumps: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.ac_water_pumps === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.ac_water_pumps_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, ac_water_pumps_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Water Filters</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, water_filters: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.water_filters === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.water_filters_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, water_filters_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Water Pumps and Controls</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, water_pumps_controls: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.water_pumps_controls === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.water_pumps_controls_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, water_pumps_controls_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Upper Deck</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Upper Deck Bathroom</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, upper_deck_bathroom: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.upper_deck_bathroom === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.upper_deck_bathroom_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, upper_deck_bathroom_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Kitchen Sink</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, upper_kitchen_sink: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.upper_kitchen_sink === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.upper_kitchen_sink_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, upper_kitchen_sink_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Disposal</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, upper_disposal: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.upper_disposal === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.upper_disposal_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, upper_disposal_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Icemaker</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, icemaker: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.icemaker === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.icemaker_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, icemaker_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Stove Top</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, upper_stove_top: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.upper_stove_top === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.upper_stove_top_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, upper_stove_top_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Propane Filled and Connected</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, propane: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.propane === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.propane_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, propane_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Windless Anchors Port Side</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, windless_port: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.windless_port === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.windless_port_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, windless_port_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Windless Anchor Starboard</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, windless_starboard: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.windless_starboard === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.windless_starboard_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, windless_starboard_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Anchors Lines</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, anchor_lines: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.anchor_lines === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.anchor_lines_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, anchor_lines_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">A/C Filter</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, upper_ac_filter: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.upper_ac_filter === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.upper_ac_filter_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, upper_ac_filter_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Engine Compartment</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium mb-2">Port Engine Oil</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, port_engine_oil: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.port_engine_oil === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.port_engine_oil_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, port_engine_oil_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Port Generator Oil</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, port_generator_oil: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.port_generator_oil === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.port_generator_oil_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, port_generator_oil_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Starboard Generator Oil</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, starboard_generator_oil: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.starboard_generator_oil === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.starboard_generator_oil_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, starboard_generator_oil_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Starboard Engine Oil</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, starboard_engine_oil: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.starboard_engine_oil === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.starboard_engine_oil_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, starboard_engine_oil_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Sea Strainers</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, sea_strainers: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.sea_strainers === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.sea_strainers_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, sea_strainers_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Engine Batteries</label>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        {['ok', 'needs service'].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => setInspectionForm({ ...inspectionForm, engine_batteries: rating as ConditionRating })}
                            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                              inspectionForm.engine_batteries === rating
                                ? 'bg-amber-500 text-slate-900'
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }`}
                          >
                            {rating.charAt(0).toUpperCase() + rating.slice(1)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={inspectionForm.engine_batteries_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, engine_batteries_notes: e.target.value })}
                        placeholder="Document issues..."
                        rows={2}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-semibold mb-4">Any Other Issues</h3>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="additionalNotes" className="block text-sm font-medium mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        id="additionalNotes"
                        value={inspectionForm.additional_notes}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, additional_notes: e.target.value })}
                        placeholder="Any other observations or concerns..."
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        id="issuesFound"
                        type="checkbox"
                        checked={inspectionForm.issues_found}
                        onChange={(e) => setInspectionForm({ ...inspectionForm, issues_found: e.target.checked })}
                        className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
                      />
                      <label htmlFor="issuesFound" className="text-sm font-medium">
                        Issues found that require attention
                      </label>
                    </div>
                  </div>
                </div>

                {inspectionError && (
                  <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                    {inspectionError}
                  </div>
                )}

                {inspectionSuccess && (
                  <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                    Inspection submitted successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={inspectionLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <ClipboardCheck className="w-5 h-5" />
                  {inspectionLoading ? 'Submitting...' : 'Submit Inspection'}
                </button>
              </form>
                </>
              ) : adminView === 'ownerhandoff' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-emerald-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center gap-3 mb-6">
                    <UserCheck className="w-8 h-8 text-emerald-500" />
                    <div>
                      <h2 className="text-2xl font-bold">Meet the Yacht Owner</h2>
                      <p className="text-slate-400">Pre-handoff inspection checklist</p>
                    </div>
                  </div>

                  <form onSubmit={handleOwnerHandoffSubmit} className="space-y-6">
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-xl font-semibold mb-4">Inspection Details</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="handoff-yacht" className="block text-sm font-medium mb-2">
                            Select Yacht
                          </label>
                          <select
                            id="handoff-yacht"
                            value={selectedYachtForHandoff}
                            onChange={(e) => setSelectedYachtForHandoff(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white"
                            required
                          >
                            <option value="">Choose a yacht...</option>
                            {allYachts.map((yacht) => (
                              <option key={yacht.id} value={yacht.id}>
                                {yacht.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="handoff-mechanic" className="block text-sm font-medium mb-2">
                            Staff Member Completing Handoff
                          </label>
                          <select
                            id="handoff-mechanic"
                            value={selectedMechanicForHandoff}
                            onChange={(e) => setSelectedMechanicForHandoff(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white"
                            required
                          >
                            <option value="">Choose a staff member...</option>
                            {mechanics.map((mechanic) => (
                              <option key={mechanic.id} value={mechanic.user_id}>
                                {mechanic.first_name} {mechanic.last_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold mb-4">Trip Issues and Damage</h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium mb-2">Any Issues During the Trip</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['ok', 'needs attention'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, trip_issues: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.trip_issues === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating === 'ok' ? 'No Issues' : 'Needs Attention'}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.trip_issues_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, trip_issues_notes: e.target.value })}
                            placeholder="Document any issues..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Any Damage to Boat During Trip</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['no damage', 'damage found'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, boat_damage: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.boat_damage === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating === 'no damage' ? 'No Damage' : 'Damage Found'}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.boat_damage_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, boat_damage_notes: e.target.value })}
                            placeholder="Document any damage..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold mb-4">Pre-Handoff Checklist</h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium mb-2">Shore Cords Plugged In and Inverters On</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['ok', 'needs service'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, shore_cords_inverters: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.shore_cords_inverters === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.shore_cords_inverters_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, shore_cords_inverters_notes: e.target.value })}
                            placeholder="Additional notes..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Engine and Generators Fuel Full</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['full', 'not full'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, engine_generator_fuel: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.engine_generator_fuel === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.engine_generator_fuel_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, engine_generator_fuel_notes: e.target.value })}
                            placeholder="Fuel level details..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Toy Tank Fuel Full</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['full', 'not full'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, toy_tank_fuel: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.toy_tank_fuel === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.toy_tank_fuel_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, toy_tank_fuel_notes: e.target.value })}
                            placeholder="Toy tank details..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Propane Tanks Full and Connected</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['ok', 'needs service'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, propane_tanks: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.propane_tanks === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.propane_tanks_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, propane_tanks_notes: e.target.value })}
                            placeholder="Propane tank details..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold mb-4">Cleaning and Repairs</h3>
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium mb-2">Boat Has Been Cleaned</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['cleaned', 'not cleaned'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, boat_cleaned: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.boat_cleaned === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.boat_cleaned_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, boat_cleaned_notes: e.target.value })}
                            placeholder="Cleaning notes..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">All Repairs Completed</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['completed', 'not completed'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, repairs_completed: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.repairs_completed === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating.charAt(0).toUpperCase() + rating.slice(1)}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.repairs_completed_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, repairs_completed_notes: e.target.value })}
                            placeholder="Repair status details..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Owners Called If All Repairs Not Completed by Their Trip</label>
                          <div className="grid grid-cols-2 gap-3 mb-2">
                            {['called', 'not applicable'].map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => setHandoffForm({ ...handoffForm, owners_called: rating })}
                                className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                                  handoffForm.owners_called === rating
                                    ? 'bg-emerald-500 text-slate-900'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {rating === 'called' ? 'Called' : 'Not Applicable'}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={handoffForm.owners_called_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, owners_called_notes: e.target.value })}
                            placeholder="Communication details..."
                            rows={2}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                      <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
                      <div className="space-y-6">
                        <div>
                          <label htmlFor="handoff-additional-notes" className="block text-sm font-medium mb-2">
                            Additional Observations
                          </label>
                          <textarea
                            id="handoff-additional-notes"
                            value={handoffForm.additional_notes}
                            onChange={(e) => setHandoffForm({ ...handoffForm, additional_notes: e.target.value })}
                            placeholder="Any other observations or concerns..."
                            rows={4}
                            className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            id="handoff-issues-found"
                            type="checkbox"
                            checked={handoffForm.issues_found}
                            onChange={(e) => setHandoffForm({ ...handoffForm, issues_found: e.target.checked })}
                            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
                          />
                          <label htmlFor="handoff-issues-found" className="text-sm font-medium">
                            Issues found that require attention
                          </label>
                        </div>
                      </div>
                    </div>

                    {handoffError && (
                      <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                        {handoffError}
                      </div>
                    )}

                    {handoffSuccess && (
                      <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
                        Owner handoff inspection submitted successfully!
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={handoffLoading}
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <UserCheck className="w-5 h-5" />
                      {handoffLoading ? 'Submitting...' : 'Submit Owner Handoff Inspection'}
                    </button>
                  </form>
                </>
              ) : adminView === 'yachts' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <Ship className="w-8 h-8 text-blue-500" />
                      <div>
                        <h2 className="text-2xl font-bold">Yacht Management</h2>
                        <p className="text-slate-400">View and manage yacht fleet</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowYachtForm(!showYachtForm)}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg"
                    >
                      {showYachtForm ? 'Cancel' : '+ Add Yacht'}
                    </button>
                  </div>

                  {showYachtForm && (
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 mb-6">
                      <h3 className="text-xl font-semibold mb-4">Add New Yacht</h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setYachtLoading(true);
                        setYachtError('');

                        try {
                          const { data: newYacht, error } = await supabase.from('yachts').insert({
                            name: yachtForm.name,
                            hull_number: yachtForm.hull_number,
                            year: yachtForm.year ? parseInt(yachtForm.year) : null,
                            size: yachtForm.size,
                            port_engine: yachtForm.port_engine,
                            starboard_engine: yachtForm.starboard_engine,
                            port_generator: yachtForm.port_generator,
                            starboard_generator: yachtForm.starboard_generator,
                            marina_name: yachtForm.marina_name,
                            slip_location: yachtForm.slip_location,
                            wifi_name: yachtForm.wifi_name,
                            wifi_password: yachtForm.wifi_password,
                            owner_id: user?.id
                          }).select().single();

                          if (error) throw error;

                          if (newYacht) {
                            const userName = userProfile?.first_name && userProfile?.last_name
                              ? `${userProfile.first_name} ${userProfile.last_name}`
                              : userProfile?.email || 'Unknown';
                            await logYachtActivity(
                              newYacht.id,
                              newYacht.name,
                              `Yacht "${newYacht.name}" was added to the fleet`,
                              user?.id,
                              userName
                            );
                          }

                          setYachtSuccess(true);
                          setYachtForm({
                            name: '',
                            hull_number: '',
                            manufacturer: '',
                            year: '',
                            size: '',
                            port_engine: '',
                            starboard_engine: '',
                            port_generator: '',
                            starboard_generator: '',
                            marina_name: '',
                            slip_location: '',
                            wifi_name: '',
                            wifi_password: ''
                          });
                          setShowYachtForm(false);
                          await loadAllYachts();
                          await refreshProfile();

                          setTimeout(() => setYachtSuccess(false), 3000);
                        } catch (err: any) {
                          setYachtError(err.message || 'Failed to add yacht');
                        } finally {
                          setYachtLoading(false);
                        }
                      }} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Yacht Name *</label>
                            <input
                              type="text"
                              required
                              value={yachtForm.name}
                              onChange={(e) => setYachtForm({...yachtForm, name: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Sea Dream"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Hull Number</label>
                            <input
                              type="text"
                              value={yachtForm.hull_number}
                              onChange={(e) => setYachtForm({...yachtForm, hull_number: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., HIN123456"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Manufacturer</label>
                            <input
                              type="text"
                              value={yachtForm.manufacturer}
                              onChange={(e) => setYachtForm({...yachtForm, manufacturer: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Sunseeker, Azimut"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Year</label>
                            <input
                              type="number"
                              value={yachtForm.year}
                              onChange={(e) => setYachtForm({...yachtForm, year: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., 2020"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Size</label>
                            <input
                              type="text"
                              value={yachtForm.size}
                              onChange={(e) => setYachtForm({...yachtForm, size: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., 75 ft"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Port Engine</label>
                            <input
                              type="text"
                              value={yachtForm.port_engine}
                              onChange={(e) => setYachtForm({...yachtForm, port_engine: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Cat C18 1000HP"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Starboard Engine</label>
                            <input
                              type="text"
                              value={yachtForm.starboard_engine}
                              onChange={(e) => setYachtForm({...yachtForm, starboard_engine: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Cat C18 1000HP"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Port Generator</label>
                            <input
                              type="text"
                              value={yachtForm.port_generator}
                              onChange={(e) => setYachtForm({...yachtForm, port_generator: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Northern Lights 27kW"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Starboard Generator</label>
                            <input
                              type="text"
                              value={yachtForm.starboard_generator}
                              onChange={(e) => setYachtForm({...yachtForm, starboard_generator: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Northern Lights 27kW"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Marina Name</label>
                            <input
                              type="text"
                              value={yachtForm.marina_name}
                              onChange={(e) => setYachtForm({...yachtForm, marina_name: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Harbor Bay Marina"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Slip Location</label>
                            <input
                              type="text"
                              value={yachtForm.slip_location}
                              onChange={(e) => setYachtForm({...yachtForm, slip_location: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., Dock A, Slip 12"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">WiFi Name</label>
                            <input
                              type="text"
                              value={yachtForm.wifi_name}
                              onChange={(e) => setYachtForm({...yachtForm, wifi_name: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="e.g., YachtWiFi"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">WiFi Password</label>
                            <input
                              type="text"
                              value={yachtForm.wifi_password}
                              onChange={(e) => setYachtForm({...yachtForm, wifi_password: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              placeholder="Enter WiFi password"
                            />
                          </div>
                        </div>

                        {yachtError && (
                          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                            {yachtError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={yachtLoading}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {yachtLoading ? 'Adding Yacht...' : 'Add Yacht'}
                        </button>
                      </form>
                    </div>
                  )}

                  {yachtSuccess && (
                    <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm mb-6">
                      Yacht added successfully!
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-sm font-medium text-slate-400">Filter:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setYachtFilter('all')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                          yachtFilter === 'all'
                            ? 'bg-blue-500 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        All Yachts
                      </button>
                      <button
                        onClick={() => setYachtFilter('active')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                          yachtFilter === 'active'
                            ? 'bg-emerald-500 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Active Yachts
                      </button>
                      <button
                        onClick={() => setYachtFilter('inactive')}
                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${
                          yachtFilter === 'inactive'
                            ? 'bg-slate-600 text-white shadow-lg'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Inactive Yachts
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allYachts
                      .filter((yacht) => {
                        if (effectiveRole === 'manager' && effectiveYacht?.id) {
                          if (yacht.id !== effectiveYacht.id) return false;
                        }
                        if (yachtFilter === 'active') return yacht.is_active;
                        if (yachtFilter === 'inactive') return !yacht.is_active;
                        return true;
                      })
                      .map((yacht) => (
                      <div key={yacht.id} className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-blue-500 transition-all flex flex-col ${!yacht.is_active ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-xl font-bold text-white">{yacht.name}</h3>
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                yacht.is_active
                                  ? 'bg-emerald-500/20 text-emerald-500'
                                  : 'bg-slate-600/30 text-slate-400'
                              }`}>
                                {yacht.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400">Yacht History</p>
                          </div>
                          <Ship className="w-6 h-6 text-blue-500" />
                        </div>

                        <div className="space-y-2 text-sm mb-4 flex-grow">
                          {yacht.size && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Size:</span>
                              <span className="text-white font-medium">{yacht.size}</span>
                            </div>
                          )}
                          {yacht.marina_name && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Marina:</span>
                              <span className="text-white font-medium">{yacht.marina_name}</span>
                            </div>
                          )}
                          {yacht.slip_location && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Slip:</span>
                              <span className="text-white font-medium">{yacht.slip_location}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <button
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to mark this yacht as ${yacht.is_active ? 'inactive' : 'active'}?`)) {
                                return;
                              }

                              try {
                                const { error } = await supabase
                                  .from('yachts')
                                  .update({ is_active: !yacht.is_active })
                                  .eq('id', yacht.id);

                                if (error) throw error;

                                const userName = userProfile?.first_name && userProfile?.last_name
                                  ? `${userProfile.first_name} ${userProfile.last_name}`
                                  : userProfile?.email || 'Unknown';

                                await logYachtActivity(
                                  yacht.id,
                                  yacht.name,
                                  `Yacht marked as ${yacht.is_active ? 'inactive' : 'active'}`,
                                  user?.id,
                                  userName
                                );

                                await loadAllYachts();
                              } catch (err: any) {
                                alert(`Failed to update yacht status: ${err.message}`);
                              }
                            }}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                              yacht.is_active
                                ? 'bg-slate-600 hover:bg-slate-500 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <CheckCircle className="w-4 h-4" />
                            {yacht.is_active ? 'Mark as Inactive' : 'Mark as Active'}
                          </button>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => toggleYachtHistory(yacht.id)}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                            >
                              <History className="w-4 h-4" />
                              {expandedYachtId === yacht.id ? 'Hide' : 'History'}
                            </button>
                            <button
                              onClick={() => toggleYachtTrips(yacht.id)}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
                            >
                              <Calendar className="w-4 h-4" />
                              {tripsYachtId === yacht.id ? 'Hide' : 'Trips'}
                            </button>
                            <button
                              onClick={async () => {
                                if (documentYachtId === yacht.id) {
                                  setDocumentYachtId(null);
                                  setShowDocumentForm(false);
                                  setDocumentForm({ document_name: '', file_url: '', notes: '' });
                                  setDocumentError('');
                                } else {
                                  setDocumentYachtId(yacht.id);
                                  setShowDocumentForm(false);
                                  if (!yachtDocuments[yacht.id]) {
                                    await loadYachtDocuments(yacht.id);
                                  }
                                }
                              }}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                            >
                              <FileText className="w-4 h-4" />
                              {documentYachtId === yacht.id ? 'Hide' : 'Docs'}
                            </button>
                            {shouldShowAgreementsButton(yacht.id) && (
                              <button
                                onClick={() => toggleVesselAgreements(yacht.id)}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"
                              >
                                <FileSignature className="w-4 h-4" />
                                {agreementYachtId === yacht.id ? 'Hide' : 'Agreements'}
                              </button>
                            )}
                            {canManageYacht(effectiveRole) && (
                              <button
                                onClick={() => toggleYachtInvoices(yacht.id)}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors text-sm"
                              >
                                <Receipt className="w-4 h-4" />
                                {invoiceYachtId === yacht.id ? 'Hide' : 'Invoices'}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingYacht(yacht);
                                setYachtForm({
                                  name: yacht.name || '',
                                  hull_number: yacht.hull_number || '',
                                  manufacturer: yacht.manufacturer || '',
                                  year: yacht.year?.toString() || '',
                                  size: yacht.size || '',
                                  port_engine: yacht.port_engine || '',
                                  starboard_engine: yacht.starboard_engine || '',
                                  port_generator: yacht.port_generator || '',
                                  starboard_generator: yacht.starboard_generator || '',
                                  marina_name: yacht.marina_name || '',
                                  slip_location: yacht.slip_location || '',
                                  wifi_name: yacht.wifi_name || '',
                                  wifi_password: yacht.wifi_password || ''
                                });
                              }}
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors text-sm"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                            {isMasterRole(effectiveRole) && (
                              <button
                                onClick={() => setQrCodeYacht({ id: yacht.id, name: yacht.name })}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors text-sm"
                              >
                                <QrCode className="w-4 h-4" />
                                QR Code
                              </button>
                            )}
                          </div>
                        </div>

                        {expandedYachtId === yacht.id && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <h4 className="text-sm font-semibold text-slate-300 mb-3">Activity Log</h4>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {yachtHistoryLogs[yacht.id]?.length > 0 ? (
                                yachtHistoryLogs[yacht.id].map((log) => (
                                  <div key={log.id} className="bg-slate-900/50 rounded-lg p-3 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="text-slate-300 mb-1">{log.action}</div>
                                        <div className="text-slate-500 flex items-center gap-2">
                                          <span>{new Date(log.created_at).toLocaleString()}</span>
                                          {log.created_by_name && <span>• {log.created_by_name}</span>}
                                        </div>
                                      </div>
                                      {log.reference_type === 'trip_inspection' && log.reference_id && (
                                        <button
                                          onClick={async () => {
                                            if (loadingPdfId) return;

                                            try {
                                              setLoadingPdfId(log.reference_id!);

                                              // Fetch inspection data
                                              const { data: inspectionData, error: inspectionError } = await supabase
                                                .from('trip_inspections')
                                                .select('*, yachts(name)')
                                                .eq('id', log.reference_id)
                                                .maybeSingle();

                                              if (inspectionError) {
                                                console.error('Error loading inspection:', inspectionError);
                                                alert(`Failed to load inspection report: ${inspectionError.message}`);
                                                return;
                                              }

                                              if (!inspectionData) {
                                                alert('Inspection report not found');
                                                return;
                                              }

                                              // Fetch inspector data separately
                                              if (inspectionData.inspector_id) {
                                                const { data: inspectorData } = await supabase
                                                  .from('user_profiles')
                                                  .select('first_name, last_name')
                                                  .eq('user_id', inspectionData.inspector_id)
                                                  .maybeSingle();

                                                if (inspectorData) {
                                                  inspectionData.user_profiles = inspectorData;
                                                }
                                              }

                                              setSelectedInspectionForPDF(inspectionData as any);
                                            } catch (err) {
                                              console.error('Error:', err);
                                              alert('Failed to load inspection report');
                                            } finally {
                                              setLoadingPdfId(null);
                                            }
                                          }}
                                          disabled={loadingPdfId === log.reference_id}
                                          className={`px-2 py-1 rounded transition-colors text-xs whitespace-nowrap flex items-center gap-1 ${
                                            loadingPdfId === log.reference_id
                                              ? 'bg-cyan-500/10 text-cyan-500/50 cursor-not-allowed'
                                              : 'bg-cyan-500/20 text-cyan-500 hover:bg-cyan-500/30'
                                          }`}
                                        >
                                          {loadingPdfId === log.reference_id ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              Loading...
                                            </>
                                          ) : (
                                            'View PDF'
                                          )}
                                        </button>
                                      )}
                                      {log.reference_type === 'owner_handoff' && log.reference_id && (
                                        <button
                                          onClick={async () => {
                                            if (loadingPdfId) return;

                                            try {
                                              setLoadingPdfId(log.reference_id!);

                                              const { data: handoffData, error: handoffError } = await supabase
                                                .from('owner_handoff_inspections')
                                                .select('*, yachts(name)')
                                                .eq('id', log.reference_id)
                                                .maybeSingle();

                                              if (handoffError) {
                                                console.error('Error loading owner handoff:', handoffError);
                                                alert(`Failed to load owner handoff report: ${handoffError.message}`);
                                                return;
                                              }

                                              if (!handoffData) {
                                                alert('Owner handoff report not found');
                                                return;
                                              }

                                              if (handoffData.inspector_id) {
                                                const { data: inspectorData } = await supabase
                                                  .from('user_profiles')
                                                  .select('first_name, last_name')
                                                  .eq('user_id', handoffData.inspector_id)
                                                  .maybeSingle();

                                                if (inspectorData) {
                                                  (handoffData as any).user_profiles = inspectorData;
                                                }
                                              }

                                              setSelectedHandoffForPDF(handoffData as any);
                                            } catch (err) {
                                              console.error('Error:', err);
                                              alert('Failed to load owner handoff report');
                                            } finally {
                                              setLoadingPdfId(null);
                                            }
                                          }}
                                          disabled={loadingPdfId === log.reference_id}
                                          className={`px-2 py-1 rounded transition-colors text-xs whitespace-nowrap flex items-center gap-1 ${
                                            loadingPdfId === log.reference_id
                                              ? 'bg-cyan-500/10 text-cyan-500/50 cursor-not-allowed'
                                              : 'bg-cyan-500/20 text-cyan-500 hover:bg-cyan-500/30'
                                          }`}
                                        >
                                          {loadingPdfId === log.reference_id ? (
                                            <>
                                              <RefreshCw className="w-3 h-3 animate-spin" />
                                              Loading...
                                            </>
                                          ) : (
                                            'View PDF'
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-500 text-xs text-center py-4">
                                  No activity logged yet
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {tripsYachtId === yacht.id && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-slate-300">Owner Trips</h4>
                              <div className="flex items-center gap-2">
                                {yachtTrips[yacht.id]?.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setTripsToPrint(yachtTrips[yacht.id] || []);
                                      setPrintYachtName(yacht.name);
                                      setShowTripsPrintView(true);
                                    }}
                                    className="text-xs px-2 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors flex items-center gap-1"
                                    title="Print trips list"
                                  >
                                    <Printer className="w-3 h-3" />
                                    Print
                                  </button>
                                )}
                                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">
                                  {yachtTrips[yacht.id]?.length || 0} {yachtTrips[yacht.id]?.length === 1 ? 'trip' : 'trips'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                              {yachtTrips[yacht.id]?.length > 0 ? (
                                yachtTrips[yacht.id].map((trip) => (
                                  <div key={trip.id} className="bg-slate-900/50 rounded-lg p-3 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        {trip.yacht_booking_owners && trip.yacht_booking_owners.length > 0 ? (
                                          <div className="text-slate-300 font-medium mb-1">
                                            {trip.yacht_booking_owners.map((owner, idx) => (
                                              <div key={owner.id}>
                                                {owner.owner_name}
                                                {idx < trip.yacht_booking_owners.length - 1 && ', '}
                                              </div>
                                            ))}
                                          </div>
                                        ) : trip.user_profiles ? (
                                          <div className="text-slate-300 font-medium mb-1">
                                            {trip.user_profiles.first_name} {trip.user_profiles.last_name}
                                          </div>
                                        ) : (
                                          <div className="text-slate-300 font-medium mb-1">{trip.owner_name || 'Unknown Owner'}</div>
                                        )}
                                        <div className="text-slate-400 space-y-1">
                                          <div className="flex items-center gap-2">
                                            <Calendar className="w-3 h-3" />
                                            <span>
                                              {new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}
                                            </span>
                                          </div>
                                          {(trip.departure_time || trip.arrival_time) && (
                                            <div className="flex items-center gap-2">
                                              <Clock className="w-3 h-3" />
                                              <span>
                                                {trip.departure_time ? `Departure: ${convertTo12Hour(trip.departure_time)}` : ''}
                                                {trip.departure_time && trip.arrival_time ? ' | ' : ''}
                                                {trip.arrival_time ? `Arrival: ${convertTo12Hour(trip.arrival_time)}` : ''}
                                              </span>
                                            </div>
                                          )}
                                          {trip.yacht_booking_owners && trip.yacht_booking_owners.length > 0 ? (
                                            <div className="space-y-1">
                                              {trip.yacht_booking_owners.map((owner) => owner.owner_contact && (
                                                <div key={owner.id} className="flex items-center gap-2">
                                                  <Phone className="w-3 h-3" />
                                                  <span>{owner.owner_name}: {owner.owner_contact}</span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : trip.user_profiles?.phone ? (
                                            <div className="flex items-center gap-2">
                                              <Phone className="w-3 h-3" />
                                              <span>{trip.user_profiles.phone}</span>
                                            </div>
                                          ) : trip.owner_contact && (
                                            <div className="flex items-center gap-2">
                                              <Phone className="w-3 h-3" />
                                              <span>{trip.owner_contact}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-500 text-xs text-center py-4">
                                  No trips scheduled yet
                                </div>
                              )}
                            </div>
                            {yachtTrips[yacht.id]?.length > 3 && (
                              <div className="mt-2 text-xs text-center text-slate-400">
                                Scroll to see all {yachtTrips[yacht.id].length} trips
                              </div>
                            )}
                          </div>
                        )}

                        {documentYachtId === yacht.id && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-slate-300">Documents</h4>
                              <button
                                onClick={() => {
                                  setShowDocumentForm(!showDocumentForm);
                                  if (!showDocumentForm) {
                                    setDocumentForm({ document_name: '', file_url: '', notes: '' });
                                    setDocumentError('');
                                  }
                                }}
                                className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1"
                              >
                                <Upload className="w-3 h-3" />
                                {showDocumentForm ? 'Cancel' : 'Add Document'}
                              </button>
                            </div>

                            {showDocumentForm && (
                              <div className="bg-slate-900/50 rounded-lg p-4 mb-3">
                                <div className="flex items-center justify-between mb-3">
                                  <h5 className="text-xs font-semibold text-slate-300">Upload Document</h5>
                                  <button
                                    onClick={() => {
                                      setShowDocumentForm(false);
                                      setDocumentForm({ document_name: '', file_url: '', notes: '' });
                                      setSelectedFile(null);
                                      setUploadProgress({ progress: 0, status: 'idle' });
                                      setUseManualUrl(false);
                                      setDocumentError('');
                                    }}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Document Name *</label>
                                    <input
                                      type="text"
                                      value={documentForm.document_name}
                                      onChange={(e) => setDocumentForm({ ...documentForm, document_name: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs focus:outline-none focus:border-blue-500"
                                      placeholder="e.g., Insurance Certificate"
                                      disabled={documentLoading}
                                    />
                                  </div>

                                  {!useManualUrl ? (
                                    <>
                                      <div>
                                        <label className="block text-xs text-slate-400 mb-1">Upload File *</label>
                                        <FileUploadDropzone
                                          onFileSelect={(file) => {
                                            setSelectedFile(file);
                                            if (!documentForm.document_name) {
                                              setDocumentForm({ ...documentForm, document_name: file.name.replace(/\.[^/.]+$/, '') });
                                            }
                                          }}
                                          onClear={() => setSelectedFile(null)}
                                          selectedFile={selectedFile}
                                          disabled={documentLoading}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setUseManualUrl(true)}
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                      >
                                        Or enter a URL instead
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <label className="block text-xs text-slate-400 mb-1">Document URL *</label>
                                        <input
                                          type="url"
                                          value={documentForm.file_url}
                                          onChange={(e) => setDocumentForm({ ...documentForm, file_url: e.target.value })}
                                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs focus:outline-none focus:border-blue-500"
                                          placeholder="https://..."
                                          disabled={documentLoading}
                                        />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setUseManualUrl(false);
                                          setDocumentForm({ ...documentForm, file_url: '' });
                                        }}
                                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                                      >
                                        Or upload a file instead
                                      </button>
                                    </>
                                  )}

                                  <div>
                                    <label className="block text-xs text-slate-400 mb-1">Notes</label>
                                    <textarea
                                      value={documentForm.notes}
                                      onChange={(e) => setDocumentForm({ ...documentForm, notes: e.target.value })}
                                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-xs focus:outline-none focus:border-blue-500 resize-none"
                                      rows={2}
                                      placeholder="Optional notes about this document"
                                      disabled={documentLoading}
                                    />
                                  </div>

                                  {uploadProgress.status === 'uploading' && (
                                    <div className="space-y-1">
                                      <div className="flex justify-between text-xs text-slate-400">
                                        <span>Uploading...</span>
                                        <span>{uploadProgress.progress}%</span>
                                      </div>
                                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                                        <div
                                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                          style={{ width: `${uploadProgress.progress}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {documentError && (
                                    <div className="bg-red-500/10 border border-red-500 text-red-500 px-3 py-2 rounded text-xs">
                                      {documentError}
                                    </div>
                                  )}
                                  <button
                                    onClick={() => handleDocumentUpload(yacht.id)}
                                    disabled={documentLoading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-xs transition-colors disabled:opacity-50"
                                  >
                                    {documentLoading ? 'Uploading...' : 'Upload Document'}
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {yachtDocuments[yacht.id]?.length > 0 ? (
                                yachtDocuments[yacht.id].map((doc) => (
                                  <div key={doc.id} className="bg-slate-900/50 rounded-lg p-3 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <FileText className="w-3 h-3 text-blue-400" />
                                          <span className="text-slate-300 font-medium">{doc.document_name}</span>
                                        </div>
                                        {doc.notes && (
                                          <p className="text-slate-500 text-xs mb-2">{doc.notes}</p>
                                        )}
                                        <div className="text-slate-500 flex items-center gap-2">
                                          <span>{new Date(doc.created_at).toLocaleString()}</span>
                                          {doc.uploaded_by_name && <span>• {doc.uploaded_by_name}</span>}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <a
                                          href={doc.file_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="px-2 py-1 bg-blue-500/20 text-blue-500 rounded hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                                        >
                                          <Download className="w-3 h-3" />
                                          <span>View</span>
                                        </a>
                                        <button
                                          onClick={() => handleDeleteDocument(doc.id, yacht.id, doc.document_name, doc.file_url)}
                                          className="px-2 py-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-500 text-xs text-center py-4">
                                  No documents uploaded yet
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {agreementYachtId === yacht.id && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-slate-300">Vessel Management Agreements</h4>
                              {(canAccessAllYachts(effectiveRole) || (isManagerRole(effectiveRole) && !hasSubmittedAgreement(yacht.id))) && (
                                <button
                                  onClick={() => {
                                    setSelectedAgreement(null);
                                    setShowAgreementForm(true);
                                  }}
                                  className="text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors flex items-center gap-1"
                                >
                                  <FileSignature className="w-3 h-3" />
                                  New Agreement
                                </button>
                              )}
                            </div>

                            {!isOwnerRole(effectiveRole) && (
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-xs text-slate-400">Filter:</span>
                                <div className="flex gap-1">
                                  {['all', 'draft', 'pending', 'approved'].map((filter) => (
                                    <button
                                      key={filter}
                                      onClick={() => setAgreementFilter(filter as any)}
                                      className={`px-2 py-1 rounded text-xs transition-colors ${
                                        agreementFilter === filter
                                          ? 'bg-cyan-600 text-white'
                                          : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                      }`}
                                    >
                                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {vesselAgreements[yacht.id]?.filter((agreement) => {
                                if (agreementFilter === 'all') return true;
                                if (agreementFilter === 'pending') return agreement.status === 'pending_approval';
                                return agreement.status === agreementFilter;
                              }).length > 0 ? (
                                vesselAgreements[yacht.id].filter((agreement) => {
                                  if (agreementFilter === 'all') return true;
                                  if (agreementFilter === 'pending') return agreement.status === 'pending_approval';
                                  return agreement.status === agreementFilter;
                                }).map((agreement) => (
                                  <div key={agreement.id} className="bg-slate-900/50 rounded-lg p-3 text-xs">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                          <FileSignature className="w-3 h-3 text-cyan-400" />
                                          <span className="text-slate-300 font-medium">{agreement.season_name}</span>
                                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getAgreementStatusColor(agreement.status)}`}>
                                            {getAgreementStatusLabel(agreement.status)}
                                          </span>
                                          {agreement.status === 'pending_approval' && !agreement.staff_signature_date && canManageYacht(effectiveRole) && (
                                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-semibold">
                                              Needs AZ Marine Signature
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-slate-500 space-y-1">
                                          <p>Period: {new Date(agreement.start_date).toLocaleDateString()} - {new Date(agreement.end_date).toLocaleDateString()}</p>
                                          {agreement.submitted_at && (
                                            <p>Submitted: {new Date(agreement.submitted_at).toLocaleString()}</p>
                                          )}
                                          {agreement.approved_at && agreement.status === 'approved' && (
                                            <p className="text-emerald-500">Approved: {new Date(agreement.approved_at).toLocaleString()}</p>
                                          )}
                                          {agreement.rejection_reason && agreement.status === 'rejected' && (
                                            <p className="text-red-500">Reason: {agreement.rejection_reason}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-1">
                                        {agreement.status === 'draft' && isOwnerRole(effectiveRole) && (
                                          <button
                                            onClick={() => {
                                              setSelectedAgreement(agreement);
                                              setShowAgreementForm(true);
                                            }}
                                            className="px-2 py-1 bg-cyan-500/20 text-cyan-500 rounded hover:bg-cyan-500/30 transition-colors"
                                          >
                                            Edit
                                          </button>
                                        )}
                                        {agreement.status === 'pending_approval' && canManageYacht(effectiveRole) && (
                                          <div className="flex flex-col gap-1">
                                            <button
                                              onClick={() => {
                                                setSelectedAgreement(agreement);
                                                setShowAgreementViewer(true);
                                              }}
                                              className="px-2 py-1 bg-cyan-500/20 text-cyan-500 rounded hover:bg-cyan-500/30 transition-colors text-xs"
                                            >
                                              View
                                            </button>
                                            <div className="flex gap-1">
                                              <button
                                                onClick={async () => {
                                                if (!agreement.staff_signature_date) {
                                                  alert('You must sign the agreement before approving it. Please click "View" and sign the agreement with your AZ Marine signature.');
                                                  return;
                                                }
                                                if (!confirm('Approve this vessel management agreement? This will finalize the contract.')) return;
                                                try {
                                                  const now = new Date().toISOString();
                                                  const { error } = await supabase
                                                    .from('vessel_management_agreements')
                                                    .update({
                                                      status: 'approved',
                                                      approved_by: user?.id,
                                                      approved_at: now,
                                                      updated_at: now,
                                                    })
                                                    .eq('id', agreement.id);

                                                  if (error) throw error;

                                                  setVesselAgreements(prev => ({
                                                    ...prev,
                                                    [yacht.id]: (prev[yacht.id] || []).map(a =>
                                                      a.id === agreement.id
                                                        ? { ...a, status: 'approved', approved_by: user?.id, approved_at: now, updated_at: now }
                                                        : a
                                                    )
                                                  }));

                                                  await logYachtActivity(
                                                    yacht.id,
                                                    yacht.name,
                                                    `Vessel Management Agreement approved for ${agreement.season_name}`,
                                                    user?.id,
                                                    userProfile?.first_name && userProfile?.last_name
                                                      ? `${userProfile.first_name} ${userProfile.last_name}`
                                                      : userProfile?.email || 'Unknown'
                                                  );

                                                  setTimeout(() => loadVesselAgreements(yacht.id), 500);
                                                } catch (err: any) {
                                                  alert(`Failed to approve agreement: ${err.message}`);
                                                  await loadVesselAgreements(yacht.id);
                                                }
                                              }}
                                              className="px-2 py-1 bg-emerald-500/20 text-emerald-500 rounded hover:bg-emerald-500/30 transition-colors text-xs"
                                            >
                                              Approve
                                            </button>
                                            <button
                                              onClick={async () => {
                                                const reason = prompt('Enter rejection reason:');
                                                if (!reason) return;
                                                try {
                                                  const now = new Date().toISOString();
                                                  const { error } = await supabase
                                                    .from('vessel_management_agreements')
                                                    .update({
                                                      status: 'rejected',
                                                      approved_by: user?.id,
                                                      approved_at: now,
                                                      rejection_reason: reason,
                                                      updated_at: now,
                                                    })
                                                    .eq('id', agreement.id);

                                                  if (error) throw error;

                                                  setVesselAgreements(prev => ({
                                                    ...prev,
                                                    [yacht.id]: (prev[yacht.id] || []).map(a =>
                                                      a.id === agreement.id
                                                        ? { ...a, status: 'rejected', approved_by: user?.id, approved_at: now, rejection_reason: reason, updated_at: now }
                                                        : a
                                                    )
                                                  }));

                                                  await logYachtActivity(
                                                    yacht.id,
                                                    yacht.name,
                                                    `Vessel Management Agreement rejected for ${agreement.season_name}`,
                                                    user?.id,
                                                    userProfile?.first_name && userProfile?.last_name
                                                      ? `${userProfile.first_name} ${userProfile.last_name}`
                                                      : userProfile?.email || 'Unknown'
                                                  );

                                                  setTimeout(() => loadVesselAgreements(yacht.id), 500);
                                                } catch (err: any) {
                                                  alert(`Failed to reject agreement: ${err.message}`);
                                                  await loadVesselAgreements(yacht.id);
                                                }
                                              }}
                                              className="px-2 py-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors text-xs"
                                            >
                                              Reject
                                            </button>
                                            </div>
                                          </div>
                                        )}
                                        {agreement.status === 'approved' && (
                                          <button
                                            onClick={() => {
                                              setSelectedAgreement(agreement);
                                              setShowAgreementViewer(true);
                                            }}
                                            className="px-2 py-1 bg-cyan-500/20 text-cyan-500 rounded hover:bg-cyan-500/30 transition-colors text-xs"
                                          >
                                            View
                                          </button>
                                        )}
                                        {agreement.status === 'rejected' && (
                                          <div className="flex flex-col gap-1">
                                            <button
                                              onClick={() => {
                                                setSelectedAgreement(agreement);
                                                setShowAgreementViewer(true);
                                              }}
                                              className="px-2 py-1 bg-cyan-500/20 text-cyan-500 rounded hover:bg-cyan-500/30 transition-colors text-xs"
                                            >
                                              View
                                            </button>
                                            {((isOwnerRole(effectiveRole) && agreement.submitted_by === user?.id) ||
                                              canManageYacht(effectiveRole)) && (
                                              <button
                                                onClick={() => {
                                                  setSelectedAgreement(agreement);
                                                  setShowAgreementForm(true);
                                                }}
                                                className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors text-xs"
                                              >
                                                Edit & Resubmit
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-500 text-xs text-center py-4">
                                  No agreements found
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {invoiceYachtId === yacht.id && canManageYacht(effectiveRole) && (
                          <div className="mt-4 pt-4 border-t border-slate-700">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-slate-300">Invoices</h4>
                              <div className="flex items-center gap-2">
                                <select
                                  value={selectedInvoiceYear}
                                  onChange={(e) => {
                                    const newYear = Number(e.target.value);
                                    setSelectedInvoiceYear(newYear);
                                    void loadYachtBudget(yacht.id, newYear);
                                  }}
                                  className="text-xs px-3 py-1 bg-slate-800 border border-slate-600 rounded focus:outline-none focus:border-emerald-500 text-white"
                                >
                                  {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const invoices = yachtInvoices[yacht.id] || [];
                                    const years = new Set(invoices.map(inv => inv.invoice_year));
                                    if (!years.has(currentYear)) years.add(currentYear);
                                    return Array.from(years).sort((a, b) => b - a).map(year => (
                                      <option key={year} value={year}>{year}</option>
                                    ));
                                  })()}
                                </select>
                              </div>
                            </div>

                            {(() => {
                              const invoices = (yachtInvoices[yacht.id] || []).filter(
                                inv => inv.invoice_year === selectedInvoiceYear
                              );
                              const total = invoices.reduce((sum, inv) => {
                                return sum + (inv.invoice_amount_numeric || 0);
                              }, 0);
                              const budgetKey = `${yacht.id}-${selectedInvoiceYear}`;
                              const currentBudget = yachtBudgets[budgetKey];
                              const budgetAmount = currentBudget?.budget_amount || 0;
                              const budgetRemaining = budgetAmount - total;
                              const isEditingBudget = budgetEditMode[budgetKey];
                              const isSavingBudget = budgetSaving[budgetKey];

                              return (
                                <>
                                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-3">
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-xs font-semibold text-slate-300">Budget for {selectedInvoiceYear}</p>
                                      {!isEditingBudget && (
                                        <button
                                          onClick={() => {
                                            setBudgetEditMode(prev => ({ ...prev, [budgetKey]: true }));
                                            if (currentBudget) {
                                              setBudgetBreakdownInput({
                                                management_fees: currentBudget.management_fees?.toString() || '0',
                                                trip_inspection_fees: currentBudget.trip_inspection_fees?.toString() || '0',
                                                spring_startup_cost: currentBudget.spring_startup_cost?.toString() || '0',
                                                oil_change_200hr: currentBudget.oil_change_200hr?.toString() || '0',
                                                oil_change_600hr: currentBudget.oil_change_600hr?.toString() || '0',
                                                preventive_maintenance: currentBudget.preventive_maintenance?.toString() || '0',
                                                winter_repairs_upgrades: currentBudget.winter_repairs_upgrades?.toString() || '0',
                                                winterizations: currentBudget.winterizations?.toString() || '0',
                                                water_filters: currentBudget.water_filters?.toString() || '0',
                                                misc_1: currentBudget.misc_1?.toString() || '0',
                                                misc_1_notes: currentBudget.misc_1_notes || '',
                                                misc_2: currentBudget.misc_2?.toString() || '0',
                                                misc_2_notes: currentBudget.misc_2_notes || ''
                                              });
                                            } else {
                                              setBudgetBreakdownInput({
                                                management_fees: '0',
                                                trip_inspection_fees: '0',
                                                spring_startup_cost: '0',
                                                oil_change_200hr: '0',
                                                oil_change_600hr: '0',
                                                preventive_maintenance: '0',
                                                winter_repairs_upgrades: '0',
                                                winterizations: '0',
                                                water_filters: '0',
                                                misc_1: '0',
                                                misc_1_notes: '',
                                                misc_2: '0',
                                                misc_2_notes: ''
                                              });
                                            }
                                          }}
                                          className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                                        >
                                          {currentBudget ? 'Edit' : 'Set Budget'}
                                        </button>
                                      )}
                                    </div>

                                    {isEditingBudget ? (
                                      <div className="space-y-3">
                                        <div className="grid grid-cols-1 gap-3">
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Management Fees</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.management_fees}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, management_fees: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Trip Inspection Fees</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.trip_inspection_fees}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, trip_inspection_fees: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Spring Start Up Cost</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.spring_startup_cost}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, spring_startup_cost: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">200 Hour Oil Changes</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.oil_change_200hr}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, oil_change_200hr: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">600 Hour Oil Changes</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.oil_change_600hr}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, oil_change_600hr: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Preventive Maintenance</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.preventive_maintenance}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, preventive_maintenance: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Winter Repairs and Upgrades</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.winter_repairs_upgrades}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, winter_repairs_upgrades: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Winterizations</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.winterizations}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, winterizations: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Water Filters</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.water_filters}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, water_filters: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Misc 1</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.misc_1}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, misc_1: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                            <input
                                              type="text"
                                              placeholder="Note (optional)"
                                              value={budgetBreakdownInput.misc_1_notes}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, misc_1_notes: e.target.value }))}
                                              className="w-full px-3 py-1 mt-1 bg-slate-900 border border-slate-600 rounded text-xs focus:outline-none focus:border-emerald-500 text-white placeholder-slate-500"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs text-slate-400 mb-1">Misc 2</label>
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={budgetBreakdownInput.misc_2}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, misc_2: e.target.value }))}
                                              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm focus:outline-none focus:border-emerald-500 text-white"
                                              disabled={isSavingBudget}
                                            />
                                            <input
                                              type="text"
                                              placeholder="Note (optional)"
                                              value={budgetBreakdownInput.misc_2_notes}
                                              onChange={(e) => setBudgetBreakdownInput(prev => ({ ...prev, misc_2_notes: e.target.value }))}
                                              className="w-full px-3 py-1 mt-1 bg-slate-900 border border-slate-600 rounded text-xs focus:outline-none focus:border-emerald-500 text-white placeholder-slate-500"
                                              disabled={isSavingBudget}
                                            />
                                          </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-700">
                                          <div className="text-xs text-slate-400 mb-1">
                                            Total Budget: <span className="text-white font-semibold">
                                              ${(
                                                (parseFloat(budgetBreakdownInput.management_fees) || 0) +
                                                (parseFloat(budgetBreakdownInput.trip_inspection_fees) || 0) +
                                                (parseFloat(budgetBreakdownInput.spring_startup_cost) || 0) +
                                                (parseFloat(budgetBreakdownInput.oil_change_200hr) || 0) +
                                                (parseFloat(budgetBreakdownInput.oil_change_600hr) || 0) +
                                                (parseFloat(budgetBreakdownInput.preventive_maintenance) || 0) +
                                                (parseFloat(budgetBreakdownInput.winter_repairs_upgrades) || 0) +
                                                (parseFloat(budgetBreakdownInput.winterizations) || 0) +
                                                (parseFloat(budgetBreakdownInput.water_filters) || 0) +
                                                (parseFloat(budgetBreakdownInput.misc_1) || 0) +
                                                (parseFloat(budgetBreakdownInput.misc_2) || 0)
                                              ).toFixed(2)}
                                            </span>
                                          </div>
                                          {(() => {
                                            const ownerCount = ownerCountsByYacht[yacht.id] || 0;
                                            const totalBudget = (
                                              (parseFloat(budgetBreakdownInput.management_fees) || 0) +
                                              (parseFloat(budgetBreakdownInput.trip_inspection_fees) || 0) +
                                              (parseFloat(budgetBreakdownInput.spring_startup_cost) || 0) +
                                              (parseFloat(budgetBreakdownInput.oil_change_200hr) || 0) +
                                              (parseFloat(budgetBreakdownInput.oil_change_600hr) || 0) +
                                              (parseFloat(budgetBreakdownInput.preventive_maintenance) || 0) +
                                              (parseFloat(budgetBreakdownInput.winter_repairs_upgrades) || 0) +
                                              (parseFloat(budgetBreakdownInput.winterizations) || 0) +
                                              (parseFloat(budgetBreakdownInput.water_filters) || 0) +
                                              (parseFloat(budgetBreakdownInput.misc_1) || 0) +
                                              (parseFloat(budgetBreakdownInput.misc_2) || 0)
                                            );
                                            const ownerPortion = ownerCount > 0 ? totalBudget / ownerCount : 0;
                                            return (
                                              <div className="text-xs text-slate-400 mb-3">
                                                Owner's Portion {ownerCount > 0 && `(${ownerCount} owner${ownerCount > 1 ? 's' : ''})`}: <span className="text-emerald-400 font-semibold">
                                                  ${ownerPortion.toFixed(2)}
                                                </span>
                                              </div>
                                            );
                                          })()}
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => saveBudget(yacht.id, selectedInvoiceYear)}
                                            disabled={isSavingBudget}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded text-xs transition-colors disabled:opacity-50"
                                          >
                                            {isSavingBudget ? 'Saving...' : 'Save'}
                                          </button>
                                          <button
                                            onClick={() => {
                                              setBudgetEditMode(prev => ({ ...prev, [budgetKey]: false }));
                                            }}
                                            disabled={isSavingBudget}
                                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded text-xs transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        {budgetAmount > 0 ? (
                                          <>
                                            <div className="space-y-2 mb-3">
                                              <div className="text-xl font-bold text-white border-b border-slate-700 pb-2 mb-2">
                                                Total Budget: ${budgetAmount.toFixed(2)}
                                              </div>
                                              {(() => {
                                                const ownerCount = ownerCountsByYacht[yacht.id] || 0;
                                                const ownerPortion = ownerCount > 0 ? budgetAmount / ownerCount : 0;
                                                return (
                                                  <div className="text-sm text-slate-300 mb-3 pb-2 border-b border-slate-700">
                                                    Owner's Portion {ownerCount > 0 && `(${ownerCount} owner${ownerCount > 1 ? 's' : ''})`}: <span className="text-emerald-400 font-bold">
                                                      ${ownerPortion.toFixed(2)}
                                                    </span>
                                                  </div>
                                                );
                                              })()}
                                              <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Management Fees:</span>
                                                  <span className="text-white">${currentBudget?.management_fees?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Trip Inspections:</span>
                                                  <span className="text-white">${currentBudget?.trip_inspection_fees?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Spring Startup:</span>
                                                  <span className="text-white">${currentBudget?.spring_startup_cost?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">200hr Oil Changes:</span>
                                                  <span className="text-white">${currentBudget?.oil_change_200hr?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">600hr Oil Changes:</span>
                                                  <span className="text-white">${currentBudget?.oil_change_600hr?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Preventive Maint.:</span>
                                                  <span className="text-white">${currentBudget?.preventive_maintenance?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Winter Repairs:</span>
                                                  <span className="text-white">${currentBudget?.winter_repairs_upgrades?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Winterizations:</span>
                                                  <span className="text-white">${currentBudget?.winterizations?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                  <span className="text-slate-400">Water Filters:</span>
                                                  <span className="text-white">${currentBudget?.water_filters?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div>
                                                  <div className="flex justify-between">
                                                    <span className="text-slate-400">Misc 1:</span>
                                                    <span className="text-white">${currentBudget?.misc_1?.toFixed(2) || '0.00'}</span>
                                                  </div>
                                                  {currentBudget?.misc_1_notes && (
                                                    <div className="text-xs text-slate-500 italic mt-0.5">
                                                      {currentBudget.misc_1_notes}
                                                    </div>
                                                  )}
                                                </div>
                                                <div>
                                                  <div className="flex justify-between">
                                                    <span className="text-slate-400">Misc 2:</span>
                                                    <span className="text-white">${currentBudget?.misc_2?.toFixed(2) || '0.00'}</span>
                                                  </div>
                                                  {currentBudget?.misc_2_notes && (
                                                    <div className="text-xs text-slate-500 italic mt-0.5">
                                                      {currentBudget.misc_2_notes}
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-xs text-slate-400 mb-3 pt-3 border-t border-slate-700">
                                              Budget Remaining: <span className={`font-semibold ${budgetRemaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                ${budgetRemaining.toFixed(2)}
                                              </span>
                                            </div>
                                            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                                              <div
                                                className={`h-2 rounded-full transition-all ${budgetRemaining >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                style={{ width: `${Math.min((total / budgetAmount) * 100, 100)}%` }}
                                              />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">
                                              {((total / budgetAmount) * 100).toFixed(1)}% of budget used
                                            </p>
                                          </>
                                        ) : (
                                          <p className="text-sm text-slate-400">No budget set for this year</p>
                                        )}
                                      </>
                                    )}
                                  </div>

                                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 mb-3">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <p className="text-xs text-emerald-400 mb-1">Total Invoiced for {selectedInvoiceYear}</p>
                                        <p className="text-2xl font-bold text-emerald-300">
                                          ${total.toFixed(2)}
                                        </p>
                                      </div>
                                      <Receipt className="w-8 h-8 text-emerald-400/50" />
                                    </div>
                                    <p className="text-xs text-emerald-400/70 mt-2">
                                      {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>

                                  <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {invoices.length > 0 ? (
                                      invoices.map((invoice) => (
                                        <div key={invoice.id} className="bg-slate-900/50 rounded-lg p-3 text-xs">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <Receipt className="w-3 h-3 text-emerald-400" />
                                                <span className="text-slate-300 font-medium">{invoice.repair_title}</span>
                                                {invoice.payment_status === 'paid' && (
                                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                                                    Paid
                                                  </span>
                                                )}
                                                {invoice.payment_status === 'pending' && !invoice.payment_email_sent_at && (
                                                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                                                    Need to Bill Customer
                                                  </span>
                                                )}
                                                {invoice.payment_status === 'pending' && invoice.payment_link_clicked_at && (
                                                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-medium">
                                                    Viewed Invoice
                                                  </span>
                                                )}
                                                {invoice.payment_status === 'pending' && !invoice.payment_link_clicked_at && invoice.payment_email_opened_at && (
                                                  <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-xs font-medium">
                                                    Opened Email
                                                  </span>
                                                )}
                                                {invoice.payment_status === 'pending' && !invoice.payment_email_opened_at && invoice.payment_email_delivered_at && (
                                                  <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs font-medium">
                                                    Email Delivered
                                                  </span>
                                                )}
                                                {invoice.payment_status === 'pending' && invoice.payment_email_sent_at && !invoice.payment_email_delivered_at && !invoice.payment_email_opened_at && !invoice.payment_link_clicked_at && (
                                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-medium">
                                                    Email Sent
                                                  </span>
                                                )}
                                                {invoice.payment_status === 'failed' && (
                                                  <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                                                    Failed
                                                  </span>
                                                )}
                                              </div>
                                              <div className="text-emerald-400 font-semibold mb-2">
                                                {invoice.invoice_amount}
                                              </div>
                                              <div className="text-slate-500 flex items-center gap-2">
                                                <span>{new Date(invoice.invoice_date).toLocaleDateString()}</span>
                                                {invoice.paid_at && (
                                                  <span className="text-emerald-400">• Paid {new Date(invoice.paid_at).toLocaleDateString()}</span>
                                                )}
                                              </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              {invoice.invoice_file_url && (
                                                <a
                                                  href={invoice.invoice_file_url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-2 py-1 bg-emerald-500/20 text-emerald-500 rounded hover:bg-emerald-500/30 transition-colors flex items-center gap-1 whitespace-nowrap"
                                                >
                                                  <Download className="w-3 h-3" />
                                                  <span>PDF</span>
                                                </a>
                                              )}
                                              {invoice.payment_status !== 'paid' && (
                                                <button
                                                  onClick={() => handlePayInvoice(invoice.id)}
                                                  disabled={paymentProcessing[invoice.id]}
                                                  className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors flex items-center gap-1 whitespace-nowrap disabled:opacity-50"
                                                >
                                                  <CreditCard className="w-3 h-3" />
                                                  <span>{paymentProcessing[invoice.id] ? 'Processing...' : 'Pay Now'}</span>
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-slate-500 text-xs text-center py-4">
                                        No invoices for {selectedInvoiceYear}
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Retail Customer Repairs Card */}
                  {(() => {
                    const retailRepairs = repairRequests.filter(request =>
                      request.is_retail_customer &&
                      (request.status === 'completed' || request.status === 'rejected' || repairInvoices[request.id]?.payment_status === 'paid')
                    );

                    // Only show to staff, mechanics, and masters
                    if (!['staff', 'mechanic', 'master'].includes(effectiveRole)) {
                      return null;
                    }

                    return (
                      <div className="mt-8">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                          <Users className="w-6 h-6 text-cyan-500" />
                          Retail Customer Repairs Archive
                          <span className="text-sm text-slate-400 font-normal">({retailRepairs.length} {retailRepairs.length === 1 ? 'repair' : 'repairs'})</span>
                        </h3>

                        {retailRepairs.length === 0 ? (
                          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-700 text-center">
                            <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <p className="text-slate-400 text-lg mb-2">No archived retail repairs yet</p>
                            <p className="text-slate-500 text-sm">Completed or denied retail customer repairs will appear here</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {retailRepairs.map((repair) => {
                            const invoice = repairInvoices[repair.id];
                            const isPaid = invoice?.payment_status === 'paid';
                            const isDenied = repair.status === 'rejected';
                            const statusText = isPaid ? 'Paid' : isDenied ? 'Denied' : 'Completed';

                            return (
                              <div key={repair.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-cyan-500 transition-all flex flex-col">
                                <div className="flex items-start justify-between mb-4">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="text-lg font-bold text-white">{repair.title}</h4>
                                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                        isPaid ? 'bg-emerald-500/20 text-emerald-500' :
                                        isDenied ? 'bg-red-500/20 text-red-500' :
                                        'bg-slate-500/20 text-slate-400'
                                      }`}>
                                        {statusText}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-400">{repair.customer_name}</p>
                                  </div>
                                  <Users className="w-6 h-6 text-cyan-500" />
                                </div>

                                <div className="space-y-2 text-sm mb-4 flex-grow">
                                  {repair.customer_email && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Email:</span>
                                      <span className="text-white font-medium truncate ml-2">{repair.customer_email}</span>
                                    </div>
                                  )}
                                  {repair.customer_phone && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Phone:</span>
                                      <span className="text-white font-medium">{repair.customer_phone}</span>
                                    </div>
                                  )}
                                  {invoice && (
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Amount:</span>
                                      <span className="text-white font-medium">{invoice.invoice_amount}</span>
                                    </div>
                                  )}
                                  {repair.description && (
                                    <div className="mt-2 pt-2 border-t border-slate-700">
                                      <p className="text-slate-300 text-xs line-clamp-2">{repair.description}</p>
                                    </div>
                                  )}
                                </div>

                                <div className="text-xs text-slate-500 mt-2">
                                  {isPaid && invoice?.paid_at ? (
                                    `Paid: ${new Date(invoice.paid_at).toLocaleDateString()}`
                                  ) : (
                                    `Created: ${new Date(repair.created_at).toLocaleDateString()}`
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {editingYacht && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
                          <h3 className="text-2xl font-bold">Edit Yacht Information: {editingYacht.name}</h3>
                          <button
                            onClick={() => {
                              setEditingYacht(null);
                              setYachtForm({
                                name: '',
                                hull_number: '',
                                manufacturer: '',
                                year: '',
                                size: '',
                                port_engine: '',
                                starboard_engine: '',
                                port_generator: '',
                                starboard_generator: '',
                                marina_name: '',
                                slip_location: '',
                                wifi_name: '',
                                wifi_password: ''
                              });
                            }}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          setYachtLoading(true);
                          setYachtError('');

                          try {
                            const { error } = await supabase.from('yachts').update({
                              name: yachtForm.name,
                              hull_number: yachtForm.hull_number,
                              manufacturer: yachtForm.manufacturer,
                              year: yachtForm.year ? parseInt(yachtForm.year) : null,
                              size: yachtForm.size,
                              port_engine: yachtForm.port_engine,
                              starboard_engine: yachtForm.starboard_engine,
                              port_generator: yachtForm.port_generator,
                              starboard_generator: yachtForm.starboard_generator,
                              marina_name: yachtForm.marina_name,
                              slip_location: yachtForm.slip_location,
                              wifi_name: yachtForm.wifi_name,
                              wifi_password: yachtForm.wifi_password,
                            }).eq('id', editingYacht.id);

                            if (error) throw error;

                            const userName = userProfile?.first_name && userProfile?.last_name
                              ? `${userProfile.first_name} ${userProfile.last_name}`
                              : userProfile?.email || 'Unknown';
                            await logYachtActivity(
                              editingYacht.id,
                              editingYacht.name,
                              `Yacht information was updated`,
                              user?.id,
                              userName
                            );

                            setYachtSuccess(true);
                            setEditingYacht(null);
                            setYachtForm({
                              name: '',
                              hull_number: '',
                              manufacturer: '',
                              year: '',
                              size: '',
                              port_engine: '',
                              starboard_engine: '',
                              port_generator: '',
                              starboard_generator: '',
                              marina_name: '',
                              slip_location: '',
                              wifi_name: '',
                              wifi_password: ''
                            });
                            await loadAllYachts();
                            await refreshProfile();

                            setTimeout(() => setYachtSuccess(false), 3000);
                          } catch (err: any) {
                            setYachtError(err.message || 'Failed to update yacht');
                          } finally {
                            setYachtLoading(false);
                          }
                        }} className="p-6 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Yacht Name *</label>
                              <input
                                type="text"
                                required
                                value={yachtForm.name}
                                onChange={(e) => setYachtForm({...yachtForm, name: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Sea Dream"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Hull Number</label>
                              <input
                                type="text"
                                value={yachtForm.hull_number}
                                onChange={(e) => setYachtForm({...yachtForm, hull_number: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., HIN123456"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Manufacturer</label>
                              <input
                                type="text"
                                value={yachtForm.manufacturer}
                                onChange={(e) => setYachtForm({...yachtForm, manufacturer: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Sunseeker, Azimut"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Year</label>
                              <input
                                type="number"
                                value={yachtForm.year}
                                onChange={(e) => setYachtForm({...yachtForm, year: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., 2020"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Size</label>
                              <input
                                type="text"
                                value={yachtForm.size}
                                onChange={(e) => setYachtForm({...yachtForm, size: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., 75 ft"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Port Engine</label>
                              <input
                                type="text"
                                value={yachtForm.port_engine}
                                onChange={(e) => setYachtForm({...yachtForm, port_engine: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Cat C18 1000HP"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Starboard Engine</label>
                              <input
                                type="text"
                                value={yachtForm.starboard_engine}
                                onChange={(e) => setYachtForm({...yachtForm, starboard_engine: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Cat C18 1000HP"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Port Generator</label>
                              <input
                                type="text"
                                value={yachtForm.port_generator}
                                onChange={(e) => setYachtForm({...yachtForm, port_generator: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Northern Lights 27kW"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Starboard Generator</label>
                              <input
                                type="text"
                                value={yachtForm.starboard_generator}
                                onChange={(e) => setYachtForm({...yachtForm, starboard_generator: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Northern Lights 27kW"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Marina Name</label>
                              <input
                                type="text"
                                value={yachtForm.marina_name}
                                onChange={(e) => setYachtForm({...yachtForm, marina_name: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Harbor Bay Marina"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Slip Location</label>
                              <input
                                type="text"
                                value={yachtForm.slip_location}
                                onChange={(e) => setYachtForm({...yachtForm, slip_location: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., Dock A, Slip 12"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">WiFi Name</label>
                              <input
                                type="text"
                                value={yachtForm.wifi_name}
                                onChange={(e) => setYachtForm({...yachtForm, wifi_name: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="e.g., YachtWiFi"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">WiFi Password</label>
                              <input
                                type="text"
                                value={yachtForm.wifi_password}
                                onChange={(e) => setYachtForm({...yachtForm, wifi_password: e.target.value})}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                                placeholder="Enter WiFi password"
                              />
                            </div>
                          </div>

                          {yachtError && (
                            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                              {yachtError}
                            </div>
                          )}

                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingYacht(null);
                                setYachtForm({
                                  name: '',
                                  hull_number: '',
                                  manufacturer: '',
                                  year: '',
                                  size: '',
                                  port_engine: '',
                                  starboard_engine: '',
                                  port_generator: '',
                                  starboard_generator: '',
                                  marina_name: '',
                                  slip_location: '',
                                  wifi_name: '',
                                  wifi_password: ''
                                });
                              }}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-lg transition-all duration-300"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={yachtLoading}
                              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {yachtLoading ? 'Updating...' : 'Update Yacht'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              ) : adminView === 'ownertrips' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-green-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <CalendarPlus className="w-8 h-8 text-green-500" />
                      <div>
                        <h2 className="text-2xl font-bold">Owner Trips</h2>
                        <p className="text-slate-400">Schedule owner yacht trips to calendar</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowOwnerTripForm(!showOwnerTripForm)}
                      className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg"
                    >
                      {showOwnerTripForm ? 'Cancel' : '+ Add Owner Trip'}
                    </button>
                  </div>

                  {showOwnerTripForm && (
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 mb-6">
                      <h3 className="text-xl font-semibold mb-4">Add Owner Trip to Calendar</h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setOwnerTripLoading(true);
                        setOwnerTripError('');

                        try {
                          if (!selectedOwnerYachtId) {
                            throw new Error('Please select an owner with an assigned yacht');
                          }

                          if (!selectedOwnerUserId) {
                            throw new Error('Selected owner user ID not found');
                          }

                          const startDateTime = `${ownerTripForm.start_date}T${ownerTripForm.departure_time || '00:00'}:00`;
                          const endDateTime = `${ownerTripForm.end_date}T${ownerTripForm.arrival_time || '00:00'}:00`;

                          const selectedYacht = allYachts.find(y => y.id === selectedOwnerYachtId);
                          if (!selectedYacht) {
                            throw new Error('Selected owner\'s yacht not found');
                          }

                          const validOwners = ownerTripForm.owners.filter(o => o.owner_name.trim());
                          if (validOwners.length === 0) {
                            throw new Error('Please add at least one owner');
                          }

                          const { data: booking, error } = await supabase.from('yacht_bookings').insert({
                            yacht_id: selectedOwnerYachtId,
                            user_id: selectedOwnerUserId,
                            start_date: startDateTime,
                            end_date: endDateTime,
                            departure_time: ownerTripForm.departure_time,
                            arrival_time: ownerTripForm.arrival_time,
                            notes: 'Owner trip',
                            checked_in: false,
                            checked_out: false
                          }).select().single();

                          if (error) throw error;

                          const ownersData = validOwners.map(owner => ({
                            booking_id: booking.id,
                            owner_name: owner.owner_name,
                            owner_contact: owner.owner_contact || null
                          }));

                          const { error: ownersError } = await supabase
                            .from('yacht_booking_owners')
                            .insert(ownersData);

                          if (ownersError) throw ownersError;

                          const userName = userProfile?.first_name && userProfile?.last_name
                            ? `${userProfile.first_name} ${userProfile.last_name}`
                            : userProfile?.email || 'Unknown';
                          const ownerNames = validOwners.map(o => o.owner_name).join(', ');
                          await logYachtActivity(
                            selectedOwnerYachtId,
                            selectedYacht.name,
                            `Owner trip scheduled for ${ownerNames} from ${new Date(startDateTime).toLocaleDateString()} to ${new Date(endDateTime).toLocaleDateString()}`,
                            user?.id,
                            userName
                          );

                          setOwnerTripSuccess(true);
                          setOwnerTripForm({
                            start_date: '',
                            departure_time: '',
                            end_date: '',
                            arrival_time: '',
                            owners: [{ owner_name: '', owner_contact: '' }]
                          });

                          // Reload yacht trips if that yacht's trips section is currently open
                          if (tripsYachtId === selectedOwnerYachtId) {
                            await loadYachtTrips(selectedOwnerYachtId);
                          }

                          setSelectedOwnerYachtId(null);
                          setSelectedOwnerUserId(null);
                          setShowOwnerTripForm(false);
                          loadBookings();
                          await loadMasterCalendar();

                          setTimeout(() => setOwnerTripSuccess(false), 3000);
                        } catch (err: any) {
                          setOwnerTripError(err.message || 'Failed to add owner trip');
                        } finally {
                          setOwnerTripLoading(false);
                        }
                      }} className="space-y-4">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-medium">Owners on Trip *</label>
                            <button
                              type="button"
                              onClick={() => {
                                setOwnerTripForm({
                                  ...ownerTripForm,
                                  owners: [...ownerTripForm.owners, { owner_name: '', owner_contact: '' }]
                                });
                              }}
                              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                              Add Owner
                            </button>
                          </div>

                          {ownerTripForm.owners.map((owner, index) => (
                            <div key={index} className="mb-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-sm text-slate-400">Owner #{index + 1}</span>
                                {ownerTripForm.owners.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOwnerTripForm({
                                        ...ownerTripForm,
                                        owners: ownerTripForm.owners.filter((_, i) => i !== index)
                                      });
                                    }}
                                    className="text-red-400 hover:text-red-300"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-slate-400">Name *</label>
                                  <select
                                    required
                                    value={owner.owner_name}
                                    onChange={(e) => {
                                      const selectedUser = allUsers.find(u =>
                                        `${u.first_name || ''} ${u.last_name || ''}`.trim() === e.target.value
                                      );
                                      const newOwners = [...ownerTripForm.owners];
                                      newOwners[index] = {
                                        owner_name: e.target.value,
                                        owner_contact: selectedUser?.phone || owner.owner_contact
                                      };
                                      setOwnerTripForm({ ...ownerTripForm, owners: newOwners });

                                      if (index === 0) {
                                        setSelectedOwnerYachtId(selectedUser?.yacht_id || null);
                                        setSelectedOwnerUserId(selectedUser?.user_id || null);
                                      }
                                    }}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                  >
                                    <option value="">Select an owner</option>
                                    {(() => {
                                      const usersByYacht: { [key: string]: typeof allUsers } = {};
                                      const usersWithoutYacht: typeof allUsers = [];

                                      allUsers.forEach(user => {
                                        if (user.is_active === false) return;
                                        if (user.role === 'owner' || user.role === 'manager') {
                                          const yachtName = user.yachts?.name || 'Unassigned';
                                          if (yachtName === 'Unassigned') {
                                            usersWithoutYacht.push(user);
                                          } else {
                                            if (!usersByYacht[yachtName]) {
                                              usersByYacht[yachtName] = [];
                                            }
                                            usersByYacht[yachtName].push(user);
                                          }
                                        }
                                      });

                                      return (
                                        <>
                                          {Object.entries(usersByYacht)
                                            .sort(([a], [b]) => a.localeCompare(b))
                                            .map(([yachtName, users]) => (
                                              <optgroup key={yachtName} label={yachtName}>
                                                {users.map((user) => {
                                                  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                                                  return fullName ? (
                                                    <option key={user.id} value={fullName}>
                                                      {fullName}
                                                    </option>
                                                  ) : null;
                                                })}
                                              </optgroup>
                                            ))}
                                          {usersWithoutYacht.length > 0 && (
                                            <optgroup label="Unassigned">
                                              {usersWithoutYacht.map((user) => {
                                                const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                                                return fullName ? (
                                                  <option key={user.id} value={fullName}>
                                                    {fullName}
                                                  </option>
                                                ) : null;
                                              })}
                                            </optgroup>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium mb-1 text-slate-400">Contact *</label>
                                  <input
                                    type="text"
                                    required
                                    value={owner.owner_contact}
                                    onChange={(e) => {
                                      const newOwners = [...ownerTripForm.owners];
                                      newOwners[index].owner_contact = e.target.value;
                                      setOwnerTripForm({ ...ownerTripForm, owners: newOwners });
                                    }}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                                    placeholder="Email or phone"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-2">Start Date *</label>
                            <input
                              type="date"
                              required
                              value={ownerTripForm.start_date}
                              onChange={(e) => {
                                const startDate = new Date(e.target.value);
                                const endDate = new Date(startDate);
                                endDate.setDate(startDate.getDate() + 7);
                                const endDateString = endDate.toISOString().split('T')[0];
                                setOwnerTripForm({
                                  ...ownerTripForm,
                                  start_date: e.target.value,
                                  end_date: endDateString
                                });
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 [color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Departure Time</label>
                            <input
                              type="time"
                              value={ownerTripForm.departure_time}
                              onChange={(e) => setOwnerTripForm({...ownerTripForm, departure_time: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 [color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Return Date *</label>
                            <input
                              type="date"
                              required
                              value={ownerTripForm.end_date}
                              onChange={(e) => setOwnerTripForm({...ownerTripForm, end_date: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 [color-scheme:dark]"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-2">Arrival Time</label>
                            <input
                              type="time"
                              value={ownerTripForm.arrival_time}
                              onChange={(e) => setOwnerTripForm({...ownerTripForm, arrival_time: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 [color-scheme:dark]"
                            />
                          </div>
                        </div>

                        {ownerTripError && (
                          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                            {ownerTripError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={ownerTripLoading}
                          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ownerTripLoading ? 'Adding Trip...' : 'Add Owner Trip'}
                        </button>
                      </form>
                    </div>
                  )}

                  {ownerTripSuccess && (
                    <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm mb-6">
                      Owner trip added to calendar successfully!
                    </div>
                  )}
                </>
              ) : adminView === 'repairs' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-orange-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <FileUp className="w-8 h-8 text-orange-500" />
                      <div>
                        <h2 className="text-2xl font-bold">Repair Requests</h2>
                        <p className="text-slate-400">Upload files and submit repair requests for approval</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowRepairForm(!showRepairForm)}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg"
                    >
                      {showRepairForm ? 'Cancel' : '+ New Repair Request'}
                    </button>
                  </div>

                  {showRepairForm && (
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 mb-6">
                      <h3 className="text-xl font-semibold mb-4">Submit Repair Request</h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        setRepairLoading(true);
                        setRepairError('');

                        try {
                          if (!user) {
                            throw new Error('User not authenticated');
                          }

                          if (customerType === 'yacht' && !repairForm.yacht_id) {
                            throw new Error('Please select a yacht');
                          }

                          if (customerType === 'customer') {
                            if (!repairForm.customer_id) {
                              throw new Error('Please select a customer');
                            }
                            if (!repairForm.vessel_id) {
                              throw new Error('Please select a vessel');
                            }
                          }

                          let fileUrl = null;
                          let fileName = null;

                          if (repairForm.file) {
                            const fileExt = repairForm.file.name.split('.').pop();
                            const filePath = customerType === 'customer'
                              ? `customers/${repairForm.customer_id}/${Date.now()}.${fileExt}`
                              : `${repairForm.yacht_id}/${Date.now()}.${fileExt}`;
                            fileName = repairForm.file.name;

                            const { data: uploadData, error: uploadError } = await supabase.storage
                              .from('repair-files')
                              .upload(filePath, repairForm.file);

                            if (uploadError) throw uploadError;

                            const { data: urlData } = supabase.storage
                              .from('repair-files')
                              .getPublicUrl(filePath);

                            fileUrl = urlData.publicUrl;
                          }

                          const insertData: any = {
                            submitted_by: user.id,
                            title: repairForm.title,
                            description: repairForm.description,
                            estimated_repair_cost: repairForm.estimated_repair_cost || null,
                            file_url: fileUrl,
                            file_name: fileName,
                            status: 'pending'
                          };

                          if (customerType === 'yacht') {
                            insertData.yacht_id = repairForm.yacht_id;
                            insertData.is_retail_customer = false;
                          } else {
                            // Fetch customer details to populate required fields
                            const { data: customerData, error: customerError } = await supabase
                              .from('customers')
                              .select('customer_type, first_name, last_name, business_name, email, phone')
                              .eq('id', repairForm.customer_id)
                              .single();

                            if (customerError) throw customerError;

                            insertData.customer_id = repairForm.customer_id;
                            insertData.vessel_id = repairForm.vessel_id;
                            insertData.is_retail_customer = true;
                            insertData.customer_name = customerData.customer_type === 'business'
                              ? customerData.business_name
                              : `${customerData.first_name} ${customerData.last_name}`;
                            insertData.customer_email = customerData.email;
                            insertData.customer_phone = customerData.phone;
                          }

                          const { data: insertedRequest, error: insertError } = await supabase.from('repair_requests').insert(insertData).select().single();

                          if (insertError) throw insertError;

                          if (customerType === 'yacht') {
                            const selectedYacht = allYachts.find(y => y.id === repairForm.yacht_id);
                            if (selectedYacht) {
                              const userName = userProfile?.first_name && userProfile?.last_name
                                ? `${userProfile.first_name} ${userProfile.last_name}`
                                : userProfile?.email || 'Unknown';
                              await logYachtActivity(
                                selectedYacht.id,
                                selectedYacht.name,
                                `Repair request submitted: "${repairForm.title}"`,
                                user?.id,
                                userName
                              );

                              const { data: managers, error: managersError } = await supabase
                                .from('user_profiles')
                                .select('user_id, first_name, last_name')
                                .eq('yacht_id', repairForm.yacht_id)
                                .eq('role', 'manager');

                              if (managersError) throw managersError;

                              if (managers && managers.length > 0) {
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();

                                  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-repair-notification`;

                                  await fetch(apiUrl, {
                                    method: 'POST',
                                    headers: {
                                      'Authorization': `Bearer ${session?.access_token}`,
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      managerEmails: managers.map(m => `${m.first_name} ${m.last_name}`),
                                      repairTitle: repairForm.title,
                                      yachtName: selectedYacht?.name || 'Unknown Yacht',
                                      submitterName: userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}`.trim() : 'Unknown'
                                    })
                                  });
                                } catch (emailError) {
                                  console.error('Failed to send email notifications:', emailError);
                                }
                              }
                            }
                          }

                          setRepairSuccess(true);
                          setRepairForm({
                            yacht_id: '',
                            title: '',
                            description: '',
                            estimated_repair_cost: '',
                            file: null,
                            customer_id: '',
                            vessel_id: ''
                          });
                          setShowRepairForm(false);
                          setCustomerType('yacht');
                          setSelectedCustomerId('');
                          setCustomerVessels([]);
                          await loadRepairRequests();
                          await loadStaffMessages();
                          await loadChatMessages();
                          await loadAdminNotifications();

                          setTimeout(() => setRepairSuccess(false), 3000);
                        } catch (err: any) {
                          setRepairError(err.message || 'Failed to submit repair request');
                        } finally {
                          setRepairLoading(false);
                        }
                      }} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Customer Type *</label>
                          <div className="grid grid-cols-2 gap-4">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerType('yacht');
                                setRepairForm({...repairForm, customer_id: '', vessel_id: ''});
                                setSelectedCustomerId('');
                                setCustomerVessels([]);
                              }}
                              className={`py-3 px-4 rounded-lg font-medium transition-all ${
                                customerType === 'yacht'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-orange-500'
                              }`}
                            >
                              Yacht Customer
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomerType('customer');
                                setRepairForm({...repairForm, yacht_id: ''});
                              }}
                              className={`py-3 px-4 rounded-lg font-medium transition-all ${
                                customerType === 'customer'
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-slate-900 text-slate-400 border border-slate-700 hover:border-orange-500'
                              }`}
                            >
                              Walk-In Customer
                            </button>
                          </div>
                        </div>

                        {customerType === 'yacht' ? (
                          <div>
                            <label className="block text-sm font-medium mb-2">Yacht Name *</label>
                            <select
                              required
                              value={repairForm.yacht_id}
                              onChange={(e) => setRepairForm({...repairForm, yacht_id: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                            >
                              <option value="">Select a yacht</option>
                              {allYachts.map((yacht) => (
                                <option key={yacht.id} value={yacht.id}>
                                  {yacht.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div className="bg-blue-500/10 border border-blue-500 rounded-lg p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-blue-400">Walk-In Customer Information</h4>
                              <button
                                type="button"
                                onClick={() => setShowQuickAddCustomer(true)}
                                className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                              >
                                + New Customer
                              </button>
                            </div>

                            {showQuickAddCustomer && (
                              <div className="bg-slate-900/50 border border-blue-500/30 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <h5 className="font-medium text-blue-300">Quick Add Customer</h5>
                                  <button
                                    type="button"
                                    onClick={() => setShowQuickAddCustomer(false)}
                                    className="text-slate-400 hover:text-white"
                                  >
                                    ✕
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setQuickCustomerForm({...quickCustomerForm, customer_type: 'individual'})}
                                    className={`px-3 py-2 rounded text-sm ${quickCustomerForm.customer_type === 'individual' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                                  >
                                    Individual
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickCustomerForm({...quickCustomerForm, customer_type: 'business'})}
                                    className={`px-3 py-2 rounded text-sm ${quickCustomerForm.customer_type === 'business' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}
                                  >
                                    Business
                                  </button>
                                </div>
                                {quickCustomerForm.customer_type === 'individual' ? (
                                  <div className="grid grid-cols-2 gap-3">
                                    <input
                                      type="text"
                                      placeholder="First Name"
                                      value={quickCustomerForm.first_name}
                                      onChange={(e) => setQuickCustomerForm({...quickCustomerForm, first_name: e.target.value})}
                                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Last Name"
                                      value={quickCustomerForm.last_name}
                                      onChange={(e) => setQuickCustomerForm({...quickCustomerForm, last_name: e.target.value})}
                                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                    />
                                  </div>
                                ) : (
                                  <input
                                    type="text"
                                    placeholder="Business Name"
                                    value={quickCustomerForm.business_name}
                                    onChange={(e) => setQuickCustomerForm({...quickCustomerForm, business_name: e.target.value})}
                                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                  />
                                )}
                                <input
                                  type="email"
                                  placeholder="Email"
                                  value={quickCustomerForm.email}
                                  onChange={(e) => setQuickCustomerForm({...quickCustomerForm, email: e.target.value})}
                                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                />
                                <input
                                  type="tel"
                                  placeholder="Phone"
                                  value={quickCustomerForm.phone}
                                  onChange={(e) => setQuickCustomerForm({...quickCustomerForm, phone: e.target.value})}
                                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const { data, error } = await supabase
                                        .from('customers')
                                        .insert({
                                          ...quickCustomerForm,
                                          is_active: true,
                                          created_by: user?.id
                                        })
                                        .select()
                                        .single();
                                      if (error) throw error;
                                      await loadCustomers();
                                      setRepairForm({...repairForm, customer_id: data.id});
                                      setSelectedCustomerId(data.id);
                                      await loadCustomerVessels(data.id);
                                      setShowQuickAddCustomer(false);
                                      setQuickCustomerForm({
                                        customer_type: 'individual',
                                        first_name: '',
                                        last_name: '',
                                        business_name: '',
                                        email: '',
                                        phone: ''
                                      });
                                      alert('Customer added successfully!');
                                    } catch (error: any) {
                                      alert('Failed to add customer: ' + error.message);
                                    }
                                  }}
                                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium"
                                >
                                  Add Customer
                                </button>
                              </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium mb-2">Select Customer *</label>
                              <select
                                required
                                value={repairForm.customer_id}
                                onChange={async (e) => {
                                  const customerId = e.target.value;
                                  setRepairForm({...repairForm, customer_id: customerId, vessel_id: ''});
                                  setSelectedCustomerId(customerId);
                                  if (customerId) {
                                    await loadCustomerVessels(customerId);
                                  } else {
                                    setCustomerVessels([]);
                                  }
                                }}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                              >
                                <option value="">Select a customer</option>
                                {customers.map((customer: any) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.customer_type === 'business'
                                      ? customer.business_name
                                      : `${customer.first_name} ${customer.last_name}`
                                    }
                                  </option>
                                ))}
                              </select>
                            </div>

                            {repairForm.customer_id && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <label className="block text-sm font-medium">Select Vessel *</label>
                                  <button
                                    type="button"
                                    onClick={() => setShowQuickAddVessel(true)}
                                    className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                                  >
                                    + New Vessel
                                  </button>
                                </div>

                                {showQuickAddVessel && (
                                  <div className="bg-slate-900/50 border border-blue-500/30 rounded-lg p-4 space-y-3 mb-3">
                                    <div className="flex items-center justify-between">
                                      <h5 className="font-medium text-blue-300">Quick Add Vessel</h5>
                                      <button
                                        type="button"
                                        onClick={() => setShowQuickAddVessel(false)}
                                        className="text-slate-400 hover:text-white"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Vessel Name *"
                                      value={quickVesselForm.vessel_name}
                                      onChange={(e) => setQuickVesselForm({...quickVesselForm, vessel_name: e.target.value})}
                                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                      <input
                                        type="text"
                                        placeholder="Manufacturer"
                                        value={quickVesselForm.manufacturer}
                                        onChange={(e) => setQuickVesselForm({...quickVesselForm, manufacturer: e.target.value})}
                                        className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                      />
                                      <input
                                        type="text"
                                        placeholder="Model"
                                        value={quickVesselForm.model}
                                        onChange={(e) => setQuickVesselForm({...quickVesselForm, model: e.target.value})}
                                        className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                      />
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Year"
                                      value={quickVesselForm.year}
                                      onChange={(e) => setQuickVesselForm({...quickVesselForm, year: e.target.value})}
                                      className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
                                    />
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          if (!quickVesselForm.vessel_name) {
                                            alert('Vessel name is required');
                                            return;
                                          }
                                          const { data, error } = await supabase
                                            .from('customer_vessels')
                                            .insert({
                                              customer_id: repairForm.customer_id,
                                              vessel_name: quickVesselForm.vessel_name,
                                              manufacturer: quickVesselForm.manufacturer || null,
                                              model: quickVesselForm.model || null,
                                              year: quickVesselForm.year ? parseInt(quickVesselForm.year) : null,
                                              is_active: true
                                            })
                                            .select()
                                            .single();
                                          if (error) throw error;
                                          await loadCustomerVessels(repairForm.customer_id);
                                          setRepairForm({...repairForm, vessel_id: data.id});
                                          setShowQuickAddVessel(false);
                                          setQuickVesselForm({
                                            vessel_name: '',
                                            manufacturer: '',
                                            model: '',
                                            year: ''
                                          });
                                          alert('Vessel added successfully!');
                                        } catch (error: any) {
                                          alert('Failed to add vessel: ' + error.message);
                                        }
                                      }}
                                      className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium"
                                    >
                                      Add Vessel
                                    </button>
                                  </div>
                                )}

                                <select
                                  required
                                  value={repairForm.vessel_id}
                                  onChange={(e) => setRepairForm({...repairForm, vessel_id: e.target.value})}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                                >
                                  <option value="">Select a vessel</option>
                                  {customerVessels.map((vessel: any) => (
                                    <option key={vessel.id} value={vessel.id}>
                                      {vessel.vessel_name} {vessel.manufacturer && vessel.model ? `(${vessel.manufacturer} ${vessel.model})` : ''}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium mb-2">Repair Title *</label>
                          <input
                            type="text"
                            required
                            value={repairForm.title}
                            onChange={(e) => setRepairForm({...repairForm, title: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                            placeholder="Brief description of repair needed"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Description</label>
                          <textarea
                            value={repairForm.description}
                            onChange={(e) => setRepairForm({...repairForm, description: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 min-h-[100px]"
                            placeholder="Detailed description of the repair..."
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Estimated Repair Cost</label>
                          <input
                            type="text"
                            value={repairForm.estimated_repair_cost}
                            onChange={(e) => setRepairForm({...repairForm, estimated_repair_cost: e.target.value})}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                            placeholder="e.g., $1,500.00"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Upload File</label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setRepairForm({...repairForm, file});
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer hover:file:bg-orange-600"
                          />
                          {repairForm.file && (
                            <p className="text-sm text-slate-400 mt-2">Selected: {repairForm.file.name}</p>
                          )}
                        </div>

                        {repairError && (
                          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                            {repairError}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={repairLoading}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {repairLoading ? 'Submitting Request...' : 'Submit Repair Request'}
                        </button>
                      </form>
                    </div>
                  )}

                  {repairSuccess && (
                    <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm mb-6">
                      Repair request submitted successfully! Managers have been notified.
                    </div>
                  )}

                  <div className="mt-8">
                    <h3 className="text-xl font-semibold mb-4">All Repair Requests</h3>

                    {repairRequests.length === 0 ? (
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700 text-center">
                        <p className="text-slate-400">No repair requests yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {repairRequests.map((request: any) => {
                          const invoice = repairInvoices[request.id];
                          return (
                            <div key={request.id} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-lg font-semibold">{request.title}</h4>
                                    {request.status === 'pending' && (
                                      <span className="bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full text-xs font-semibold">
                                        Pending
                                      </span>
                                    )}
                                    {request.status === 'pending' && request.submitted_by === user?.id && (
                                      <button
                                        onClick={() => handleEditRepairRequest(request)}
                                        className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                                      >
                                        <Pencil className="w-3 h-3" />
                                        Edit
                                      </button>
                                    )}
                                    {request.status === 'approved' && (
                                      <span className="bg-green-500/20 text-green-500 px-3 py-1 rounded-full text-xs font-semibold">
                                        ✓ Approved
                                      </span>
                                    )}
                                    {request.status === 'rejected' && (
                                      <span className="bg-red-500/20 text-red-500 px-3 py-1 rounded-full text-xs font-semibold">
                                        ✗ Denied
                                      </span>
                                    )}
                                    {request.status === 'completed' && (
                                      <span className="bg-blue-500/20 text-blue-500 px-3 py-1 rounded-full text-xs font-semibold">
                                        Completed
                                      </span>
                                    )}
                                  </div>
                                  {request.customer_id && request.customers ? (
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-semibold">
                                          WALK-IN CUSTOMER
                                        </span>
                                      </div>
                                      <p className="text-slate-300 text-sm font-medium">
                                        {request.customers.customer_type === 'business'
                                          ? request.customers.business_name
                                          : `${request.customers.first_name} ${request.customers.last_name}`
                                        }
                                      </p>
                                      {request.customer_vessels && (
                                        <p className="text-slate-300 text-sm">
                                          <span className="text-slate-400">Vessel:</span> {request.customer_vessels.vessel_name}
                                          {request.customer_vessels.manufacturer && request.customer_vessels.model &&
                                            ` (${request.customer_vessels.manufacturer} ${request.customer_vessels.model})`
                                          }
                                        </p>
                                      )}
                                      {request.customers.phone && (
                                        <p className="text-slate-400 text-sm">{request.customers.phone}</p>
                                      )}
                                      {request.customers.email && (
                                        <p className="text-slate-400 text-sm">{request.customers.email}</p>
                                      )}
                                    </div>
                                  ) : request.is_retail_customer ? (
                                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-2">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs font-semibold">
                                          WALK-IN CUSTOMER (Legacy)
                                        </span>
                                      </div>
                                      <p className="text-slate-300 text-sm font-medium">{request.customer_name}</p>
                                      <p className="text-slate-400 text-sm">{request.customer_phone}</p>
                                      <p className="text-slate-400 text-sm">{request.customer_email}</p>
                                    </div>
                                  ) : (
                                    <p className="text-slate-400 text-sm mb-1">
                                      Yacht: <span className="text-white">{request.yachts?.name || 'Unknown'}</span>
                                    </p>
                                  )}
                                  {request.description && (
                                    <p className="text-slate-400 text-sm mb-2">{request.description}</p>
                                  )}
                                  {request.file_url && (
                                    <a
                                      href={request.file_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-orange-500 hover:text-orange-400 text-sm inline-flex items-center gap-1"
                                    >
                                      📎 {request.file_name || 'View File'}
                                    </a>
                                  )}
                                  <p className="text-slate-500 text-xs mt-2">
                                    Submitted: {new Date(request.created_at).toLocaleDateString()} at {new Date(request.created_at).toLocaleTimeString()}
                                  </p>
                                  {request.completed_at && request.completed_by_profile && (
                                    <div className="mt-3 bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
                                      <p className="text-sm text-blue-300">
                                        <span className="font-semibold">Completed:</span> {new Date(request.completed_at).toLocaleDateString()} at {new Date(request.completed_at).toLocaleTimeString()}
                                      </p>
                                      <p className="text-sm text-blue-300 mt-1">
                                        <span className="font-semibold">By:</span> {request.completed_by_profile.first_name} {request.completed_by_profile.last_name}
                                      </p>
                                    </div>
                                  )}
                                  {request.approval_notes && (
                                    <div className="mt-3 bg-slate-900/50 p-3 rounded-lg">
                                      <p className="text-sm text-slate-300">
                                        <span className="font-semibold">Note:</span> {request.approval_notes}
                                      </p>
                                    </div>
                                  )}

                                  {invoice && (
                                    <div className="mt-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-lg p-4">
                                      <div className="flex items-center gap-2 mb-3">
                                        <Receipt className="w-5 h-5 text-emerald-400" />
                                        <h5 className="font-semibold text-emerald-400">Invoice Details</h5>
                                        {invoice.payment_status && (
                                          <>
                                            {invoice.payment_status === 'pending' && !invoice.payment_email_sent_at && (
                                              <span className="ml-auto bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                                                Need to Bill Customer
                                              </span>
                                            )}
                                            {invoice.payment_status === 'pending' && invoice.payment_link_clicked_at && (
                                              <span className="ml-auto bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-xs font-semibold">
                                                Viewed Invoice
                                              </span>
                                            )}
                                            {invoice.payment_status === 'pending' && !invoice.payment_link_clicked_at && invoice.payment_email_opened_at && (
                                              <span className="ml-auto bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-xs font-semibold">
                                                Opened Email
                                              </span>
                                            )}
                                            {invoice.payment_status === 'pending' && !invoice.payment_email_opened_at && invoice.payment_email_delivered_at && (
                                              <span className="ml-auto bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-xs font-semibold">
                                                Email Delivered
                                              </span>
                                            )}
                                            {invoice.payment_status === 'pending' && invoice.payment_email_sent_at && !invoice.payment_email_delivered_at && !invoice.payment_email_opened_at && !invoice.payment_link_clicked_at && (
                                              <span className="ml-auto bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold">
                                                Email Sent
                                              </span>
                                            )}
                                            {invoice.payment_status === 'paid' && (
                                              <span className="ml-auto bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                                                <CheckCircle className="w-3 h-3" />
                                                Paid
                                              </span>
                                            )}
                                            {invoice.payment_status === 'failed' && (
                                              <span className="ml-auto bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold">
                                                Payment Failed
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <p className="text-sm text-slate-300">
                                          <span className="font-semibold">Amount:</span> {invoice.invoice_amount}
                                        </p>
                                        {invoice.invoice_file_url && (
                                          <p className="text-sm">
                                            <a
                                              href={invoice.invoice_file_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                                            >
                                              <FileText className="w-4 h-4" />
                                              {invoice.invoice_file_name || 'View Invoice PDF'}
                                            </a>
                                          </p>
                                        )}
                                        <p className="text-xs text-slate-400">
                                          Invoice Date: {new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString()}
                                        </p>
                                        {invoice.paid_at && (
                                          <p className="text-xs text-green-400">
                                            Paid on: {new Date(invoice.paid_at).toLocaleDateString()} at {new Date(invoice.paid_at).toLocaleTimeString()}
                                          </p>
                                        )}
                                        {invoice.payment_email_sent_at && (
                                          <div className="mt-3 pt-3 border-t border-emerald-500/20">
                                            <p className="text-xs font-semibold text-slate-300 mb-2">Email Engagement</p>
                                            <div className="space-y-1">
                                              {invoice.payment_email_recipient && (
                                                <div className="flex items-center gap-2 text-xs text-blue-300 mb-2">
                                                  <Mail className="w-3 h-3" />
                                                  <span className="font-medium">To: {invoice.payment_email_recipient}</span>
                                                </div>
                                              )}
                                              {invoice.payment_email_sent_at && (
                                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                                  <Mail className="w-3 h-3 text-blue-400" />
                                                  <span>Sent: {new Date(invoice.payment_email_sent_at).toLocaleDateString()} at {new Date(invoice.payment_email_sent_at).toLocaleTimeString()}</span>
                                                </div>
                                              )}
                                              {invoice.payment_email_delivered_at && (
                                                <div className="flex items-center gap-2 text-xs text-emerald-400">
                                                  <CheckCircle className="w-3 h-3" />
                                                  <span>Delivered: {new Date(invoice.payment_email_delivered_at).toLocaleDateString()} at {new Date(invoice.payment_email_delivered_at).toLocaleTimeString()}</span>
                                                </div>
                                              )}
                                              {invoice.payment_email_opened_at && (
                                                <div className="flex items-center gap-2 text-xs text-cyan-400">
                                                  <Eye className="w-3 h-3" />
                                                  <span>Opened: {new Date(invoice.payment_email_opened_at).toLocaleDateString()} at {new Date(invoice.payment_email_opened_at).toLocaleTimeString()}</span>
                                                  {invoice.email_open_count > 1 && (
                                                    <span className="bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded text-xs">
                                                      {invoice.email_open_count}x
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                              {invoice.payment_link_clicked_at && (
                                                <div className="flex items-center gap-2 text-xs text-teal-400">
                                                  <MousePointer className="w-3 h-3" />
                                                  <span>Clicked: {new Date(invoice.payment_link_clicked_at).toLocaleDateString()} at {new Date(invoice.payment_link_clicked_at).toLocaleTimeString()}</span>
                                                  {invoice.email_click_count > 1 && (
                                                    <span className="bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded text-xs">
                                                      {invoice.email_click_count}x
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                              {invoice.payment_status === 'paid' && invoice.payment_confirmation_email_sent_at && (
                                                <div className="flex items-center gap-2 text-xs text-emerald-400 pt-2 border-t border-emerald-500/20 mt-2">
                                                  <CheckCircle className="w-3 h-3" />
                                                  <span className="font-medium">Payment Confirmation Sent: {new Date(invoice.payment_confirmation_email_sent_at).toLocaleDateString()} at {new Date(invoice.payment_confirmation_email_sent_at).toLocaleTimeString()}</span>
                                                </div>
                                              )}
                                              {invoice.payment_email_bounced_at && (
                                                <div className="flex items-center gap-2 text-xs text-red-400">
                                                  <AlertCircle className="w-3 h-3" />
                                                  <span>Bounced: {new Date(invoice.payment_email_bounced_at).toLocaleDateString()} at {new Date(invoice.payment_email_bounced_at).toLocaleTimeString()}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                        {invoice.payment_link_url && (
                                          <div className="mt-3 pt-3 border-t border-emerald-500/20">
                                            <p className="text-xs text-slate-400 mb-2">Payment Link:</p>
                                            <div className="flex items-center gap-2">
                                              <input
                                                type="text"
                                                readOnly
                                                value={invoice.payment_link_url}
                                                className="flex-1 bg-slate-900/50 border border-slate-700 rounded px-3 py-2 text-xs text-slate-300"
                                              />
                                              <button
                                                onClick={() => copyToClipboard(invoice.payment_link_url)}
                                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                                              >
                                                <Download className="w-3 h-3" />
                                                Copy
                                              </button>
                                              <button
                                                onClick={() => handleOpenEmailModal(invoice)}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-xs font-semibold transition-all flex items-center gap-1"
                                              >
                                                <Mail className="w-3 h-3" />
                                                Email
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {canManageYacht(effectiveRole) && invoice.payment_status !== 'paid' && (
                                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-emerald-500/20">
                                          {invoice.payment_status === 'pending' && !invoice.payment_link_url && (
                                            <button
                                              onClick={() => handleEditExistingInvoice(invoice, request)}
                                              className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                                            >
                                              <Pencil className="w-3 h-3" />
                                              Edit Invoice
                                            </button>
                                          )}
                                          {!invoice.payment_link_url && invoice.payment_status === 'pending' && (
                                            <button
                                              onClick={() => handleGeneratePaymentLink(invoice)}
                                              disabled={paymentLinkLoading[invoice.id]}
                                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                            >
                                              <CreditCard className="w-3 h-3" />
                                              {paymentLinkLoading[invoice.id] ? 'Generating...' : 'Generate Payment Link'}
                                            </button>
                                          )}
                                          {invoice.payment_link_url && invoice.payment_status === 'pending' && (
                                            <>
                                              <button
                                                onClick={() => handleRegeneratePaymentLink(invoice)}
                                                disabled={paymentLinkLoading[invoice.id]}
                                                className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                              >
                                                <CreditCard className="w-3 h-3" />
                                                {paymentLinkLoading[invoice.id] ? 'Regenerating...' : 'Regenerate Payment Link'}
                                              </button>
                                              <button
                                                onClick={() => handleDeletePaymentLink(invoice)}
                                                disabled={deletePaymentLinkLoading[invoice.id]}
                                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                                              >
                                                <X className="w-3 h-3" />
                                                {deletePaymentLinkLoading[invoice.id] ? 'Deleting...' : 'Delete Payment Link'}
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {!invoice && request.status === 'completed' && !request.is_retail_customer && canManageYacht(effectiveRole) && (
                                    <div className="mt-4">
                                      <button
                                        onClick={() => handleAddInvoiceToCompletedRepair(request)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                                      >
                                        <Receipt className="w-4 h-4" />
                                        Add Invoice
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {canManageYacht(effectiveRole) && (
                                  <>
                                    {request.status === 'pending' && (
                                      <div className="flex flex-col gap-2 ml-4">
                                        <div className="flex gap-2">
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setApprovalAction({ requestId: request.id, status: 'approved' });
                                              setShowApprovalModal(true);
                                            }}
                                            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                                          >
                                            ✓ Approve
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setApprovalAction({ requestId: request.id, status: 'rejected' });
                                              setShowApprovalModal(true);
                                            }}
                                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                                          >
                                            ✗ Deny
                                          </button>
                                        </div>
                                        {request.is_retail_customer && request.estimated_repair_cost && (
                                          <button
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setSelectedRepairForEstimateEmail(request);
                                              setEstimateEmailRecipient(request.customer_email || '');
                                              setEstimateEmailRecipientName(request.customer_name || '');
                                              setShowEstimateEmailModal(true);
                                            }}
                                            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                                            title="Send estimate email to customer"
                                          >
                                            <Mail className="w-4 h-4" />
                                            Send Estimate
                                            {request.estimate_email_sent_at && (
                                              <span className="text-xs bg-blue-400/20 px-2 py-0.5 rounded">
                                                Sent {new Date(request.estimate_email_sent_at).toLocaleDateString()}
                                              </span>
                                            )}
                                          </button>
                                        )}
                                      </div>
                                    )}
                                    {request.status === 'approved' && (
                                      <div className="flex gap-2 ml-4">
                                        <button
                                          onClick={() => handleRepairCompletion(request.id)}
                                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                          Repair Completed
                                        </button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {showApprovalModal && approvalAction && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full">
                        <div className="p-6 border-b border-slate-700">
                          <h3 className="text-2xl font-bold">
                            {approvalAction.status === 'approved' ? 'Approve Repair Request' : 'Deny Repair Request'}
                          </h3>
                        </div>

                        <div className="p-6">
                          <label className="block text-sm font-medium mb-2">
                            {approvalAction.status === 'approved' ? 'Approval Notes (Optional)' : 'Denial Reason (Optional)'}
                          </label>
                          <textarea
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 min-h-[100px]"
                            placeholder={approvalAction.status === 'approved' ? 'Add any approval notes...' : 'Explain why this request is being denied...'}
                          />
                        </div>

                        <div className="p-6 border-t border-slate-700 flex gap-3">
                          <button
                            onClick={() => {
                              setShowApprovalModal(false);
                              setApprovalAction(null);
                              setApprovalNotes('');
                            }}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleRepairApproval(approvalNotes || undefined)}
                            className={`flex-1 ${approvalAction.status === 'approved' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white font-semibold py-3 rounded-lg transition-all`}
                          >
                            {approvalAction.status === 'approved' ? '✓ Approve' : '✗ Deny'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {showEditRepairModal && editingRepairRequest && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700">
                          <h3 className="text-2xl font-bold">Edit Repair Request</h3>
                        </div>

                        <div className="p-6 space-y-4">
                          {editingRepairRequest.is_retail_customer && (
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                              <p className="text-sm text-blue-300 font-semibold mb-3">Retail Customer Information</p>

                              <div className="mb-3">
                                <label className="block text-sm font-medium mb-2">Customer Name</label>
                                <input
                                  type="text"
                                  value={editRepairForm.customer_name}
                                  onChange={(e) => setEditRepairForm({ ...editRepairForm, customer_name: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                                  required
                                />
                              </div>

                              <div className="mb-3">
                                <label className="block text-sm font-medium mb-2">Phone Number</label>
                                <input
                                  type="tel"
                                  value={editRepairForm.customer_phone}
                                  onChange={(e) => setEditRepairForm({ ...editRepairForm, customer_phone: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium mb-2">Email Address</label>
                                <input
                                  type="email"
                                  value={editRepairForm.customer_email}
                                  onChange={(e) => setEditRepairForm({ ...editRepairForm, customer_email: e.target.value })}
                                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                                  required
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-2">Title</label>
                            <input
                              type="text"
                              value={editRepairForm.title}
                              onChange={(e) => setEditRepairForm({ ...editRepairForm, title: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Description</label>
                            <textarea
                              value={editRepairForm.description}
                              onChange={(e) => setEditRepairForm({ ...editRepairForm, description: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 min-h-[120px]"
                              placeholder="Describe the repair request..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">Estimated Repair Cost (Optional)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editRepairForm.estimated_repair_cost}
                              onChange={(e) => setEditRepairForm({ ...editRepairForm, estimated_repair_cost: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                              placeholder="0.00"
                            />
                          </div>

                          {editingRepairRequest.file_url && (
                            <div className="bg-slate-900/50 p-3 rounded-lg">
                              <p className="text-sm text-slate-300 mb-2">Current file:</p>
                              <a
                                href={editingRepairRequest.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-500 hover:text-orange-400 text-sm inline-flex items-center gap-1"
                              >
                                📎 {editingRepairRequest.file_name || 'View File'}
                              </a>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {editingRepairRequest.file_url ? 'Replace File (Optional)' : 'Upload File (Optional)'}
                            </label>
                            <input
                              type="file"
                              onChange={(e) => setEditRepairForm({ ...editRepairForm, file: e.target.files?.[0] || null })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                            />
                          </div>
                        </div>

                        <div className="p-6 border-t border-slate-700">
                          {editingRepairRequest.is_retail_customer && editRepairForm.customer_email && editRepairForm.estimated_repair_cost && (
                            <div className="mb-4">
                              <button
                                onClick={handleSaveAndSendEstimate}
                                disabled={editRepairLoading || !editRepairForm.title}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                <Send className="w-5 h-5" />
                                {editingRepairRequest.estimate_email_sent_at ? 'Save & Resend Estimate Email' : 'Save & Send Estimate Email'}
                              </button>
                              {editingRepairRequest.estimate_email_sent_at && (
                                <p className="text-xs text-slate-400 mt-2 text-center">
                                  Last sent: {new Date(editingRepairRequest.estimate_email_sent_at).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          )}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                setShowEditRepairModal(false);
                                setEditingRepairRequest(null);
                                setEditRepairForm({
                                  title: '',
                                  description: '',
                                  file: null,
                                  customer_name: '',
                                  customer_phone: '',
                                  customer_email: '',
                                  estimated_repair_cost: ''
                                });
                              }}
                              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all"
                              disabled={editRepairLoading}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSubmitEditRepair}
                              disabled={editRepairLoading || !editRepairForm.title}
                              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50"
                            >
                              {editRepairLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {showInvoiceModal && selectedRepairForInvoice && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-700">
                          <h3 className="text-2xl font-bold">
                            {isEditingInvoice ? 'Edit Invoice' : isAddingInvoiceToCompleted ? 'Add Invoice to Completed Repair' : 'Complete Repair & Send Invoice'}
                          </h3>
                          <p className="text-slate-400 mt-2">{selectedRepairForInvoice.title}</p>
                        </div>

                        <div className="p-6 space-y-6">
                          {selectedRepairForInvoice.estimated_repair_cost && !isEditingInvoice && (
                            <div className="bg-slate-900/50 p-4 rounded-lg">
                              <p className="text-sm text-slate-400">Estimated Repair Cost</p>
                              <p className="text-lg font-semibold">{selectedRepairForInvoice.estimated_repair_cost}</p>
                            </div>
                          )}

                          {isEditingInvoice && selectedInvoiceForEdit && (
                            <div className="bg-slate-900/50 p-4 rounded-lg">
                              <p className="text-sm text-slate-400">Current Invoice Amount</p>
                              <p className="text-lg font-semibold">{selectedInvoiceForEdit.invoice_amount}</p>
                              {selectedInvoiceForEdit.invoice_file_name && (
                                <p className="text-sm text-slate-400 mt-2">
                                  Current File: {selectedInvoiceForEdit.invoice_file_name}
                                </p>
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {isEditingInvoice ? 'New Invoice Amount *' : 'Final Invoice Amount *'}
                            </label>
                            <input
                              type="text"
                              required
                              value={invoiceForm.final_invoice_amount}
                              onChange={(e) => setInvoiceForm({...invoiceForm, final_invoice_amount: e.target.value})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                              placeholder="e.g., $1,500.00"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              {isEditingInvoice ? 'Replace Invoice PDF (Optional)' : 'Attach Invoice PDF (Optional)'}
                            </label>
                            <input
                              type="file"
                              accept=".pdf"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setInvoiceForm({...invoiceForm, invoice_file: file});
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-orange-500 file:text-white file:cursor-pointer hover:file:bg-orange-600"
                            />
                            {invoiceForm.invoice_file && (
                              <p className="text-sm text-slate-400 mt-2">Selected: {invoiceForm.invoice_file.name}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Payment Method Type *
                            </label>
                            <select
                              value={invoiceForm.payment_method_type}
                              onChange={(e) => setInvoiceForm({...invoiceForm, payment_method_type: e.target.value as 'card' | 'ach' | 'both'})}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-orange-500"
                            >
                              <option value="card">Credit/Debit Card Only</option>
                              <option value="ach">ACH (Bank Transfer) Only</option>
                              <option value="both">Both Card and ACH</option>
                            </select>
                            <p className="text-xs text-slate-400 mt-1">
                              Select how the {(selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer) ? 'customer' : 'yacht owner'} can pay this invoice
                            </p>
                          </div>

                          {!isEditingInvoice && (
                            <div className="bg-blue-500/10 border border-blue-500 text-blue-300 px-4 py-3 rounded-lg text-sm">
                              <p className="font-semibold mb-1">What happens next:</p>
                              <ul className="list-disc list-inside space-y-1 text-xs">
                                {!isAddingInvoiceToCompleted && <li>Repair will be marked as completed</li>}
                                <li>Invoice will be sent to the {(selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer) ? 'walk-in customer' : 'yacht manager'} via email</li>
                                {!(selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer) && (
                                  <li>Owner will receive a message in their yacht chat</li>
                                )}
                                <li>Invoice details will be stored with the repair request</li>
                              </ul>
                            </div>
                          )}

                          {isEditingInvoice && (
                            <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-300 px-4 py-3 rounded-lg text-sm">
                              <p className="font-semibold mb-1">Note:</p>
                              <p className="text-xs">
                                This will update the invoice details. If a payment link has been generated, it will remain valid with the updated amount.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="p-6 border-t border-slate-700 flex gap-3">
                          <button
                            onClick={() => {
                              setShowInvoiceModal(false);
                              setSelectedRepairForInvoice(null);
                              setSelectedInvoiceForEdit(null);
                              setInvoiceForm({ final_invoice_amount: '', invoice_file: null, payment_method_type: 'card' });
                              setIsEditingInvoice(false);
                              setIsAddingInvoiceToCompleted(false);
                            }}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-all"
                            disabled={invoiceLoading}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={isEditingInvoice ? handleUpdateInvoice : isAddingInvoiceToCompleted ? handleAddInvoiceToCompletedRepairSubmit : handleBillYachtManager}
                            disabled={invoiceLoading || !invoiceForm.final_invoice_amount}
                            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {invoiceLoading
                              ? (isEditingInvoice ? 'Updating Invoice...' : isAddingInvoiceToCompleted ? 'Adding Invoice...' : 'Sending Invoice...')
                              : (isEditingInvoice ? 'Update Invoice' : isAddingInvoiceToCompleted ? ((selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer) ? 'Bill Walk-In Customer' : 'Bill Yacht Manager') : ((selectedRepairForInvoice.customer_id || selectedRepairForInvoice.is_retail_customer) ? 'Bill Walk-In Customer' : 'Bill Yacht Manager'))}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : adminView === 'ownerchat' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-purple-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center gap-3 mb-6">
                    <MessageCircle className="w-8 h-8 text-purple-500" />
                    <div>
                      <h2 className="text-2xl font-bold">Owner Chat</h2>
                      <p className="text-slate-400">{isOwnerRole(effectiveRole) ? `Chat with all owners on ${yacht?.name || 'your yacht'}` : 'View all owner chats across all yachts'}</p>
                    </div>
                  </div>

                  {canAccessAllYachts(effectiveRole) ? (
                    <div className="space-y-6">
                      {selectedChatYachtId ? (
                        <>
                          <button
                            onClick={() => setSelectedChatYachtId(null)}
                            className="flex items-center gap-2 text-slate-400 hover:text-purple-500 transition-colors mb-4"
                          >
                            <span>← Back to All Yachts</span>
                          </button>

                          {(() => {
                            const selectedYacht = allYachts.find(y => y.id === selectedChatYachtId);
                            const yachtMessages = chatMessages
                              .filter((msg: any) => msg.yacht_id === selectedChatYachtId)
                              .filter((msg: any) =>
                                !msg.message.includes('Check-In Alert:') &&
                                !msg.message.includes('Check-Out Alert:') &&
                                !msg.message.includes('Repair Request Approved:') &&
                                !msg.message.includes('Repair Request Completed') &&
                                !msg.message.includes('Repair Request Submitted:') &&
                                !msg.message.includes('Invoice Sent:')
                              );

                            return (
                              <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                                <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <Ship className="w-6 h-6 text-purple-500" />
                                    <h3 className="text-xl font-bold">{selectedYacht?.name}</h3>
                                    <span className="ml-auto text-sm text-slate-400">
                                      {yachtMessages.length} {yachtMessages.length === 1 ? 'message' : 'messages'}
                                    </span>
                                  </div>
                                </div>

                                <div className="h-[500px] overflow-y-auto p-6 space-y-4">
                                  {yachtMessages.length === 0 ? (
                                    <div className="flex items-center justify-center h-full">
                                      <p className="text-slate-400">No messages yet</p>
                                    </div>
                                  ) : (
                                    yachtMessages.map((msg: any) => {
                                      const senderName = msg.user_profiles?.first_name && msg.user_profiles?.last_name
                                        ? `${msg.user_profiles.first_name} ${msg.user_profiles.last_name}`
                                        : 'Unknown User';

                                      return (
                                        <div key={msg.id} className="flex justify-start">
                                          <div className="max-w-[70%] rounded-2xl p-4 bg-slate-700 text-slate-100">
                                            <p className="text-xs font-semibold mb-1 opacity-80">
                                              {senderName}
                                            </p>
                                            <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                            <p className="text-xs mt-2 text-slate-400">
                                              {new Date(msg.created_at).toLocaleString([], {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                              })}
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })()}

                          <div className="bg-amber-500/10 border border-amber-500 text-amber-500 px-4 py-3 rounded-lg text-sm">
                            Staff view: You can see all owner chats but cannot send messages. Only yacht owners can participate in these conversations.
                          </div>
                        </>
                      ) : (
                        <>
                          {allYachts.length === 0 ? (
                            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-700 text-center">
                              <Ship className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                              <p className="text-slate-400 text-lg">No yachts found</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {allYachts.map((yacht) => {
                                const yachtMessages = chatMessages
                                  .filter((msg: any) => msg.yacht_id === yacht.id)
                                  .filter((msg: any) =>
                                    !msg.message.includes('Check-In Alert:') &&
                                    !msg.message.includes('Check-Out Alert:') &&
                                    !msg.message.includes('Repair Request Approved:') &&
                                    !msg.message.includes('Repair Request Completed') &&
                                    !msg.message.includes('Repair Request Submitted:') &&
                                    !msg.message.includes('Invoice Sent:')
                                  );

                                return (
                                  <button
                                    key={yacht.id}
                                    onClick={() => setSelectedChatYachtId(yacht.id)}
                                    className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-purple-500 transition-all duration-300 hover:scale-105 text-left group"
                                  >
                                    <div className="flex items-center gap-4 mb-4">
                                      <div className="bg-purple-500/20 p-4 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                                        <Ship className="w-8 h-8 text-purple-500" />
                                      </div>
                                    </div>
                                    <h3 className="text-xl font-bold mb-2">{yacht.name}</h3>
                                    <p className="text-slate-400 text-sm">
                                      {yachtMessages.length} {yachtMessages.length === 1 ? 'message' : 'messages'}
                                    </p>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          <div className="bg-amber-500/10 border border-amber-500 text-amber-500 px-4 py-3 rounded-lg text-sm">
                            Click on a yacht to view its owner chat conversations.
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="h-[500px] overflow-y-auto p-6 space-y-4">
                          {chatMessages.filter((msg: any) =>
                            !msg.message.includes('Check-In Alert:') &&
                            !msg.message.includes('Check-Out Alert:') &&
                            !msg.message.includes('Repair Request Approved:') &&
                            !msg.message.includes('Repair Request Completed') &&
                            !msg.message.includes('Repair Request Submitted:') &&
                            !msg.message.includes('Invoice Sent:') &&
                            (userProfile?.role !== 'owner' || !yacht || msg.yacht_id === yacht.id)
                          ).length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                              <p className="text-slate-400">No messages yet. Start the conversation!</p>
                            </div>
                          ) : (
                            chatMessages
                              .filter((msg: any) =>
                                !msg.message.includes('Check-In Alert:') &&
                                !msg.message.includes('Check-Out Alert:') &&
                                !msg.message.includes('Repair Request Approved:') &&
                                !msg.message.includes('Repair Request Completed') &&
                                !msg.message.includes('Repair Request Submitted:') &&
                                !msg.message.includes('Invoice Sent:') &&
                                (userProfile?.role !== 'owner' || !yacht || msg.yacht_id === yacht.id)
                              )
                              .map((msg: any) => {
                              const isCurrentUser = msg.user_id === user?.id;
                              const senderName = msg.user_profiles?.first_name && msg.user_profiles?.last_name
                                ? `${msg.user_profiles.first_name} ${msg.user_profiles.last_name}`
                                : 'Unknown User';

                              return (
                                <div
                                  key={msg.id}
                                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                                >
                                  <div
                                    className={`max-w-[70%] rounded-2xl p-4 ${
                                      isCurrentUser
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-slate-700 text-slate-100'
                                    }`}
                                  >
                                    {!isCurrentUser && (
                                      <p className="text-xs font-semibold mb-1 opacity-80">
                                        {senderName}
                                      </p>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                    <p className={`text-xs mt-2 ${isCurrentUser ? 'text-purple-200' : 'text-slate-400'}`}>
                                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="border-t border-slate-700 p-4">
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={newMessage}
                              onChange={(e) => setNewMessage(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  sendChatMessage();
                                }
                              }}
                              placeholder="Type your message..."
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500"
                              disabled={chatLoading}
                            />
                            <button
                              onClick={sendChatMessage}
                              disabled={chatLoading || !newMessage.trim()}
                              className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              <Send className="w-5 h-5" />
                              Send
                            </button>
                          </div>
                        </div>
                      </div>

                      {isOwnerRole(effectiveRole) ? (
                        <div className="mt-4 bg-purple-500/10 border border-purple-500 text-purple-500 px-4 py-3 rounded-lg text-sm">
                          You are chatting with all owners assigned to this yacht. Messages are visible to all owners on your yacht.
                        </div>
                      ) : (
                        <div className="mt-4 bg-amber-500/10 border border-amber-500 text-amber-500 px-4 py-3 rounded-lg text-sm">
                          Note: Only yacht owners can send messages in this chat.
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : adminView === 'messages' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-cyan-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="flex items-center gap-3 mb-6">
                    <Mail className="w-8 h-8 text-cyan-500" />
                    <div>
                      <h2 className="text-2xl font-bold">New Messages</h2>
                      <p className="text-slate-400">View all incoming messages and appointments</p>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-6">
                    <button
                      onClick={() => setMessagesTab('yacht')}
                      className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                        messagesTab === 'yacht'
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      Yacht Messages
                    </button>
                    {isStaffRole(effectiveRole) && (
                      <button
                        onClick={() => setMessagesTab('staff')}
                        className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
                          messagesTab === 'staff'
                            ? 'bg-cyan-500 text-white'
                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        Staff Messages
                      </button>
                    )}
                  </div>

                  {messagesTab === 'yacht' ? (
                  <div className="space-y-6">
                    {adminNotifications.length === 0 ? (
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-12 border border-slate-700 text-center">
                        <Mail className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400 text-lg">No notifications yet</p>
                      </div>
                    ) : selectedMessagesYachtId ? (
                      (() => {
                        const messagesByYacht = adminNotifications.reduce((acc: any, msg: any) => {
                          const yachtId = msg.yacht_id || 'unknown';
                          if (!acc[yachtId]) {
                            acc[yachtId] = {
                              yacht: msg.yachts,
                              messages: []
                            };
                          }
                          acc[yachtId].messages.push(msg);
                          return acc;
                        }, {});

                        const selectedData = messagesByYacht[selectedMessagesYachtId];

                        return (
                          <>
                            <button
                              onClick={() => setSelectedMessagesYachtId(null)}
                              className="flex items-center gap-2 text-slate-400 hover:text-cyan-500 transition-colors mb-4"
                            >
                              <span>← Back to All Yachts</span>
                            </button>

                            <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                              <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <Ship className="w-6 h-6 text-cyan-500" />
                                  <h3 className="text-xl font-bold">{selectedData?.yacht?.name || 'Customer Pay Boats'}</h3>
                                  <span className="ml-auto text-sm text-slate-400">
                                    {selectedData?.messages.length} {selectedData?.messages.length === 1 ? 'message' : 'messages'}
                                  </span>
                                </div>
                              </div>

                              <div className="p-6 space-y-4">
                                {selectedData?.messages
                                  .sort((a: any, b: any) => {
                                    const aCompleted = a.completed_at && a.completed_by;
                                    const bCompleted = b.completed_at && b.completed_by;
                                    if (aCompleted === bCompleted) return 0;
                                    return aCompleted ? 1 : -1;
                                  })
                                  .map((msg: any) => {
                                  const senderName = msg.user_profiles?.first_name && msg.user_profiles?.last_name
                                    ? `${msg.user_profiles.first_name} ${msg.user_profiles.last_name}`
                                    : 'Unknown User';

                                  const isCompleted = msg.completed_at && msg.completed_by;

                                  return (
                                    <div
                                      key={msg.id}
                                      className={`bg-slate-900/50 rounded-xl p-4 border border-slate-700 hover:border-cyan-500 transition-all duration-300 ${
                                        isCompleted ? 'opacity-50' : ''
                                      }`}
                                    >
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          <div className="bg-cyan-500/20 p-2 rounded-lg">
                                            <MessageCircle className="w-4 h-4 text-cyan-500" />
                                          </div>
                                          <div>
                                            <h4 className="font-semibold">{senderName}</h4>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-xs text-slate-400">
                                            {new Date(msg.created_at).toLocaleDateString()}
                                          </p>
                                          <p className="text-xs text-slate-500">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="bg-slate-800/50 rounded-lg p-3">
                                        <p className="text-slate-200 text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                                      </div>
                                      {msg.notification_type === 'trip_inspection' && msg.reference_id && (
                                        <div className="mt-3">
                                          <button
                                            onClick={() => viewInspectionPDF(msg.reference_id)}
                                            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                                          >
                                            <ClipboardCheck className="w-4 h-4" />
                                            View Inspection Report
                                          </button>
                                        </div>
                                      )}
                                      {msg.notification_type === 'owner_handoff' && msg.reference_id && (
                                        <div className="mt-3">
                                          <button
                                            onClick={() => viewOwnerHandoffPDF(msg.reference_id)}
                                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                                          >
                                            <UserCheck className="w-4 h-4" />
                                            View Owner Handoff Report
                                          </button>
                                        </div>
                                      )}
                                      {!isCompleted ? (
                                        <div className="mt-3">
                                          <button
                                            onClick={() => markYachtMessageComplete(msg.id)}
                                            className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                                          >
                                            <ClipboardCheck className="w-4 h-4" />
                                            Task Complete
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="mt-3 text-center text-xs text-slate-400">
                                          Completed on {new Date(msg.completed_at).toLocaleDateString()} at {new Date(msg.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          {msg.completed_by_profile && (
                                            <span> by {msg.completed_by_profile.first_name} {msg.completed_by_profile.last_name}</span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        );
                      })()
                    ) : (
                      (() => {
                        const messagesByYacht = adminNotifications.reduce((acc: any, msg: any) => {
                          const yachtId = msg.yacht_id || 'unknown';
                          if (!acc[yachtId]) {
                            acc[yachtId] = {
                              yacht: msg.yachts,
                              messages: []
                            };
                          }
                          acc[yachtId].messages.push(msg);
                          return acc;
                        }, {});

                        return (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(messagesByYacht).map(([yachtId, data]: [string, any]) => {
                              const incompleteTasks = data.messages.filter((msg: any) => !msg.completed_at || !msg.completed_by).length;

                              return (
                                <button
                                  key={yachtId}
                                  onClick={() => setSelectedMessagesYachtId(yachtId)}
                                  className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-cyan-500 transition-all duration-300 hover:scale-105 text-left group"
                                >
                                  <div className="flex items-center gap-4 mb-4">
                                    <div className="bg-cyan-500/20 p-4 rounded-xl group-hover:bg-cyan-500/30 transition-colors">
                                      <Ship className="w-8 h-8 text-cyan-500" />
                                    </div>
                                  </div>
                                  <h3 className="text-xl font-bold mb-2">{data.yacht?.name || 'Customer Pay Boats'}</h3>
                                  <p className="text-slate-400 text-sm">
                                    {incompleteTasks} {incompleteTasks === 1 ? 'task' : 'tasks'} pending
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    )}
                  </div>
                  ) : (
                  <div className="space-y-6">
                    {(() => {
                      const unreadMessages = staffMessages.filter((msg: any) => !msg.completed_at || !msg.completed_by);
                      const completedMessages = staffMessages.filter((msg: any) => msg.completed_at && msg.completed_by);

                      const renderMessage = (msg: any, isCompleted: boolean) => {
                        const senderName = msg.user_profiles?.first_name && msg.user_profiles?.last_name
                          ? `${msg.user_profiles.first_name} ${msg.user_profiles.last_name}`
                          : msg.user_profiles?.email || 'Unknown User';

                        const isBulkEmail = msg.notification_type === 'bulk_email';

                        return (
                          <div
                            key={msg.id}
                            className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-cyan-500 transition-all duration-300 ${
                              isCompleted ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`${isCompleted ? 'bg-slate-500/20' : isBulkEmail ? 'bg-blue-500/20' : 'bg-cyan-500/20'} p-3 rounded-xl`}>
                                  {isBulkEmail ? (
                                    <Mail className={`w-5 h-5 ${isCompleted ? 'text-slate-500' : 'text-blue-500'}`} />
                                  ) : (
                                    <MessageCircle className={`w-5 h-5 ${isCompleted ? 'text-slate-500' : 'text-cyan-500'}`} />
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-lg">{senderName}</h4>
                                  <p className="text-xs text-slate-400">{isBulkEmail ? 'Bulk Email' : msg.notification_type}</p>
                                  {msg.yacht_name && (
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                      <Ship className="w-3 h-3" />
                                      {msg.yacht_name}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-slate-300">
                                  {new Date(msg.created_at).toLocaleDateString()}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>

                            {isBulkEmail && msg.email_subject ? (
                              <div className="space-y-3">
                                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                                  <p className="text-xs text-slate-400 mb-1">Subject:</p>
                                  <p className="text-slate-200 font-semibold">{msg.email_subject}</p>
                                </div>

                                <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                                  <p className="text-xs text-slate-400 mb-2">Message:</p>
                                  <p className="text-slate-200 whitespace-pre-wrap break-words">{msg.email_body}</p>
                                </div>

                                {msg.email_recipients && msg.email_recipients.length > 0 && (
                                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                                    <p className="text-xs text-slate-400 mb-2">Recipients ({msg.email_recipients.length}):</p>
                                    <div className="flex flex-wrap gap-2">
                                      {msg.email_recipients.slice(0, 5).map((recipient: any, idx: number) => (
                                        <span key={idx} className="text-xs bg-slate-700/50 px-2 py-1 rounded">
                                          {recipient.name}
                                        </span>
                                      ))}
                                      {msg.email_recipients.length > 5 && (
                                        <span className="text-xs text-slate-400">+{msg.email_recipients.length - 5} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {msg.email_sent_at && (
                                  <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 space-y-2">
                                    <p className="text-xs text-slate-400 mb-2">Email Status:</p>
                                    <div className="flex flex-wrap gap-2">
                                      <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">
                                        Sent
                                      </span>
                                      {msg.email_delivered_at && (
                                        <span className="text-xs bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full flex items-center gap-1">
                                          <CheckCircle className="w-3 h-3" />
                                          Delivered
                                        </span>
                                      )}
                                      {msg.email_opened_at && (
                                        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full flex items-center gap-1">
                                          <Eye className="w-3 h-3" />
                                          Opened {msg.email_open_count > 1 ? `(${msg.email_open_count}x)` : ''}
                                        </span>
                                      )}
                                      {msg.email_clicked_at && (
                                        <span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full flex items-center gap-1">
                                          <MousePointer className="w-3 h-3" />
                                          Clicked {msg.email_click_count > 1 ? `(${msg.email_click_count}x)` : ''}
                                        </span>
                                      )}
                                      {msg.email_bounced_at && (
                                        <span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3" />
                                          Bounced
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1 mt-3">
                                      {msg.email_opened_at && (
                                        <div className="flex items-center gap-2">
                                          <Eye className="w-3 h-3" />
                                          <span>First opened: {new Date(msg.email_opened_at).toLocaleDateString()} at {new Date(msg.email_opened_at).toLocaleTimeString()}</span>
                                        </div>
                                      )}
                                      {msg.email_clicked_at && (
                                        <div className="flex items-center gap-2">
                                          <MousePointer className="w-3 h-3" />
                                          <span>First clicked: {new Date(msg.email_clicked_at).toLocaleDateString()} at {new Date(msg.email_clicked_at).toLocaleTimeString()}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                                <p className="text-slate-200 whitespace-pre-wrap break-words">{msg.message}</p>
                              </div>
                            )}

                            {!isCompleted ? (
                              <div className="mt-4">
                                <button
                                  onClick={() => markStaffMessageComplete(msg.id)}
                                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm"
                                >
                                  <ClipboardCheck className="w-4 h-4" />
                                  Task Complete
                                </button>
                              </div>
                            ) : (
                              <div className="mt-4 text-center text-xs text-slate-400">
                                Completed on {new Date(msg.completed_at).toLocaleDateString()} at {new Date(msg.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {msg.completed_by_profile && (
                                  <span> by {msg.completed_by_profile.first_name} {msg.completed_by_profile.last_name}</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return (
                        <>
                          <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                            <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-slate-700 p-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="bg-cyan-500/20 p-3 rounded-xl">
                                    <MessageCircle className="w-6 h-6 text-cyan-500" />
                                  </div>
                                  <h3 className="text-xl font-bold">Unread Messages</h3>
                                </div>
                                {unreadMessages.length > 0 && (
                                  <span className="bg-cyan-500 text-white text-sm font-bold px-3 py-1 rounded-full">
                                    {unreadMessages.length}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-6">
                              {unreadMessages.length === 0 ? (
                                <div className="text-center py-8">
                                  <div className="bg-slate-700/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ClipboardCheck className="w-8 h-8 text-slate-600" />
                                  </div>
                                  <p className="text-slate-400 text-lg">All caught up!</p>
                                  <p className="text-slate-500 text-sm mt-1">No unread messages</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {unreadMessages.map((msg: any) => renderMessage(msg, false))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                            <div className="bg-gradient-to-r from-slate-600/10 to-slate-500/10 border-b border-slate-700 p-6">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="bg-slate-500/20 p-3 rounded-xl">
                                    <ClipboardCheck className="w-6 h-6 text-slate-500" />
                                  </div>
                                  <h3 className="text-xl font-bold text-slate-300">Completed Messages</h3>
                                </div>
                                {completedMessages.length > 0 && (
                                  <span className="bg-slate-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                                    {completedMessages.length}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-6">
                              {completedMessages.length === 0 ? (
                                <div className="text-center py-8">
                                  <div className="bg-slate-700/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <MessageCircle className="w-8 h-8 text-slate-600" />
                                  </div>
                                  <p className="text-slate-400 text-lg">No completed messages yet</p>
                                  <p className="text-slate-500 text-sm mt-1">Completed tasks will appear here</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  {completedMessages.map((msg: any) => renderMessage(msg, true))}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  )}
                </>
              ) : adminView === 'mastercalendar' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-teal-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="p-6 border-b border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Calendar className="w-8 h-8 text-teal-500" />
                          <h2 className="text-2xl font-bold">Master Calendar</h2>
                        </div>
                        <div className="flex gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
                          <button
                            onClick={() => setCalendarView('day')}
                            className={`px-4 py-2 rounded-md font-medium transition-all ${
                              calendarView === 'day'
                                ? 'bg-teal-500 text-white'
                                : 'text-slate-400 hover:text-teal-400'
                            }`}
                          >
                            Day
                          </button>
                          <button
                            onClick={() => setCalendarView('week')}
                            className={`px-4 py-2 rounded-md font-medium transition-all ${
                              calendarView === 'week'
                                ? 'bg-teal-500 text-white'
                                : 'text-slate-400 hover:text-teal-400'
                            }`}
                          >
                            Week
                          </button>
                          <button
                            onClick={() => setCalendarView('month')}
                            className={`px-4 py-2 rounded-md font-medium transition-all ${
                              calendarView === 'month'
                                ? 'bg-teal-500 text-white'
                                : 'text-slate-400 hover:text-teal-400'
                            }`}
                          >
                            Month
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => navigateCalendar('prev')}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => navigateCalendar('next')}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                          <button
                            onClick={goToToday}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-medium"
                          >
                            Today
                          </button>
                          {masterCalendarBookings.length > 0 && (() => {
                            const nextBooking = [...masterCalendarBookings].sort((a, b) =>
                              new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
                            ).find(b => new Date(b.start_date) >= new Date());

                            if (nextBooking) {
                              return (
                                <button
                                  onClick={() => setCurrentDate(new Date(nextBooking.start_date))}
                                  className="px-4 py-2 bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 rounded-lg transition-colors font-medium text-teal-300"
                                >
                                  Next Trip
                                </button>
                              );
                            }
                          })()}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-slate-400">
                            {masterCalendarBookings.length} total {masterCalendarBookings.length === 1 ? 'booking' : 'bookings'}
                          </span>
                          <h3 className="text-xl font-semibold">{formatCalendarTitle()}</h3>
                        </div>
                      </div>

                      <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
                        <div className="flex items-center gap-6 flex-wrap">
                          <span className="text-sm font-semibold text-slate-300">Legend:</span>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50"></div>
                            <span className="text-sm text-slate-300">Departure</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50"></div>
                            <span className="text-sm text-slate-300">Arrival</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-yellow-500/30 border border-yellow-500/50"></div>
                            <span className="text-sm text-slate-300">Arrival (Oil Change Needed)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded bg-pink-500/30 border border-pink-500/50"></div>
                            <span className="text-sm text-slate-300">Appointment</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {calendarView === 'month' && (() => {
                      const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
                      const days = [];

                      for (let i = 0; i < startingDayOfWeek; i++) {
                        days.push(null);
                      }

                      for (let day = 1; day <= daysInMonth; day++) {
                        days.push(day);
                      }

                      // Check if there are any bookings in this month
                      const monthHasBookings = days.some(day => {
                        if (!day) return false;
                        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                        return getBookingsForDate(date).length > 0;
                      });

                      return (
                        <div className="p-4">
                          {!monthHasBookings && masterCalendarBookings.length > 0 && (
                            <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                              <div className="flex items-center gap-3 text-amber-400">
                                <Calendar className="w-5 h-5" />
                                <div>
                                  <p className="font-medium">No bookings in {formatCalendarTitle()}</p>
                                  <p className="text-sm text-amber-300/80">Use the "Next Trip" button or navigate to view scheduled trips</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {masterCalendarBookings.length === 0 && (
                            <div className="mb-4 p-6 bg-slate-800/50 border border-slate-600 rounded-lg text-center">
                              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                              <p className="text-lg font-medium text-slate-300 mb-2">No Trips Scheduled</p>
                              <p className="text-sm text-slate-400">There are currently no yacht bookings or appointments in the system.</p>
                            </div>
                          )}
                          <div className="grid grid-cols-7 gap-px bg-slate-700 border border-slate-700 rounded-lg overflow-hidden">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                              <div key={day} className="bg-slate-800 p-3 text-center font-semibold text-slate-400 text-sm">
                                {day}
                              </div>
                            ))}
                            {days.map((day, index) => {
                              const date = day ? new Date(currentDate.getFullYear(), currentDate.getMonth(), day) : null;
                              const bookings = date ? getBookingsForDate(date) : [];
                              const isToday = date && date.toDateString() === new Date().toDateString();

                              return (
                                <div
                                  key={day ? `day-${day}` : `empty-${index}`}
                                  onClick={() => {
                                    if (day && date) {
                                      setCurrentDate(date);
                                      setCalendarView('day');
                                    }
                                  }}
                                  className={`bg-slate-900 min-h-[120px] p-2 ${day ? 'hover:bg-slate-800 cursor-pointer' : ''} transition-colors relative group`}
                                >
                                  {day && (
                                    <>
                                      <div className="flex items-center justify-between mb-2">
                                        <div className={`text-sm font-semibold ${isToday ? 'bg-teal-500 text-white w-7 h-7 rounded-full flex items-center justify-center' : 'text-slate-300'}`}>
                                          {day}
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCalendarDateClick(date!);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-pink-500/20 rounded text-pink-400"
                                          title="Create Appointment"
                                        >
                                          <CalendarPlus className="w-4 h-4" />
                                        </button>
                                      </div>
                                      <div className="space-y-1">
                                        {bookings.slice(0, 2).map((booking: any) => {
                                          const startDateStr = booking.start_date.includes('T') ? booking.start_date : booking.start_date + 'T00:00:00';
                                          const endDateStr = booking.end_date.includes('T') ? booking.end_date : booking.end_date + 'T00:00:00';
                                          const startDate = new Date(startDateStr);
                                          const endDate = new Date(endDateStr);
                                          startDate.setHours(0, 0, 0, 0);
                                          endDate.setHours(0, 0, 0, 0);
                                          const checkDate = new Date(date!);
                                          checkDate.setHours(0, 0, 0, 0);

                                          const isDeparture = checkDate.getTime() === startDate.getTime();
                                          const isArrival = checkDate.getTime() === endDate.getTime();

                                          return (
                                            <div
                                              key={booking.id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                booking.is_appointment ? handleEditAppointment(booking) : handleEditBooking(booking, date!);
                                              }}
                                              className={`text-xs rounded px-2 py-1 cursor-pointer transition-colors truncate ${
                                                booking.is_appointment
                                                  ? 'bg-pink-500/20 border border-pink-500/30 hover:bg-pink-500/30'
                                                  : isDeparture
                                                  ? 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/30'
                                                  : !isDeparture && booking.oil_change_needed
                                                  ? 'bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30'
                                                  : 'bg-red-500/20 border border-red-500/30 hover:bg-red-500/30'
                                              }`}
                                            >
                                              <div className={`font-medium truncate ${booking.is_appointment ? 'text-pink-300' : isDeparture ? 'text-green-300' : !isDeparture && booking.oil_change_needed ? 'text-yellow-300' : 'text-red-300'}`}>
                                                {booking.yachts?.name || 'Yacht'}
                                              </div>
                                              <div className="text-slate-400 truncate">
                                                {getBookingDisplayName(booking)}
                                              </div>
                                              <div className={`text-xs ${booking.is_appointment ? 'text-pink-400' : isDeparture ? 'text-green-400' : !isDeparture && booking.oil_change_needed ? 'text-yellow-400' : 'text-red-400'}`}>
                                                {booking.is_appointment
                                                  ? `Appt ${formatTimeOnly(booking.departure_time)}`
                                                  : isDeparture
                                                    ? `Departure${booking.departure_time ? ' ' + formatTimeOnly(booking.departure_time) : ''}`
                                                    : `Arrival${booking.arrival_time ? ' ' + formatTimeOnly(booking.arrival_time) : ''}`
                                                }
                                              </div>
                                            </div>
                                          );
                                        })}
                                        {bookings.length > 2 && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedDayAppointments({ date: date!, bookings });
                                            }}
                                            className="w-full text-xs bg-teal-500/20 border border-teal-500/30 hover:bg-teal-500/30 rounded px-2 py-1 text-teal-300 font-medium transition-colors"
                                          >
                                            +{bookings.length - 2} more
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {calendarView === 'week' && (() => {
                      const weekDays = getWeekDays(currentDate);

                      return (
                        <div className="p-4">
                          <div className="grid grid-cols-7 gap-px bg-slate-700 border border-slate-700 rounded-lg overflow-hidden">
                            {weekDays.map((date, index) => {
                              const bookings = getBookingsForDate(date);
                              const isToday = date.toDateString() === new Date().toDateString();
                              const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                              const dayNum = date.getDate();

                              return (
                                <div key={date.toISOString()} className="bg-slate-900">
                                  <div
                                    onClick={() => handleCalendarDateClick(date)}
                                    className={`p-3 border-b border-slate-700 text-center cursor-pointer hover:bg-slate-800/50 transition-colors ${isToday ? 'bg-teal-500/20' : ''}`}
                                  >
                                    <div className="text-sm font-semibold text-slate-400">{dayName}</div>
                                    <div className={`text-xl font-bold ${isToday ? 'text-teal-400' : 'text-slate-200'}`}>{dayNum}</div>
                                  </div>
                                  <div className="p-2 min-h-[400px] space-y-2">
                                    {bookings.map((booking: any) => {
                                      const startDateStr = booking.start_date.includes('T') ? booking.start_date : booking.start_date + 'T00:00:00';
                                      const endDateStr = booking.end_date.includes('T') ? booking.end_date : booking.end_date + 'T00:00:00';
                                      const startDate = new Date(startDateStr);
                                      const endDate = new Date(endDateStr);
                                      startDate.setHours(0, 0, 0, 0);
                                      endDate.setHours(0, 0, 0, 0);
                                      const checkDate = new Date(date);
                                      checkDate.setHours(0, 0, 0, 0);

                                      const isDeparture = checkDate.getTime() === startDate.getTime();
                                      const isArrival = checkDate.getTime() === endDate.getTime();

                                      return (
                                        <div
                                          key={booking.id}
                                          onClick={() => booking.is_appointment ? handleEditAppointment(booking) : handleEditBooking(booking, date)}
                                          className={`rounded-lg p-3 cursor-pointer transition-colors ${
                                            booking.is_appointment
                                              ? 'bg-pink-500/20 border border-pink-500/30 hover:bg-pink-500/30'
                                              : isDeparture
                                              ? 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/30'
                                              : !isDeparture && booking.oil_change_needed
                                              ? 'bg-yellow-500/20 border border-yellow-500/30 hover:bg-yellow-500/30'
                                              : 'bg-red-500/20 border border-red-500/30 hover:bg-red-500/30'
                                          }`}
                                        >
                                          <div className={`font-semibold text-sm mb-1 ${
                                            booking.is_appointment
                                              ? 'text-pink-300'
                                              : isDeparture ? 'text-green-300' : !isDeparture && booking.oil_change_needed ? 'text-yellow-300' : 'text-red-300'
                                          }`}>
                                            {booking.yachts?.name || 'Yacht'}
                                          </div>
                                          <div className="text-xs text-slate-400 mb-2">
                                            {getBookingDisplayName(booking)}
                                          </div>
                                          <div className={`text-xs font-medium ${
                                            booking.is_appointment
                                              ? 'text-pink-400'
                                              : isDeparture ? 'text-green-400' : !isDeparture && booking.oil_change_needed ? 'text-yellow-400' : 'text-red-400'
                                          }`}>
                                            {booking.is_appointment
                                              ? `Appointment ${convertTo12Hour(booking.departure_time)}`
                                              : isDeparture
                                              ? `Departure ${convertTo12Hour(booking.departure_time)}`
                                              : `Arrival ${convertTo12Hour(booking.arrival_time)}`}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {calendarView === 'day' && (() => {
                      const bookings = getBookingsForDate(currentDate);

                      return (
                        <div className="p-4">
                          <div className="bg-slate-900 border border-slate-700 rounded-lg min-h-[500px]">
                            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                              <div className="text-lg font-semibold text-slate-200">
                                {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
                              </div>
                              <button
                                onClick={() => handleCalendarDateClick(currentDate)}
                                className="px-4 py-2 bg-pink-500/20 border border-pink-500/30 hover:bg-pink-500/30 rounded-lg transition-colors text-pink-300 font-medium flex items-center gap-2"
                              >
                                <CalendarPlus className="w-4 h-4" />
                                Create Appointment
                              </button>
                            </div>
                            <div className="p-4 space-y-3">
                              {bookings.length === 0 ? (
                                <div className="text-center py-12 text-slate-400">
                                  <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                                  <p>No trips scheduled for this day</p>
                                </div>
                              ) : (
                                bookings.map((booking: any) => {
                                  const startDateStr = booking.start_date.includes('T') ? booking.start_date : booking.start_date + 'T00:00:00';
                                  const endDateStr = booking.end_date.includes('T') ? booking.end_date : booking.end_date + 'T00:00:00';
                                  const startDate = new Date(startDateStr);
                                  const endDate = new Date(endDateStr);
                                  startDate.setHours(0, 0, 0, 0);
                                  endDate.setHours(0, 0, 0, 0);
                                  const checkDate = new Date(currentDate);
                                  checkDate.setHours(0, 0, 0, 0);

                                  const isDeparture = checkDate.getTime() === startDate.getTime();
                                  const isArrival = checkDate.getTime() === endDate.getTime();

                                  return (
                                    <div
                                      key={booking.id}
                                      onClick={() => booking.is_appointment ? handleEditAppointment(booking) : handleEditBooking(booking, currentDate)}
                                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                                        booking.is_appointment
                                          ? 'bg-pink-500/10 border-pink-500/50 hover:border-pink-500'
                                          : isDeparture
                                          ? 'bg-green-500/10 border-green-500/50 hover:border-green-500'
                                          : !isDeparture && booking.oil_change_needed
                                          ? 'bg-yellow-500/10 border-yellow-500/50 hover:border-yellow-500'
                                          : 'bg-red-500/10 border-red-500/50 hover:border-red-500'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-3">
                                            <div className={`p-2 rounded-lg ${
                                              booking.is_appointment
                                                ? 'bg-pink-500/20'
                                                : isDeparture ? 'bg-green-500/20' : !isDeparture && booking.oil_change_needed ? 'bg-yellow-500/20' : 'bg-red-500/20'
                                            }`}>
                                              {booking.is_appointment ? (
                                                <CalendarPlus className="w-5 h-5 text-pink-500" />
                                              ) : (
                                                <Ship className={`w-5 h-5 ${isDeparture ? 'text-green-500' : !isDeparture && booking.oil_change_needed ? 'text-yellow-500' : 'text-red-500'}`} />
                                              )}
                                            </div>
                                            <div>
                                              <h4 className="font-bold text-lg">{booking.yachts?.name || 'Yacht'}</h4>
                                              <p className="text-sm text-slate-400">
                                                {getBookingDisplayName(booking)}
                                              </p>
                                              <div className={`text-xs font-medium mt-1 ${
                                                booking.is_appointment
                                                  ? 'text-pink-400'
                                                  : isDeparture ? 'text-green-400' : !isDeparture && booking.oil_change_needed ? 'text-yellow-400' : 'text-red-400'
                                              }`}>
                                                {booking.is_appointment ? 'Appointment' : isDeparture ? 'Departure' : 'Arrival'}
                                              </div>
                                            </div>
                                          </div>
                                          {booking.is_appointment ? (
                                            <div className="bg-slate-900/50 rounded p-2 mb-3">
                                              <p className="text-xs text-slate-400 mb-1">Scheduled Time</p>
                                              <p className="text-sm font-medium">{formatDate(booking.start_date)}</p>
                                              <p className="text-xs text-slate-300">{convertTo12Hour(booking.departure_time)}</p>
                                              {booking.problem_description && (
                                                <p className="text-xs text-slate-400 mt-2">{booking.problem_description}</p>
                                              )}
                                            </div>
                                          ) : (
                                            <>
                                              <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div className="bg-slate-900/50 rounded p-2">
                                                  <p className="text-xs text-slate-400 mb-1">Departure</p>
                                                  <p className="text-sm font-medium">{formatDate(booking.start_date)}</p>
                                                  <p className="text-xs text-slate-300">{booking.departure_time ? convertTo12Hour(booking.departure_time) : formatTime(booking.start_date)}</p>
                                                </div>
                                                <div className="bg-slate-900/50 rounded p-2">
                                                  <p className="text-xs text-slate-400 mb-1">Return</p>
                                                  <p className="text-sm font-medium">{formatDate(booking.end_date)}</p>
                                                  <p className="text-xs text-slate-300">{booking.arrival_time ? convertTo12Hour(booking.arrival_time) : formatTime(booking.end_date)}</p>
                                                </div>
                                              </div>
                                              <div className="flex gap-2">
                                                {booking.checked_in && (
                                                  <div className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs text-green-400">
                                                    <CheckCircle className="w-3 h-3" />
                                                    <span>Checked In</span>
                                                  </div>
                                                )}
                                                {booking.checked_out && (
                                                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400">
                                                    <CheckCircle className="w-3 h-3" />
                                                    <span>Checked Out</span>
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {editingBooking && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                          <h3 className="text-xl font-bold mb-4">Edit Trip</h3>
                          <form onSubmit={handleUpdateBooking} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Owner Name</label>
                              <input
                                type="text"
                                value={editBookingForm.owner_name}
                                onChange={(e) => setEditBookingForm({ ...editBookingForm, owner_name: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Contact Info</label>
                              <input
                                type="text"
                                value={editBookingForm.owner_contact}
                                onChange={(e) => setEditBookingForm({ ...editBookingForm, owner_contact: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Departure Date</label>
                                <input
                                  type="date"
                                  value={editBookingForm.start_date}
                                  onChange={(e) => setEditBookingForm({ ...editBookingForm, start_date: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Departure Time</label>
                                <input
                                  type="time"
                                  value={editBookingForm.departure_time}
                                  onChange={(e) => setEditBookingForm({ ...editBookingForm, departure_time: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Return Date</label>
                                <input
                                  type="date"
                                  value={editBookingForm.end_date}
                                  onChange={(e) => setEditBookingForm({ ...editBookingForm, end_date: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Return Time</label>
                                <input
                                  type="time"
                                  value={editBookingForm.arrival_time}
                                  onChange={(e) => setEditBookingForm({ ...editBookingForm, arrival_time: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                            </div>
                            {editBookingError && (
                              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                                {editBookingError}
                              </div>
                            )}
                            {(() => {
                              // Only show oil change button for arrivals, not departures or appointments
                              if (editingBooking.is_appointment) {
                                return null;
                              }

                              const startDate = new Date(editingBooking.start_date);
                              startDate.setHours(0, 0, 0, 0);
                              const endDate = new Date(editingBooking.end_date);
                              endDate.setHours(0, 0, 0, 0);

                              let isDeparture = false;
                              if (editingBookingClickedDate) {
                                const checkDate = new Date(editingBookingClickedDate);
                                checkDate.setHours(0, 0, 0, 0);
                                isDeparture = checkDate.getTime() === startDate.getTime();
                              }

                              return !isDeparture && (
                                <div className="mb-4">
                                  <button
                                    type="button"
                                    onClick={handleToggleOilChange}
                                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all ${
                                      editingBooking.oil_change_needed
                                        ? 'bg-yellow-500/20 border-2 border-yellow-500 text-yellow-300 hover:bg-yellow-500/30'
                                        : 'bg-red-500/20 border-2 border-red-500 text-red-300 hover:bg-red-500/30'
                                    }`}
                                  >
                                    {editingBooking.oil_change_needed ? '⚠️ Oil Change Needed' : '✓ Oil Change Not Needed'}
                                  </button>
                                </div>
                              );
                            })()}
                            <div className="flex gap-3">
                              <button
                                type="submit"
                                disabled={editBookingLoading}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {editBookingLoading ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBooking(null)}
                                className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              {canManageYacht(effectiveRole) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleDeleteBooking(editingBooking.id);
                                    setEditingBooking(null);
                                  }}
                                  className="px-6 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    {editingAppointment && (
                      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                          <h3 className="text-xl font-bold mb-4">Edit Appointment</h3>
                          <form onSubmit={handleUpdateAppointment} className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium mb-2">Customer Name</label>
                              <input
                                type="text"
                                value={editAppointmentForm.name}
                                onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, name: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Phone</label>
                                <input
                                  type="tel"
                                  value={editAppointmentForm.phone}
                                  onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, phone: formatPhoneNumber(e.target.value) })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Email</label>
                                <input
                                  type="email"
                                  value={editAppointmentForm.email}
                                  onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, email: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Yacht</label>
                              <input
                                type="text"
                                value={editAppointmentForm.yacht_name}
                                onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, yacht_name: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium mb-2">Date</label>
                                <input
                                  type="date"
                                  value={editAppointmentForm.date}
                                  onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, date: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium mb-2">Time</label>
                                <input
                                  type="time"
                                  value={editAppointmentForm.time}
                                  onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, time: e.target.value })}
                                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white"
                                  required
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-2">Problem Description</label>
                              <textarea
                                value={editAppointmentForm.problem_description}
                                onChange={(e) => setEditAppointmentForm({ ...editAppointmentForm, problem_description: e.target.value })}
                                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 text-white min-h-[100px]"
                                required
                              />
                            </div>
                            {editAppointmentError && (
                              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                                {editAppointmentError}
                              </div>
                            )}
                            <div className="flex gap-3">
                              <button
                                type="submit"
                                disabled={editAppointmentLoading}
                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {editAppointmentLoading ? 'Saving...' : 'Save Changes'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingAppointment(null)}
                                className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                              {canManageYacht(effectiveRole) && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await handleDeleteAppointment(editingAppointment.id);
                                  }}
                                  className="px-6 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-lg transition-colors flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : adminView === 'appointments' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <CalendarPlus className="w-8 h-8 text-orange-500" />
                      <div>
                        <h2 className="text-2xl font-bold">Create Appointment</h2>
                        <p className="text-slate-400">Schedule a repair appointment</p>
                      </div>
                    </div>

                    {appointmentSuccess && (
                      <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
                        Appointment created successfully!
                      </div>
                    )}

                    {appointmentError && (
                      <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
                        {appointmentError}
                      </div>
                    )}

                    <form onSubmit={handleAppointmentSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Customer Name
                          </label>
                          <input
                            type="text"
                            value={appointmentForm.name}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, name: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={appointmentForm.phone}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, phone: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={appointmentForm.email}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, email: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Yacht
                          </label>
                          <input
                            type="text"
                            value={appointmentForm.yacht_id}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, yacht_id: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            placeholder="Enter yacht name"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Date
                          </label>
                          <input
                            type="date"
                            value={appointmentForm.date}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Time
                          </label>
                          <input
                            type="time"
                            value={appointmentForm.time}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                          Problem Description
                        </label>
                        <textarea
                          value={appointmentForm.problem_description}
                          onChange={(e) => setAppointmentForm({ ...appointmentForm, problem_description: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                          required
                        />
                      </div>

                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={appointmentForm.createRepairRequest}
                            onChange={(e) => setAppointmentForm({ ...appointmentForm, createRepairRequest: e.target.checked })}
                            className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 focus:ring-offset-slate-800"
                          />
                          <div className="flex-1">
                            <span className="text-slate-300 font-medium">Also create repair request</span>
                            <p className="text-sm text-slate-400 mt-1">
                              Automatically create a retail repair request with the appointment details for tracking and billing
                            </p>
                          </div>
                        </label>
                      </div>

                      <div className="flex gap-4">
                        <button
                          type="submit"
                          disabled={appointmentLoading}
                          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {appointmentLoading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <CalendarPlus className="w-4 h-4" />
                              Create Appointment
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminView('menu')}
                          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              ) : adminView === 'smartdevices' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-green-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <SmartDeviceManagement />
                </>
              ) : adminView === 'users' ? (
                <>
                  <button
                    onClick={() => setAdminView('menu')}
                    className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors mb-4"
                  >
                    <span>← Back to Admin Menu</span>
                  </button>

                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700">
                    <div className="p-6 border-b border-slate-700">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Users className="w-8 h-8 text-blue-500" />
                          <div>
                            <h2 className="text-2xl font-bold">User Management</h2>
                            <p className="text-slate-400">View and edit user profiles</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isStaffRole(effectiveRole) && (
                            <select
                              value={printYachtFilter}
                              onChange={(e) => setPrintYachtFilter(e.target.value)}
                              className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="all">All Yachts</option>
                              {allYachts.map((yacht) => (
                                <option key={yacht.id} value={yacht.id}>
                                  {yacht.name}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => {
                              // Master role sees ALL users including inactive
                              let filteredUsers = effectiveRole === 'master'
                                ? allUsers
                                : allUsers.filter((user) => user.is_active !== false);

                              if (isStaffRole(effectiveRole) && userProfile?.role !== 'master') {
                                if (printYachtFilter !== 'all') {
                                  filteredUsers = filteredUsers.filter((user) => user.yacht_id === printYachtFilter);
                                }
                              } else if ((effectiveRole === 'owner' || effectiveRole === 'manager') && effectiveYacht?.id) {
                                filteredUsers = filteredUsers.filter((user) => user.yacht_id === effectiveYacht.id);
                              }

                              if (filteredUsers.length === 0) {
                                alert('No users to print.');
                                return;
                              }

                              const usersWithYachts = filteredUsers.map(user => ({
                                ...user,
                                yachts: allYachts.find(y => y.id === user.yacht_id)
                              }));

                              let title = 'User List';
                              if (isStaffRole(effectiveRole) && userProfile?.role !== 'master') {
                                if (printYachtFilter !== 'all') {
                                  const yachtName = allYachts.find(y => y.id === printYachtFilter)?.name;
                                  title = yachtName ? `${yachtName} - User List` : 'User List';
                                } else {
                                  title = 'All Yachts - User List';
                                }
                              } else if (effectiveRole === 'master') {
                                title = 'All Yachts - User List';
                              } else if ((effectiveRole === 'owner' || effectiveRole === 'manager') && effectiveYacht?.id) {
                                const yachtName = allYachts.find(y => y.id === effectiveYacht.id)?.name;
                                title = yachtName ? `${yachtName} - User List` : 'User List';
                              }

                              setUsersToPrint(usersWithYachts);
                              setPrintTitle(title);
                              setShowUserPrintView(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                            Print Users
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(null);
                              setUserEditForm({
                                first_name: '',
                                last_name: '',
                                email: '',
                                password: '',
                                trip_number: '',
                                role: 'owner',
                                employee_type: 'hourly',
                                yacht_id: (effectiveRole === 'manager' && effectiveYacht?.id) ? effectiveYacht.id : '',
                                phone: '',
                                street: '',
                                city: '',
                                state: '',
                                zip_code: '',
                                email_notifications_enabled: true,
                                sms_notifications_enabled: false,
                                notification_email: '',
                                notification_phone: '',
                                secondary_email: '',
                                can_approve_repairs: false,
                                can_approve_billing: false
                              });
                              setIsCreatingNewUser(true);
                              setSelectedUserGroup(null);
                              setUserError('');
                              setUserSuccess('');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            <Users className="w-4 h-4" />
                            Add New User
                          </button>
                        </div>
                      </div>

                      <div className="mt-4">
                        <input
                          type="text"
                          placeholder="Search by name, email, or role..."
                          value={userSearchTerm}
                          onChange={(e) => setUserSearchTerm(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="p-6">
                      {(selectedUser || isCreatingNewUser) ? (
                        <div className="bg-slate-700/30 rounded-xl p-6">
                          <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold">{isCreatingNewUser ? 'Add New User' : 'Edit User Profile'}</h3>
                            <button
                              onClick={() => {
                                setSelectedUser(null);
                                setIsCreatingNewUser(false);
                                setSelectedUserGroup(null);
                                setUserError('');
                                setUserSuccess('');
                              }}
                              className="text-slate-400 hover:text-white transition-colors"
                            >
                              <X className="w-6 h-6" />
                            </button>
                          </div>

                          {userError && (
                            <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
                              {userError}
                            </div>
                          )}

                          {userSuccess && (
                            <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
                              {userSuccess}
                            </div>
                          )}

                          <form onSubmit={handleUserUpdate} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  First Name
                                </label>
                                <input
                                  type="text"
                                  value={userEditForm.first_name}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, first_name: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Last Name
                                </label>
                                <input
                                  type="text"
                                  value={userEditForm.last_name}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, last_name: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={userEditForm.email}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, email: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Secondary CC Email (optional)
                                </label>
                                <input
                                  type="email"
                                  value={userEditForm.secondary_email}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, secondary_email: e.target.value })}
                                  placeholder="CC recipient for email notifications"
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-slate-500 mt-1">This email will receive a copy (CC) of all notifications sent to the user</p>
                              </div>

                              {isCreatingNewUser && (
                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Password
                                  </label>
                                  <div className="relative">
                                    <input
                                      type={showPassword ? "text" : "password"}
                                      value={userEditForm.password}
                                      onChange={(e) => setUserEditForm({ ...userEditForm, password: e.target.value })}
                                      className="w-full px-4 py-3 pr-12 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      required
                                      minLength={6}
                                      placeholder="Minimum 6 characters"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowPassword(!showPassword)}
                                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                                    >
                                      {showPassword ? (
                                        <EyeOff className="w-5 h-5" />
                                      ) : (
                                        <Eye className="w-5 h-5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Phone
                                </label>
                                <input
                                  type="tel"
                                  value={userEditForm.phone}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, phone: formatPhoneNumber(e.target.value) })}
                                  placeholder="123-456-7890"
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Street Address
                                </label>
                                <input
                                  type="text"
                                  value={userEditForm.street}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, street: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  City
                                </label>
                                <input
                                  type="text"
                                  value={userEditForm.city}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, city: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  State
                                </label>
                                <select
                                  value={userEditForm.state}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, state: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                  <option value="">Select State</option>
                                  <option value="AL">Alabama</option>
                                  <option value="AK">Alaska</option>
                                  <option value="AZ">Arizona</option>
                                  <option value="AR">Arkansas</option>
                                  <option value="CA">California</option>
                                  <option value="CO">Colorado</option>
                                  <option value="CT">Connecticut</option>
                                  <option value="DE">Delaware</option>
                                  <option value="FL">Florida</option>
                                  <option value="GA">Georgia</option>
                                  <option value="HI">Hawaii</option>
                                  <option value="ID">Idaho</option>
                                  <option value="IL">Illinois</option>
                                  <option value="IN">Indiana</option>
                                  <option value="IA">Iowa</option>
                                  <option value="KS">Kansas</option>
                                  <option value="KY">Kentucky</option>
                                  <option value="LA">Louisiana</option>
                                  <option value="ME">Maine</option>
                                  <option value="MD">Maryland</option>
                                  <option value="MA">Massachusetts</option>
                                  <option value="MI">Michigan</option>
                                  <option value="MN">Minnesota</option>
                                  <option value="MS">Mississippi</option>
                                  <option value="MO">Missouri</option>
                                  <option value="MT">Montana</option>
                                  <option value="NE">Nebraska</option>
                                  <option value="NV">Nevada</option>
                                  <option value="NH">New Hampshire</option>
                                  <option value="NJ">New Jersey</option>
                                  <option value="NM">New Mexico</option>
                                  <option value="NY">New York</option>
                                  <option value="NC">North Carolina</option>
                                  <option value="ND">North Dakota</option>
                                  <option value="OH">Ohio</option>
                                  <option value="OK">Oklahoma</option>
                                  <option value="OR">Oregon</option>
                                  <option value="PA">Pennsylvania</option>
                                  <option value="RI">Rhode Island</option>
                                  <option value="SC">South Carolina</option>
                                  <option value="SD">South Dakota</option>
                                  <option value="TN">Tennessee</option>
                                  <option value="TX">Texas</option>
                                  <option value="UT">Utah</option>
                                  <option value="VT">Vermont</option>
                                  <option value="VA">Virginia</option>
                                  <option value="WA">Washington</option>
                                  <option value="WV">West Virginia</option>
                                  <option value="WI">Wisconsin</option>
                                  <option value="WY">Wyoming</option>
                                  <option value="DC">District of Columbia</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  ZIP Code
                                </label>
                                <input
                                  type="text"
                                  value={userEditForm.zip_code}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, zip_code: e.target.value })}
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Role
                                </label>
                                {isManagerRole(effectiveRole) && selectedUser && selectedUser.role !== 'owner' ? (
                                  <>
                                    <input
                                      type="text"
                                      value={userEditForm.role.charAt(0).toUpperCase() + userEditForm.role.slice(1)}
                                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400"
                                      disabled
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Only staff can edit this user type</p>
                                  </>
                                ) : (
                                  <>
                                    <select
                                      value={userEditForm.role}
                                      onChange={(e) => setUserEditForm({ ...userEditForm, role: e.target.value })}
                                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      required
                                    >
                                      <option value="owner">Owner</option>
                                      {canAccessAllYachts(effectiveRole) && (
                                        <>
                                          <option value="manager">Manager</option>
                                          <option value="staff">Staff</option>
                                          <option value="mechanic">Mechanic</option>
                                          {isMasterRole(effectiveRole) && (
                                            <option value="master">Master</option>
                                          )}
                                        </>
                                      )}
                                    </select>
                                    {isManagerRole(effectiveRole) && (
                                      <p className="text-xs text-slate-500 mt-1">You can only create yacht owners</p>
                                    )}
                                  </>
                                )}
                              </div>

                              {(userEditForm.role === 'staff' || userEditForm.role === 'mechanic' || userEditForm.role === 'master') && (
                                <div>
                                  <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Employee Type
                                  </label>
                                  <select
                                    value={userEditForm.employee_type}
                                    onChange={(e) => setUserEditForm({ ...userEditForm, employee_type: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                  >
                                    <option value="hourly">Hourly</option>
                                    <option value="salary">Salary</option>
                                  </select>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {userEditForm.employee_type === 'hourly'
                                      ? 'Hourly employees track lunch breaks separately'
                                      : 'Salary employees auto-deduct 1 hour for lunch'}
                                  </p>
                                </div>
                              )}

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Assigned Yacht
                                </label>
                                {effectiveRole === 'manager' ? (
                                  <>
                                    <input
                                      type="text"
                                      value={allYachts.find(y => y.id === (userEditForm.yacht_id || effectiveYacht?.id))?.name || 'No Yacht Assigned'}
                                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400"
                                      disabled
                                    />
                                    <p className="text-xs text-slate-500 mt-1">You can only manage users for your assigned yacht</p>
                                  </>
                                ) : (
                                  <select
                                    value={userEditForm.yacht_id}
                                    onChange={(e) => setUserEditForm({ ...userEditForm, yacht_id: e.target.value })}
                                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  >
                                    <option value="">No Yacht Assigned</option>
                                    {allYachts.map((yacht) => (
                                      <option key={yacht.id} value={yacht.id}>
                                        {yacht.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                  Trip Number
                                </label>
                                <input
                                  type="text"
                                  value={userEditForm.trip_number}
                                  onChange={(e) => setUserEditForm({ ...userEditForm, trip_number: e.target.value })}
                                  placeholder="e.g., T1, T2, Trip 1"
                                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-xs text-slate-500 mt-1">Optional field to track owner trip sequence</p>
                              </div>
                            </div>

                            {userEditForm.role === 'manager' && (
                              <div className="mt-6 p-6 bg-slate-900/50 rounded-xl border border-slate-600">
                                <h4 className="text-lg font-bold mb-4 text-amber-400">Manager Permissions</h4>
                                <p className="text-sm text-slate-400 mb-4">Specify what this manager can approve</p>

                                <div className="space-y-4">
                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={userEditForm.can_approve_repairs}
                                      onChange={(e) => setUserEditForm({ ...userEditForm, can_approve_repairs: e.target.checked })}
                                      className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-2 focus:ring-amber-500"
                                    />
                                    <div>
                                      <span className="text-slate-300 font-medium">Repair Approval</span>
                                      <p className="text-xs text-slate-500 mt-0.5">This manager can approve repair requests</p>
                                    </div>
                                  </label>

                                  <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={userEditForm.can_approve_billing}
                                      onChange={(e) => setUserEditForm({ ...userEditForm, can_approve_billing: e.target.checked })}
                                      className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-2 focus:ring-amber-500"
                                    />
                                    <div>
                                      <span className="text-slate-300 font-medium">Accounting/Billing Approval</span>
                                      <p className="text-xs text-slate-500 mt-0.5">This manager can approve invoices and billing</p>
                                    </div>
                                  </label>
                                </div>
                              </div>
                            )}

                            {(userEditForm.role === 'staff' || userEditForm.role === 'manager' || userEditForm.role === 'mechanic' || userEditForm.role === 'master') && (
                              <div className="mt-6 p-6 bg-slate-900/50 rounded-xl border border-slate-600">
                                <h4 className="text-lg font-bold mb-4 text-blue-400">Notification Settings</h4>
                                <p className="text-sm text-slate-400 mb-4">Configure how this user receives notifications and time clock reminders</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="md:col-span-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={userEditForm.email_notifications_enabled}
                                        onChange={(e) => setUserEditForm({ ...userEditForm, email_notifications_enabled: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="text-slate-300 font-medium">Enable Email Notifications</span>
                                    </label>
                                  </div>

                                  {userEditForm.email_notifications_enabled && (
                                    <div className="md:col-span-2">
                                      <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Notification Email (optional)
                                      </label>
                                      <input
                                        type="email"
                                        value={userEditForm.notification_email}
                                        onChange={(e) => setUserEditForm({ ...userEditForm, notification_email: e.target.value })}
                                        placeholder="Leave blank to use primary email"
                                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                      <p className="text-xs text-slate-500 mt-1">If left blank, notifications will be sent to the primary email address</p>
                                    </div>
                                  )}

                                  <div className="md:col-span-2">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={userEditForm.sms_notifications_enabled}
                                        onChange={(e) => setUserEditForm({ ...userEditForm, sms_notifications_enabled: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                      />
                                      <span className="text-slate-300 font-medium">Enable SMS Notifications</span>
                                    </label>
                                  </div>

                                  {userEditForm.sms_notifications_enabled && (
                                    <div className="md:col-span-2">
                                      <label className="block text-sm font-medium text-slate-300 mb-2">
                                        SMS Phone Number (optional)
                                      </label>
                                      <input
                                        type="tel"
                                        value={userEditForm.notification_phone}
                                        onChange={(e) => setUserEditForm({ ...userEditForm, notification_phone: formatPhoneNumber(e.target.value) })}
                                        placeholder="123-456-7890"
                                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      />
                                      <p className="text-xs text-slate-500 mt-1">If left blank, SMS will be sent to the primary phone number.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex gap-4 mt-6">
                              <button
                                type="submit"
                                disabled={userLoading}
                                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {userLoading ? (
                                  <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                    {isCreatingNewUser ? 'Creating...' : 'Saving...'}
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-5 h-5" />
                                    {isCreatingNewUser ? 'Create User' : 'Save Changes'}
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUser(null);
                                  setIsCreatingNewUser(false);
                                  setSelectedUserGroup(null);
                                  setUserError('');
                                  setUserSuccess('');
                                }}
                                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </div>
                      ) : (
                        <div>
                          {(() => {
                            const filteredUsers = allUsers.filter((user) => {
                              // Master role sees ALL users including inactive
                              if (userProfile?.role !== 'master') {
                                if (user.is_active === false) return false;
                                // Apply yacht filters for non-master roles
                                if ((effectiveRole === 'owner' || effectiveRole === 'manager') && effectiveYacht?.id) {
                                  if (user.yacht_id !== effectiveYacht.id) return false;
                                }
                              }
                              if (!userSearchTerm) return true;
                              const searchLower = userSearchTerm.toLowerCase();
                              return (
                                user.first_name?.toLowerCase().includes(searchLower) ||
                                user.last_name?.toLowerCase().includes(searchLower) ||
                                user.email?.toLowerCase().includes(searchLower) ||
                                user.role?.toLowerCase().includes(searchLower)
                              );
                            });

                            // Staff: mechanic, staff, and master users WITHOUT yacht assignment
                            const staffUsers = filteredUsers.filter(user => {
                              if (user.is_active === false) return false;
                              if (user.role === 'mechanic' || user.role === 'staff') return true;
                              // Master users with yacht_id are yacht representatives, not staff
                              if (user.role === 'master' && !user.yacht_id) return true;
                              return false;
                            });
                            const yachtAssignedUsers = filteredUsers.filter(user => {
                              if (!user.yacht_id || user.is_active === false) return false;
                              return user.role === 'owner' || user.role === 'manager' || user.role === 'master';
                            });

                            const yachtGroups: { [key: string]: typeof yachtAssignedUsers } = {};

                            // Initialize yacht groups with all active yachts (so they show even without users)
                            allYachts.forEach(yacht => {
                              yachtGroups[yacht.name] = [];
                            });

                            // Add yacht-assigned users (owners and managers) to their respective yacht groups
                            // Only include users whose yachts are active
                            yachtAssignedUsers.forEach(user => {
                              const yachtName = user.yachts?.name || 'Unassigned';
                              // Only add user if their yacht exists in the active yachts list
                              if (yachtGroups[yachtName] !== undefined) {
                                yachtGroups[yachtName].push(user);
                              }
                            });

                            const hasResults = filteredUsers.length > 0;

                            if (selectedUserGroup) {
                              let groupUsers = selectedUserGroup === 'Staff' ? staffUsers : yachtGroups[selectedUserGroup] || [];

                              // Sort users: by trip number first (if present), then alphabetically
                              groupUsers = [...groupUsers].sort((a, b) => {
                                // If both have trip numbers, sort by trip number
                                if (a.trip_number && b.trip_number) {
                                  return a.trip_number - b.trip_number;
                                }
                                // Users with trip numbers come first
                                if (a.trip_number && !b.trip_number) return -1;
                                if (!a.trip_number && b.trip_number) return 1;
                                // If neither has trip number, sort alphabetically by name
                                const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
                                const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
                                return nameA.localeCompare(nameB);
                              });

                              return (
                                <div>
                                  <button
                                    onClick={() => setSelectedUserGroup(null)}
                                    className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors mb-6"
                                  >
                                    <span>← Back to Groups</span>
                                  </button>

                                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden mb-6">
                                    <div className={`${selectedUserGroup === 'Staff' ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20' : 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20'} border-b border-slate-700 px-6 py-4`}>
                                      <div className="flex items-center gap-3">
                                        {selectedUserGroup === 'Staff' ? (
                                          <Users className="w-6 h-6 text-blue-400" />
                                        ) : (
                                          <Ship className="w-6 h-6 text-teal-400" />
                                        )}
                                        <h3 className="text-xl font-bold text-white">{selectedUserGroup}</h3>
                                        <span className={`ml-auto px-3 py-1 ${selectedUserGroup === 'Staff' ? 'bg-blue-500/30 text-blue-300' : 'bg-teal-500/30 text-teal-300'} rounded-full text-sm font-medium`}>
                                          {groupUsers.length} {groupUsers.length === 1 ? 'member' : 'members'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-4">
                                    {groupUsers.map((user) => (
                                      <div
                                        key={user.user_id}
                                        className="bg-slate-700/30 rounded-xl p-6 hover:bg-slate-700/50 transition-colors"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <h4 className="text-lg font-bold mb-1">
                                              {user.first_name} {user.last_name}
                                            </h4>
                                            <p className="text-slate-400 text-sm mb-2">{user.email}</p>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">
                                                {user.role}
                                              </span>
                                              {user.trip_number && (
                                                <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">
                                                  Trip #{user.trip_number}
                                                </span>
                                              )}
                                              {user.phone && (
                                                <span className="px-3 py-1 bg-slate-600 text-slate-300 rounded-full text-xs">
                                                  {user.phone}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                                              {user.last_sign_in_at && (
                                                <div className="flex items-center gap-2">
                                                  <Clock className="w-3 h-3 text-green-500" />
                                                  <span>Last sign in: {new Date(user.last_sign_in_at).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                  })}</span>
                                                </div>
                                              )}
                                              {user.last_sign_out_at && (
                                                <div className="flex items-center gap-2">
                                                  <Clock className="w-3 h-3 text-orange-500" />
                                                  <span>Last sign out: {new Date(user.last_sign_out_at).toLocaleString('en-US', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                  })}</span>
                                                </div>
                                              )}
                                              {!user.last_sign_in_at && !user.last_sign_out_at && (
                                                <div className="flex items-center gap-2">
                                                  <Clock className="w-3 h-3 text-slate-600" />
                                                  <span>Never signed in</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex gap-2 ml-4">
                                            <button
                                              onClick={() => handleUserEdit(user)}
                                              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                            >
                                              <Edit2 className="w-4 h-4" />
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => handleUserDelete(user)}
                                              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                              Delete
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }

                            return hasResults ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {staffUsers.length > 0 && effectiveRole !== 'manager' && (
                                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-blue-500 transition-all duration-300 hover:scale-105 group">
                                    <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b border-slate-700 px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <Users className="w-6 h-6 text-blue-400" />
                                        <h3 className="text-xl font-bold text-white">Staff</h3>
                                      </div>
                                      <p className="text-slate-400 text-sm mt-2">
                                        {staffUsers.length} {staffUsers.length === 1 ? 'member' : 'members'}
                                      </p>
                                    </div>
                                    <div className="p-6">
                                      <button
                                        onClick={() => setSelectedUserGroup('Staff')}
                                        className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                      >
                                        Access
                                        <Users className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {Object.entries(yachtGroups).sort(([a], [b]) => a.localeCompare(b)).map(([yachtName, users]) => (
                                  <div key={yachtName} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-teal-500 transition-all duration-300 hover:scale-105 group">
                                    <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-b border-slate-700 px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <Ship className="w-6 h-6 text-teal-400" />
                                        <h3 className="text-xl font-bold text-white">{yachtName}</h3>
                                      </div>
                                      <p className="text-slate-400 text-sm mt-2">
                                        {users.length} {users.length === 1 ? 'member' : 'members'}
                                      </p>
                                    </div>
                                    <div className="p-6">
                                      <div className="grid grid-cols-2 gap-3">
                                        <button
                                          onClick={() => setSelectedUserGroup(yachtName)}
                                          className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                          Access
                                          <Ship className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => {
                                            const recipients: Array<{ email: string; name: string }> = [];
                                            const ccEmails: string[] = [];

                                            users.forEach((user: any) => {
                                              const primaryEmail = user.notification_email || user.email;
                                              const userName = user.first_name && user.last_name
                                                ? `${user.first_name} ${user.last_name}`
                                                : user.email;

                                              if (primaryEmail) {
                                                recipients.push({ email: primaryEmail, name: userName });
                                              }

                                              if (user.secondary_email && user.secondary_email !== primaryEmail) {
                                                ccEmails.push(user.secondary_email);
                                              }
                                            });

                                            if (recipients.length === 0) {
                                              alert('No email addresses found for yacht members');
                                              return;
                                            }

                                            setBulkEmailRecipients(recipients);
                                            setBulkEmailCcRecipients(ccEmails);
                                            setBulkEmailYachtName(yachtName);
                                            setShowBulkEmailModal(true);
                                          }}
                                          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                          Email All
                                          <Mail className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-12">
                                <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                                <p className="text-slate-400">No users found matching your search.</p>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* Trip Inspection PDF Modal */}
      {selectedInspectionForPDF && (
        <InspectionPDFView
          inspection={selectedInspectionForPDF}
          onClose={() => setSelectedInspectionForPDF(null)}
        />
      )}

      {/* Owner Handoff PDF Modal */}
      {selectedHandoffForPDF && (
        <OwnerHandoffPDFView
          handoff={selectedHandoffForPDF}
          onClose={() => setSelectedHandoffForPDF(null)}
        />
      )}

      {/* Daily Appointments Modal */}
      {selectedDayAppointments && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border-2 border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-slate-800/50 border-b border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-1">
                    {selectedDayAppointments.date.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h2>
                  <p className="text-slate-400">
                    {selectedDayAppointments.bookings.length} {selectedDayAppointments.bookings.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDayAppointments(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedDayAppointments.bookings.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>No appointments for this day</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayAppointments.bookings.map((booking: any) => {
                  const startDate = new Date(booking.start_date);
                  const endDate = new Date(booking.end_date);
                  startDate.setHours(0, 0, 0, 0);
                  endDate.setHours(0, 0, 0, 0);
                  const checkDate = new Date(selectedDayAppointments.date);
                  checkDate.setHours(0, 0, 0, 0);

                  const isDeparture = checkDate.getTime() === startDate.getTime();
                  const isArrival = checkDate.getTime() === endDate.getTime();

                  return (
                    <div
                      key={booking.id}
                      onClick={() => {
                        if (!booking.is_appointment) {
                          setSelectedDayAppointments(null);
                          handleEditBooking(booking);
                        }
                      }}
                      className={`bg-slate-800/50 rounded-xl p-4 border-2 transition-all ${
                        booking.is_appointment
                          ? 'border-pink-500/30 hover:border-pink-500/50'
                          : isDeparture
                          ? 'border-green-500/30 hover:border-green-500/50 cursor-pointer'
                          : 'border-red-500/30 hover:border-red-500/50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl ${
                            booking.is_appointment
                              ? 'bg-pink-500/20'
                              : isDeparture
                              ? 'bg-green-500/20'
                              : !isDeparture && booking.oil_change_needed
                              ? 'bg-yellow-500/20'
                              : 'bg-red-500/20'
                          }`}>
                            {booking.is_appointment ? (
                              <Clock className={`w-5 h-5 text-pink-400`} />
                            ) : isDeparture ? (
                              <Ship className={`w-5 h-5 text-green-400`} />
                            ) : !isDeparture && booking.oil_change_needed ? (
                              <Ship className={`w-5 h-5 text-yellow-400`} />
                            ) : (
                              <Ship className={`w-5 h-5 text-red-400`} />
                            )}
                          </div>
                          <div>
                            <h3 className={`text-lg font-bold ${
                              booking.is_appointment
                                ? 'text-pink-300'
                                : isDeparture
                                ? 'text-green-300'
                                : !isDeparture && booking.oil_change_needed
                                ? 'text-yellow-300'
                                : 'text-red-300'
                            }`}>
                              {booking.yachts?.name || 'Yacht'}
                            </h3>
                            <p className="text-slate-400">
                              {getBookingDisplayName(booking)}
                            </p>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          booking.is_appointment
                            ? 'bg-pink-500/20 text-pink-300'
                            : isDeparture
                            ? 'bg-green-500/20 text-green-300'
                            : !isDeparture && booking.oil_change_needed
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}>
                          {booking.is_appointment
                            ? `Appointment ${convertTo12Hour(booking.departure_time)}`
                            : isDeparture
                            ? 'Departure'
                            : 'Arrival'
                          }
                        </div>
                      </div>

                      {booking.is_appointment && booking.problem_description && (
                        <div className="bg-slate-900/50 rounded-lg p-3 mt-3">
                          <p className="text-sm text-slate-300">{booking.problem_description}</p>
                        </div>
                      )}

                      {!booking.is_appointment && (
                        <div className="mt-3 pt-3 border-t border-slate-700 text-sm text-slate-400">
                          <p>Trip: {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showVideoUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">Upload Educational Video</h2>
              <button
                onClick={() => {
                  setShowVideoUploadModal(false);
                  setVideoFile(null);
                  setThumbnailFile(null);
                  setUploadError('');
                  setVideoUploadProgress(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {uploadError && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Upload Failed</p>
                      <p className="text-sm">{uploadError}</p>
                    </div>
                    {videoUploadProgress?.isAuthError && (
                      <button
                        onClick={signOut}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors whitespace-nowrap"
                      >
                        <LogOut className="w-4 h-4" />
                        Log Out
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={videoUploadForm.title}
                  onChange={(e) => setVideoUploadForm({ ...videoUploadForm, title: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                  placeholder="Enter video title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={videoUploadForm.description}
                  onChange={(e) => setVideoUploadForm({ ...videoUploadForm, description: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 min-h-[100px]"
                  placeholder="Enter video description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Category *</label>
                <input
                  type="text"
                  value={videoUploadForm.category}
                  onChange={(e) => setVideoUploadForm({ ...videoUploadForm, category: e.target.value })}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                  placeholder="e.g., Navigation, Maintenance, Safety"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Order Index</label>
                <input
                  type="number"
                  value={videoUploadForm.order_index}
                  onChange={(e) => setVideoUploadForm({ ...videoUploadForm, order_index: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Video File (MP4) *</label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('video/')) {
                      setVideoFile(file);
                      setUploadError('');
                    } else {
                      setUploadError('Please drop a valid video file');
                    }
                  }}
                  className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-amber-500 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('video-file-input')?.click()}
                >
                  {videoFile ? (
                    <div className="space-y-2">
                      <Play className="w-12 h-12 text-amber-500 mx-auto" />
                      <p className="text-sm font-medium">{videoFile.name}</p>
                      <p className="text-xs text-slate-400">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      {videoFile.size > 100 * 1024 * 1024 && (
                        <p className="text-xs text-blue-400 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          Large file - upload may take a few minutes
                        </p>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoFile(null);
                        }}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 text-slate-500 mx-auto" />
                      <p className="text-sm text-slate-400">Drag and drop your MP4 video here</p>
                      <p className="text-xs text-slate-500">or click to browse</p>
                      <p className="text-xs text-blue-400 mt-2">Supports large video files with resumable uploads</p>
                    </div>
                  )}
                </div>
                <input
                  id="video-file-input"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setVideoFile(file);
                      setUploadError('');
                    }
                  }}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Thumbnail Image (Optional)</label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                      setThumbnailFile(file);
                    } else {
                      setUploadError('Please drop a valid image file');
                    }
                  }}
                  className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-amber-500 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('thumbnail-file-input')?.click()}
                >
                  {thumbnailFile ? (
                    <div className="space-y-2">
                      <Camera className="w-12 h-12 text-amber-500 mx-auto" />
                      <p className="text-sm font-medium">{thumbnailFile.name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setThumbnailFile(null);
                        }}
                        className="text-red-500 hover:text-red-400 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Camera className="w-12 h-12 text-slate-500 mx-auto" />
                      <p className="text-sm text-slate-400">Drag and drop a thumbnail image</p>
                      <p className="text-xs text-slate-500">or click to browse</p>
                    </div>
                  )}
                </div>
                <input
                  id="thumbnail-file-input"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setThumbnailFile(file);
                    }
                  }}
                  className="hidden"
                />
              </div>

              {videoUploadProgress && videoUploadProgress.status === 'uploading' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{videoUploadProgress.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${videoUploadProgress.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {videoUploadProgress && videoUploadProgress.status === 'complete' && (
                <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-4 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span>Video uploaded successfully!</span>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleUploadVideo}
                  disabled={!videoFile || !videoUploadForm.title || !videoUploadForm.category || videoUploadProgress?.status === 'uploading'}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload Video
                </button>
                <button
                  onClick={() => {
                    setShowVideoUploadModal(false);
                    setVideoFile(null);
                    setThumbnailFile(null);
                    setUploadError('');
                    setVideoUploadProgress(null);
                  }}
                  className="px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && selectedInvoiceForEmail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  Send Payment Link via Email
                </h3>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Invoice</p>
                <p className="text-white font-semibold">{selectedInvoiceForEmail.repair_title}</p>
                <p className="text-emerald-400 text-lg font-bold mt-1">{selectedInvoiceForEmail.invoice_amount}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Recipient Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={emailRecipient}
                  onChange={(e) => setEmailRecipient(e.target.value)}
                  placeholder="manager@example.com"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  value={emailRecipientName}
                  onChange={(e) => setEmailRecipientName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  A professional email will be sent with the payment link, invoice details, and instructions for completing the payment.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={sendingEmail}
                className="flex-1 px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendPaymentEmail}
                disabled={sendingEmail || !emailRecipient}
                className="flex-1 px-6 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEstimateEmailModal && selectedRepairForEstimateEmail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-orange-400" />
                  Send Repair Estimate via Email
                </h3>
                <button
                  onClick={() => setShowEstimateEmailModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400 mb-1">Repair Request</p>
                <p className="text-white font-semibold">{selectedRepairForEstimateEmail.title}</p>
                {selectedRepairForEstimateEmail.estimated_repair_cost && (
                  <p className="text-orange-400 text-lg font-bold mt-1">
                    ${parseFloat(selectedRepairForEstimateEmail.estimated_repair_cost).toFixed(2)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Recipient Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={estimateEmailRecipient}
                  onChange={(e) => setEstimateEmailRecipient(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  value={estimateEmailRecipientName}
                  onChange={(e) => setEstimateEmailRecipientName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                />
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                <p className="text-xs text-orange-300">
                  A professional email will be sent with the repair estimate, description, and attached files. The customer can review and approve the estimate.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setShowEstimateEmailModal(false)}
                disabled={sendingEstimateEmail}
                className="flex-1 px-6 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEstimateEmail}
                disabled={sendingEstimateEmail || !estimateEmailRecipient}
                className="flex-1 px-6 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingEstimateEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAgreementForm && yacht && userProfile && user && (
        <VesselManagementAgreementForm
          yacht={allYachts.find(y => y.id === agreementYachtId) || yacht}
          userProfile={userProfile}
          userId={user.id}
          existingAgreement={selectedAgreement || undefined}
          onClose={() => {
            setShowAgreementForm(false);
            setSelectedAgreement(null);
          }}
          onSuccess={handleAgreementSuccess}
        />
      )}

      {showAgreementViewer && selectedAgreement && userProfile && user && (
        <VesselAgreementViewer
          agreement={selectedAgreement}
          userProfile={userProfile}
          userId={user.id}
          onClose={() => {
            setShowAgreementViewer(false);
            setSelectedAgreement(null);
          }}
          onUpdate={() => {
            if (agreementYachtId) {
              loadVesselAgreements(agreementYachtId);
            }
          }}
        />
      )}

      {showUserPrintView && (
        <PrintableUserList
          users={usersToPrint}
          title={printTitle}
          onClose={() => setShowUserPrintView(false)}
        />
      )}

      {showTripsPrintView && (
        <PrintableOwnerTrips
          trips={tripsToPrint}
          yachtName={printYachtName}
          onClose={() => setShowTripsPrintView(false)}
        />
      )}

      {showProfileEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Edit My Profile</h3>
              <button
                onClick={() => setShowProfileEdit(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {profileEditError && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
                {profileEditError}
              </div>
            )}

            {profileEditSuccess && (
              <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-200">
                {profileEditSuccess}
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileEditForm.first_name}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, first_name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileEditForm.last_name}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, last_name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={profileEditForm.email}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Changing your email will update your login credentials
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={profileEditForm.phone}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, phone: formatPhoneNumber(e.target.value) })}
                    placeholder="123-456-7890"
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={profileEditForm.street}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, street: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={profileEditForm.city}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, city: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    State
                  </label>
                  <select
                    value={profileEditForm.state}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, state: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select State</option>
                    <option value="AL">Alabama</option>
                    <option value="AK">Alaska</option>
                    <option value="AZ">Arizona</option>
                    <option value="AR">Arkansas</option>
                    <option value="CA">California</option>
                    <option value="CO">Colorado</option>
                    <option value="CT">Connecticut</option>
                    <option value="DE">Delaware</option>
                    <option value="FL">Florida</option>
                    <option value="GA">Georgia</option>
                    <option value="HI">Hawaii</option>
                    <option value="ID">Idaho</option>
                    <option value="IL">Illinois</option>
                    <option value="IN">Indiana</option>
                    <option value="IA">Iowa</option>
                    <option value="KS">Kansas</option>
                    <option value="KY">Kentucky</option>
                    <option value="LA">Louisiana</option>
                    <option value="ME">Maine</option>
                    <option value="MD">Maryland</option>
                    <option value="MA">Massachusetts</option>
                    <option value="MI">Michigan</option>
                    <option value="MN">Minnesota</option>
                    <option value="MS">Mississippi</option>
                    <option value="MO">Missouri</option>
                    <option value="MT">Montana</option>
                    <option value="NE">Nebraska</option>
                    <option value="NV">Nevada</option>
                    <option value="NH">New Hampshire</option>
                    <option value="NJ">New Jersey</option>
                    <option value="NM">New Mexico</option>
                    <option value="NY">New York</option>
                    <option value="NC">North Carolina</option>
                    <option value="ND">North Dakota</option>
                    <option value="OH">Ohio</option>
                    <option value="OK">Oklahoma</option>
                    <option value="OR">Oregon</option>
                    <option value="PA">Pennsylvania</option>
                    <option value="RI">Rhode Island</option>
                    <option value="SC">South Carolina</option>
                    <option value="SD">South Dakota</option>
                    <option value="TN">Tennessee</option>
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="VT">Vermont</option>
                    <option value="VA">Virginia</option>
                    <option value="WA">Washington</option>
                    <option value="WV">West Virginia</option>
                    <option value="WI">Wisconsin</option>
                    <option value="WY">Wyoming</option>
                    <option value="DC">District of Columbia</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Zip Code
                  </label>
                  <input
                    type="text"
                    value={profileEditForm.zip_code}
                    onChange={(e) => setProfileEditForm({ ...profileEditForm, zip_code: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="mt-6 p-6 bg-slate-900/50 rounded-xl border border-slate-600">
                <h4 className="text-lg font-bold mb-4 text-blue-400">Email Notification Settings</h4>
                <p className="text-sm text-slate-400 mb-4">Configure how you receive email notifications</p>

                <div className="space-y-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Secondary CC Email (optional)
                    </label>
                    <input
                      type="email"
                      value={profileEditForm.secondary_email}
                      onChange={(e) => setProfileEditForm({ ...profileEditForm, secondary_email: e.target.value })}
                      placeholder="CC recipient for email notifications"
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">This email will receive a copy (CC) of all notifications sent to you</p>
                  </div>

                  {isStaffOrManager(effectiveRole) && (
                    <>
                      <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={profileEditForm.email_notifications_enabled}
                            onChange={(e) => setProfileEditForm({ ...profileEditForm, email_notifications_enabled: e.target.checked })}
                            className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-slate-300 font-medium">Enable Email Notifications for New Messages</span>
                        </label>
                      </div>

                      {profileEditForm.email_notifications_enabled && (
                        <div>
                          <label className="block text-sm font-medium text-slate-300 mb-2">
                            Notification Email (optional)
                          </label>
                          <input
                            type="email"
                            value={profileEditForm.notification_email}
                            onChange={(e) => setProfileEditForm({ ...profileEditForm, notification_email: e.target.value })}
                            placeholder="Leave blank to use primary email"
                            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <p className="text-xs text-slate-500 mt-1">If left blank, notifications will be sent to your primary email address</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProfileEdit(false)}
                  className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileEditLoading}
                  className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {profileEditLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmailChangeConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-md w-full">
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-center mb-4">Email Updated Successfully</h3>
            <div className="bg-slate-700/50 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-center mb-2">Your new login email is:</p>
              <p className="text-blue-400 font-semibold text-center text-lg">{newEmailAddress}</p>
            </div>
            <p className="text-slate-400 text-center text-sm mb-6">
              Please use this email address to log in next time.
            </p>
            <button
              onClick={() => {
                setShowEmailChangeConfirm(false);
                setShowProfileEdit(false);
                setNewEmailAddress('');
              }}
              className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* Quick Appointment Creation Modal */}
      {showQuickAppointmentModal && quickAppointmentDate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border-2 border-pink-500/30 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-pink-500/20 to-orange-500/20 border-b border-slate-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarPlus className="w-8 h-8 text-pink-400" />
                  <div>
                    <h2 className="text-2xl font-bold">Create Appointment</h2>
                    <p className="text-slate-400">
                      {quickAppointmentDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowQuickAppointmentModal(false);
                    setQuickAppointmentDate(null);
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {appointmentSuccess && (
                <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
                  Appointment created successfully!
                </div>
              )}

              {appointmentError && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
                  {appointmentError}
                </div>
              )}

              <form onSubmit={handleAppointmentSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      value={appointmentForm.name}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={appointmentForm.phone}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={appointmentForm.email}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Yacht
                    </label>
                    <input
                      type="text"
                      value={appointmentForm.yacht_id}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, yacht_id: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-white"
                      placeholder="Enter yacht name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Date
                    </label>
                    <input
                      type="date"
                      value={appointmentForm.date}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, date: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Time
                    </label>
                    <input
                      type="time"
                      value={appointmentForm.time}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, time: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Problem Description
                  </label>
                  <textarea
                    value={appointmentForm.problem_description}
                    onChange={(e) => setAppointmentForm({ ...appointmentForm, problem_description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none text-white"
                    required
                  />
                </div>

                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appointmentForm.createRepairRequest}
                      onChange={(e) => setAppointmentForm({ ...appointmentForm, createRepairRequest: e.target.checked })}
                      className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-pink-500 focus:ring-2 focus:ring-pink-500"
                    />
                    <div className="flex-1">
                      <span className="text-slate-300 font-medium">Also create repair request</span>
                      <p className="text-sm text-slate-400 mt-1">
                        Automatically create a retail repair request with the appointment details
                      </p>
                    </div>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={appointmentLoading}
                    className="flex-1 px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {appointmentLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CalendarPlus className="w-4 h-4" />
                        Create Appointment
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAppointmentModal(false);
                      setQuickAppointmentDate(null);
                    }}
                    className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Version Number - Fixed Bottom Right */}
      <div className="fixed bottom-4 right-4 text-slate-500 text-sm font-mono bg-slate-900/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-slate-700">
        Version: 2026.02.01.A
      </div>

      {/* QR Code Modal */}
      {qrCodeYacht && (
        <YachtQRCode
          yachtId={qrCodeYacht.id}
          yachtName={qrCodeYacht.name}
          onClose={() => setQrCodeYacht(null)}
        />
      )}

      {/* Email Compose Modal */}
      <EmailComposeModal
        isOpen={showBulkEmailModal}
        onClose={() => {
          setShowBulkEmailModal(false);
          setBulkEmailRecipients([]);
          setBulkEmailCcRecipients([]);
          setBulkEmailYachtName('');
        }}
        recipients={bulkEmailRecipients}
        ccRecipients={bulkEmailCcRecipients}
        yachtName={bulkEmailYachtName}
      />
      </main>
    </div>
  );
};
