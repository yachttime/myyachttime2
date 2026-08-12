import { UserCheck, Save, UploadCloud } from 'lucide-react';
import { Yacht } from '../../lib/supabase';
import type { OfflineInspectionItem } from '../../utils/offlineInspectionQueue';
import PendingQueuePanel from './PendingQueuePanel';

export interface OwnerHandoffForm {
  trip_issues: string;
  trip_issues_notes: string;
  boat_damage: string;
  boat_damage_notes: string;
  shore_cords_inverters: string;
  shore_cords_inverters_notes: string;
  engine_generator_fuel: string;
  engine_generator_fuel_notes: string;
  toy_tank_fuel: string;
  toy_tank_fuel_notes: string;
  propane_tanks: string;
  propane_tanks_notes: string;
  boat_cleaned: string;
  boat_cleaned_notes: string;
  repairs_completed: string;
  repairs_completed_notes: string;
  owners_called: string;
  owners_called_notes: string;
  additional_notes: string;
  issues_found: boolean;
}

interface Mechanic {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface OwnerHandoffViewProps {
  form: OwnerHandoffForm;
  onFormChange: (form: OwnerHandoffForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  error: string | null;
  success: boolean;
  allYachts: Yacht[];
  mechanics: Mechanic[];
  selectedYacht: string;
  onYachtChange: (id: string) => void;
  selectedMechanic: string;
  onMechanicChange: (id: string) => void;
  onSaveDraft: () => void;
  onSaveAndContinue: () => void;
  queueItems: OfflineInspectionItem[];
  onOpenQueueItem: (item: OfflineInspectionItem) => void;
  onUploadOne: (item: OfflineInspectionItem) => void;
  onUploadAll: () => void;
  onDeleteQueueItem: (id: string) => void;
  queueUploading: boolean;
}

function RatingField({
  label, value, options, onChange, notesValue, onNotesChange, placeholder,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  notesValue: string;
  onNotesChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-3 mb-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              value === opt.value
                ? 'bg-emerald-500 text-slate-900'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={notesValue}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
      />
    </div>
  );
}

const ratingOptions = {
  okNeedsAttention: [
    { value: 'ok', label: 'No Issues' },
    { value: 'needs attention', label: 'Needs Attention' },
  ],
  noDamageDamage: [
    { value: 'no damage', label: 'No Damage' },
    { value: 'damage found', label: 'Damage Found' },
  ],
  okNeedsService: [
    { value: 'ok', label: 'Ok' },
    { value: 'needs service', label: 'Needs service' },
  ],
  fullNotFull: [
    { value: 'full', label: 'Full' },
    { value: 'not full', label: 'Not full' },
  ],
  cleanedNotCleaned: [
    { value: 'cleaned', label: 'Cleaned' },
    { value: 'not cleaned', label: 'Not cleaned' },
  ],
  completedNotCompleted: [
    { value: 'completed', label: 'Completed' },
    { value: 'not completed', label: 'Not completed' },
  ],
  calledNotApplicable: [
    { value: 'called', label: 'Called' },
    { value: 'not applicable', label: 'Not Applicable' },
  ],
};

export default function OwnerHandoffView({
  form, onFormChange, onSubmit, loading, error, success,
  allYachts, mechanics, selectedYacht, onYachtChange, selectedMechanic, onMechanicChange,
  onSaveDraft, onSaveAndContinue, queueItems, onOpenQueueItem, onUploadOne, onUploadAll,
  onDeleteQueueItem, queueUploading,
}: OwnerHandoffViewProps) {
  const set = (patch: Partial<OwnerHandoffForm>) => onFormChange({ ...form, ...patch });

  const handoffQueueItems = queueItems.filter(i => i.kind === 'handoff');

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {handoffQueueItems.length > 0 && (
        <PendingQueuePanel
          items={handoffQueueItems}
          onOpen={onOpenQueueItem}
          onUploadOne={onUploadOne}
          onUploadAll={onUploadAll}
          onDelete={onDeleteQueueItem}
          uploading={queueUploading}
        />
      )}

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-xl font-semibold mb-4">Inspection Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="handoff-yacht" className="block text-sm font-medium mb-2">Select Yacht</label>
            <select
              id="handoff-yacht"
              value={selectedYacht}
              onChange={(e) => onYachtChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white"
              required
            >
              <option value="">Choose a yacht...</option>
              {allYachts.map((yacht) => (
                <option key={yacht.id} value={yacht.id}>{yacht.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="handoff-mechanic" className="block text-sm font-medium mb-2">Staff Member Completing Handoff</label>
            <select
              id="handoff-mechanic"
              value={selectedMechanic}
              onChange={(e) => onMechanicChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white"
              required
            >
              <option value="">Choose a staff member...</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.user_id}>
                  {mechanic.first_name} {mechanic.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Trip Issues and Damage</h3>
        <div className="space-y-6">
          <RatingField
            label="Any Issues During the Trip"
            value={form.trip_issues}
            options={ratingOptions.okNeedsAttention}
            onChange={(v) => set({ trip_issues: v })}
            notesValue={form.trip_issues_notes}
            onNotesChange={(v) => set({ trip_issues_notes: v })}
            placeholder="Document any issues..."
          />
          <RatingField
            label="Any Damage to Boat During Trip"
            value={form.boat_damage}
            options={ratingOptions.noDamageDamage}
            onChange={(v) => set({ boat_damage: v })}
            notesValue={form.boat_damage_notes}
            onNotesChange={(v) => set({ boat_damage_notes: v })}
            placeholder="Document any damage..."
          />
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Pre-Handoff Checklist</h3>
        <div className="space-y-6">
          <RatingField
            label="Shore Cords Plugged In and Inverters On"
            value={form.shore_cords_inverters}
            options={ratingOptions.okNeedsService}
            onChange={(v) => set({ shore_cords_inverters: v })}
            notesValue={form.shore_cords_inverters_notes}
            onNotesChange={(v) => set({ shore_cords_inverters_notes: v })}
            placeholder="Additional notes..."
          />
          <RatingField
            label="Engine and Generators Fuel Full"
            value={form.engine_generator_fuel}
            options={ratingOptions.fullNotFull}
            onChange={(v) => set({ engine_generator_fuel: v })}
            notesValue={form.engine_generator_fuel_notes}
            onNotesChange={(v) => set({ engine_generator_fuel_notes: v })}
            placeholder="Fuel level details..."
          />
          <RatingField
            label="Toy Tank Fuel Full"
            value={form.toy_tank_fuel}
            options={ratingOptions.fullNotFull}
            onChange={(v) => set({ toy_tank_fuel: v })}
            notesValue={form.toy_tank_fuel_notes}
            onNotesChange={(v) => set({ toy_tank_fuel_notes: v })}
            placeholder="Toy tank details..."
          />
          <RatingField
            label="Propane Tanks Full and Connected"
            value={form.propane_tanks}
            options={ratingOptions.okNeedsService}
            onChange={(v) => set({ propane_tanks: v })}
            notesValue={form.propane_tanks_notes}
            onNotesChange={(v) => set({ propane_tanks_notes: v })}
            placeholder="Propane tank details..."
          />
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Cleaning and Repairs</h3>
        <div className="space-y-6">
          <RatingField
            label="Boat Has Been Cleaned"
            value={form.boat_cleaned}
            options={ratingOptions.cleanedNotCleaned}
            onChange={(v) => set({ boat_cleaned: v })}
            notesValue={form.boat_cleaned_notes}
            onNotesChange={(v) => set({ boat_cleaned_notes: v })}
            placeholder="Cleaning notes..."
          />
          <RatingField
            label="All Repairs Completed"
            value={form.repairs_completed}
            options={ratingOptions.completedNotCompleted}
            onChange={(v) => set({ repairs_completed: v })}
            notesValue={form.repairs_completed_notes}
            onNotesChange={(v) => set({ repairs_completed_notes: v })}
            placeholder="Repair status details..."
          />
          <RatingField
            label="Owners Called If All Repairs Not Completed by Their Trip"
            value={form.owners_called}
            options={ratingOptions.calledNotApplicable}
            onChange={(v) => set({ owners_called: v })}
            notesValue={form.owners_called_notes}
            onNotesChange={(v) => set({ owners_called_notes: v })}
            placeholder="Communication details..."
          />
        </div>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">Additional Notes</h3>
        <div className="space-y-6">
          <div>
            <label htmlFor="handoff-additional-notes" className="block text-sm font-medium mb-2">Additional Observations</label>
            <textarea
              id="handoff-additional-notes"
              value={form.additional_notes}
              onChange={(e) => set({ additional_notes: e.target.value })}
              placeholder="Any other observations or concerns..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-emerald-500 transition-colors text-white placeholder-slate-400 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="handoff-issues-found"
              type="checkbox"
              checked={form.issues_found}
              onChange={(e) => set({ issues_found: e.target.checked })}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500"
            />
            <label htmlFor="handoff-issues-found" className="text-sm font-medium">Issues found that require attention</label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
          Owner handoff inspection submitted successfully!
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-1 bg-emerald-500 hover:bg-emerald-600 text-slate-900 font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <UserCheck className="w-5 h-5" />
          {loading ? 'Submitting...' : 'Submit'}
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={loading}
          className="sm:col-span-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" />
          Save as Draft
        </button>
        <button
          type="button"
          onClick={onSaveAndContinue}
          disabled={loading}
          className="sm:col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <UploadCloud className="w-5 h-5" />
          Save & Continue
        </button>
      </div>
    </form>
  );
}
