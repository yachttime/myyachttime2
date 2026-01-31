import React, { useState } from 'react';
import { Clock, Users, History, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, isMasterRole } from '../lib/supabase';
import { TimeClockPanel } from './TimeClockPanel';
import { TimeEntriesView } from './TimeEntriesView';
import { TimeEntryEditor } from './TimeEntryEditor';
import { PayrollReportView } from './PayrollReportView';
import { TimeEntry } from '../utils/timeClockHelpers';

export function TimeClock() {
  const { userProfile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'punch' | 'myTime' | 'allTime' | 'payroll'>('punch');
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);

  const isMaster = isMasterRole(userProfile?.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Time Clock</h1>
        <p className="text-gray-600">Track work hours and generate payroll reports</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-4">
          <button
            onClick={() => setActiveSubTab('punch')}
            className={`pb-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeSubTab === 'punch'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            Punch In/Out
          </button>
          <button
            onClick={() => setActiveSubTab('myTime')}
            className={`pb-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeSubTab === 'myTime'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <History className="w-4 h-4" />
            My Time
          </button>
          {isMaster && (
            <>
              <button
                onClick={() => setActiveSubTab('allTime')}
                className={`pb-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeSubTab === 'allTime'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="w-4 h-4" />
                All Staff
              </button>
              <button
                onClick={() => setActiveSubTab('payroll')}
                className={`pb-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 ${
                  activeSubTab === 'payroll'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                Payroll Reports
              </button>
            </>
          )}
        </nav>
      </div>

      <div>
        {activeSubTab === 'punch' && (
          <div className="max-w-2xl">
            <TimeClockPanel />
          </div>
        )}

        {activeSubTab === 'myTime' && (
          <TimeEntriesView />
        )}

        {activeSubTab === 'allTime' && isMaster && (
          <AllStaffTimeView onEditEntry={setEditingEntry} />
        )}

        {activeSubTab === 'payroll' && isMaster && (
          <PayrollReportView />
        )}
      </div>

      {editingEntry && (
        <TimeEntryEditor
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={() => {
            setEditingEntry(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function AllStaffTimeView({ onEditEntry }: { onEditEntry: (entry: TimeEntry) => void }) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<Array<{ user_id: string; first_name: string; last_name: string }>>([]);

  React.useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('user_id, first_name, last_name')
      .in('role', ['staff', 'mechanic', 'master'])
      .eq('is_active', true)
      .order('last_name');

    if (data) {
      setUsers(data);
      if (data.length > 0) {
        setSelectedUserId(data[0].user_id);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Employee
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {users.map((user) => (
            <option key={user.user_id} value={user.user_id}>
              {user.last_name}, {user.first_name}
            </option>
          ))}
        </select>
      </div>

      {selectedUserId && (
        <TimeEntriesView
          userId={selectedUserId}
          onEditEntry={onEditEntry}
          showEditButton={true}
        />
      )}
    </div>
  );
}
