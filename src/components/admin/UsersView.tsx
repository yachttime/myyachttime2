import { Users, Mail, Printer, X, Save, Eye, EyeOff, Ship, UserX, UserCheck, Clock, CreditCard as Edit2, ArrowLeftRight, AlertCircle, MousePointer, CheckCircle, ChevronDown } from 'lucide-react';
import { Yacht } from '../../lib/supabase';

interface UserProfile {
  user_id: string; first_name: string; last_name: string; email: string;
  role: string; phone?: string; secondary_phone?: string; secondary_email?: string;
  trip_number?: string; yacht_id?: string; is_active?: boolean;
  last_sign_in_at?: string; last_sign_out_at?: string;
  yachts?: { name: string };
  notification_email?: string; notification_phone?: string;
  email_notifications_enabled?: boolean; sms_notifications_enabled?: boolean;
  employee_type?: string; rate_of_pay?: string;
  can_approve_repairs?: boolean; can_approve_billing?: boolean;
  sms_consent_given?: boolean; sms_consent_method?: string;
  street?: string; city?: string; state?: string; zip_code?: string;
}

export interface UserEditForm {
  first_name: string; last_name: string; email: string; password: string;
  trip_number: string; role: string; employee_type: string; yacht_id: string;
  phone: string; secondary_phone: string; secondary_email: string;
  street: string; city: string; state: string; zip_code: string;
  email_notifications_enabled: boolean; sms_notifications_enabled: boolean;
  notification_email: string; notification_phone: string;
  can_approve_repairs: boolean; can_approve_billing: boolean;
  sms_consent_given: boolean; sms_consent_method: string;
  rate_of_pay?: string;
}

interface StaffMessage { id: string; notification_type: string; yacht_name: string; email_subject: string; email_body?: string; email_sent_at?: string; created_at: string; email_recipients?: any[]; email_cc_recipients?: string[]; email_delivered_at?: string; email_opened_at?: string; email_clicked_at?: string; email_bounced_at?: string; email_open_count?: number; email_click_count?: number; user_profiles?: { first_name: string; last_name: string } }

interface TransferForm { first_name: string; last_name: string; email: string; password: string; phone: string; trip_number: string; street: string; city: string; state: string; zip_code: string; notification_email: string; notification_phone: string; secondary_email: string; secondary_phone: string; email_notifications_enabled: boolean; sms_notifications_enabled: boolean }

interface UsersViewProps {
  allUsers: UserProfile[];
  allYachts: Yacht[];
  effectiveRole: string;
  effectiveYacht: { id: string; name: string } | null;
  userProfile: { role: string } | null;
  canAccessAllYachts: (r: string) => boolean;
  isStaffRole: (r: string) => boolean;
  isMasterRole: (r: string) => boolean;
  onEmailAllManagers: () => void;
  onEmailAllOwnersAndManagers: () => void;
  printYachtFilter: string;
  onPrintYachtFilterChange: (v: string) => void;
  onPrintUsers: (usersWithYachts: any[], title: string) => void;
  selectedUser: UserProfile | null;
  onSelectedUserChange: (u: UserProfile | null) => void;
  isCreatingNewUser: boolean;
  onIsCreatingNewUserChange: (v: boolean) => void;
  userEditForm: UserEditForm;
  onUserEditFormChange: (f: UserEditForm) => void;
  selectedUserGroup: string | null;
  onSelectedUserGroupChange: (g: string | null) => void;
  userError: string;
  userSuccess: string;
  onClearUserMessages: () => void;
  onUserUpdate: (e: React.FormEvent) => void;
  onUserEdit: (u: UserProfile) => void;
  onUserDelete: (u: UserProfile) => void;
  onUserReactivate: (u: UserProfile) => void;
  userSearchTerm: string;
  onUserSearchTermChange: (v: string) => void;
  userLoading: boolean;
  showPassword: boolean;
  onShowPasswordToggle: () => void;
  formatPhoneNumber: (v: string) => string;
  showResetPassword: boolean;
  onShowResetPasswordToggle: () => void;
  resetPasswordValue: string;
  onResetPasswordValueChange: (v: string) => void;
  resetPasswordError: string;
  resetPasswordSuccess: string;
  resetPasswordLoading: boolean;
  onResetUserPassword: (e: React.FormEvent) => void;
  staffMessages: StaffMessage[];
  expandedEmailId: string | null;
  onExpandedEmailIdChange: (id: string | null) => void;
  recipientTrackingMap: { [key: string]: any[] };
  onFetchRecipientTracking: (msgId: string) => Promise<void>;
  onTransferClick: (user: UserProfile, yachtName: string) => void;
  yachtPartners: { [yachtId: string]: any[] };
  onEmailGroup: (yachtName: string, users: UserProfile[]) => void;
  onEmailManagementTeam: (yachtName: string, users: UserProfile[]) => void;
  onSendIntroVideo: (yachtName: string, users: UserProfile[]) => void;
}

