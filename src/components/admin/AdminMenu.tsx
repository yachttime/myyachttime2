import { Calendar, Mail, CalendarPlus, Users, ClipboardCheck, UserCheck, FileUp, Wrench, MessageCircle, Ship, Lock, Building2 } from 'lucide-react';
import { isStaffRole, isMasterRole, isStaffOrManager, isOwnerRole, canManageYacht, canAccessAllYachts, UserRole } from '../../lib/supabase';

export type AdminViewType =
  | 'menu' | 'inspection' | 'yachts' | 'ownertrips' | 'repairs'
  | 'ownerchat' | 'messages' | 'mastercalendar' | 'ownerhandoff'
  | 'users' | 'appointments' | 'staffappointment' | 'smartdevices'
  | 'companies' | 'maintenancerequests';

interface AdminMenuProps {
  effectiveRole: UserRole;
  pendingInspectionCount: number;
  onNavigate: (view: AdminViewType) => void;
  onLoadMaintenanceRequests: () => void;
}

export default function AdminMenu({ effectiveRole, pendingInspectionCount, onNavigate, onLoadMaintenanceRequests }: AdminMenuProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <button
        onClick={() => onNavigate('mastercalendar')}
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
          onClick={() => onNavigate('messages')}
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
          onClick={() => onNavigate('appointments')}
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

      {canAccessAllYachts(effectiveRole) && (
        <button
          onClick={() => onNavigate('staffappointment')}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-blue-500/20 p-4 rounded-xl group-hover:bg-blue-500/30 transition-colors">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Staff Appointment</h3>
          <p className="text-slate-400 text-sm">Schedule meetings with staff or contacts</p>
        </button>
      )}

      {canManageYacht(effectiveRole) && (
        <button
          onClick={() => onNavigate('inspection')}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="bg-amber-500/20 p-4 rounded-xl group-hover:bg-amber-500/30 transition-colors">
              <ClipboardCheck className="w-8 h-8 text-amber-500" />
            </div>
            {(isStaffRole(effectiveRole) || isMasterRole(effectiveRole)) && pendingInspectionCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pendingInspectionCount} Pending</span>
            )}
          </div>
          <h3 className="text-xl font-bold mb-2">Trip Inspection Form</h3>
          <p className="text-slate-400 text-sm">Complete trip inspections for yacht trips</p>
        </button>
      )}

      {canManageYacht(effectiveRole) && (
        <button
          onClick={() => onNavigate('ownerhandoff')}
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
          onClick={() => onNavigate('repairs')}
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

      {isStaffOrManager(effectiveRole) && (
        <button
          onClick={() => { onLoadMaintenanceRequests(); onNavigate('maintenancerequests'); }}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-amber-500/20 p-4 rounded-xl group-hover:bg-amber-500/30 transition-colors">
              <Wrench className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Owner Maintenance Requests</h3>
          <p className="text-slate-400 text-sm">View maintenance requests submitted by yacht owners and managers</p>
        </button>
      )}

      {canManageYacht(effectiveRole) && (
        <button
          onClick={() => onNavigate('ownertrips')}
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
          onClick={() => onNavigate('ownerchat')}
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
          onClick={() => onNavigate('yachts')}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
        >
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="bg-blue-500/20 p-4 rounded-xl group-hover:bg-blue-500/30 transition-colors">
              <Ship className="w-8 h-8 text-blue-500" />
            </div>
            {(isStaffRole(effectiveRole) || isMasterRole(effectiveRole)) && pendingInspectionCount > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{pendingInspectionCount} Review{pendingInspectionCount > 1 ? 's' : ''} Pending</span>
            )}
          </div>
          <h3 className="text-xl font-bold mb-2">Yachts</h3>
          <p className="text-slate-400 text-sm">Manage yacht fleet and vessel information</p>
        </button>
      )}

      {isMasterRole(effectiveRole) && (
        <button
          onClick={() => onNavigate('smartdevices')}
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

      {isMasterRole(effectiveRole) && (
        <button
          onClick={() => onNavigate('companies')}
          className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-amber-500 transition-all duration-300 hover:scale-105 text-left group"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-amber-500/20 p-4 rounded-xl group-hover:bg-amber-500/30 transition-colors">
              <Building2 className="w-8 h-8 text-amber-500" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2">Company Management</h3>
          <p className="text-slate-400 text-sm">Manage companies and multi-tenant settings</p>
        </button>
      )}

      {canManageYacht(effectiveRole) && (
        <button
          onClick={() => onNavigate('users')}
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
  );
}
