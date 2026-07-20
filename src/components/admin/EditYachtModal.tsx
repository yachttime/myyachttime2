import { X } from 'lucide-react';
import { supabase, Yacht, UserProfile, logYachtActivity } from '../../lib/supabase';

export interface YachtFormState {
  name: string;
  hull_number: string;
  manufacturer: string;
  year: string;
  size: string;
  port_engine: string;
  starboard_engine: string;
  port_generator: string;
  starboard_generator: string;
  marina_name: string;
  slip_location: string;
  wifi_name: string;
  wifi_password: string;
}

export type EngineGenFormEntry = { id?: string; label: string; description: string; season_start_hours: string };

export const EMPTY_YACHT_FORM: YachtFormState = {
  name: '',
  hull_number: '',
  manufacturer: '',
  year: '',
  size: '',
  port_engine: '',
  starboard_engine: '',
  port_generator: '',
  starboard_generator: '',
  marina_name: '',
  slip_location: '',
  wifi_name: '',
  wifi_password: ''
};

interface EditYachtModalProps {
  editingYacht: Yacht;
  yachtForm: YachtFormState;
  setYachtForm: React.Dispatch<React.SetStateAction<YachtFormState>>;
  enginesForm: EngineGenFormEntry[];
  setEnginesForm: React.Dispatch<React.SetStateAction<EngineGenFormEntry[]>>;
  generatorsForm: EngineGenFormEntry[];
  setGeneratorsForm: React.Dispatch<React.SetStateAction<EngineGenFormEntry[]>>;
  yachtLoading: boolean;
  yachtError: string;
  setYachtError: (v: string) => void;
  setYachtLoading: (v: boolean) => void;
  setYachtSuccess: (v: boolean) => void;
  onClose: () => void;
  userProfile: UserProfile | null;
  currentUserId?: string;
  onSaved: () => Promise<void>;
}

