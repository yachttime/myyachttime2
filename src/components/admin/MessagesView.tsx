import { Mail, MessageCircle, Ship, RefreshCw, ClipboardCheck, UserCheck, CheckCircle, Eye, MousePointer, AlertCircle } from 'lucide-react';
import { UserRole, isStaffRole, isMasterRole } from '../../lib/supabase';

interface AdminNotification {
  id: string;
  message: string;
  created_at: string;
  yacht_id: string | null;
  notification_type: string;
  reference_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_profile?: { first_name: string | null; last_name: string | null } | null;
  yachts?: { name: string } | null;
  user_profiles?: { first_name: string | null; last_name: string | null; email?: string | null } | null;
}

interface StaffMessage {
  id: string;
  message: string;
  created_at: string;
  notification_type: string;
  yacht_name?: string | null;
  email_subject?: string | null;
  email_body?: string | null;
  email_recipients?: any[];
  email_sent_at?: string | null;
  email_delivered_at?: string | null;
  email_opened_at?: string | null;
  email_open_count?: number;
  email_clicked_at?: string | null;
  email_click_count?: number;
  email_bounced_at?: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completed_by_profile?: { first_name: string | null; last_name: string | null } | null;
  user_profiles?: { first_name: string | null; last_name: string | null; email?: string | null } | null;
}

interface MessagesViewProps {
  effectiveRole: UserRole;
  userProfileRole?: string;
  adminNotifications: AdminNotification[];
  staffMessages: StaffMessage[];
  messagesTab: 'yacht' | 'staff';
  onTabChange: (tab: 'yacht' | 'staff') => void;
  selectedMessagesYachtId: string | null;
  onSelectYacht: (id: string | null) => void;
  onEmailOwners: (yachtId: string, yacht: any) => void;
  onReviewInspection: (id: string) => void;
  loadingReviewId: string | null;
  onViewInspectionPDF: (id: string) => void;
  loadingPdfId: string | null;
  onViewOwnerHandoffPDF: (id: string) => void;
}

