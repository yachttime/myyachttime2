import { CalendarPlus, RefreshCw } from 'lucide-react';
import { Yacht } from '../../lib/supabase';

export interface AppointmentForm {
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  yacht_name: string;
  problem_description: string;
  createRepairRequest: boolean;
  useExistingCustomer: boolean;
  customerId: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  type: string;
}

interface AppointmentsViewProps {
  form: AppointmentForm;
  onFormChange: (form: AppointmentForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  success: boolean;
  error: string | null;
  allCustomers: Customer[];
  allYachts: Yacht[];
  onCancel: () => void;
}

export default function AppointmentsView({
  form, onFormChange, onSubmit, loading, success, error, allCustomers, allYachts, onCancel,
}: AppointmentsViewProps) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 p-6">
      <div className="flex items-center gap-3 mb-6">
        <CalendarPlus className="w-8 h-8 text-orange-500" />
        <div>
          <h2 className="text-2xl font-bold">Create Appointment</h2>
          <p className="text-slate-400">Schedule a repair appointment</p>
        </div>
      </div>

      {success && (
        <div className="mb-4 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400">
          Appointment created successfully!
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
              Customer Name
            </label>
            {form.useExistingCustomer ? (
              <div className="space-y-2">
                <select
                  value={form.customerId}
                  onChange={(e) => {
                    const customerId = e.target.value;
                    const customer = allCustomers.find(c => c.id === customerId);
                    onFormChange({
                      ...form,
                      customerId,
                      name: customer?.name || '',
                      phone: customer?.phone || '',
                      email: customer?.email || ''
                    });
                  }}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white cursor-pointer"
                  required
                >
                  <option value="">Select existing customer...</option>
                  {allCustomers.map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} {customer.type === 'yacht_owner' ? '(Yacht Owner)' : '(Walk-in)'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onFormChange({ ...form, useExistingCustomer: false, customerId: '', name: '', phone: '', email: '' })}
                  className="text-sm text-orange-400 hover:text-orange-300"
                >
                  + Add new customer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => onFormChange({ ...form, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter customer name"
                  required
                />
                <button
                  type="button"
                  onClick={() => onFormChange({ ...form, useExistingCustomer: true })}
                  className="text-sm text-orange-400 hover:text-orange-300"
                >
                  ← Select from existing customers
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => onFormChange({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onFormChange({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Yacht <span className="text-slate-500">(Optional)</span>
            </label>
            <select
              value={form.yacht_name}
              onChange={(e) => onFormChange({ ...form, yacht_name: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white cursor-pointer"
            >
              <option value="">Select a yacht...</option>
              {allYachts.map(yacht => (
                <option key={yacht.id} value={yacht.name}>
                  {yacht.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => onFormChange({ ...form, date: e.target.value })}
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Problem Description
          </label>
          <textarea
            value={form.problem_description}
            onChange={(e) => onFormChange({ ...form, problem_description: e.target.value })}
            rows={4}
            className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
            required
          />
        </div>

        <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.createRepairRequest}
              onChange={(e) => onFormChange({ ...form, createRepairRequest: e.target.checked })}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-2 focus:ring-orange-500 focus:ring-offset-0 focus:ring-offset-slate-800"
            />
            <div className="flex-1">
              <span className="text-slate-300 font-medium">Also create repair request</span>
              <p className="text-sm text-slate-400 mt-1">
                Automatically create a retail repair request with the appointment details for tracking and billing
              </p>
            </div>
          </label>
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CalendarPlus className="w-4 h-4" />
                Create Appointment
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
