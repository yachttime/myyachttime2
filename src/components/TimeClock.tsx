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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Employee</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6 max-h-[400px] overflow-y-auto p-1">
          {users.map((user) => (
            <button
              key={user.user_id}
              onClick={() => setSelectedUserId(user.user_id)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedUserId === user.user_id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <div className="font-medium text-gray-900">
                {user.first_name} {user.last_name}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                View time entries
              </div>
            </button>
          ))}
        </div>
        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No staff members found
          </div>
        )}
      </div>

      {selectedUserId && (
        <div className="border-t pt-6">
          <TimeEntriesView
            userId={selectedUserId}
            onEditEntry={onEditEntry}
            showEditButton={true}
          />
        </div>
      )}
    </div>
  );
}
