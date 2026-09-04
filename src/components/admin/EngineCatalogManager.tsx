import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Copy, X, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import PartNumberSearchInput from './PartNumberSearchInput';
import MercuryPartsLink from './MercuryPartsLink';

export interface EngineCatalogEntry {
  id?: string;
  model_name: string;
  manufacturer: string;
  equipment_type: string;
  description: string;
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
}

const EMPTY_ENTRY: Omit<EngineCatalogEntry, 'id'> = {
  model_name: '',
  manufacturer: '',
  equipment_type: 'engine',
  description: '',
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
  include_oil_filter: false,
  include_fuel_filter: false,
  include_impeller: false,
  include_belt1: false,
  include_belt2: false,
  include_spark_plug: false,
  include_distributor_cap: false,
  include_rotor: false,
  include_plug_wires: false,
  include_oil_weight: false,
  include_oil_quantity: false,
  include_oil_filter_alt1: false,
  include_oil_filter_alt2: false,
  include_fuel_filter_alt1: false,
  include_fuel_filter_alt2: false,
  include_impeller_alt1: false,
  include_impeller_alt2: false,
  include_belt1_alt1: false,
  include_belt1_alt2: false,
  include_belt2_alt1: false,
  include_belt2_alt2: false,
};

const SERVICE_PARTS_FIELDS = [
  { key: 'oil_filter', label: 'Oil Filter', primaryKey: 'oil_filter_part_number', alt1Key: 'oil_filter_alt1', alt2Key: 'oil_filter_alt2', incKey: 'include_oil_filter', inc1Key: 'include_oil_filter_alt1', inc2Key: 'include_oil_filter_alt2' },
  { key: 'fuel_filter', label: 'Fuel Filter', primaryKey: 'fuel_filter_part_number', alt1Key: 'fuel_filter_alt1', alt2Key: 'fuel_filter_alt2', incKey: 'include_fuel_filter', inc1Key: 'include_fuel_filter_alt1', inc2Key: 'include_fuel_filter_alt2' },
  { key: 'impeller', label: 'Impeller', primaryKey: 'impeller_part_number', alt1Key: 'impeller_alt1', alt2Key: 'impeller_alt2', incKey: 'include_impeller', inc1Key: 'include_impeller_alt1', inc2Key: 'include_impeller_alt2' },
  { key: 'belt1', label: 'Belt 1', primaryKey: 'belt1_part_number', alt1Key: 'belt1_alt1', alt2Key: 'belt1_alt2', incKey: 'include_belt1', inc1Key: 'include_belt1_alt1', inc2Key: 'include_belt1_alt2' },
  { key: 'belt2', label: 'Belt 2', primaryKey: 'belt2_part_number', alt1Key: 'belt2_alt1', alt2Key: 'belt2_alt2', incKey: 'include_belt2', inc1Key: 'include_belt2_alt1', inc2Key: 'include_belt2_alt2' },
] as const;

