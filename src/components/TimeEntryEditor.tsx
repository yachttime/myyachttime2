import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { TimeEntry } from '../utils/timeClockHelpers';

interface TimeEntryEditorProps {
  entry: TimeEntry;
  onClose: () => void;
  onSave: () => void;
}

export function TimeEntryEditor({ entry, onClose, onSave }: TimeEntryEditorProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [punchInDate, setPunchInDate] = useState(
    new Date(entry.punch_in_time).toISOString().split('T')[0]
  );
  const [punchInTime, setPunchInTime] = useState(
    new Date(entry.punch_in_time).toTimeString().slice(0, 5)
  );
  const [punchOutDate, setPunchOutDate] = useState(
    entry.punch_out_time ? new Date(entry.punch_out_time).toISOString().split('T')[0] : ''
  );
  const [punchOutTime, setPunchOutTime] = useState(
    entry.punch_out_time ? new Date(entry.punch_out_time).toTimeString().slice(0, 5) : ''
  );
  const [lunchStartTime, setLunchStartTime] = useState(
    entry.lunch_break_start ? new Date(entry.lunch_break_start).toTimeString().slice(0, 5) : ''
  );
  const [lunchEndTime, setLunchEndTime] = useState(
    entry.lunch_break_end ? new Date(entry.lunch_break_end).toTimeString().slice(0, 5) : ''
  );
  const [notes, setNotes] = useState(entry.notes || '');
  const [editReason, setEditReason] = useState('');

  const handleSave = async () => {
    if (!editReason.trim()) {
      setError('Please provide a reason for editing this entry');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const punchIn = new Date(`${punchInDate}T${punchInTime}`);
      const punchOut = punchOutDate && punchOutTime
        ? new Date(`${punchOutDate}T${punchOutTime}`)
        : null;

      if (punchOut && punchOut <= punchIn) {
        throw new Error('Punch out time must be after punch in time');
      }

      const lunchStart = lunchStartTime
        ? new Date(`${punchInDate}T${lunchStartTime}`)
        : null;
      const lunchEnd = lunchEndTime
        ? new Date(`${punchInDate}T${lunchEndTime}`)
        : null;

      if (lunchStart && lunchEnd && lunchEnd <= lunchStart) {
        throw new Error('Lunch end time must be after lunch start time');
      }

      const updates: any = {
        punch_in_time: punchIn.toISOString(),
        punch_out_time: punchOut?.toISOString() || null,
        lunch_break_start: lunchStart?.toISOString() || null,
        lunch_break_end: lunchEnd?.toISOString() || null,
        notes,
        is_edited: true,
        edited_by: user?.id,
        edited_at: new Date().toISOString(),
        edit_reason: editReason
      };

      const { error: updateError } = await supabase
        .from('staff_time_entries')
        .update(updates)
        .eq('id', entry.id);

      if (updateError) throw updateError;

      onSave();
    } catch (err: any) {
      console.error('Error saving entry:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('staff_time_entries')
        .delete()
        .eq('id', entry.id);

      if (deleteError) throw deleteError;

      onSave();
    } catch (err: any) {
      console.error('Error deleting entry:', err);
      setError(err.message || 'Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit Time Entry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Punch In Date
              </label>
              <input
                type="date"
                value={punchInDate}
                onChange={(e) => setPunchInDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Punch In Time
              </label>
              <input
                type="time"
                value={punchInTime}
                onChange={(e) => setPunchInTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Punch Out Date
              </label>
              <input
                type="date"
                value={punchOutDate}
                onChange={(e) => setPunchOutDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Punch Out Time
              </label>
              <input
                type="time"
                value={punchOutTime}
                onChange={(e) => setPunchOutTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Lunch Break (Optional)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Start Time
                </label>
                <input
                  type="time"
                  value={lunchStartTime}
                  onChange={(e) => setLunchStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  End Time
                </label>
                <input
                  type="time"
                  value={lunchEndTime}
                  onChange={(e) => setLunchEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Edit <span className="text-red-500">*</span>
            </label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={2}
              placeholder="Explain why you are editing this entry..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {entry.is_edited && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="text-sm font-medium text-yellow-800 mb-1">
                Previously Edited
              </div>
              {entry.edit_reason && (
                <div className="text-sm text-yellow-700">
                  Reason: {entry.edit_reason}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium disabled:opacity-50"
          >
            Delete Entry
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