export default function EditYachtModal({
  editingYacht, yachtForm, setYachtForm, enginesForm, setEnginesForm,
  generatorsForm, setGeneratorsForm, yachtLoading, yachtError, setYachtError,
  setYachtLoading, setYachtSuccess, onClose, userProfile, currentUserId, onSaved
}: EditYachtModalProps) {
  const handleClose = () => {
    setEnginesForm([]);
    setGeneratorsForm([]);
    setYachtForm(EMPTY_YACHT_FORM);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setYachtLoading(true);
    setYachtError('');

    try {
      const { error } = await supabase.from('yachts').update({
        name: yachtForm.name,
        hull_number: yachtForm.hull_number,
        manufacturer: yachtForm.manufacturer,
        year: yachtForm.year ? parseInt(yachtForm.year) : null,
        size: yachtForm.size,
        port_engine: yachtForm.port_engine,
        starboard_engine: yachtForm.starboard_engine,
        port_generator: yachtForm.port_generator,
        starboard_generator: yachtForm.starboard_generator,
        marina_name: yachtForm.marina_name,
        slip_location: yachtForm.slip_location,
        wifi_name: yachtForm.wifi_name,
        wifi_password: yachtForm.wifi_password,
      }).eq('id', editingYacht.id);

      if (error) throw error;

      const existingEngineIds = (editingYacht.yacht_engines || []).map(e => e.id);
      const keepEngineIds = enginesForm.filter(e => e.id).map(e => e.id!);
      const deleteEngineIds = existingEngineIds.filter(id => !keepEngineIds.includes(id));
      if (deleteEngineIds.length > 0) {
        await supabase.from('yacht_engines').delete().in('id', deleteEngineIds);
      }
      for (let i = 0; i < enginesForm.length; i++) {
        const eng = enginesForm[i];
        if (!eng.label.trim()) continue;
        const payload = {
          yacht_id: editingYacht.id,
          label: eng.label.trim(),
          description: eng.description.trim(),
          season_start_hours: eng.season_start_hours ? parseFloat(eng.season_start_hours) : null,
          sort_order: i,
          company_id: userProfile?.company_id
        };
        if (eng.id) {
          await supabase.from('yacht_engines').update(payload).eq('id', eng.id);
        } else {
          await supabase.from('yacht_engines').insert(payload);
        }
      }

      const existingGenIds = (editingYacht.yacht_generators || []).map(g => g.id);
      const keepGenIds = generatorsForm.filter(g => g.id).map(g => g.id!);
      const deleteGenIds = existingGenIds.filter(id => !keepGenIds.includes(id));
      if (deleteGenIds.length > 0) {
        await supabase.from('yacht_generators').delete().in('id', deleteGenIds);
      }
      for (let i = 0; i < generatorsForm.length; i++) {
        const gen = generatorsForm[i];
        if (!gen.label.trim()) continue;
        const payload = {
          yacht_id: editingYacht.id,
          label: gen.label.trim(),
          description: gen.description.trim(),
          season_start_hours: gen.season_start_hours ? parseFloat(gen.season_start_hours) : null,
          sort_order: i,
          company_id: userProfile?.company_id
        };
        if (gen.id) {
          await supabase.from('yacht_generators').update(payload).eq('id', gen.id);
        } else {
          await supabase.from('yacht_generators').insert(payload);
        }
      }

      const userName = userProfile?.first_name && userProfile?.last_name
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : userProfile?.email || 'Unknown';
      await logYachtActivity(
        editingYacht.id,
        editingYacht.name,
        `Yacht information was updated`,
        currentUserId,
        userName
      );

      setYachtSuccess(true);
      setEnginesForm([]);
      setGeneratorsForm([]);
      setYachtForm(EMPTY_YACHT_FORM);
      await onSaved();

      setTimeout(() => setYachtSuccess(false), 3000);
    } catch (err: any) {
      setYachtError(err.message || 'Failed to update yacht');
    } finally {
      setYachtLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold">Edit Yacht Information: {editingYacht.name}</h3>
          <button onClick={handleClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Yacht Name *</label>
              <input type="text" required value={yachtForm.name} onChange={(e) => setYachtForm({...yachtForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., Sea Dream" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hull Number</label>
              <input type="text" value={yachtForm.hull_number} onChange={(e) => setYachtForm({...yachtForm, hull_number: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., HIN123456" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Manufacturer</label>
              <input type="text" value={yachtForm.manufacturer} onChange={(e) => setYachtForm({...yachtForm, manufacturer: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., Sunseeker, Azimut" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Year</label>
              <input type="number" value={yachtForm.year} onChange={(e) => setYachtForm({...yachtForm, year: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., 2020" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Size</label>
              <input type="text" value={yachtForm.size} onChange={(e) => setYachtForm({...yachtForm, size: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., 75 ft" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Marina Name</label>
              <input type="text" value={yachtForm.marina_name} onChange={(e) => setYachtForm({...yachtForm, marina_name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., Harbor Bay Marina" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Slip Location</label>
              <input type="text" value={yachtForm.slip_location} onChange={(e) => setYachtForm({...yachtForm, slip_location: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., Dock A, Slip 12" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">WiFi Name</label>
              <input type="text" value={yachtForm.wifi_name} onChange={(e) => setYachtForm({...yachtForm, wifi_name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g., YachtWiFi" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">WiFi Password</label>
              <input type="text" value={yachtForm.wifi_password} onChange={(e) => setYachtForm({...yachtForm, wifi_password: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="Enter WiFi password" />
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Engines</h4>
              <button type="button" onClick={() => setEnginesForm([...enginesForm, { label: '', description: '', season_start_hours: '' }])} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">+ Add Engine</button>
            </div>
            {enginesForm.length === 0 && <p className="text-xs text-slate-500 mb-3">No engines added yet.</p>}
            {enginesForm.map((eng, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-3 mb-2 grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={eng.label} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], label: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Label (e.g. Port Engine)" />
                  <input type="text" value={eng.description} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], description: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Description (e.g. Cat C18 1000HP)" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Season Start Hours</label>
                    <input type="number" step="0.1" min="0" value={eng.season_start_hours} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], season_start_hours: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="e.g. 1250.5" />
                  </div>
                  <button type="button" onClick={() => setEnginesForm(enginesForm.filter((_, j) => j !== i))} className="mt-5 p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Generators</h4>
              <button type="button" onClick={() => setGeneratorsForm([...generatorsForm, { label: '', description: '', season_start_hours: '' }])} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">+ Add Generator</button>
            </div>
            {generatorsForm.length === 0 && <p className="text-xs text-slate-500 mb-3">No generators added yet.</p>}
            {generatorsForm.map((gen, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-3 mb-2 grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={gen.label} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], label: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Label (e.g. Port Generator)" />
                  <input type="text" value={gen.description} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], description: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Description (e.g. Northern Lights 27kW)" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Season Start Hours</label>
                    <input type="number" step="0.1" min="0" value={gen.season_start_hours} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], season_start_hours: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="e.g. 850.0" />
                  </div>
                  <button type="button" onClick={() => setGeneratorsForm(generatorsForm.filter((_, j) => j !== i))} className="mt-5 p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>

          {yachtError && (
            <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-lg text-sm">
              {yachtError}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={handleClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-lg transition-all duration-300">
              Cancel
            </button>
            <button type="submit" disabled={yachtLoading} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 rounded-lg transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
              {yachtLoading ? 'Updating...' : 'Update Yacht'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
