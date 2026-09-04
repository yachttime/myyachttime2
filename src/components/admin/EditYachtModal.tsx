import { X } from 'lucide-react';
import { supabase, Yacht, UserProfile, logYachtActivity } from '../../lib/supabase';
import PartNumberSearchInput from './PartNumberSearchInput';
import CatalogSearchDropdown from './CatalogSearchDropdown';

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

export type EngineGenFormEntry = {
  id?: string;
  catalog_id?: string;
  label: string;
  description: string;
  model_number: string;
  serial_number: string;
  season_start_hours: string;
  fuel_type: string;
  oil_filter_part_number: string;
  oil_filter_alt1: string;
  oil_filter_alt2: string;
  fuel_filter_part_number: string;
  fuel_filter_alt1: string;
  fuel_filter_alt2: string;
  impeller_part_number: string;
  impeller_alt1: string;
  impeller_alt2: string;
  belt1_part_number: string;
  belt1_alt1: string;
  belt1_alt2: string;
  belt2_part_number: string;
  belt2_alt1: string;
  belt2_alt2: string;
  oil_weight: string;
  oil_quantity: string;
  spark_plug_part_number: string;
  distributor_cap_part_number: string;
  rotor_part_number: string;
  plug_wires_part_number: string;
  include_oil_filter: boolean;
  include_fuel_filter: boolean;
  include_impeller: boolean;
  include_belt1: boolean;
  include_belt2: boolean;
  include_spark_plug: boolean;
  include_distributor_cap: boolean;
  include_rotor: boolean;
  include_plug_wires: boolean;
  include_oil_weight: boolean;
  include_oil_quantity: boolean;
  include_oil_filter_alt1: boolean;
  include_oil_filter_alt2: boolean;
  include_fuel_filter_alt1: boolean;
  include_fuel_filter_alt2: boolean;
  include_impeller_alt1: boolean;
  include_impeller_alt2: boolean;
  include_belt1_alt1: boolean;
  include_belt1_alt2: boolean;
  include_belt2_alt1: boolean;
  include_belt2_alt2: boolean;
};

export const EMPTY_SERVICE_PARTS = {
  fuel_type: 'diesel',
  oil_filter_part_number: '',
  oil_filter_alt1: '',
  oil_filter_alt2: '',
  fuel_filter_part_number: '',
  fuel_filter_alt1: '',
  fuel_filter_alt2: '',
  impeller_part_number: '',
  impeller_alt1: '',
  impeller_alt2: '',
  belt1_part_number: '',
  belt1_alt1: '',
  belt1_alt2: '',
  belt2_part_number: '',
  belt2_alt1: '',
  belt2_alt2: '',
  oil_weight: '',
  oil_quantity: '',
  spark_plug_part_number: '',
  distributor_cap_part_number: '',
  rotor_part_number: '',
  plug_wires_part_number: '',
  include_oil_filter: true,
  include_fuel_filter: true,
  include_impeller: true,
  include_belt1: true,
  include_belt2: true,
  include_spark_plug: true,
  include_distributor_cap: true,
  include_rotor: true,
  include_plug_wires: true,
  include_oil_weight: true,
  include_oil_quantity: true,
  include_oil_filter_alt1: true,
  include_oil_filter_alt2: true,
  include_fuel_filter_alt1: true,
  include_fuel_filter_alt2: true,
  include_impeller_alt1: true,
  include_impeller_alt2: true,
  include_belt1_alt1: true,
  include_belt1_alt2: true,
  include_belt2_alt1: true,
  include_belt2_alt2: true,
};

