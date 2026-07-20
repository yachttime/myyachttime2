import { CalendarPlus, Plus, X } from 'lucide-react';
import { Yacht, UserProfile, logYachtActivity } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';

export interface OwnerTripForm {
  start_date: string;
  departure_time: string;
  end_date: string;
  arrival_time: string;
  owners: { owner_name: string; owner_contact: string }[];
}

interface OwnerTripsViewProps {
  showForm: boolean;
  onToggleForm: () => void;
  form: OwnerTripForm;
  onFormChange: (form: OwnerTripForm) => void;
  loading: boolean;
  error: string | null;
  success: boolean;
  allUsers: any[];
  allYachts: Yacht[];
  userProfile: UserProfile | null;
  currentUserId?: string;
  selectedOwnerYachtId: string | null;
  selectedOwnerUserId: string | null;
  onSelectedYachtChange: (id: string | null) => void;
  onSelectedUserChange: (id: string | null) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function OwnerTripsView({
  showForm, onToggleForm, form, onFormChange, loading, error, success,
  allUsers, allYachts, onSelectedYachtChange, onSelectedUserChange, onSubmit,
}: OwnerTripsViewProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarPlus className="w-8 h-8 text-green-500" />
          <div>
            <h2 className="text-2xl font-bold">Owner Trips</h2>
            <p className="text-slate-400">Schedule owner yacht trips to calendar</p>
          </div>
        </div>
        <button
          onClick={onToggleForm}
          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg"
        >
          {showForm ? 'Cancel' : '+ Add Owner Trip'}
        </button>
      </div>

      {showForm && (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700 mb-6">
          <h3 className="text-xl font-semibold mb-4">Add Owner Trip to Calendar</h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium">Owners on Trip *</label>
                <button
                  type="button"
                  onClick={() => {
                    onFormChange({
                      ...form,
                      owners: [...form.owners, { owner_name: '', owner_contact: '' }]
                    });
                  }}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-sm px-3 py-1 rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Owner
                </button>
              </div>

              {form.owners.map((owner, index) => (
                <div key={index} className="mb-3 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-slate-400">Owner #{index + 1}</span>
                    {form.owners.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onFormChange({
                            ...form,
                            owners: form.owners.filter((_, i) => i !== index)
                          });
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-400">Name *</label>
                      <select
                        required
                        value={owner.owner_name}
                        onChange={(e) => {
                          const selectedUser = allUsers.find(u =>
                            `${u.first_name || ''} ${u.last_name || ''}`.trim() === e.target.value
                          );
                          const newOwners = [...form.owners];
                          newOwners[index] = {
                            owner_name: e.target.value,
                            owner_contact: selectedUser?.phone || owner.owner_contact
                          };
                          onFormChange({ ...form, owners: newOwners });

                          if (index === 0) {
                            onSelectedYachtChange(selectedUser?.yacht_id || null);
                            onSelectedUserChange(selectedUser?.user_id || null);
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500"
                      >
                        <option value="" className="bg-slate-800 text-white">Select an owner</option>
                        {(() => {
                          const usersByYacht: { [key: string]: typeof allUsers } = {};
                          const usersWithoutYacht: typeof allUsers = [];

                          allUsers.forEach(user => {
                            if (user.is_active === false) return;
                            if (user.role === 'owner' || user.role === 'manager') {
                              const userYacht = allYachts.find(y => y.id === user.yacht_id);
                              if (userYacht && userYacht.is_active === false) return;
                              const yachtName = user.yachts?.name || 'Unassigned';
                              if (yachtName === 'Unassigned') {
                                usersWithoutYacht.push(user);
                              } else {
                                if (!usersByYacht[yachtName]) {
                                  usersByYacht[yachtName] = [];
                                }
                                usersByYacht[yachtName].push(user);
                              }
                            }
                          });

                          return (
                            <>
                              {Object.entries(usersByYacht)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([yachtName, users]) => (
                                  <optgroup key={yachtName} label={yachtName} className="bg-slate-800 text-slate-300">
                                    {users.map((user) => {
                                      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                                      return fullName ? (
                                        <option key={user.id} value={fullName} className="bg-slate-800 text-white">
                                          {fullName}
                                        </option>
                                      ) : null;
                                    })}
                                  </optgroup>
                                ))}
                              {usersWithoutYacht.length > 0 && (
                                <optgroup label="Unassigned" className="bg-slate-800 text-slate-300">
                                  {usersWithoutYacht.map((user) => {
                                    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
                                    return fullName ? (
                                      <option key={user.id} value={fullName} className="bg-slate-800 text-white">
                                        {fullName}
                                      </option>
                                    ) : null;
                                  })}
                                </optgroup>
                              )}
                            </>
                          );
                        })()}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-400">Contact *</label>
                      <input
                        type="text"
                        required
                        value={owner.owner_contact}
                        onChange={(e) => {
                          const newOwners = [...form.owners];
                          newOwners[index].owner_contact = e.target.value;
                          onFormChange({ ...form, owners: newOwners });
                        }}
                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                        placeholder="Email or phone"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Date *</label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => {
                    const startDate = new Date(e.target.value);
                    const endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 7);
                    const endDateString = endDate.toISOString().split('T')[0];
                    onFormChange({
                      ...form,
                      start_date: e.target.value,
                      end_date: endDateString
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Departure Time</label>
                <input
                  type="time"
                  value={form.departure_time}
                  onChange={(e) => onFormChange({...form, departure_time: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Return Date *</label>
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => onFormChange({...form, end_date: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Arrival Time</label>
                <input
                  type="time"
                  value={form.arrival_time}
                  onChange={(e) => onFormChange({...form, arrival_time: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 [color-scheme:dark]"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding Trip...' : 'Add Owner Trip'}
            </button>
          </form>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm mb-6">
          Owner trip added to calendar successfully!
        </div>
      )}
    </>
  );
}
