import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { MessageSquare, Plus, X, Send, Paperclip, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { uploadFile } from '../utils/fileUpload';

interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  attachment_url: string | null;
  last_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  user_profiles?: {
    full_name: string;
    email_address: string;
  };
  assigned_user?: {
    full_name: string;
  };
}

interface TicketResponse {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  attachment_url: string | null;
  is_staff_response: boolean;
  created_at: string;
  user_profiles?: {
    full_name: string;
    role: string;
  };
}

const CATEGORIES = [
  { value: 'general', label: 'General Question' },
  { value: 'billing', label: 'Billing' },
  { value: 'technical', label: 'Technical Issue' },
  { value: 'account', label: 'Account Help' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'other', label: 'Other' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
];

const STATUSES = [
  { value: 'open', label: 'Open', icon: AlertCircle, color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
  { value: 'waiting_on_customer', label: 'Waiting on You', icon: Clock, color: 'bg-purple-100 text-purple-800' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle, color: 'bg-green-100 text-green-800' },
  { value: 'closed', label: 'Closed', icon: CheckCircle, color: 'bg-gray-100 text-gray-800' }
];

export default function SupportTickets() {
  const { user, userProfile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responses, setResponses] = useState<TicketResponse[]>([]);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const [newTicket, setNewTicket] = useState({
    subject: '',
    message: '',
    category: 'general',
    priority: 'medium',
    attachment: null as File | null
  });

  const [newResponse, setNewResponse] = useState({
    message: '',
    attachment: null as File | null
  });

  const [staffUpdate, setStaffUpdate] = useState({
    status: '',
    assigned_to: '',
    priority: ''
  });

  const isStaff = userProfile?.role === 'master';

  useEffect(() => {
    if (user) {
      fetchTickets();
    }
  }, [user, filterStatus]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('support-tickets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets'
        },
        () => {
          fetchTickets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_ticket_responses'
        },
        () => {
          if (selectedTicket) {
            fetchResponses(selectedTicket.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedTicket]);

  const fetchTickets = async () => {
    try {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          user_profiles:user_id (full_name, email_address),
          assigned_user:assigned_to (full_name)
        `)
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchResponses = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_ticket_responses')
        .select(`
          *,
          user_profiles:user_id (full_name, role)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setResponses(data || []);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile?.company_id) return;

    setSubmitting(true);
    try {
      let attachmentUrl = null;

      if (newTicket.attachment) {
        const filePath = `${user.id}/${Date.now()}_${newTicket.attachment.name}`;
        attachmentUrl = await uploadFile(
          newTicket.attachment,
          'support-attachments',
          filePath
        );
      }

      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          company_id: userProfile.company_id,
          subject: newTicket.subject,
          message: newTicket.message,
          category: newTicket.category,
          priority: newTicket.priority,
          attachment_url: attachmentUrl
        });

      if (error) throw error;

      setNewTicket({
        subject: '',
        message: '',
        category: 'general',
        priority: 'medium',
        attachment: null
      });
      setShowNewTicketModal(false);
      fetchTickets();
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      alert('Failed to create ticket: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTicket) return;

    setSubmitting(true);
    try {
      let attachmentUrl = null;

      if (newResponse.attachment) {
        const filePath = `${user.id}/${Date.now()}_${newResponse.attachment.name}`;
        attachmentUrl = await uploadFile(
          newResponse.attachment,
          'support-attachments',
          filePath
        );
      }

      const { error } = await supabase
        .from('support_ticket_responses')
        .insert({
          ticket_id: selectedTicket.id,
          user_id: user.id,
          message: newResponse.message,
          attachment_url: attachmentUrl,
          is_staff_response: isStaff || false
        });

      if (error) throw error;

      setNewResponse({ message: '', attachment: null });
      fetchResponses(selectedTicket.id);

      if (selectedTicket.status === 'waiting_on_customer' && !isStaff) {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress' })
          .eq('id', selectedTicket.id);
      }
    } catch (error: any) {
      console.error('Error adding response:', error);
      alert('Failed to add response: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStaffUpdate = async () => {
    if (!selectedTicket || !isStaff) return;

    try {
      const updates: any = {};
      if (staffUpdate.status) updates.status = staffUpdate.status;
      if (staffUpdate.assigned_to) updates.assigned_to = staffUpdate.assigned_to;
      if (staffUpdate.priority) updates.priority = staffUpdate.priority;

      if (Object.keys(updates).length === 0) return;

      const { error } = await supabase
        .from('support_tickets')
        .update(updates)
        .eq('id', selectedTicket.id);

      if (error) throw error;

      setStaffUpdate({ status: '', assigned_to: '', priority: '' });
      fetchTickets();

      const updatedTicket = tickets.find(t => t.id === selectedTicket.id);
      if (updatedTicket) {
        setSelectedTicket({ ...updatedTicket, ...updates });
      }
    } catch (error: any) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket: ' + error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUSES.find(s => s.value === status);
    if (!statusInfo) return null;
    const Icon = statusInfo.icon;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {statusInfo.label}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityInfo = PRIORITIES.find(p => p.value === priority);
    if (!priorityInfo) return null;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityInfo.color}`}>
        {priorityInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading support tickets...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
          <p className="mt-1 text-sm text-gray-500">
            Get help with questions, issues, or feedback
          </p>
        </div>
        <button
          onClick={() => setShowNewTicketModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </button>
      </div>

      <div className="flex items-center space-x-2">
        <Filter className="w-4 h-4 text-gray-500" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Tickets</option>
          {STATUSES.map(status => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            {filterStatus === 'all' ? 'No support tickets yet' : `No ${filterStatus} tickets`}
          </p>
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            Create your first ticket
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  if (expandedTicket === ticket.id) {
                    setExpandedTicket(null);
                    setSelectedTicket(null);
                  } else {
                    setExpandedTicket(ticket.id);
                    setSelectedTicket(ticket);
                    fetchResponses(ticket.id);
                    setStaffUpdate({
                      status: ticket.status,
                      assigned_to: ticket.assigned_to || '',
                      priority: ticket.priority
                    });
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-sm font-mono text-gray-500">
                        {ticket.ticket_number}
                      </span>
                      {getStatusBadge(ticket.status)}
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {ticket.subject}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {ticket.message}
                    </p>
                    <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                      <span>
                        {CATEGORIES.find(c => c.value === ticket.category)?.label}
                      </span>
                      <span>
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                      {isStaff && ticket.user_profiles && (
                        <span>
                          By: {ticket.user_profiles.full_name}
                        </span>
                      )}
                      {ticket.assigned_user && (
                        <span>
                          Assigned to: {ticket.assigned_user.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                  {expandedTicket === ticket.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                  )}
                </div>
              </div>

              {expandedTicket === ticket.id && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {isStaff && (
                    <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">
                        Staff Actions
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            value={staffUpdate.status}
                            onChange={(e) => setStaffUpdate({ ...staffUpdate, status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            {STATUSES.map(status => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Priority
                          </label>
                          <select
                            value={staffUpdate.priority}
                            onChange={(e) => setStaffUpdate({ ...staffUpdate, priority: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          >
                            {PRIORITIES.map(priority => (
                              <option key={priority.value} value={priority.value}>
                                {priority.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={handleStaffUpdate}
                            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 mb-4">
                    <h4 className="text-sm font-semibold text-gray-900">
                      Conversation
                    </h4>

                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-medium text-gray-900">
                            {ticket.user_profiles?.full_name || 'You'}
                          </span>
                          <span className="text-sm text-gray-500 ml-2">
                            {new Date(ticket.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {ticket.message}
                      </p>
                      {ticket.attachment_url && (
                        <div className="mt-3">
                          <a
                            href={ticket.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                          >
                            <Paperclip className="w-4 h-4 mr-1" />
                            View Attachment
                          </a>
                        </div>
                      )}
                    </div>

                    {responses.map((response) => (
                      <div
                        key={response.id}
                        className={`rounded-lg p-4 border ${
                          response.is_staff_response
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <span className="font-medium text-gray-900">
                              {response.user_profiles?.full_name}
                            </span>
                            {response.is_staff_response && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">
                                Staff
                              </span>
                            )}
                            <span className="text-sm text-gray-500 ml-2">
                              {new Date(response.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {response.message}
                        </p>
                        {response.attachment_url && (
                          <div className="mt-3">
                            <a
                              href={response.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700 text-sm flex items-center"
                            >
                              <Paperclip className="w-4 h-4 mr-1" />
                              View Attachment
                            </a>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {ticket.status !== 'closed' && (
                    <form onSubmit={handleAddResponse} className="space-y-3">
                      <textarea
                        value={newResponse.message}
                        onChange={(e) => setNewResponse({ ...newResponse, message: e.target.value })}
                        placeholder="Type your response..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <div className="flex items-center justify-between">
                        <label className="flex items-center text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                          <Paperclip className="w-4 h-4 mr-1" />
                          Attach File
                          <input
                            type="file"
                            onChange={(e) => setNewResponse({ ...newResponse, attachment: e.target.files?.[0] || null })}
                            className="hidden"
                          />
                        </label>
                        {newResponse.attachment && (
                          <span className="text-sm text-gray-600">
                            {newResponse.attachment.name}
                          </span>
                        )}
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {submitting ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">
                  Create Support Ticket
                </h3>
                <button
                  onClick={() => setShowNewTicketModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {PRIORITIES.map(priority => (
                      <option key={priority.value} value={priority.value}>
                        {priority.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Brief description of your issue or question"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newTicket.message}
                    onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Please provide as much detail as possible..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attachment (optional)
                  </label>
                  <label className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500">
                    <Paperclip className="w-5 h-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {newTicket.attachment ? newTicket.attachment.name : 'Choose file to upload'}
                    </span>
                    <input
                      type="file"
                      onChange={(e) => setNewTicket({ ...newTicket, attachment: e.target.files?.[0] || null })}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewTicketModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