export const EMPTY_ENGINE_GEN_ENTRY: Omit<EngineGenFormEntry, 'id'> = {
  catalog_id: undefined,
  label: '',
  description: '',
  model_number: '',
  serial_number: '',
  season_start_hours: '',
  ...EMPTY_SERVICE_PARTS,
};

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
  const safeTrim = (v: unknown): string => (typeof v === 'string' ? v : '').trim();

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
        const { error: delEngErr } = await supabase.from('yacht_engines').delete().in('id', deleteEngineIds);
        if (delEngErr) throw new Error(`Failed to delete removed engines: ${delEngErr.message}`);
      }
      for (let i = 0; i < enginesForm.length; i++) {
        const eng = enginesForm[i];
        if (!safeTrim(eng.label)) continue;
        const payload = {
          yacht_id: editingYacht.id,
          label: safeTrim(eng.label),
          catalog_id: eng.catalog_id || null,
          description: safeTrim(eng.description),
          model_number: safeTrim(eng.model_number),
          serial_number: safeTrim(eng.serial_number),
          season_start_hours: eng.season_start_hours ? parseFloat(eng.season_start_hours) : null,
          sort_order: i,
          company_id: userProfile?.company_id,
          fuel_type: eng.fuel_type || 'diesel',
          oil_filter_part_number: safeTrim(eng.oil_filter_part_number),
          oil_filter_alt1: safeTrim(eng.oil_filter_alt1),
          oil_filter_alt2: safeTrim(eng.oil_filter_alt2),
          fuel_filter_part_number: safeTrim(eng.fuel_filter_part_number),
          fuel_filter_alt1: safeTrim(eng.fuel_filter_alt1),
          fuel_filter_alt2: safeTrim(eng.fuel_filter_alt2),
          impeller_part_number: safeTrim(eng.impeller_part_number),
          impeller_alt1: safeTrim(eng.impeller_alt1),
          impeller_alt2: safeTrim(eng.impeller_alt2),
          belt1_part_number: safeTrim(eng.belt1_part_number),
          belt1_alt1: safeTrim(eng.belt1_alt1),
          belt1_alt2: safeTrim(eng.belt1_alt2),
          belt2_part_number: safeTrim(eng.belt2_part_number),
          belt2_alt1: safeTrim(eng.belt2_alt1),
          belt2_alt2: safeTrim(eng.belt2_alt2),
          oil_weight: safeTrim(eng.oil_weight),
          oil_quantity: safeTrim(eng.oil_quantity),
          spark_plug_part_number: safeTrim(eng.spark_plug_part_number),
          distributor_cap_part_number: safeTrim(eng.distributor_cap_part_number),
          rotor_part_number: safeTrim(eng.rotor_part_number),
          plug_wires_part_number: safeTrim(eng.plug_wires_part_number),
          include_oil_filter: eng.include_oil_filter !== false,
          include_fuel_filter: eng.include_fuel_filter !== false,
          include_impeller: eng.include_impeller !== false,
          include_belt1: eng.include_belt1 !== false,
          include_belt2: eng.include_belt2 !== false,
          include_spark_plug: eng.include_spark_plug !== false,
          include_distributor_cap: eng.include_distributor_cap !== false,
          include_rotor: eng.include_rotor !== false,
          include_plug_wires: eng.include_plug_wires !== false,
          include_oil_weight: eng.include_oil_weight !== false,
          include_oil_quantity: eng.include_oil_quantity !== false,
          include_oil_filter_alt1: eng.include_oil_filter_alt1 !== false,
          include_oil_filter_alt2: eng.include_oil_filter_alt2 !== false,
          include_fuel_filter_alt1: eng.include_fuel_filter_alt1 !== false,
          include_fuel_filter_alt2: eng.include_fuel_filter_alt2 !== false,
          include_impeller_alt1: eng.include_impeller_alt1 !== false,
          include_impeller_alt2: eng.include_impeller_alt2 !== false,
          include_belt1_alt1: eng.include_belt1_alt1 !== false,
          include_belt1_alt2: eng.include_belt1_alt2 !== false,
          include_belt2_alt1: eng.include_belt2_alt1 !== false,
          include_belt2_alt2: eng.include_belt2_alt2 !== false,
        };
        if (eng.id) {
          const { error: engErr } = await supabase.from('yacht_engines').update(payload).eq('id', eng.id);
          if (engErr) throw new Error(`Engine "${eng.label}": ${engErr.message}`);
        } else {
          const { error: engErr } = await supabase.from('yacht_engines').insert(payload);
          if (engErr) throw new Error(`Engine "${eng.label}": ${engErr.message}`);
        }
      }

      const existingGenIds = (editingYacht.yacht_generators || []).map(g => g.id);
      const keepGenIds = generatorsForm.filter(g => g.id).map(g => g.id!);
      const deleteGenIds = existingGenIds.filter(id => !keepGenIds.includes(id));
      if (deleteGenIds.length > 0) {
        const { error: delGenErr } = await supabase.from('yacht_generators').delete().in('id', deleteGenIds);
        if (delGenErr) throw new Error(`Failed to delete removed generators: ${delGenErr.message}`);
      }
      for (let i = 0; i < generatorsForm.length; i++) {
        const gen = generatorsForm[i];
        if (!safeTrim(gen.label)) continue;
        const payload = {
          yacht_id: editingYacht.id,
          label: safeTrim(gen.label),
          catalog_id: gen.catalog_id || null,
          description: safeTrim(gen.description),
          model_number: safeTrim(gen.model_number),
          serial_number: safeTrim(gen.serial_number),
          season_start_hours: gen.season_start_hours ? parseFloat(gen.season_start_hours) : null,
          sort_order: i,
          company_id: userProfile?.company_id,
          fuel_type: gen.fuel_type || 'diesel',
          oil_filter_part_number: safeTrim(gen.oil_filter_part_number),
          oil_filter_alt1: safeTrim(gen.oil_filter_alt1),
          oil_filter_alt2: safeTrim(gen.oil_filter_alt2),
          fuel_filter_part_number: safeTrim(gen.fuel_filter_part_number),
          fuel_filter_alt1: safeTrim(gen.fuel_filter_alt1),
          fuel_filter_alt2: safeTrim(gen.fuel_filter_alt2),
          impeller_part_number: safeTrim(gen.impeller_part_number),
          impeller_alt1: safeTrim(gen.impeller_alt1),
          impeller_alt2: safeTrim(gen.impeller_alt2),
          belt1_part_number: safeTrim(gen.belt1_part_number),
          belt1_alt1: safeTrim(gen.belt1_alt1),
          belt1_alt2: safeTrim(gen.belt1_alt2),
          belt2_part_number: safeTrim(gen.belt2_part_number),
          belt2_alt1: safeTrim(gen.belt2_alt1),
          belt2_alt2: safeTrim(gen.belt2_alt2),
          oil_weight: safeTrim(gen.oil_weight),
          oil_quantity: safeTrim(gen.oil_quantity),
          spark_plug_part_number: safeTrim(gen.spark_plug_part_number),
          distributor_cap_part_number: safeTrim(gen.distributor_cap_part_number),
          rotor_part_number: safeTrim(gen.rotor_part_number),
          plug_wires_part_number: safeTrim(gen.plug_wires_part_number),
          include_oil_filter: gen.include_oil_filter !== false,
          include_fuel_filter: gen.include_fuel_filter !== false,
          include_impeller: gen.include_impeller !== false,
          include_belt1: gen.include_belt1 !== false,
          include_belt2: gen.include_belt2 !== false,
          include_spark_plug: gen.include_spark_plug !== false,
          include_distributor_cap: gen.include_distributor_cap !== false,
          include_rotor: gen.include_rotor !== false,
          include_plug_wires: gen.include_plug_wires !== false,
          include_oil_weight: gen.include_oil_weight !== false,
          include_oil_quantity: gen.include_oil_quantity !== false,
          include_oil_filter_alt1: gen.include_oil_filter_alt1 !== false,
          include_oil_filter_alt2: gen.include_oil_filter_alt2 !== false,
          include_fuel_filter_alt1: gen.include_fuel_filter_alt1 !== false,
          include_fuel_filter_alt2: gen.include_fuel_filter_alt2 !== false,
          include_impeller_alt1: gen.include_impeller_alt1 !== false,
          include_impeller_alt2: gen.include_impeller_alt2 !== false,
          include_belt1_alt1: gen.include_belt1_alt1 !== false,
          include_belt1_alt2: gen.include_belt1_alt2 !== false,
          include_belt2_alt1: gen.include_belt2_alt1 !== false,
          include_belt2_alt2: gen.include_belt2_alt2 !== false,
        };
        if (gen.id) {
          const { error: genErr } = await supabase.from('yacht_generators').update(payload).eq('id', gen.id);
          if (genErr) throw new Error(`Generator "${gen.label}": ${genErr.message}`);
        } else {
          const { error: genErr } = await supabase.from('yacht_generators').insert(payload);
          if (genErr) throw new Error(`Generator "${gen.label}": ${genErr.message}`);
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
              <button type="button" onClick={() => setEnginesForm([...enginesForm, { ...EMPTY_ENGINE_GEN_ENTRY }])} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">+ Add Engine</button>
            </div>
            {enginesForm.length === 0 && <p className="text-xs text-slate-500 mb-3">No engines added yet.</p>}
            {enginesForm.map((eng, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-3 mb-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={eng.label} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], label: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Label (e.g. Port Engine)" />
                  <input type="text" value={eng.description} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], description: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Description (e.g. Cat C18 1000HP)" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={eng.model_number} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], model_number: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Model Number" />
                  <input type="text" value={eng.serial_number} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], serial_number: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Serial Number" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Season Start Hours</label>
                    <input type="number" step="0.1" min="0" value={eng.season_start_hours} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], season_start_hours: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="e.g. 1250.5" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Fuel Type</label>
                    <select value={eng.fuel_type} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], fuel_type: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500">
                      <option value="diesel">Diesel</option>
                      <option value="gas">Gas</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => setEnginesForm(enginesForm.filter((_, j) => j !== i))} className="mt-5 p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="border-t border-slate-700 pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-400 flex-1">Service Parts</p>
                    <CatalogSearchDropdown
                      equipmentType="engine"
                      onSelect={(cat) => { const a = [...enginesForm]; a[i] = { ...a[i], ...cat }; setEnginesForm(a); }}
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      placeholder="Pick from engine database..."
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_oil_filter} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_oil_filter: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Oil Filter P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_oil_filter_alt1} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_oil_filter_alt1: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Oil Filter Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_oil_filter_alt2} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_oil_filter_alt2: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Oil Filter Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={eng.oil_filter_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], oil_filter_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Filter P/N" />
                    <PartNumberSearchInput value={eng.oil_filter_alt1} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], oil_filter_alt1: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Filter Alt 1" />
                    <PartNumberSearchInput value={eng.oil_filter_alt2} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], oil_filter_alt2: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Filter Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_fuel_filter} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_fuel_filter: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Fuel Filter P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_fuel_filter_alt1} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_fuel_filter_alt1: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Fuel Filter Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_fuel_filter_alt2} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_fuel_filter_alt2: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Fuel Filter Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={eng.fuel_filter_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], fuel_filter_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Fuel Filter P/N" />
                    <PartNumberSearchInput value={eng.fuel_filter_alt1} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], fuel_filter_alt1: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Fuel Filter Alt 1" />
                    <PartNumberSearchInput value={eng.fuel_filter_alt2} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], fuel_filter_alt2: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Fuel Filter Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_impeller} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_impeller: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Impeller P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_impeller_alt1} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_impeller_alt1: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Impeller Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_impeller_alt2} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_impeller_alt2: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Impeller Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={eng.impeller_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], impeller_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Impeller P/N" />
                    <PartNumberSearchInput value={eng.impeller_alt1} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], impeller_alt1: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Impeller Alt 1" />
                    <PartNumberSearchInput value={eng.impeller_alt2} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], impeller_alt2: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Impeller Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_belt1} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_belt1: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Belt 1 P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_belt1_alt1} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_belt1_alt1: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Belt 1 Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_belt1_alt2} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_belt1_alt2: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Belt 1 Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={eng.belt1_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], belt1_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 1 P/N" />
                    <PartNumberSearchInput value={eng.belt1_alt1} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], belt1_alt1: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 1 Alt 1" />
                    <PartNumberSearchInput value={eng.belt1_alt2} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], belt1_alt2: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 1 Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_belt2} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_belt2: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Belt 2 P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_belt2_alt1} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_belt2_alt1: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Belt 2 Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_belt2_alt2} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_belt2_alt2: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Belt 2 Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={eng.belt2_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], belt2_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 2 P/N" />
                    <PartNumberSearchInput value={eng.belt2_alt1} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], belt2_alt1: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 2 Alt 1" />
                    <PartNumberSearchInput value={eng.belt2_alt2} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], belt2_alt2: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 2 Alt 2" />
                  </div>
                  <div className="grid grid-cols-2 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_oil_weight} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_oil_weight: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Oil Weight (e.g. 15W-40)</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_oil_quantity} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_oil_quantity: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Oil Quantity (e.g. 8 qts)</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PartNumberSearchInput value={eng.oil_weight} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], oil_weight: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Weight (e.g. 15W-40)" />
                    <input type="text" value={eng.oil_quantity} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], oil_quantity: e.target.value}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Quantity (e.g. 8 qts)" />
                  </div>
                  {eng.fuel_type === 'gas' && (
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-700 pt-2">
                      <p className="col-span-2 text-xs font-semibold text-slate-400">Gas Ignition Parts</p>
                      <div className="grid grid-cols-2 gap-1 mb-0.5">
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_spark_plug} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_spark_plug: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Spark Plug P/N</label>
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_distributor_cap} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_distributor_cap: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Distributor Cap P/N</label>
                      </div>
                      <PartNumberSearchInput value={eng.spark_plug_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], spark_plug_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Spark Plug P/N" />
                      <PartNumberSearchInput value={eng.distributor_cap_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], distributor_cap_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Distributor Cap P/N" />
                      <div className="grid grid-cols-2 gap-1 mb-0.5">
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_rotor} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_rotor: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Rotor P/N</label>
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={eng.include_plug_wires} onChange={(e) => { const a = [...enginesForm]; a[i] = {...a[i], include_plug_wires: e.target.checked}; setEnginesForm(a); } } className="w-3 h-3" />Plug Wires P/N</label>
                      </div>
                      <PartNumberSearchInput value={eng.rotor_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], rotor_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Rotor P/N" />
                      <PartNumberSearchInput value={eng.plug_wires_part_number} onChange={(v) => { const a = [...enginesForm]; a[i] = {...a[i], plug_wires_part_number: v}; setEnginesForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Plug Wires P/N" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-300">Generators</h4>
              <button type="button" onClick={() => setGeneratorsForm([...generatorsForm, { ...EMPTY_ENGINE_GEN_ENTRY }])} className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">+ Add Generator</button>
            </div>
            {generatorsForm.length === 0 && <p className="text-xs text-slate-500 mb-3">No generators added yet.</p>}
            {generatorsForm.map((gen, i) => (
              <div key={i} className="bg-slate-900/50 rounded-lg p-3 mb-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={gen.label} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], label: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Label (e.g. Port Generator)" />
                  <input type="text" value={gen.description} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], description: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Description (e.g. Northern Lights 27kW)" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={gen.model_number} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], model_number: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Model Number" />
                  <input type="text" value={gen.serial_number} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], serial_number: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="Serial Number" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Season Start Hours</label>
                    <input type="number" step="0.1" min="0" value={gen.season_start_hours} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], season_start_hours: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" placeholder="e.g. 850.0" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-400 mb-1">Fuel Type</label>
                    <select value={gen.fuel_type} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], fuel_type: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500">
                      <option value="diesel">Diesel</option>
                      <option value="gas">Gas</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => setGeneratorsForm(generatorsForm.filter((_, j) => j !== i))} className="mt-5 p-2 text-red-400 hover:text-red-300 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="border-t border-slate-700 pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-400 flex-1">Service Parts</p>
                    <CatalogSearchDropdown
                      equipmentType="generator"
                      onSelect={(cat) => { const a = [...generatorsForm]; a[i] = { ...a[i], ...cat }; setGeneratorsForm(a); }}
                      className="flex-1 bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      placeholder="Pick from generator database..."
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_oil_filter} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_oil_filter: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Oil Filter P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_oil_filter_alt1} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_oil_filter_alt1: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Oil Filter Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_oil_filter_alt2} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_oil_filter_alt2: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Oil Filter Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={gen.oil_filter_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], oil_filter_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Filter P/N" />
                    <PartNumberSearchInput value={gen.oil_filter_alt1} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], oil_filter_alt1: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Filter Alt 1" />
                    <PartNumberSearchInput value={gen.oil_filter_alt2} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], oil_filter_alt2: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Filter Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_fuel_filter} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_fuel_filter: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Fuel Filter P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_fuel_filter_alt1} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_fuel_filter_alt1: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Fuel Filter Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_fuel_filter_alt2} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_fuel_filter_alt2: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Fuel Filter Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={gen.fuel_filter_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], fuel_filter_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Fuel Filter P/N" />
                    <PartNumberSearchInput value={gen.fuel_filter_alt1} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], fuel_filter_alt1: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Fuel Filter Alt 1" />
                    <PartNumberSearchInput value={gen.fuel_filter_alt2} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], fuel_filter_alt2: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Fuel Filter Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_impeller} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_impeller: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Impeller P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_impeller_alt1} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_impeller_alt1: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Impeller Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_impeller_alt2} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_impeller_alt2: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Impeller Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={gen.impeller_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], impeller_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Impeller P/N" />
                    <PartNumberSearchInput value={gen.impeller_alt1} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], impeller_alt1: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Impeller Alt 1" />
                    <PartNumberSearchInput value={gen.impeller_alt2} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], impeller_alt2: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Impeller Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_belt1} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_belt1: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Belt 1 P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_belt1_alt1} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_belt1_alt1: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Belt 1 Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_belt1_alt2} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_belt1_alt2: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Belt 1 Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={gen.belt1_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], belt1_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 1 P/N" />
                    <PartNumberSearchInput value={gen.belt1_alt1} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], belt1_alt1: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 1 Alt 1" />
                    <PartNumberSearchInput value={gen.belt1_alt2} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], belt1_alt2: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 1 Alt 2" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_belt2} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_belt2: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Belt 2 P/N</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_belt2_alt1} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_belt2_alt1: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Belt 2 Alt 1</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_belt2_alt2} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_belt2_alt2: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Belt 2 Alt 2</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={gen.belt2_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], belt2_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 2 P/N" />
                    <PartNumberSearchInput value={gen.belt2_alt1} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], belt2_alt1: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 2 Alt 1" />
                    <PartNumberSearchInput value={gen.belt2_alt2} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], belt2_alt2: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Belt 2 Alt 2" />
                  </div>
                  <div className="grid grid-cols-2 gap-1 mb-0.5">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_oil_weight} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_oil_weight: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Oil Weight (e.g. 15W-40)</label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_oil_quantity} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_oil_quantity: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Oil Quantity (e.g. 8 qts)</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PartNumberSearchInput value={gen.oil_weight} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], oil_weight: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Weight (e.g. 15W-40)" />
                    <input type="text" value={gen.oil_quantity} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], oil_quantity: e.target.value}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Quantity (e.g. 8 qts)" />
                  </div>
                  {gen.fuel_type === 'gas' && (
                    <div className="grid grid-cols-2 gap-2 border-t border-slate-700 pt-2">
                      <p className="col-span-2 text-xs font-semibold text-slate-400">Gas Ignition Parts</p>
                      <div className="grid grid-cols-2 gap-1 mb-0.5">
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_spark_plug} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_spark_plug: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Spark Plug P/N</label>
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_distributor_cap} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_distributor_cap: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Distributor Cap P/N</label>
                      </div>
                      <PartNumberSearchInput value={gen.spark_plug_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], spark_plug_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Spark Plug P/N" />
                      <PartNumberSearchInput value={gen.distributor_cap_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], distributor_cap_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Distributor Cap P/N" />
                      <div className="grid grid-cols-2 gap-1 mb-0.5">
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_rotor} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_rotor: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Rotor P/N</label>
                        <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1"><input type="checkbox" checked={gen.include_plug_wires} onChange={(e) => { const a = [...generatorsForm]; a[i] = {...a[i], include_plug_wires: e.target.checked}; setGeneratorsForm(a); } } className="w-3 h-3" />Plug Wires P/N</label>
                      </div>
                      <PartNumberSearchInput value={gen.rotor_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], rotor_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Rotor P/N" />
                      <PartNumberSearchInput value={gen.plug_wires_part_number} onChange={(v) => { const a = [...generatorsForm]; a[i] = {...a[i], plug_wires_part_number: v}; setGeneratorsForm(a); }} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Plug Wires P/N" />
                    </div>
                  )}
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
