import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { EMPTY_SERVICE_PARTS, EngineGenFormEntry } from './EditYachtModal';

interface CatalogSearchDropdownProps {
  equipmentType: 'engine' | 'generator';
  onSelect: (catalogEntry: Partial<EngineGenFormEntry> & { catalog_id: string }) => void;
  placeholder?: string;
  className?: string;
}

interface CatalogRow {
  id: string;
  model_name: string;
  manufacturer: string | null;
  description: string | null;
  fuel_type: string;
  oil_filter_part_number: string | null;
  oil_filter_alt1: string | null;
  oil_filter_alt2: string | null;
  fuel_filter_part_number: string | null;
  fuel_filter_alt1: string | null;
  fuel_filter_alt2: string | null;
  impeller_part_number: string | null;
  impeller_alt1: string | null;
  impeller_alt2: string | null;
  belt1_part_number: string | null;
  belt1_alt1: string | null;
  belt1_alt2: string | null;
  belt2_part_number: string | null;
  belt2_alt1: string | null;
  belt2_alt2: string | null;
  oil_weight: string | null;
  oil_quantity: string | null;
  spark_plug_part_number: string | null;
  distributor_cap_part_number: string | null;
  rotor_part_number: string | null;
  plug_wires_part_number: string | null;
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

export default function CatalogSearchDropdown({ equipmentType, onSelect, placeholder = 'Pick from catalog...', className }: CatalogSearchDropdownProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = async (q: string) => {
    if (!q.trim() || q.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('engine_catalog')
      .select('*')
      .eq('equipment_type', equipmentType)
      .or(`model_name.ilike.%${q}%,manufacturer.ilike.%${q}%,description.ilike.%${q}%`)
      .order('manufacturer')
      .order('model_name')
      .limit(20);
    setResults((data || []) as CatalogRow[]);
    setShowDropdown((data || []).length > 0);
    setLoading(false);
  };

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const selectResult = (row: CatalogRow) => {
    const entry: Partial<EngineGenFormEntry> & { catalog_id: string } = {
      catalog_id: row.id,
      description: row.description || '',
      model_number: row.model_name,
      fuel_type: row.fuel_type || 'diesel',
      ...EMPTY_SERVICE_PARTS,
      oil_filter_part_number: row.oil_filter_part_number || '',
      oil_filter_alt1: row.oil_filter_alt1 || '',
      oil_filter_alt2: row.oil_filter_alt2 || '',
      fuel_filter_part_number: row.fuel_filter_part_number || '',
      fuel_filter_alt1: row.fuel_filter_alt1 || '',
      fuel_filter_alt2: row.fuel_filter_alt2 || '',
      impeller_part_number: row.impeller_part_number || '',
      impeller_alt1: row.impeller_alt1 || '',
      impeller_alt2: row.impeller_alt2 || '',
      belt1_part_number: row.belt1_part_number || '',
      belt1_alt1: row.belt1_alt1 || '',
      belt1_alt2: row.belt1_alt2 || '',
      belt2_part_number: row.belt2_part_number || '',
      belt2_alt1: row.belt2_alt1 || '',
      belt2_alt2: row.belt2_alt2 || '',
      oil_weight: row.oil_weight || '',
      oil_quantity: row.oil_quantity || '',
      spark_plug_part_number: row.spark_plug_part_number || '',
      distributor_cap_part_number: row.distributor_cap_part_number || '',
      rotor_part_number: row.rotor_part_number || '',
      plug_wires_part_number: row.plug_wires_part_number || '',
      include_oil_filter: row.include_oil_filter === true,
      include_fuel_filter: row.include_fuel_filter === true,
      include_impeller: row.include_impeller === true,
      include_belt1: row.include_belt1 === true,
      include_belt2: row.include_belt2 === true,
      include_spark_plug: row.include_spark_plug === true,
      include_distributor_cap: row.include_distributor_cap === true,
      include_rotor: row.include_rotor === true,
      include_plug_wires: row.include_plug_wires === true,
      include_oil_weight: row.include_oil_weight === true,
      include_oil_quantity: row.include_oil_quantity === true,
      include_oil_filter_alt1: row.include_oil_filter_alt1 === true,
      include_oil_filter_alt2: row.include_oil_filter_alt2 === true,
      include_fuel_filter_alt1: row.include_fuel_filter_alt1 === true,
      include_fuel_filter_alt2: row.include_fuel_filter_alt2 === true,
      include_impeller_alt1: row.include_impeller_alt1 === true,
      include_impeller_alt2: row.include_impeller_alt2 === true,
      include_belt1_alt1: row.include_belt1_alt1 === true,
      include_belt1_alt2: row.include_belt1_alt2 === true,
      include_belt2_alt1: row.include_belt2_alt1 === true,
      include_belt2_alt2: row.include_belt2_alt2 === true,
    };
    onSelect(entry);
    setQuery('');
    setShowDropdown(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (query.trim().length >= 1) search(query); }}
          className={`${className || ''} pl-7 pr-2`}
          placeholder={placeholder}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {loading && <div className="px-3 py-2 text-xs text-slate-400">Searching catalog...</div>}
          {!loading && results.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No models found</div>}
          {!loading && results.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => selectResult(row)}
              className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-white">{row.model_name}</span>
                  {row.manufacturer && <span className="text-[10px] text-slate-400 ml-1">{row.manufacturer}</span>}
                  {row.description && <span className="text-[10px] text-slate-500 ml-1 truncate">{row.description}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
