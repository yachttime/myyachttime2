import { MessageCircle, Ship, Send } from 'lucide-react';
import { Yacht, UserProfile, UserRole, isOwnerRole, canAccessAllYachts } from '../../lib/supabase';

interface ChatMessage {
  id: string;
  message: string;
  created_at: string;
  yacht_id: string;
  user_id: string;
  user_profiles?: { first_name: string | null; last_name: string | null } | null;
}

interface OwnerChatViewProps {
  effectiveRole: UserRole;
  userProfile: UserProfile | null;
  yacht: Yacht | null;
  currentUserId?: string;
  allYachts: Yacht[];
  chatMessages: ChatMessage[];
  selectedChatYachtId: string | null;
  onSelectYacht: (id: string | null) => void;
  newMessage: string;
  onNewMessageChange: (msg: string) => void;
  onSend: () => void;
  chatLoading: boolean;
}

const SYSTEM_MESSAGE_PREFIXES = [
  'Check-In Alert:',
  'Check-Out Alert:',
  'Repair Request Approved:',
  'Repair Request Completed',
  'Repair Request Submitted:',
  'Invoice Sent:',
];

const isSystemMessage = (msg: ChatMessage) =>
  SYSTEM_MESSAGE_PREFIXES.some(prefix => msg.message.includes(prefix));

export default function OwnerChatView({
  effectiveRole,
  userProfile,
  yacht,
  currentUserId,
  allYachts,
  chatMessages,
  selectedChatYachtId,
  onSelectYacht,
  newMessage,
  onNewMessageChange,
  onSend,
  chatLoading,
}: OwnerChatViewProps) {
  return (
    <>
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
                onClick={() => onSelectYacht(null)}
                className="flex items-center gap-2 text-slate-400 hover:text-purple-500 transition-colors mb-4"
              >
                <span>← Back to All Yachts</span>
              </button>

              {(() => {
                const selectedYacht = allYachts.find(y => y.id === selectedChatYachtId);
                const yachtMessages = chatMessages
                  .filter((msg) => msg.yacht_id === selectedChatYachtId)
                  .filter((msg) => !isSystemMessage(msg));

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
                        yachtMessages.map((msg) => {
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
                  {allYachts.map((y) => {
                    const yachtMessages = chatMessages
                      .filter((msg) => msg.yacht_id === y.id)
                      .filter((msg) => !isSystemMessage(msg));

                    return (
                      <button
                        key={y.id}
                        onClick={() => onSelectYacht(y.id)}
                        className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 hover:border-purple-500 transition-all duration-300 hover:scale-105 text-left group"
                      >
                        <div className="flex items-center gap-4 mb-4">
                          <div className="bg-purple-500/20 p-4 rounded-xl group-hover:bg-purple-500/30 transition-colors">
                            <Ship className="w-8 h-8 text-purple-500" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">{y.name}</h3>
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
              {(() => {
                const filtered = chatMessages.filter((msg) =>
                  !isSystemMessage(msg) &&
                  (userProfile?.role !== 'owner' || !yacht || msg.yacht_id === yacht.id)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-400">No messages yet. Start the conversation!</p>
                    </div>
                  );
                }

                return filtered.map((msg) => {
                  const isCurrentUser = msg.user_id === currentUserId;
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
                });
              })()}
            </div>

            <div className="border-t border-slate-700 p-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => onNewMessageChange(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder="Type your message..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:outline-none focus:border-amber-500 text-white placeholder-slate-400"
                  disabled={chatLoading}
                />
                <button
                  onClick={onSend}
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
  );
}
