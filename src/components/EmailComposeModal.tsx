import React, { useState, useEffect } from 'react';
import { X, Mail, Loader2, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipients: Array<{ email: string; name: string }>;
  ccRecipients?: string[];
  yachtName?: string;
  allowRecipientSelection?: boolean;
}

export function EmailComposeModal({ isOpen, onClose, recipients, ccRecipients = [], yachtName, allowRecipientSelection = false }: EmailComposeModalProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && recipients.length > 0) {
      if (allowRecipientSelection) {
        setSelectedRecipients(new Set(recipients.map(r => r.email)));
      }
    }
  }, [isOpen, recipients, allowRecipientSelection]);

  if (!isOpen) return null;

  const toggleRecipient = (email: string) => {
    const newSelected = new Set(selectedRecipients);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelectedRecipients(newSelected);
  };

  const toggleAll = () => {
    if (selectedRecipients.size === recipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map(r => r.email)));
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      alert('Please enter both subject and message');
      return;
    }

    const finalRecipients = allowRecipientSelection
      ? recipients.filter(r => selectedRecipients.has(r.email))
      : recipients;

    if (finalRecipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-bulk-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipients: finalRecipients.map(r => r.email),
            cc_recipients: ccRecipients,
            subject,
            message,
            yacht_name: yachtName,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      alert(`Email sent successfully to ${finalRecipients.length} recipient${finalRecipients.length > 1 ? 's' : ''}!`);
      onClose();
      setSubject('');
      setMessage('');
      setSelectedRecipients(new Set());
    } catch (error) {
      console.error('Error sending email:', error);
      alert(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (sending) return;

    if (subject || message) {
      if (!confirm('Discard unsent email?')) {
        return;
      }
    }

    setSubject('');
    setMessage('');
    setSelectedRecipients(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Compose Email</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={sending}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-slate-400">
                Recipients: {allowRecipientSelection && `(${selectedRecipients.size} of ${recipients.length} selected)`}
              </p>
              {allowRecipientSelection && recipients.length > 1 && (
                <button
                  onClick={toggleAll}
                  disabled={sending}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors disabled:opacity-50"
                >
                  {selectedRecipients.size === recipients.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {allowRecipientSelection ? (
              <div className="space-y-2">
                {recipients.map((recipient, index) => (
                  <label
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedRecipients.has(recipient.email)
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-slate-800/50 border-slate-700 text-slate-300 hover:border-slate-600'
                    } ${sending ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRecipients.has(recipient.email)}
                      onChange={() => toggleRecipient(recipient.email)}
                      disabled={sending}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{recipient.name}</div>
                      <div className="text-xs text-slate-400">{recipient.email}</div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recipients.map((recipient, index) => (
                  <div
                    key={index}
                    className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm border border-blue-500/30"
                  >
                    {recipient.name} ({recipient.email})
                  </div>
                ))}
              </div>
            )}

            {ccRecipients.length > 0 && (
              <>
                <p className="text-sm text-slate-400 mt-3 mb-2">CC:</p>
                <div className="flex flex-wrap gap-2">
                  {ccRecipients.map((email, index) => (
                    <div
                      key={index}
                      className="bg-slate-700/50 text-slate-300 px-3 py-1 rounded-full text-sm border border-slate-600"
                    >
                      {email}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              disabled={sending}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={12}
              disabled={sending}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleClose}
              disabled={sending}
              className="flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={
                sending ||
                !subject.trim() ||
                !message.trim() ||
                (allowRecipientSelection && selectedRecipients.size === 0)
              }
              className="flex-1 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  {allowRecipientSelection && selectedRecipients.size > 0
                    ? `Send to ${selectedRecipients.size} Recipient${selectedRecipients.size > 1 ? 's' : ''}`
                    : 'Send Email'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