const inputCls = "w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400";

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
const STATE_NAMES: Record<string, string> = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia' };

function fmtTs(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', { timeZone: 'America/Phoenix', month: 'short', day: 'numeric', year: 'numeric' }) +
    ' at ' + new Date(ts).toLocaleTimeString('en-US', { timeZone: 'America/Phoenix', hour: '2-digit', minute: '2-digit' });
}

function EmailExpandable({ msg, isExpanded, onToggle, recipientTracking }: { msg: StaffMessage; isExpanded: boolean; onToggle: () => void; recipientTracking: any[] }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-slate-700/30 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{msg.email_subject}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmtTs(msg.email_sent_at || msg.created_at)}
              {msg.email_recipients?.length > 0 && ` · ${msg.email_recipients.length} recipient${msg.email_recipients.length !== 1 ? 's' : ''}`}
              {msg.user_profiles && ` · Sent by ${msg.user_profiles.first_name} ${msg.user_profiles.last_name}`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {msg.email_bounced_at ? (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" />Bounced</span>
              ) : msg.email_clicked_at ? (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1"><MousePointer className="w-3 h-3" />Clicked{msg.email_click_count! > 1 ? ` (${msg.email_click_count}x)` : ''}</span>
              ) : msg.email_opened_at ? (
                <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full flex items-center gap-1"><Eye className="w-3 h-3" />Opened{msg.email_open_count! > 1 ? ` (${msg.email_open_count}x)` : ''}</span>
              ) : msg.email_delivered_at ? (
                <span className="text-xs bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />Delivered</span>
              ) : (
                <span className="text-xs bg-slate-600/50 text-slate-400 px-2 py-0.5 rounded-full">Pending</span>
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>
      {isExpanded && (
        <div className="border-t border-slate-700 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Delivery Timeline</p>
              <div className="space-y-2">
                <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" /><div><p className="text-xs font-medium text-blue-400">Sent</p><p className="text-xs text-slate-500">{fmtTs(msg.email_sent_at || msg.created_at)}</p></div></div>
                <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full shrink-0 ${msg.email_delivered_at ? 'bg-teal-400' : 'bg-slate-600'}`} /><div><p className={`text-xs font-medium ${msg.email_delivered_at ? 'text-teal-400' : 'text-slate-600'}`}>Delivered</p>{msg.email_delivered_at ? <p className="text-xs text-slate-500">{fmtTs(msg.email_delivered_at)}</p> : <p className="text-xs text-slate-600">Not yet confirmed</p>}</div></div>
                <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full shrink-0 ${msg.email_opened_at ? 'bg-cyan-400' : 'bg-slate-600'}`} /><div><p className={`text-xs font-medium ${msg.email_opened_at ? 'text-cyan-400' : 'text-slate-600'}`}>Opened{msg.email_open_count! > 1 ? ` (${msg.email_open_count} times)` : ''}</p>{msg.email_opened_at ? <p className="text-xs text-slate-500">{fmtTs(msg.email_opened_at)}</p> : <p className="text-xs text-slate-600">Not opened yet</p>}</div></div>
                <div className="flex items-center gap-3"><div className={`w-2 h-2 rounded-full shrink-0 ${msg.email_clicked_at ? 'bg-emerald-400' : 'bg-slate-600'}`} /><div><p className={`text-xs font-medium ${msg.email_clicked_at ? 'text-emerald-400' : 'text-slate-600'}`}>Link Clicked{msg.email_click_count! > 1 ? ` (${msg.email_click_count} times)` : ''}</p>{msg.email_clicked_at ? <p className="text-xs text-slate-500">{fmtTs(msg.email_clicked_at)}</p> : <p className="text-xs text-slate-600">No clicks yet</p>}</div></div>
                {msg.email_bounced_at && <div className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-red-400 shrink-0" /><div><p className="text-xs font-medium text-red-400">Bounced</p><p className="text-xs text-slate-500">{fmtTs(msg.email_bounced_at)}</p></div></div>}
              </div>
            </div>
            <div>
              {msg.email_recipients?.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recipients ({msg.email_recipients.length})</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {msg.email_recipients.map((r: any, i: number) => {
                      const track = recipientTracking.find((t: any) => t.recipient_email === (r.email || r));
                      return (
                        <div key={i} className="bg-slate-900/50 rounded-lg p-2.5">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0"><span className="text-xs text-slate-400">{(r.name || r.email || '?')[0].toUpperCase()}</span></div>
                            <div className="min-w-0 flex-1">{r.name && r.name !== r.email && <p className="text-xs text-white truncate">{r.name}</p>}<p className="text-xs text-slate-400 truncate">{r.email || r}</p></div>
                          </div>
                          {(() => {
                            const delivered_at = track?.delivered_at ?? (recipientTracking.length === 0 ? msg.email_delivered_at : null);
                            const opened_at = track?.opened_at ?? null; const open_count = track?.open_count ?? 0;
                            const clicked_at = track?.clicked_at ?? null; const click_count = track?.click_count ?? 0;
                            const bounced_at = track?.bounced_at ?? null;
                            return (
                              <div className="flex flex-wrap gap-1 ml-8">
                                {bounced_at ? (
                                  <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded flex items-center gap-0.5"><AlertCircle className="w-3 h-3" />Bounced</span>
                                ) : (
                                  <>
                                    <span className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5 ${delivered_at ? 'bg-teal-500/20 text-teal-400' : 'bg-slate-700/50 text-slate-500'}`}><CheckCircle className="w-3 h-3" />{delivered_at ? 'Delivered' : 'Pending'}</span>
                                    {opened_at && <span className="text-xs bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Eye className="w-3 h-3" />Opened{open_count > 1 ? ` (${open_count}x)` : ''}</span>}
                                    {clicked_at && <span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-0.5"><MousePointer className="w-3 h-3" />Clicked{click_count > 1 ? ` (${click_count}x)` : ''}</span>}
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                  {msg.email_cc_recipients?.length > 0 && <div className="mt-2 pt-2 border-t border-slate-700/50"><p className="text-xs text-slate-500 mb-1">CC: {msg.email_cc_recipients.join(', ')}</p></div>}
                </>
              )}
            </div>
          </div>
          {msg.email_body && <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Message</p><div className="bg-slate-900/50 rounded-lg p-3 text-sm text-slate-300 whitespace-pre-wrap max-h-40 overflow-y-auto">{msg.email_body}</div></div>}
        </div>
      )}
    </div>
  );
}

export default function UsersView(props: UsersViewProps) {
  const p = props;
  const f = p.userEditForm;
  const setF = p.onUserEditFormChange;

  const filteredUsers = p.allUsers.filter((user) => {
    if (p.userProfile?.role !== 'master') {
      if (user.is_active === false) return false;
      if ((p.effectiveRole === 'owner' || p.effectiveRole === 'manager') && p.effectiveYacht?.id) {
        if (user.yacht_id !== p.effectiveYacht.id) return false;
      }
    }
    if (!p.userSearchTerm) return true;
    const s = p.userSearchTerm.toLowerCase();
    return user.first_name?.toLowerCase().includes(s) || user.last_name?.toLowerCase().includes(s) || user.email?.toLowerCase().includes(s) || user.role?.toLowerCase().includes(s);
  });

  const staffUsers = filteredUsers.filter(u => u.is_active !== false && (u.role === 'mechanic' || u.role === 'staff' || u.role === 'master'));
  const deactivatedUsers = p.allUsers.filter(u => {
    if (u.is_active !== false) return false;
    if (p.userSearchTerm) { const s = p.userSearchTerm.toLowerCase(); return u.first_name?.toLowerCase().includes(s) || u.last_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s) || u.role?.toLowerCase().includes(s); }
    return true;
  });
  const yachtAssignedUsers = filteredUsers.filter(u => u.yacht_id && u.is_active !== false && (u.role === 'owner' || u.role === 'manager'));

  const yachtGroups: { [key: string]: typeof yachtAssignedUsers } = {};
  p.allYachts.filter(y => y.is_active !== false).forEach(y => { yachtGroups[y.name] = []; });
  yachtAssignedUsers.forEach(u => { const yn = u.yachts?.name || 'Unassigned'; if (yachtGroups[yn] !== undefined) yachtGroups[yn].push(u); });

  const hasResults = filteredUsers.length > 0 || Object.keys(yachtGroups).length > 0;

  const handlePrint = () => {
    let filtered = p.userProfile?.role === 'master' ? p.allUsers : p.allUsers.filter(u => u.is_active !== false);
    if (p.isStaffRole(p.effectiveRole) || p.isMasterRole(p.effectiveRole)) {
      if (p.printYachtFilter !== 'all') filtered = filtered.filter(u => u.yacht_id === p.printYachtFilter);
    } else if ((p.effectiveRole === 'owner' || p.effectiveRole === 'manager') && p.effectiveYacht?.id) {
      filtered = filtered.filter(u => u.yacht_id === p.effectiveYacht.id);
    }
    if (filtered.length === 0) { alert('No users to print.'); return; }
    const usersWithYachts = filtered.map(u => ({ ...u, yachts: p.allYachts.find(y => y.id === u.yacht_id) }));
    let title = 'User List';
    if (p.isStaffRole(p.effectiveRole) || p.isMasterRole(p.effectiveRole)) {
      if (p.printYachtFilter !== 'all') { const yn = p.allYachts.find(y => y.id === p.printYachtFilter)?.name; title = yn ? `${yn} - User List` : 'User List'; }
      else title = 'All Yachts - User List';
    } else if ((p.effectiveRole === 'owner' || p.effectiveRole === 'manager') && p.effectiveYacht?.id) {
      const yn = p.allYachts.find(y => y.id === p.effectiveYacht.id)?.name; title = yn ? `${yn} - User List` : 'User List';
    }
    p.onPrintUsers(usersWithYachts, title);
  };

  const handleAddNew = () => {
    p.onSelectedUserChange(null);
    p.onUserEditFormChange({
      first_name: '', last_name: '', email: '', password: '', trip_number: '', role: 'owner',
      employee_type: 'hourly', yacht_id: (p.effectiveRole === 'manager' && p.effectiveYacht?.id) ? p.effectiveYacht.id : '',
      phone: '', secondary_phone: '', secondary_email: '', street: '', city: '', state: '', zip_code: '',
      email_notifications_enabled: true, sms_notifications_enabled: false, notification_email: '', notification_phone: '',
      can_approve_repairs: false, can_approve_billing: false, sms_consent_given: false, sms_consent_method: 'web_form',
    });
    p.onIsCreatingNewUserChange(true);
    p.onSelectedUserGroupChange(null);
    p.onClearUserMessages();
  };

  const renderEditForm = () => (
    <div className="bg-slate-700/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">{p.isCreatingNewUser ? 'Add New User' : 'Edit User Profile'}</h3>
        <button onClick={() => { p.onSelectedUserChange(null); p.onIsCreatingNewUserChange(false); p.onSelectedUserGroupChange(null); p.onClearUserMessages(); }} className="text-slate-400 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
      </div>
      {p.userError && <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">{p.userError}</div>}
      {p.userSuccess && <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">{p.userSuccess}</div>}
      <form onSubmit={p.onUserUpdate} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium text-slate-300 mb-2">First Name</label><input type="text" value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} className={inputCls} required /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label><input type="text" value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} className={inputCls} required /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputCls} required /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Secondary CC Email (optional)</label><input type="email" value={f.secondary_email} onChange={(e) => setF({ ...f, secondary_email: e.target.value })} placeholder="CC recipient for email notifications" className={inputCls} /><p className="text-xs text-slate-500 mt-1">This email will receive a copy (CC) of all notifications sent to the user</p></div>
          {p.isCreatingNewUser && (
            <div><label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input type={p.showPassword ? "text" : "password"} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className="w-full px-4 py-3 pr-12 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent" required minLength={6} placeholder="Minimum 6 characters" />
                <button type="button" onClick={p.onShowPasswordToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors">{p.showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
              </div>
            </div>
          )}
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Phone</label><input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: p.formatPhoneNumber(e.target.value) })} placeholder="123-456-7890" className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Secondary Phone</label><input type="tel" value={f.secondary_phone} onChange={(e) => setF({ ...f, secondary_phone: p.formatPhoneNumber(e.target.value) })} placeholder="123-456-7890" className={inputCls} /></div>
          <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-300 mb-2">Street Address</label><input type="text" value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">City</label><input type="text" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={inputCls} /></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">State</label><select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} className={inputCls}><option value="">Select State</option>{US_STATES.map(s => <option key={s} value={s}>{STATE_NAMES[s]}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">ZIP Code</label><input type="text" value={f.zip_code} onChange={(e) => setF({ ...f, zip_code: e.target.value })} className={inputCls} /></div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
            {p.effectiveRole === 'manager' && p.selectedUser && p.selectedUser.role !== 'owner' ? (
              <><input type="text" value={f.role.charAt(0).toUpperCase() + f.role.slice(1)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400" disabled /><p className="text-xs text-slate-500 mt-1">Only staff can edit this user type</p></>
            ) : (
              <><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inputCls} required><option value="owner">Owner</option>{p.canAccessAllYachts(p.effectiveRole) && (<><option value="manager">Manager</option><option value="staff">Staff</option><option value="mechanic">Mechanic</option>{p.isMasterRole(p.effectiveRole) && <option value="master">Master</option>}</>)}</select>{p.effectiveRole === 'manager' && <p className="text-xs text-slate-500 mt-1">You can only create yacht owners</p>}</>
            )}
          </div>
          {(f.role === 'staff' || f.role === 'mechanic' || f.role === 'master') && (
            <>
              <div><label className="block text-sm font-medium text-slate-300 mb-2">Employee Type</label><select value={f.employee_type} onChange={(e) => setF({ ...f, employee_type: e.target.value })} className={inputCls} required><option value="hourly">Hourly</option><option value="salary">Salary</option></select><p className="text-xs text-slate-500 mt-1">{f.employee_type === 'hourly' ? 'Hourly employees track lunch breaks separately' : 'Salary employees auto-deduct 1 hour for lunch'}</p></div>
              <div><label className="block text-sm font-medium text-slate-300 mb-2">Rate of Pay ($/hr)</label><input type="number" min="0" step="0.01" value={f.rate_of_pay || ''} onChange={(e) => setF({ ...f, rate_of_pay: e.target.value })} placeholder="e.g., 25.00" className={inputCls} /></div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Assigned Yacht</label>
            {p.effectiveRole === 'manager' ? (
              <><input type="text" value={p.allYachts.find(y => y.id === (f.yacht_id || p.effectiveYacht?.id))?.name || 'No Yacht Assigned'} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-400" disabled /><p className="text-xs text-slate-500 mt-1">You can only manage users for your assigned yacht</p></>
            ) : (
              <select value={f.yacht_id} onChange={(e) => setF({ ...f, yacht_id: e.target.value })} className={inputCls}><option value="">No Yacht Assigned</option>{p.allYachts.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}</select>
            )}
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Trip Number</label><input type="text" value={f.trip_number} onChange={(e) => setF({ ...f, trip_number: e.target.value })} placeholder="e.g., T1, T2, Trip 1" className={inputCls} /><p className="text-xs text-slate-500 mt-1">Optional field to track owner trip sequence</p></div>
        </div>

        {f.role === 'manager' && (
          <div className="mt-6 p-6 bg-slate-900/50 rounded-xl border border-slate-600">
            <h4 className="text-lg font-bold mb-4 text-amber-400">Manager Permissions</h4>
            <p className="text-sm text-slate-400 mb-4">Specify what this manager can approve</p>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={f.can_approve_repairs} onChange={(e) => setF({ ...f, can_approve_repairs: e.target.checked })} className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-2 focus:ring-amber-500" /><div><span className="text-slate-300 font-medium">Repair Approval</span><p className="text-xs text-slate-500 mt-0.5">This manager can approve repair requests</p></div></label>
              <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={f.can_approve_billing} onChange={(e) => setF({ ...f, can_approve_billing: e.target.checked })} className="w-5 h-5 rounded border-slate-600 text-amber-500 focus:ring-2 focus:ring-amber-500" /><div><span className="text-slate-300 font-medium">Accounting/Billing Approval</span><p className="text-xs text-slate-500 mt-0.5">This manager can approve invoices and billing</p></div></label>
            </div>
          </div>
        )}

        {(f.role === 'staff' || f.role === 'manager' || f.role === 'mechanic' || f.role === 'master') && (
          <div className="mt-6 p-6 bg-slate-900/50 rounded-xl border border-slate-600">
            <h4 className="text-lg font-bold mb-4 text-blue-400">Notification Settings</h4>
            <p className="text-sm text-slate-400 mb-4">Configure how this user receives notifications and time clock reminders</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={f.email_notifications_enabled} onChange={(e) => setF({ ...f, email_notifications_enabled: e.target.checked })} className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500" /><span className="text-slate-300 font-medium">Enable Email Notifications</span></label></div>
              {f.email_notifications_enabled && <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-300 mb-2">Notification Email (optional)</label><input type="email" value={f.notification_email} onChange={(e) => setF({ ...f, notification_email: e.target.value })} placeholder="Leave blank to use primary email" className={inputCls} /><p className="text-xs text-slate-500 mt-1">If left blank, notifications will be sent to the primary email address</p></div>}
              <div className="md:col-span-2"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={f.sms_notifications_enabled} onChange={(e) => setF({ ...f, sms_notifications_enabled: e.target.checked })} className="w-5 h-5 rounded border-slate-600 text-blue-500 focus:ring-2 focus:ring-blue-500" /><span className="text-slate-300 font-medium">Enable SMS Notifications</span></label></div>
              {f.sms_notifications_enabled && (
                <>
                  <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-300 mb-2">SMS Phone Number (optional)</label><input type="tel" value={f.notification_phone} onChange={(e) => setF({ ...f, notification_phone: p.formatPhoneNumber(e.target.value) })} placeholder="123-456-7890" className={inputCls} /><p className="text-xs text-slate-500 mt-1">If left blank, SMS will be sent to the primary phone number.</p></div>
                  <div className="md:col-span-2 bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-amber-300 mb-3">SMS Consent Required</h4>
                    <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" checked={f.sms_consent_given} onChange={(e) => setF({ ...f, sms_consent_given: e.target.checked, sms_consent_method: 'web_form' })} className="w-5 h-5 mt-0.5 rounded border-amber-600 text-amber-500 focus:ring-2 focus:ring-amber-500" /><div className="flex-1"><p className="text-slate-200 text-sm leading-relaxed">I consent to receive SMS text message reminders for my scheduled work shifts. Message frequency varies (up to 2 per workday). Message and data rates may apply. Reply STOP to opt out at any time. Consent is not required as a condition of employment.</p></div></label>
                    {!f.sms_consent_given && <p className="text-xs text-amber-400 mt-3 font-medium">SMS consent must be given before text messages can be sent (TCPA compliance).</p>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!p.isCreatingNewUser && p.userProfile?.role === 'master' && p.selectedUser && (
          <div className="mt-6 border border-slate-600 rounded-lg overflow-hidden">
            <button type="button" onClick={p.onShowResetPasswordToggle} className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/50 hover:bg-slate-700 text-left transition-colors"><span className="text-sm font-semibold text-amber-400">Reset User Password</span><span className="text-xs text-slate-400">{p.showResetPassword ? 'Hide' : 'Set a new password for this user'}</span></button>
            {p.showResetPassword && (
              <div className="p-4 bg-slate-800/50">
                <p className="text-xs text-slate-400 mb-3">The user will be required to change this password the next time they log in.</p>
                <form onSubmit={p.onResetUserPassword} className="flex gap-3">
                  <div className="relative flex-1"><input type={p.showResetPassword ? 'text' : 'password'} value={p.resetPasswordValue} onChange={(e) => p.onResetPasswordValueChange(e.target.value)} placeholder="New password (min. 6 characters)" className="w-full px-4 py-2.5 pr-10 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm text-white placeholder:text-slate-400" minLength={6} required /></div>
                  <button type="submit" disabled={p.resetPasswordLoading || !p.resetPasswordValue} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap">{p.resetPasswordLoading ? 'Resetting...' : 'Set Password'}</button>
                </form>
                {p.resetPasswordError && <p className="text-red-400 text-xs mt-2">{p.resetPasswordError}</p>}
              </div>
            )}
            {p.resetPasswordSuccess && <div className="px-4 py-3 bg-green-900/30 border-t border-green-700/50"><p className="text-green-400 text-xs">{p.resetPasswordSuccess}</p></div>}
          </div>
        )}

        <div className="flex gap-4 mt-6">
          <button type="submit" disabled={p.userLoading} className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {p.userLoading ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>{p.isCreatingNewUser ? 'Creating...' : 'Saving...'}</>) : (<><Save className="w-5 h-5" />{p.isCreatingNewUser ? 'Create User' : 'Save Changes'}</>)}
          </button>
          <button type="button" onClick={() => { p.onSelectedUserChange(null); p.onIsCreatingNewUserChange(false); p.onSelectedUserGroupChange(null); p.onClearUserMessages(); }} className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors">Cancel</button>
        </div>
      </form>
    </div>
  );

  const renderUserCard = (user: UserProfile) => (
    <div key={user.user_id} className="bg-slate-700/30 rounded-xl p-6 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="text-lg font-bold mb-1">{user.first_name} {user.last_name}</h4>
          <p className="text-slate-400 text-sm mb-2">{user.email}</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium">{user.role}</span>
            {user.trip_number && <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-xs font-medium">Trip #{user.trip_number}</span>}
            {user.phone && <span className="px-3 py-1 bg-slate-600 text-slate-300 rounded-full text-xs">{user.phone}</span>}
            {user.secondary_phone && <span className="px-3 py-1 bg-slate-600 text-slate-300 rounded-full text-xs">{user.secondary_phone}</span>}
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500">
            {user.last_sign_in_at && <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-green-500" /><span>Last sign in: {new Date(user.last_sign_in_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span></div>}
            {user.last_sign_out_at && <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-orange-500" /><span>Last sign out: {new Date(user.last_sign_out_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span></div>}
            {!user.last_sign_in_at && !user.last_sign_out_at && <div className="flex items-center gap-2"><Clock className="w-3 h-3 text-slate-600" /><span>Never signed in</span></div>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 ml-4 justify-end">
          {p.effectiveRole === 'master' && user.role === 'owner' && user.yacht_id && <button onClick={() => p.onTransferClick(user, p.selectedUserGroup || '')} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"><ArrowLeftRight className="w-4 h-4" />Transfer</button>}
          <button onClick={() => p.onUserEdit(user)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"><Edit2 className="w-4 h-4" />Edit</button>
          {p.selectedUserGroup === 'Deactivated' ? <button onClick={() => p.onUserReactivate(user)} className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"><UserCheck className="w-4 h-4" />Reactivate</button> : <button onClick={() => p.onUserDelete(user)} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"><UserX className="w-4 h-4" />Deactivate</button>}
        </div>
      </div>
    </div>
  );

  const renderGroupDetail = () => {
    let groupUsers = p.selectedUserGroup === 'Staff' ? staffUsers : p.selectedUserGroup === 'Deactivated' ? deactivatedUsers : yachtGroups[p.selectedUserGroup!] || [];
    groupUsers = [...groupUsers].sort((a, b) => {
      if (a.trip_number && b.trip_number) return Number(a.trip_number) - Number(b.trip_number);
      if (a.trip_number && !b.trip_number) return -1;
      if (!a.trip_number && b.trip_number) return 1;
      return `${a.first_name} ${a.last_name}`.toLowerCase().localeCompare(`${b.first_name} ${b.last_name}`.toLowerCase());
    });

    if (p.selectedUserGroup === 'Broadcast Emails') {
      const broadcastEmails = p.staffMessages.filter(m => m.notification_type === 'bulk_email' && m.yacht_name === 'All Active Yachts');
      return (
        <div>
          <button onClick={() => p.onSelectedUserGroupChange(null)} className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors mb-6"><span>← Back to Groups</span></button>
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-b border-slate-700 px-6 py-4 flex items-center gap-3"><Mail className="w-6 h-6 text-orange-400" /><h3 className="text-xl font-bold text-white">Broadcast Emails</h3><span className="ml-auto px-3 py-1 bg-orange-500/30 text-orange-300 rounded-full text-sm font-medium">{broadcastEmails.length} sent</span></div>
            <div className="p-6">
              {broadcastEmails.length === 0 ? <p className="text-slate-400 text-center py-8">No broadcast emails sent yet.</p> : <div className="space-y-3">{broadcastEmails.map(msg => <EmailExpandable key={msg.id} msg={msg} isExpanded={p.expandedEmailId === msg.id} onToggle={() => { const next = p.expandedEmailId === msg.id ? null : msg.id; p.onExpandedEmailIdChange(next); if (next) p.onFetchRecipientTracking(next); }} recipientTracking={p.recipientTrackingMap[msg.id] || []} />)}</div>}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <button onClick={() => p.onSelectedUserGroupChange(null)} className="flex items-center gap-2 text-slate-400 hover:text-blue-500 transition-colors mb-6"><span>← Back to Groups</span></button>
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden mb-6">
          <div className={`${p.selectedUserGroup === 'Staff' ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20' : p.selectedUserGroup === 'Deactivated' ? 'bg-gradient-to-r from-red-500/20 to-rose-500/20' : 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20'} border-b border-slate-700 px-6 py-4`}>
            <div className="flex items-center gap-3">
              {p.selectedUserGroup === 'Staff' ? <Users className="w-6 h-6 text-blue-400" /> : p.selectedUserGroup === 'Deactivated' ? <UserX className="w-6 h-6 text-red-400" /> : <Ship className="w-6 h-6 text-teal-400" />}
              <h3 className="text-xl font-bold text-white">{p.selectedUserGroup}</h3>
              <span className={`ml-auto px-3 py-1 ${p.selectedUserGroup === 'Staff' ? 'bg-blue-500/30 text-blue-300' : p.selectedUserGroup === 'Deactivated' ? 'bg-red-500/30 text-red-300' : 'bg-teal-500/30 text-teal-300'} rounded-full text-sm font-medium`}>{groupUsers.length} {groupUsers.length === 1 ? 'member' : 'members'}</span>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          {groupUsers.length === 0 && p.selectedUserGroup !== 'Staff' && <div className="text-center py-8 text-slate-500 text-sm">No members assigned yet.</div>}
          {groupUsers.map(renderUserCard)}
        </div>

        {p.selectedUserGroup !== 'Staff' && (() => {
          const selectedYachtObj = p.allYachts.find(y => y.name === p.selectedUserGroup);
          const partners = selectedYachtObj ? (p.yachtPartners[selectedYachtObj.id] || []) : [];
          if (partners.length === 0) return null;
          return (
            <div className="mt-8">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users className="w-5 h-5 text-teal-400" />Partner Schedule</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full text-sm">
                  <thead><tr className="bg-slate-700/60 text-slate-300 text-xs uppercase tracking-wider"><th className="px-4 py-3 text-left font-semibold">Partner</th><th className="px-4 py-3 text-left font-semibold">Week</th><th className="px-4 py-3 text-left font-semibold">Phone</th><th className="px-4 py-3 text-left font-semibold">Email</th></tr></thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {partners.map((pt: any) => (
                      <tr key={pt.id} className={`${pt.partner_name === 'Available' ? 'bg-emerald-500/10' : 'bg-slate-800/30'} hover:bg-slate-700/30 transition-colors`}>
                        <td className="px-4 py-3 font-medium text-white">{pt.partner_name === 'Available' ? <span className="text-emerald-400">{pt.partner_name}</span> : pt.partner_name}</td>
                        <td className="px-4 py-3 text-slate-300">{pt.week_label}</td>
                        <td className="px-4 py-3 text-slate-300">{pt.phone || '—'}</td>
                        <td className="px-4 py-3">{pt.email ? <a href={`mailto:${pt.email}`} className="text-blue-400 hover:text-blue-300 transition-colors">{pt.email}</a> : <span className="text-slate-600">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {p.selectedUserGroup !== 'Staff' && (() => {
          const groupEmails = p.staffMessages.filter(m => m.notification_type === 'bulk_email' && m.yacht_name === p.selectedUserGroup);
          if (groupEmails.length === 0) return null;
          return (
            <div className="mt-8">
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Mail className="w-5 h-5 text-blue-400" />Email History ({groupEmails.length})</h4>
              <div className="space-y-3">{groupEmails.map(msg => <EmailExpandable key={msg.id} msg={msg} isExpanded={p.expandedEmailId === msg.id} onToggle={() => { const next = p.expandedEmailId === msg.id ? null : msg.id; p.onExpandedEmailIdChange(next); if (next) p.onFetchRecipientTracking(next); }} recipientTracking={p.recipientTrackingMap[msg.id] || []} />)}</div>
            </div>
          );
        })()}
      </div>
    );
  };

  const renderGroupsGrid = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {staffUsers.length > 0 && p.effectiveRole !== 'manager' && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-blue-500 transition-all duration-300 hover:scale-105 group">
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border-b border-slate-700 px-6 py-4"><div className="flex items-center gap-3"><Users className="w-6 h-6 text-blue-400" /><h3 className="text-xl font-bold text-white">Staff</h3></div><p className="text-slate-400 text-sm mt-2">{staffUsers.length} {staffUsers.length === 1 ? 'member' : 'members'}</p></div>
          <div className="p-6"><button onClick={() => p.onSelectedUserGroupChange('Staff')} className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">Access <Users className="w-4 h-4" /></button></div>
        </div>
      )}
      {Object.entries(yachtGroups).sort(([a], [b]) => a.localeCompare(b)).map(([yachtName, users]) => (
        <div key={yachtName} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-teal-500 transition-all duration-300 hover:scale-105 group">
          <div className="bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border-b border-slate-700 px-6 py-4"><div className="flex items-center gap-3"><Ship className="w-6 h-6 text-teal-400" /><h3 className="text-xl font-bold text-white">{yachtName}</h3></div><p className="text-slate-400 text-sm mt-2">{users.length} {users.length === 1 ? 'member' : 'members'}</p></div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => p.onSelectedUserGroupChange(yachtName)} className="px-6 py-3 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">Access <Ship className="w-4 h-4" /></button>
              <button onClick={() => p.onEmailGroup(yachtName, users)} className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">Email All <Mail className="w-4 h-4" /></button>
              <button onClick={() => p.onEmailManagementTeam(yachtName, users)} className="col-span-2 px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"><Mail className="w-4 h-4" />Email Management Team</button>
              <button onClick={() => p.onSendIntroVideo(yachtName, users)} className="col-span-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"><Mail className="w-4 h-4" />Send Intro Video</button>
            </div>
          </div>
        </div>
      ))}
      {deactivatedUsers.length > 0 && p.effectiveRole !== 'manager' && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-red-500 transition-all duration-300 hover:scale-105 group">
          <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 border-b border-slate-700 px-6 py-4"><div className="flex items-center gap-3"><UserX className="w-6 h-6 text-red-400" /><h3 className="text-xl font-bold text-white">Deactivated</h3></div><p className="text-slate-400 text-sm mt-2">{deactivatedUsers.length} {deactivatedUsers.length === 1 ? 'user' : 'users'}</p></div>
          <div className="p-6"><button onClick={() => p.onSelectedUserGroupChange('Deactivated')} className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">View <UserX className="w-4 h-4" /></button></div>
        </div>
      )}
      {p.canAccessAllYachts(p.effectiveRole) && !p.userSearchTerm && (() => {
        const broadcastCount = p.staffMessages.filter(m => m.notification_type === 'bulk_email' && m.yacht_name === 'All Active Yachts').length;
        return (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden hover:border-orange-500 transition-all duration-300 hover:scale-105 group">
            <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-b border-slate-700 px-6 py-4"><div className="flex items-center gap-3"><Mail className="w-6 h-6 text-orange-400" /><h3 className="text-xl font-bold text-white">Broadcast Emails</h3></div><p className="text-slate-400 text-sm mt-2">{broadcastCount} broadcast{broadcastCount !== 1 ? 's' : ''} sent to all yachts</p></div>
            <div className="p-6"><button onClick={() => p.onSelectedUserGroupChange('Broadcast Emails')} className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">View History <Mail className="w-4 h-4" /></button></div>
          </div>
        );
      })()}
    </div>
  );

  return (
    <>
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-500" />
              <div><h2 className="text-2xl font-bold">User Management</h2><p className="text-slate-400">View and edit user profiles</p></div>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              {p.canAccessAllYachts(p.effectiveRole) && (
                <>
                  <button onClick={p.onEmailAllManagers} className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm"><Mail className="w-4 h-4" />Email All Managers</button>
                  <button onClick={p.onEmailAllOwnersAndManagers} className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition-colors text-sm"><Mail className="w-4 h-4" />Email All Owners & Managers</button>
                </>
              )}
              {p.isStaffRole(p.effectiveRole) && (
                <select value={p.printYachtFilter} onChange={(e) => p.onPrintYachtFilterChange(e.target.value)} className="px-4 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="all">All Yachts</option>
                  {p.allYachts.filter(y => y.is_active !== false).map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              )}
              <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"><Printer className="w-4 h-4" />Print Users</button>
              <button onClick={handleAddNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"><Users className="w-4 h-4" />Add New User</button>
            </div>
          </div>
          <div className="mt-4">
            <input type="text" placeholder="Search by name, email, or role..." value={p.userSearchTerm} onChange={(e) => p.onUserSearchTermChange(e.target.value)} className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400" />
          </div>
        </div>
        <div className="p-6">
          {(p.selectedUser || p.isCreatingNewUser) ? renderEditForm() : (
            <div>
              {p.selectedUserGroup ? renderGroupDetail() : (hasResults ? renderGroupsGrid() : (
                <div className="text-center py-12"><Users className="w-16 h-16 text-slate-600 mx-auto mb-4" /><p className="text-slate-400">No users found matching your search.</p></div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
