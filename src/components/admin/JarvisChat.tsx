import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, Check, X, Clock, ListTodo, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '../../lib/supabase';

interface JarvisChatProps {
  userId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  proposedActions?: PendingAction[];
  tasks?: JarvisTask[];
}

interface PendingAction {
  id: string;
  summary: string;
  reason: string;
  table_name: string;
  record_id: string;
  changes: Record<string, any>;
  before: Record<string, any> | null;
  status: string;
  created_at: string;
}

interface JarvisTask {
  id: string;
  title: string;
  details: string | null;
  priority: string;
  status: string;
  created_at: string;
}

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  active: boolean;
}

type Tab = 'chat' | 'pending' | 'tasks' | 'knowledge';

async function callJarvis(supabaseUrl: string, payload: Record<string, any>): Promise<any> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

async function callApprove(supabaseUrl: string, actionId: string, decision: 'approve' | 'reject'): Promise<any> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const response = await fetch(`${supabaseUrl}/functions/v1/jarvis-approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ actionId, decision }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

export default function JarvisChat({ userId, supabaseUrl }: JarvisChatProps) {
  const [activeTab, setActiveTab] = useState<Tab>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [tasks, setTasks] = useState<JarvisTask[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const loadPendingActions = useCallback(async () => {
    try {
      const data = await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'loadPending' });
      setPendingActions((data.data as PendingAction[]) || []);
    } catch (e: any) {
      console.error('Failed to load pending actions:', e);
    }
  }, [supabaseUrl]);

  const loadTasks = useCallback(async () => {
    try {
      const data = await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'loadTasks' });
      setTasks((data.data as JarvisTask[]) || []);
    } catch (e: any) {
      console.error('Failed to load tasks:', e);
    }
  }, [supabaseUrl]);

  const loadKnowledge = useCallback(async () => {
    try {
      const data = await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'loadKnowledge' });
      setKnowledge((data.data as KnowledgeEntry[]) || []);
    } catch (e: any) {
      console.error('Failed to load knowledge:', e);
    }
  }, [supabaseUrl]);

  useEffect(() => {
    loadPendingActions();
    loadTasks();
    loadKnowledge();
  }, [loadPendingActions, loadTasks, loadKnowledge]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    setError('');
    setLoading(true);

    const newMessages = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(newMessages);

    try {
      const data = await callJarvis(supabaseUrl, {
        message: userMsg,
        conversationHistory: newMessages.slice(-11, -1).map(m => ({ role: m.role, content: m.content })),
      });

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.reply,
        proposedActions: data.proposedActions || [],
        tasks: data.tasks || [],
      };
      setMessages([...newMessages, assistantMsg]);

      if (data.proposedActions?.length > 0) loadPendingActions();
      if (data.tasks?.length > 0) loadTasks();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (actionId: string) => {
    setActionLoading(prev => ({ ...prev, [actionId]: true }));
    try {
      await callApprove(supabaseUrl, actionId, 'approve');
      setPendingActions(prev => prev.filter(p => p.id !== actionId));
      setMessages(prev => prev.map(m => {
        if (m.proposedActions) {
          return { ...m, proposedActions: m.proposedActions.map(pa => pa.id === actionId ? { ...pa, status: 'approved' } : pa) };
        }
        return m;
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionId]: false }));
    }
  };

  const handleReject = async (actionId: string) => {
    setActionLoading(prev => ({ ...prev, [actionId]: true }));
    try {
      await callApprove(supabaseUrl, actionId, 'reject');
      setPendingActions(prev => prev.filter(p => p.id !== actionId));
      setMessages(prev => prev.map(m => {
        if (m.proposedActions) {
          return { ...m, proposedActions: m.proposedActions.map(pa => pa.id === actionId ? { ...pa, status: 'rejected' } : pa) };
        }
        return m;
      }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionId]: false }));
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: string) => {
    try {
      await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'updateTask', taskId, taskStatus: status });
      loadTasks();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteKnowledge = async (id: string) => {
    try {
      await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'deleteKnowledge', knowledgeId: id });
      loadKnowledge();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleKnowledge = async (id: string, currentActive: boolean) => {
    try {
      await callJarvis(supabaseUrl, { mode: 'data', dataAction: 'toggleKnowledge', knowledgeId: id, knowledgeActive: !currentActive });
      loadKnowledge();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const pendingBadge = pendingActions.length > 0 ? pendingActions.length : null;

  const tabButton = (tab: Tab, label: string, icon: React.ReactNode, badge?: number | null) => (
    <button
      onClick={() => setActiveTab(tab)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tab ? 'bg-amber-500 text-slate-900' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
      {badge ? <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{badge}</span> : null}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="bg-amber-500/20 p-3 rounded-xl">
          <Bot className="w-8 h-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Jarvis AI Assistant</h2>
          <p className="text-slate-400 text-sm">Ask about your fleet, repairs, bookings, and operations</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabButton('chat', 'Chat', <Bot className="w-4 h-4" />)}
        {tabButton('pending', 'Pending Actions', <Clock className="w-4 h-4" />, pendingBadge)}
        {tabButton('tasks', 'Tasks', <ListTodo className="w-4 h-4" />)}
        {tabButton('knowledge', 'Knowledge Base', <BookOpen className="w-4 h-4" />)}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-slate-500 py-12">
                <Bot className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-sm">Ask Jarvis anything about your fleet, repairs, bookings, or operations.</p>
                <p className="text-xs text-slate-600 mt-2">Try: "What repairs are pending?" or "Which yachts have upcoming trips?"</p>
              </div>
            )}
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-3 ${msg.role === 'user' ? 'bg-amber-500 text-slate-900' : 'bg-slate-700 text-slate-100'}`}>
                  {msg.role === 'assistant' ? (
                    <div className="jarvis-markdown text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.proposedActions && msg.proposedActions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.proposedActions.map((pa, paIdx) => (
                        <div key={paIdx} className="bg-slate-900/50 border border-slate-600 rounded-xl p-3">
                          <p className="text-xs text-amber-400 font-semibold mb-1">PROPOSED ACTION</p>
                          <p className="text-sm text-white font-medium mb-1">{pa.summary}</p>
                          <p className="text-xs text-slate-400 mb-2">{pa.reason}</p>
                          <p className="text-xs text-slate-500 mb-2">Table: {pa.table_name} | Record: {pa.record_id?.substring(0, 8)}...</p>
                          <div className="text-xs text-slate-500 bg-slate-800/50 rounded p-2 mb-2">
                            <span className="text-slate-400">Changes:</span>
                            <pre className="mt-1 overflow-x-auto">{JSON.stringify(pa.changes, null, 2)}</pre>
                          </div>
                          {pa.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                                {actionLoading[pa.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                Approve
                              </button>
                              <button onClick={() => handleReject(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors">
                                {actionLoading[pa.id] ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${pa.status === 'approved' ? 'bg-green-500/20 text-green-400' : pa.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-slate-600 text-slate-300'}`}>
                              {pa.status.charAt(0).toUpperCase() + pa.status.slice(1)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.tasks && msg.tasks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.tasks.map((task, tIdx) => (
                        <div key={tIdx} className="bg-slate-900/50 border border-slate-600 rounded-xl p-3">
                          <p className="text-xs text-blue-400 font-semibold mb-1">NEW TASK</p>
                          <p className="text-sm text-white font-medium">{task.title}</p>
                          {task.details && <p className="text-xs text-slate-400 mt-1">{task.details}</p>}
                          <span className="inline-block mt-2 px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400 capitalize">{task.priority} priority</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-700 rounded-2xl p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  <span className="text-sm text-slate-400">Jarvis is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="border-t border-slate-700 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Ask Jarvis..."
              disabled={loading}
              className="flex-1 px-4 py-2 bg-slate-900 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-medium rounded-xl transition-colors flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
          {pendingActions.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No pending actions. Jarvis will propose changes here for your approval.</p>
          ) : (
            <div className="space-y-3">
              {pendingActions.map(pa => (
                <div key={pa.id} className="bg-slate-900/50 border border-slate-600 rounded-xl p-4">
                  <p className="text-sm text-white font-medium mb-1">{pa.summary}</p>
                  <p className="text-xs text-slate-400 mb-2">{pa.reason}</p>
                  <p className="text-xs text-slate-500 mb-2">Table: {pa.table_name} | Record: {pa.record_id?.substring(0, 8)}... | Created: {new Date(pa.created_at).toLocaleString()}</p>
                  <div className="text-xs text-slate-500 bg-slate-800/50 rounded p-2 mb-3">
                    <span className="text-slate-400">Changes:</span>
                    <pre className="mt-1 overflow-x-auto">{JSON.stringify(pa.changes, null, 2)}</pre>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                      {actionLoading[pa.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Approve
                    </button>
                    <button onClick={() => handleReject(pa.id)} disabled={actionLoading[pa.id]} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                      {actionLoading[pa.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tasks' && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-4">
          {tasks.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No tasks yet. Jarvis can create tasks during conversations.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => (
                <div key={task.id} className="bg-slate-900/50 border border-slate-600 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>{task.title}</p>
                    {task.details && <p className="text-xs text-slate-400 mt-1">{task.details}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs capitalize ${task.priority === 'urgent' ? 'bg-red-500/20 text-red-400' : task.priority === 'high' ? 'bg-orange-500/20 text-orange-400' : task.priority === 'normal' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>{task.priority}</span>
                      <span className="text-xs text-slate-500">{new Date(task.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <select value={task.status} onChange={(e) => handleUpdateTaskStatus(task.id, e.target.value)} className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white focus:outline-none focus:border-amber-500">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'knowledge' && (
        <KnowledgeManager knowledge={knowledge} onLoad={loadKnowledge} onDelete={handleDeleteKnowledge} onToggle={handleToggleKnowledge} supabaseUrl={supabaseUrl} />
      )}
    </div>
  );
}

interface KnowledgeManagerProps {
  knowledge: KnowledgeEntry[];
  onLoad: () => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, currentActive: boolean) => void;
  supabaseUrl: string;
}

function KnowledgeManager({ knowledge, onLoad, onDelete, onToggle, supabaseUrl }: KnowledgeManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [form, setForm] = useState({ category: 'general', title: '', content: '' });
  const [saving, setSaving] = useState(false);

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditing(entry);
    setForm({ category: entry.category, title: entry.title, content: entry.content });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      await callJarvis(supabaseUrl, {
        mode: 'data',
        dataAction: 'saveKnowledge',
        knowledgeData: { id: editing?.id, category: form.category, title: form.title, content: form.content },
      });
      setShowForm(false);
      setEditing(null);
      setForm({ category: 'general', title: '', content: '' });
      onLoad();
    } catch (e: any) {
      console.error('Failed to save knowledge:', e);
    } finally {
      setSaving(false);
    }
  };

  const categories = ['general', 'houseboats', 'service', 'billing', 'rescue'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">Manage what Jarvis knows about your business</p>
        <button onClick={() => { setEditing(null); setForm({ category: 'general', title: '', content: '' }); setShowForm(true); }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium rounded-lg transition-colors">
          + Add Entry
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select value={form.category} onChange={(e) => setForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500">
              {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Title</label>
            <input type="text" value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Content</label>
            <textarea value={form.content} onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))} rows={4} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500 resize-y" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !form.title.trim() || !form.content.trim()} className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-sm font-medium rounded-lg transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {knowledge.length === 0 ? (
          <p className="text-center text-slate-500 py-8">No knowledge entries yet. Add one to teach Jarvis about your business.</p>
        ) : (
          knowledge.map(entry => (
            <div key={entry.id} className={`bg-slate-800/50 border rounded-xl p-3 ${entry.active ? 'border-slate-700' : 'border-slate-800 opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded text-xs bg-slate-700 text-slate-300 capitalize">{entry.category}</span>
                    {!entry.active && <span className="text-xs text-slate-500">Inactive</span>}
                  </div>
                  <p className="text-sm text-white font-medium">{entry.title}</p>
                  <p className="text-xs text-slate-400 mt-1">{entry.content.substring(0, 120)}{entry.content.length > 120 ? '...' : ''}</p>
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => handleEdit(entry)} className="text-slate-400 hover:text-amber-500 text-xs px-2 py-1">Edit</button>
                  <button onClick={() => onToggle(entry.id, entry.active)} className="text-slate-400 hover:text-blue-400 text-xs px-2 py-1">{entry.active ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => onDelete(entry.id)} className="text-slate-400 hover:text-red-400 text-xs px-2 py-1">Delete</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
