import { ClipboardCheck, Camera, CheckCircle, X } from 'lucide-react';
import { Yacht } from '../../lib/supabase';

type ConditionRating = 'ok' | 'needs service' | 'excellent' | 'poor';

export interface InspectionPhoto {
  category: 'port_prop' | 'starboard_prop' | 'damage' | 'general';
  preview: string;
  url?: string;
  caption: string;
  uploading?: boolean;
  error?: string;
}

export interface InspectionForm {
  hull_condition: string;
  hull_notes: string;
  deck_condition: string;
  deck_notes: string;
  trash_removed: string;
  trash_removed_notes: string;
  port_engine_hours: string;
  stbd_engine_hours: string;
  port_gen_hours: string;
  stbd_gen_hours: string;
  inverter_system: ConditionRating | '';
  inverter_notes: string;
  master_bathroom: ConditionRating | '';
  master_bathroom_notes: string;
  secondary_bathroom: ConditionRating | '';
  secondary_bathroom_notes: string;
  lower_sinks: ConditionRating | '';
  lower_sinks_notes: string;
  kitchen_sink: ConditionRating | '';
  kitchen_sink_notes: string;
  garbage_disposal: ConditionRating | '';
  garbage_disposal_notes: string;
  stove_top: ConditionRating | '';
  stove_top_notes: string;
  dishwasher: ConditionRating | '';
  dishwasher_notes: string;
  trash_compactor: ConditionRating | '';
  trash_compactor_notes: string;
  volt_fans: ConditionRating | '';
  volt_fans_notes: string;
  ac_filters: ConditionRating | '';
  ac_filters_notes: string;
  ac_water_pumps: ConditionRating | '';
  ac_water_pumps_notes: string;
  water_filters: ConditionRating | '';
  water_filters_notes: string;
  water_pumps_controls: ConditionRating | '';
  water_pumps_controls_notes: string;
  upper_deck_bathroom: ConditionRating | '';
  upper_deck_bathroom_notes: string;
  upper_kitchen_sink: ConditionRating | '';
  upper_kitchen_sink_notes: string;
  upper_disposal: ConditionRating | '';
  upper_disposal_notes: string;
  icemaker: ConditionRating | '';
  icemaker_notes: string;
  upper_stove_top: ConditionRating | '';
  upper_stove_top_notes: string;
  propane: ConditionRating | '';
  propane_notes: string;
  windless_port: ConditionRating | '';
  windless_port_notes: string;
  windless_starboard: ConditionRating | '';
  windless_starboard_notes: string;
  anchor_lines: ConditionRating | '';
  anchor_lines_notes: string;
  upper_ac_filter: ConditionRating | '';
  upper_ac_filter_notes: string;
  port_engine_oil: ConditionRating | '';
  port_engine_oil_notes: string;
  port_generator_oil: ConditionRating | '';
  port_generator_oil_notes: string;
  starboard_generator_oil: ConditionRating | '';
  starboard_generator_oil_notes: string;
  starboard_engine_oil: ConditionRating | '';
  starboard_engine_oil_notes: string;
  sea_strainers: ConditionRating | '';
  sea_strainers_notes: string;
  engine_batteries: ConditionRating | '';
  engine_batteries_notes: string;
  additional_notes: string;
  issues_found: boolean;
}