export default function EngineCatalogManager() {
  const [entries, setEntries] = useState<EngineCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EngineCatalogEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EngineCatalogEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('engine_catalog')
      .select('*')
      .order('equipment_type')
      .order('manufacturer')
      .order('model_name');
    if (err) {
      setError(err.message);
    } else {
      setEntries((data || []) as EngineCatalogEntry[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filtered = entries.filter((e) => {
    if (filterType !== 'all' && e.equipment_type !== filterType) return false;
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      e.model_name?.toLowerCase().includes(q) ||
      e.manufacturer?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  const handleSave = async (entry: EngineCatalogEntry) => {
    setError('');
    setSuccess('');
    const payload: Record<string, unknown> = { ...entry };
    delete payload.id;
    if (entry.id) {
      const { error: err } = await supabase.from('engine_catalog').update(payload).eq('id', entry.id);
      if (err) { setError(err.message); return; }
      setSuccess('Catalog entry updated successfully.');
    } else {
      const { error: err } = await supabase.from('engine_catalog').insert(payload);
      if (err) { setError(err.message); return; }
      setSuccess('Catalog entry created successfully.');
    }
    setShowForm(false);
    setEditingEntry(null);
    await fetchEntries();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleDelete = async (entry: EngineCatalogEntry) => {
    if (!entry.id) return;
    const { error: err } = await supabase.from('engine_catalog').delete().eq('id', entry.id);
    if (err) { setError(err.message); return; }
    setDeleteConfirm(null);
    setSuccess('Catalog entry deleted.');
    await fetchEntries();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleClone = (entry: EngineCatalogEntry) => {
    setEditingEntry({ ...entry, id: undefined, model_name: `${entry.model_name} (Copy)` });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Engine &amp; Generator Database</h2>
        <button
          onClick={() => { setEditingEntry(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Model
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500 text-green-400 px-4 py-3 rounded-lg text-sm">{success}</div>}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by model, manufacturer, or description..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">All Types</option>
          <option value="engine">Engines</option>
          <option value="generator">Generators</option>
        </select>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm">Loading catalog...</p>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-slate-700">
          <p className="text-slate-400">No catalog entries found. Click "Add Model" to create your first engine or generator model.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((entry) => (
            <div key={entry.id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${entry.equipment_type === 'engine' ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}`}>
                      {entry.equipment_type === 'engine' ? 'ENGINE' : 'GENERATOR'}
                    </span>
                    <span className="text-[10px] text-slate-500 uppercase">{entry.fuel_type}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white truncate">{entry.model_name}</h3>
                  {entry.manufacturer && <p className="text-xs text-slate-400">{entry.manufacturer}</p>}
                  {entry.description && <p className="text-xs text-slate-500 mt-1">{entry.description}</p>}
                  <MercuryPartsLink manufacturer={entry.manufacturer} />
                </div>
              </div>
              <div className="space-y-1 mb-3">
                {SERVICE_PARTS_FIELDS.map((f) => {
                  const pn = (entry as Record<string, unknown>)[f.primaryKey] as string;
                  if (!pn) return null;
                  return <div key={f.key} className="text-[11px] text-slate-400"><span className="text-slate-500">{f.label}:</span> {pn}</div>;
                })}
                {entry.oil_weight && <div className="text-[11px] text-slate-400"><span className="text-slate-500">Oil:</span> {entry.oil_weight} {entry.oil_quantity && `(${entry.oil_quantity})`}</div>}
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-700">
                <button onClick={() => { setEditingEntry(entry); setShowForm(true); }} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => handleClone(entry)} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  <Copy className="w-3 h-3" /> Clone
                </button>
                <button onClick={() => setDeleteConfirm(entry)} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors ml-auto">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CatalogFormModal
          entry={editingEntry}
          onClose={() => { setShowForm(false); setEditingEntry(null); }}
          onSave={handleSave}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-2">Delete Catalog Entry?</h3>
            <p className="text-sm text-slate-400 mb-4">Are you sure you want to delete "{deleteConfirm.model_name}"? This will not affect engines already added to vessels, but the link to this catalog entry will be removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogFormModal({ entry, onClose, onSave }: { entry: EngineCatalogEntry | null; onClose: () => void; onSave: (e: EngineCatalogEntry) => void }) {
  const [form, setForm] = useState<EngineCatalogEntry>(entry ? { ...entry } : { ...EMPTY_ENTRY });
  const [saving, setSaving] = useState(false);

  const update = (field: keyof EngineCatalogEntry, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold">{entry?.id ? 'Edit Catalog Entry' : 'New Catalog Entry'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Model Name *</label>
              <input type="text" required value={form.model_name} onChange={(e) => update('model_name', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g. C18 ACERT" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Manufacturer</label>
              <input type="text" value={form.manufacturer} onChange={(e) => update('manufacturer', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g. Caterpillar" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Equipment Type *</label>
              <select value={form.equipment_type} onChange={(e) => update('equipment_type', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500">
                <option value="engine">Engine (includes outboards)</option>
                <option value="generator">Generator</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Fuel Type</label>
              <select value={form.fuel_type} onChange={(e) => update('fuel_type', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500">
                <option value="diesel">Diesel</option>
                <option value="gas">Gas</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Description</label>
              <input type="text" value={form.description} onChange={(e) => update('description', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-500" placeholder="e.g. Cat C18 1000HP Diesel" />
            </div>
          </div>

          <div className="border-t border-slate-700 pt-4">
            <p className="text-sm font-semibold text-slate-300 mb-3">Service Parts</p>
            <div className="space-y-3">
              {SERVICE_PARTS_FIELDS.map((f) => (
                <div key={f.key} className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-1">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form[f.incKey] as boolean} onChange={(e) => update(f.incKey, e.target.checked)} className="w-3 h-3" />{f.label} P/N
                    </label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form[f.inc1Key] as boolean} onChange={(e) => update(f.inc1Key, e.target.checked)} className="w-3 h-3" />{f.label} Alt 1
                    </label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form[f.inc2Key] as boolean} onChange={(e) => update(f.inc2Key, e.target.checked)} className="w-3 h-3" />{f.label} Alt 2
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <PartNumberSearchInput value={form[f.primaryKey] as string} onChange={(v) => update(f.primaryKey, v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder={`${f.label} P/N`} />
                    <PartNumberSearchInput value={form[f.alt1Key] as string} onChange={(v) => update(f.alt1Key, v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder={`${f.label} Alt 1`} />
                    <PartNumberSearchInput value={form[f.alt2Key] as string} onChange={(v) => update(f.alt2Key, v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder={`${f.label} Alt 2`} />
                  </div>
                </div>
              ))}
              <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                <div className="grid grid-cols-2 gap-1">
                  <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                    <input type="checkbox" checked={form.include_oil_weight} onChange={(e) => update('include_oil_weight', e.target.checked)} className="w-3 h-3" />Oil Weight (e.g. 15W-40)
                  </label>
                  <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                    <input type="checkbox" checked={form.include_oil_quantity} onChange={(e) => update('include_oil_quantity', e.target.checked)} className="w-3 h-3" />Oil Quantity (e.g. 8 qts)
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PartNumberSearchInput value={form.oil_weight} onChange={(v) => update('oil_weight', v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Weight (e.g. 15W-40)" />
                  <input type="text" value={form.oil_quantity} onChange={(e) => update('oil_quantity', e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Oil Quantity (e.g. 8 qts)" />
                </div>
              </div>
              {form.fuel_type === 'gas' && (
                <div className="bg-slate-900/50 rounded-lg p-3 space-y-2 border-t border-slate-700">
                  <p className="text-xs font-semibold text-slate-400">Gas Ignition Parts</p>
                  <div className="grid grid-cols-2 gap-1">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form.include_spark_plug} onChange={(e) => update('include_spark_plug', e.target.checked)} className="w-3 h-3" />Spark Plug P/N
                    </label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form.include_distributor_cap} onChange={(e) => update('include_distributor_cap', e.target.checked)} className="w-3 h-3" />Distributor Cap P/N
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PartNumberSearchInput value={form.spark_plug_part_number} onChange={(v) => update('spark_plug_part_number', v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Spark Plug P/N" />
                    <PartNumberSearchInput value={form.distributor_cap_part_number} onChange={(v) => update('distributor_cap_part_number', v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Distributor Cap P/N" />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form.include_rotor} onChange={(e) => update('include_rotor', e.target.checked)} className="w-3 h-3" />Rotor P/N
                    </label>
                    <label className="text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1">
                      <input type="checkbox" checked={form.include_plug_wires} onChange={(e) => update('include_plug_wires', e.target.checked)} className="w-3 h-3" />Plug Wires P/N
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <PartNumberSearchInput value={form.rotor_part_number} onChange={(v) => update('rotor_part_number', v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Rotor P/N" />
                    <PartNumberSearchInput value={form.plug_wires_part_number} onChange={(v) => update('plug_wires_part_number', v)} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500" placeholder="Plug Wires P/N" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-4 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : entry?.id ? 'Update Entry' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
