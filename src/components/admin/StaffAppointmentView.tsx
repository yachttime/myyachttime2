import { Users, RefreshCw, CalendarPlus } from 'lucide-react';

export interface StaffAppointmentForm {
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  notes: string;
}

interface StaffAppointmentViewProps {
  form: StaffAppointmentForm;
  onFormChange: (form: StaffAppointmentForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  success: boolean;
  error: string | null;
  onCancel: () => void;
}

export default function StaffAppointmentView({ form, onFormChange, onSubmit, loading, success, error, onCancel }: StaffAppointmentViewProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-8 h-8 text-blue-500" />
        <div>
          <h2 className="text-2xl font-bold">Staff Appointment</h2>
          <p className="text-slate-400">Schedule a meeting with staff or contacts</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
          Staff appointment scheduled successfully!
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onFormChange({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400"
              placeholder="Enter name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Phone Number <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address <span className="text-slate-500">(Optional)</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400"
              placeholder="Enter email address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => onFormChange({ ...form, date: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Time
            </label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => onFormChange({ ...form, time: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder:text-slate-400"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Notes / Purpose <span className="text-slate-500">(Optional)</span>
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Meeting purpose or additional notes"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CalendarPlus className="w-4 h-4" />
                Schedule Appointment
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