export default function MessagesView({
  effectiveRole, userProfileRole, adminNotifications, staffMessages,
  messagesTab, onTabChange, selectedMessagesYachtId, onSelectYacht,
  onEmailOwners, onReviewInspection, loadingReviewId, onViewInspectionPDF, loadingPdfId, onViewOwnerHandoffPDF,
}: MessagesViewProps) {
  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <Mail className="w-8 h-8 text-cyan-500" />
        <div>
          <h2 className="text-2xl font-bold">New Messages</h2>
          <p className="text-slate-400">View all incoming messages and appointments</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => onTabChange('yacht')}
          className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
            messagesTab === 'yacht' ? 'bg-cyan-500 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
          }`}
        >
          Yacht Messages
        </button>
        {isStaffRole(userProfileRole) && (
          <button
            onClick={() => onTabChange('staff')}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold transition-all duration-300 ${
              messagesTab === 'staff' ? 'bg-cyan-500 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700'
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
                if (!acc[yachtId]) acc[yachtId] = { yacht: msg.yachts, messages: [] };
                acc[yachtId].messages.push(msg);
                return acc;
              }, {});
              const selectedData = messagesByYacht[selectedMessagesYachtId];

              return (
                <>
                  <button onClick={() => onSelectYacht(null)} className="flex items-center gap-2 text-slate-400 hover:text-cyan-500 transition-colors mb-4">
                    <span>← Back to All Yachts</span>
                  </button>
                  <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                    <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Ship className="w-6 h-6 text-cyan-500" />
                          <h3 className="text-xl font-bold">{selectedData?.yacht?.name || 'Customer Pay Boats'}</h3>
                          <span className="text-sm text-slate-400">{selectedData?.messages.length} {selectedData?.messages.length === 1 ? 'message' : 'messages'}</span>
                        </div>
                        {selectedMessagesYachtId !== 'unknown' && (
                          <button onClick={() => onEmailOwners(selectedMessagesYachtId, selectedData?.yacht)} className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300">
                            <Mail className="w-4 h-4" />Email Owners & Managers
                          </button>
                        )}
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
                            ? `${msg.user_profiles.first_name} ${msg.user_profiles.last_name}` : 'Unknown User';
                          const isCompleted = msg.completed_at && msg.completed_by;
                          return (
                            <div key={msg.id} className={`bg-slate-900/50 rounded-xl p-4 border border-slate-700 hover:border-cyan-500 transition-all duration-300 ${isCompleted ? 'opacity-50' : ''}`}>
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="bg-cyan-500/20 p-2 rounded-lg"><MessageCircle className="w-4 h-4 text-cyan-500" /></div>
                                  <div><h4 className="font-semibold">{senderName}</h4></div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleDateString()}</p>
                                  <p className="text-xs text-slate-500">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                              </div>
                              <div className="bg-slate-800/50 rounded-lg p-3"><p className="text-slate-200 text-sm whitespace-pre-wrap break-words">{msg.message}</p></div>
                              {msg.notification_type === 'trip_inspection' && msg.reference_id && (
                                <div className="mt-3 flex flex-col gap-2">
                                  {(isStaffRole(effectiveRole) || isMasterRole(effectiveRole)) && (
                                    <button onClick={() => onReviewInspection(msg.reference_id)} disabled={loadingReviewId === msg.reference_id} className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm">
                                      {loadingReviewId === msg.reference_id ? (<><RefreshCw className="w-4 h-4 animate-spin" />Loading...</>) : (<><ClipboardCheck className="w-4 h-4" />Review Inspection</>)}
                                    </button>
                                  )}
                                  <button onClick={() => onViewInspectionPDF(msg.reference_id)} disabled={loadingPdfId === msg.reference_id} className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm">
                                    {loadingPdfId === msg.reference_id ? (
                                      <><svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading Report...</>
                                    ) : (<><ClipboardCheck className="w-4 h-4" />View Inspection Report</>)}
                                  </button>
                                </div>
                              )}
                              {msg.notification_type === 'owner_handoff' && msg.reference_id && (
                                <div className="mt-3">
                                  <button onClick={() => onViewOwnerHandoffPDF(msg.reference_id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 text-sm">
                                    <UserCheck className="w-4 h-4" />View Owner Handoff Report
                                  </button>
                                </div>
                              )}
                              {isCompleted && (
                                <div className="mt-3 text-center text-xs bg-green-500/10 border border-green-500/20 rounded-lg py-2 px-3">
                                  <span className="text-green-400 font-semibold">✓ Task Complete</span>
                                  <span className="text-slate-400"> on {new Date(msg.completed_at).toLocaleDateString()} at {new Date(msg.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  {msg.completed_by_profile && (<span className="text-slate-400"> by {msg.completed_by_profile.first_name} {msg.completed_by_profile.last_name}</span>)}
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
                if (!acc[yachtId]) acc[yachtId] = { yacht: msg.yachts, messages: [] };
                acc[yachtId].messages.push(msg);
                return acc;
              }, {});
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(messagesByYacht).map(([yachtId, data]: [string, any]) => {
                    const incompleteMessages = data.messages.filter((msg: any) => !msg.completed_at || !msg.completed_by).length;
                    return (
                      <button key={yachtId} onClick={() => onSelectYacht(yachtId)} className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-cyan-500 transition-all duration-300 hover:scale-105 text-left group">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-cyan-500/20 p-4 rounded-xl group-hover:bg-cyan-500/30 transition-colors"><Ship className="w-8 h-8 text-cyan-500" /></div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">{data.yacht?.name || 'Customer Pay Boats'}</h3>
                        <p className="text-slate-400 text-sm">{incompleteMessages} {incompleteMessages === 1 ? 'message' : 'messages'} pending</p>
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
                ? `${msg.user_profiles.first_name} ${msg.user_profiles.last_name}` : msg.user_profiles?.email || 'Unknown User';
              const isBulkEmail = msg.notification_type === 'bulk_email';
              return (
                <div key={msg.id} className={`bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-cyan-500 transition-all duration-300 ${isCompleted ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`${isCompleted ? 'bg-slate-500/20' : isBulkEmail ? 'bg-blue-500/20' : 'bg-cyan-500/20'} p-3 rounded-xl`}>
                        {isBulkEmail ? <Mail className={`w-5 h-5 ${isCompleted ? 'text-slate-500' : 'text-blue-500'}`} /> : <MessageCircle className={`w-5 h-5 ${isCompleted ? 'text-slate-500' : 'text-cyan-500'}`} />}
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg">{senderName}</h4>
                        <p className="text-xs text-slate-400">{isBulkEmail ? 'Bulk Email' : msg.notification_type}</p>
                        {msg.yacht_name && (<p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Ship className="w-3 h-3" />{msg.yacht_name}</p>)}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-300">{new Date(msg.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-slate-500">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  {isBulkEmail && msg.email_subject ? (
                    <div className="space-y-3">
                      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700"><p className="text-xs text-slate-400 mb-1">Subject:</p><p className="text-slate-200 font-semibold">{msg.email_subject}</p></div>
                      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700"><p className="text-xs text-slate-400 mb-2">Message:</p><p className="text-slate-200 whitespace-pre-wrap break-words">{msg.email_body}</p></div>
                      {msg.email_recipients && msg.email_recipients.length > 0 && (
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                          <p className="text-xs text-slate-400 mb-2">Recipients ({msg.email_recipients.length}):</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.email_recipients.slice(0, 5).map((recipient: any, idx: number) => (<span key={idx} className="text-xs bg-slate-700/50 px-2 py-1 rounded">{recipient.name}</span>))}
                            {msg.email_recipients.length > 5 && (<span className="text-xs text-slate-400">+{msg.email_recipients.length - 5} more</span>)}
                          </div>
                        </div>
                      )}
                      {msg.email_sent_at && (
                        <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 space-y-2">
                          <p className="text-xs text-slate-400 mb-2">Email Status:</p>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full">Sent</span>
                            {msg.email_delivered_at && (<span className="text-xs bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" />Delivered</span>)}
                            {msg.email_opened_at && (<span className="text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full flex items-center gap-1"><Eye className="w-3 h-3" />Opened {msg.email_open_count > 1 ? `(${msg.email_open_count}x)` : ''}</span>)}
                            {msg.email_clicked_at && (<span className="text-xs bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full flex items-center gap-1"><MousePointer className="w-3 h-3" />Clicked {msg.email_click_count > 1 ? `(${msg.email_click_count}x)` : ''}</span>)}
                            {msg.email_bounced_at && (<span className="text-xs bg-red-500/20 text-red-400 px-3 py-1 rounded-full flex items-center gap-1"><AlertCircle className="w-3 h-3" />Bounced</span>)}
                          </div>
                          <div className="text-xs text-slate-400 space-y-1 mt-3">
                            {msg.email_opened_at && (<div className="flex items-center gap-2"><Eye className="w-3 h-3" /><span>First opened: {new Date(msg.email_opened_at).toLocaleDateString()} at {new Date(msg.email_opened_at).toLocaleTimeString()}</span></div>)}
                            {msg.email_clicked_at && (<div className="flex items-center gap-2"><MousePointer className="w-3 h-3" /><span>First clicked: {new Date(msg.email_clicked_at).toLocaleDateString()} at {new Date(msg.email_clicked_at).toLocaleTimeString()}</span></div>)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700"><p className="text-slate-200 whitespace-pre-wrap break-words">{msg.message}</p></div>
                  )}
                  {isCompleted && (
                    <div className="mt-4 text-center text-xs bg-green-500/10 border border-green-500/20 rounded-lg py-2 px-3">
                      <span className="text-green-400 font-semibold">✓ Task Complete</span>
                      <span className="text-slate-400"> on {new Date(msg.completed_at).toLocaleDateString()} at {new Date(msg.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.completed_by_profile && (<span className="text-slate-400"> by {msg.completed_by_profile.first_name} {msg.completed_by_profile.last_name}</span>)}
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
                        <div className="bg-cyan-500/20 p-3 rounded-xl"><MessageCircle className="w-6 h-6 text-cyan-500" /></div>
                        <h3 className="text-xl font-bold">Unread Messages</h3>
                      </div>
                      {unreadMessages.length > 0 && (<span className="bg-cyan-500 text-white text-sm font-bold px-3 py-1 rounded-full">{unreadMessages.length}</span>)}
                    </div>
                  </div>
                  <div className="p-6">
                    {unreadMessages.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="bg-slate-700/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><ClipboardCheck className="w-8 h-8 text-slate-600" /></div>
                        <p className="text-slate-400 text-lg">All caught up!</p>
                        <p className="text-slate-500 text-sm mt-1">No unread messages</p>
                      </div>
                    ) : (<div className="space-y-4">{unreadMessages.map((msg: any) => renderMessage(msg, false))}</div>)}
                  </div>
                </div>
                <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
                  <div className="bg-gradient-to-r from-slate-600/10 to-slate-500/10 border-b border-slate-700 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-500/20 p-3 rounded-xl"><ClipboardCheck className="w-6 h-6 text-slate-500" /></div>
                        <h3 className="text-xl font-bold text-slate-300">Completed Messages</h3>
                      </div>
                      {completedMessages.length > 0 && (<span className="bg-slate-600 text-white text-sm font-bold px-3 py-1 rounded-full">{completedMessages.length}</span>)}
                    </div>
                  </div>
                  <div className="p-6">
                    {completedMessages.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="bg-slate-700/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><MessageCircle className="w-8 h-8 text-slate-600" /></div>
                        <p className="text-slate-400 text-lg">No completed messages yet</p>
                        <p className="text-slate-500 text-sm mt-1">Completed tasks will appear here</p>
                      </div>
                    ) : (<div className="space-y-4">{completedMessages.map((msg: any) => renderMessage(msg, true))}</div>)}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}