interface Mechanic {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

interface RatingFieldConfig {
  label: string;
  field: keyof InspectionForm;
  notesField: keyof InspectionForm;
  options: { value: string; label: string }[];
  placeholder: string;
}

const okServiceOptions = [
  { value: 'ok', label: 'Ok' },
  { value: 'needs service', label: 'Needs Service' },
];

const okServiceFields: RatingFieldConfig[] = [
  { label: 'Inverter System', field: 'inverter_system', notesField: 'inverter_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Master Bedroom Bathroom', field: 'master_bathroom', notesField: 'master_bathroom_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Secondary Bathroom', field: 'secondary_bathroom', notesField: 'secondary_bathroom_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Lower Sinks', field: 'lower_sinks', notesField: 'lower_sinks_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Kitchen Sink', field: 'kitchen_sink', notesField: 'kitchen_sink_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Garbage Disposal', field: 'garbage_disposal', notesField: 'garbage_disposal_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Stove Top', field: 'stove_top', notesField: 'stove_top_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Dishwasher', field: 'dishwasher', notesField: 'dishwasher_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Trash Compactor', field: 'trash_compactor', notesField: 'trash_compactor_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: '12 Volt Fans', field: 'volt_fans', notesField: 'volt_fans_notes', options: okServiceOptions, placeholder: 'Document issues...' },
];

const basementFields: RatingFieldConfig[] = [
  { label: 'A/C Filters', field: 'ac_filters', notesField: 'ac_filters_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'A/C Water Pumps', field: 'ac_water_pumps', notesField: 'ac_water_pumps_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Water Filters', field: 'water_filters', notesField: 'water_filters_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Water Pumps and Controls', field: 'water_pumps_controls', notesField: 'water_pumps_controls_notes', options: okServiceOptions, placeholder: 'Document issues...' },
];

const upperDeckFields: RatingFieldConfig[] = [
  { label: 'Upper Deck Bathroom', field: 'upper_deck_bathroom', notesField: 'upper_deck_bathroom_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Kitchen Sink', field: 'upper_kitchen_sink', notesField: 'upper_kitchen_sink_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Disposal', field: 'upper_disposal', notesField: 'upper_disposal_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Icemaker', field: 'icemaker', notesField: 'icemaker_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Stove Top', field: 'upper_stove_top', notesField: 'upper_stove_top_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Propane Filled and Connected', field: 'propane', notesField: 'propane_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Windless Anchors Port Side', field: 'windless_port', notesField: 'windless_port_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Windless Anchor Starboard', field: 'windless_starboard', notesField: 'windless_starboard_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Anchors Lines', field: 'anchor_lines', notesField: 'anchor_lines_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'A/C Filter', field: 'upper_ac_filter', notesField: 'upper_ac_filter_notes', options: okServiceOptions, placeholder: 'Document issues...' },
];

const engineCompartmentFields: RatingFieldConfig[] = [
  { label: 'Port Engine Oil', field: 'port_engine_oil', notesField: 'port_engine_oil_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Port Generator Oil', field: 'port_generator_oil', notesField: 'port_generator_oil_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Starboard Generator Oil', field: 'starboard_generator_oil', notesField: 'starboard_generator_oil_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Starboard Engine Oil', field: 'starboard_engine_oil', notesField: 'starboard_engine_oil_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Sea Strainers', field: 'sea_strainers', notesField: 'sea_strainers_notes', options: okServiceOptions, placeholder: 'Document issues...' },
  { label: 'Engine Batteries', field: 'engine_batteries', notesField: 'engine_batteries_notes', options: okServiceOptions, placeholder: 'Document issues...' },
];

const photoCategories = [
  { key: 'port_prop', label: 'Port Prop', color: 'border-blue-500/50 hover:border-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
  { key: 'starboard_prop', label: 'Stbd Prop', color: 'border-cyan-500/50 hover:border-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300' },
  { key: 'damage', label: 'Damage', color: 'border-red-500/50 hover:border-red-400', badge: 'bg-red-500/20 text-red-300' },
  { key: 'general', label: 'General', color: 'border-slate-500/50 hover:border-slate-400', badge: 'bg-slate-500/20 text-slate-300' },
] as const;

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
                ? 'bg-amber-500 text-slate-900'
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
        className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

interface InspectionViewProps {
  form: InspectionForm;
  onFormChange: (form: InspectionForm) => void;
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
  ownerName: string;
  onOwnerNameChange: (name: string) => void;
  photos: InspectionPhoto[];
  onPhotoAdd: (files: FileList | null, category: InspectionPhoto['category']) => void;
  onPhotoRemove: (idx: number) => void;
  onPhotoCaptionChange: (idx: number, caption: string) => void;
}

export default function InspectionView({
  form, onFormChange, onSubmit, loading, error, success,
  allYachts, mechanics, selectedYacht, onYachtChange, selectedMechanic, onMechanicChange,
  ownerName, onOwnerNameChange, photos, onPhotoAdd, onPhotoRemove, onPhotoCaptionChange,
}: InspectionViewProps) {
  const set = (patch: Partial<InspectionForm>) => onFormChange({ ...form, ...patch });
  const photosUploading = photos.some(p => p.uploading);
  const uploadedCount = photos.filter(p => p.url).length;

  const renderRatingField = (cfg: RatingFieldConfig) => (
    <RatingField
      key={cfg.field}
      label={cfg.label}
      value={form[cfg.field] as string}
      options={cfg.options}
      onChange={(v) => set({ [cfg.field]: v } as Partial<InspectionForm>)}
      notesValue={form[cfg.notesField] as string}
      onNotesChange={(v) => set({ [cfg.notesField]: v } as Partial<InspectionForm>)}
      placeholder={cfg.placeholder}
    />
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Section title="Inspection Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="yacht" className="block text-sm font-medium mb-2">Select Yacht</label>
            <select
              id="yacht"
              value={selectedYacht}
              onChange={(e) => onYachtChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white"
              required
            >
              <option value="">Choose a yacht...</option>
              {allYachts.map((yacht) => (
                <option key={yacht.id} value={yacht.id}>{yacht.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="mechanic" className="block text-sm font-medium mb-2">Staff completing Inspection</label>
            <select
              id="mechanic"
              value={selectedMechanic}
              onChange={(e) => onMechanicChange(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white"
              required
            >
              <option value="">Choose staff member...</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.user_id}>
                  {mechanic.first_name} {mechanic.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="ownerName" className="block text-sm font-medium mb-2">Owner Name (for this trip)</label>
            <input
              id="ownerName"
              type="text"
              value={ownerName}
              onChange={(e) => onOwnerNameChange(e.target.value)}
              placeholder="Enter owner's name..."
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-500"
            />
          </div>
        </div>
      </Section>

      <Section title="Exterior Hull">
        <div className="space-y-6">
          <RatingField
            label="Hull Damage"
            value={form.hull_condition}
            options={[{ value: 'excellent', label: 'No new damage' }, { value: 'poor', label: 'New damage' }]}
            onChange={(v) => set({ hull_condition: v })}
            notesValue={form.hull_notes}
            onNotesChange={(v) => set({ hull_notes: v })}
            placeholder="Notate new damage here"
          />
          <RatingField
            label="Shore Cords"
            value={form.deck_condition}
            options={[{ value: 'excellent', label: 'OK' }, { value: 'poor', label: 'Need repairs' }]}
            onChange={(v) => set({ deck_condition: v })}
            notesValue={form.deck_notes}
            onNotesChange={(v) => set({ deck_notes: v })}
            placeholder="Notate repairs need or replacement"
          />
          <RatingField
            label="Trash Removed from Storage Compartment"
            value={form.trash_removed}
            options={[{ value: 'ok', label: 'OK' }, { value: 'needs_service', label: 'Needs Service' }]}
            onChange={(v) => set({ trash_removed: v })}
            notesValue={form.trash_removed_notes}
            onNotesChange={(v) => set({ trash_removed_notes: v })}
            placeholder="Additional notes"
          />
        </div>
      </Section>

      <Section title="Engine Hours">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Port Engine Hours', field: 'port_engine_hours' },
            { label: 'Starboard Engine Hours', field: 'stbd_engine_hours' },
            { label: 'Port Generator Hours', field: 'port_gen_hours' },
            { label: 'Starboard Generator Hours', field: 'stbd_gen_hours' },
          ].map((h) => (
            <div key={h.field}>
              <label className="block text-sm font-medium mb-2">{h.label} <span className="text-red-400">*</span></label>
              <input
                type="number"
                step="0.1"
                value={form[h.field as keyof InspectionForm] as string}
                onChange={(e) => set({ [h.field]: e.target.value } as Partial<InspectionForm>)}
                placeholder="Enter hours"
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400"
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Main Cabin">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {okServiceFields.map(renderRatingField)}
        </div>
      </Section>

      <Section title="Lower Basement Equipment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {basementFields.map(renderRatingField)}
        </div>
      </Section>

      <Section title="Upper Deck">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {upperDeckFields.map(renderRatingField)}
        </div>
      </Section>

      <Section title="Engine Compartment">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {engineCompartmentFields.map(renderRatingField)}
        </div>
      </Section>

      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Camera className="w-5 h-5 text-amber-400" />
          Inspection Photos
        </h3>
        <p className="text-slate-400 text-sm mb-4">Upload photos from your GoPro or camera roll — props, damage, or general condition.</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {photoCategories.map((cat) => (
            <label key={cat.key} className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${cat.color} bg-slate-900/40`}>
              <Camera className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-300">{cat.label}</span>
              <span className="text-xs text-slate-500">Add Photos</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => onPhotoAdd(e.target.files, cat.key)}
              />
            </label>
          ))}
        </div>

        {photos.length > 0 && (
          <div>
            <p className="text-sm font-medium text-slate-300 mb-3">
              {uploadedCount}/{photos.length} photo{photos.length !== 1 ? 's' : ''} uploaded
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-start">
              {photos.map((photo, idx) => {
                const cat = photoCategories.find(c => c.key === photo.category)!;
                return (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-900/60">
                    <img
                      src={photo.preview}
                      alt={photo.caption || `Photo ${idx + 1}`}
                      className="w-full object-cover"
                      style={{ height: (photo.category === 'port_prop' || photo.category === 'starboard_prop') ? '154px' : '128px' }}
                    />
                    {photo.uploading && (
                      <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-1" />
                          <span className="text-xs text-amber-300">Uploading...</span>
                        </div>
                      </div>
                    )}
                    {photo.error && (
                      <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center p-2">
                        <span className="text-xs text-red-200 text-center">{photo.error}</span>
                      </div>
                    )}
                    {photo.url && !photo.uploading && (
                      <div className="absolute bottom-1.5 right-1.5 bg-green-500/90 rounded-full p-0.5">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="absolute top-1.5 left-1.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.badge}`}>{cat.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPhotoRemove(idx)}
                      className="absolute top-1.5 right-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <div className="p-2">
                      <input
                        type="text"
                        value={photo.caption}
                        onChange={(e) => onPhotoCaptionChange(idx, e.target.value)}
                        placeholder="Add caption..."
                        className="w-full text-xs bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Section title="Any Other Issues">
        <div className="space-y-6">
          <div>
            <label htmlFor="additionalNotes" className="block text-sm font-medium mb-2">Additional Notes</label>
            <textarea
              id="additionalNotes"
              value={form.additional_notes}
              onChange={(e) => set({ additional_notes: e.target.value })}
              placeholder="Any other observations or concerns..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-amber-500 transition-colors text-white placeholder-slate-400 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              id="issuesFound"
              type="checkbox"
              checked={form.issues_found}
              onChange={(e) => set({ issues_found: e.target.checked })}
              className="w-5 h-5 rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="issuesFound" className="text-sm font-medium">Issues found that require attention</label>
          </div>
        </div>
      </Section>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded-lg text-sm">
          Inspection submitted successfully!
        </div>
      )}

      <button
        type="submit"
        disabled={loading || photosUploading}
        className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <ClipboardCheck className="w-5 h-5" />
        {photosUploading ? 'Uploading Photos...' : loading ? 'Submitting...' : `Submit Inspection${uploadedCount > 0 ? ` (${uploadedCount} photo${uploadedCount !== 1 ? 's' : ''})` : ''}`}
      </button>
    </form>
  );
}
