import PartNumberSearchInput from './PartNumberSearchInput';
import type { EngineGenFormEntry, PartField } from '../../utils/servicePartsGroups';

const SERVICE_PART_FIELDS = [
  'oil_filter_part_number', 'oil_filter_alt1', 'oil_filter_alt2',
  'fuel_filter_part_number', 'fuel_filter_alt1', 'fuel_filter_alt2',
  'impeller_part_number', 'impeller_alt1', 'impeller_alt2',
  'belt1_part_number', 'belt1_alt1', 'belt1_alt2',
  'belt2_part_number', 'belt2_alt1', 'belt2_alt2',
  'oil_weight', 'oil_quantity',
  'spark_plug_part_number', 'distributor_cap_part_number',
  'rotor_part_number', 'plug_wires_part_number',
] as const;

const INCLUDE_FIELDS = [
  'include_oil_filter', 'include_oil_filter_alt1', 'include_oil_filter_alt2',
  'include_fuel_filter', 'include_fuel_filter_alt1', 'include_fuel_filter_alt2',
  'include_impeller', 'include_impeller_alt1', 'include_impeller_alt2',
  'include_belt1', 'include_belt1_alt1', 'include_belt1_alt2',
  'include_belt2', 'include_belt2_alt1', 'include_belt2_alt2',
  'include_oil_weight', 'include_oil_quantity',
  'include_spark_plug', 'include_distributor_cap',
  'include_rotor', 'include_plug_wires',
] as const;

export type ServicePartField = typeof SERVICE_PART_FIELDS[number];
export type IncludeField = typeof INCLUDE_FIELDS[number];
export type { PartField };

interface ServicePartsSectionProps {
  entry: EngineGenFormEntry;
  onChange: (field: PartField, value: string | boolean) => void;
  theme: 'dark' | 'light';
}

export default function ServicePartsSection({ entry, onChange, theme }: ServicePartsSectionProps) {
  const isDark = theme === 'dark';
  const labelClass = isDark
    ? 'text-[10px] font-medium text-slate-500 leading-tight flex items-center gap-1'
    : 'text-[10px] font-medium text-gray-600 leading-tight flex items-center gap-1';
  const inputClass = isDark
    ? 'w-full bg-slate-800 border border-slate-600 rounded-lg py-2 text-xs text-white focus:outline-none focus:border-amber-500'
    : 'w-full py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs focus:ring-2 focus:ring-blue-500';
  const textInputClass = isDark
    ? 'w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500'
    : 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-xs focus:ring-2 focus:ring-blue-500';
  const sectionTitle = isDark ? 'text-xs font-semibold text-slate-400' : 'text-xs font-semibold text-gray-500';
  const gasTitle = isDark ? 'text-xs font-semibold text-slate-400' : 'text-xs font-semibold text-gray-500';
  const borderClass = isDark ? 'border-slate-700' : 'border-gray-200';

  return (
    <div className={`border-t ${borderClass} pt-2 space-y-2`}>
      <p className={sectionTitle}>Service Parts</p>

      {/* Oil Filter */}
      <div className="grid grid-cols-3 gap-1 mb-0.5">
        <label className={labelClass}><input type="checkbox" checked={entry.include_oil_filter} onChange={(e) => onChange('include_oil_filter', e.target.checked)} className="w-3 h-3" />Oil Filter P/N</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_oil_filter_alt1} onChange={(e) => onChange('include_oil_filter_alt1', e.target.checked)} className="w-3 h-3" />Oil Filter Alt 1</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_oil_filter_alt2} onChange={(e) => onChange('include_oil_filter_alt2', e.target.checked)} className="w-3 h-3" />Oil Filter Alt 2</label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PartNumberSearchInput value={entry.oil_filter_part_number} onChange={(v) => onChange('oil_filter_part_number', v)} className={inputClass} placeholder="Oil Filter P/N" />
        <PartNumberSearchInput value={entry.oil_filter_alt1} onChange={(v) => onChange('oil_filter_alt1', v)} className={inputClass} placeholder="Oil Filter Alt 1" />
        <PartNumberSearchInput value={entry.oil_filter_alt2} onChange={(v) => onChange('oil_filter_alt2', v)} className={inputClass} placeholder="Oil Filter Alt 2" />
      </div>

      {/* Fuel Filter */}
      <div className="grid grid-cols-3 gap-1 mb-0.5">
        <label className={labelClass}><input type="checkbox" checked={entry.include_fuel_filter} onChange={(e) => onChange('include_fuel_filter', e.target.checked)} className="w-3 h-3" />Fuel Filter P/N</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_fuel_filter_alt1} onChange={(e) => onChange('include_fuel_filter_alt1', e.target.checked)} className="w-3 h-3" />Fuel Filter Alt 1</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_fuel_filter_alt2} onChange={(e) => onChange('include_fuel_filter_alt2', e.target.checked)} className="w-3 h-3" />Fuel Filter Alt 2</label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PartNumberSearchInput value={entry.fuel_filter_part_number} onChange={(v) => onChange('fuel_filter_part_number', v)} className={inputClass} placeholder="Fuel Filter P/N" />
        <PartNumberSearchInput value={entry.fuel_filter_alt1} onChange={(v) => onChange('fuel_filter_alt1', v)} className={inputClass} placeholder="Fuel Filter Alt 1" />
        <PartNumberSearchInput value={entry.fuel_filter_alt2} onChange={(v) => onChange('fuel_filter_alt2', v)} className={inputClass} placeholder="Fuel Filter Alt 2" />
      </div>

      {/* Impeller */}
      <div className="grid grid-cols-3 gap-1 mb-0.5">
        <label className={labelClass}><input type="checkbox" checked={entry.include_impeller} onChange={(e) => onChange('include_impeller', e.target.checked)} className="w-3 h-3" />Impeller P/N</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_impeller_alt1} onChange={(e) => onChange('include_impeller_alt1', e.target.checked)} className="w-3 h-3" />Impeller Alt 1</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_impeller_alt2} onChange={(e) => onChange('include_impeller_alt2', e.target.checked)} className="w-3 h-3" />Impeller Alt 2</label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PartNumberSearchInput value={entry.impeller_part_number} onChange={(v) => onChange('impeller_part_number', v)} className={inputClass} placeholder="Impeller P/N" />
        <PartNumberSearchInput value={entry.impeller_alt1} onChange={(v) => onChange('impeller_alt1', v)} className={inputClass} placeholder="Impeller Alt 1" />
        <PartNumberSearchInput value={entry.impeller_alt2} onChange={(v) => onChange('impeller_alt2', v)} className={inputClass} placeholder="Impeller Alt 2" />
      </div>

      {/* Belt 1 */}
      <div className="grid grid-cols-3 gap-1 mb-0.5">
        <label className={labelClass}><input type="checkbox" checked={entry.include_belt1} onChange={(e) => onChange('include_belt1', e.target.checked)} className="w-3 h-3" />Belt 1 P/N</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_belt1_alt1} onChange={(e) => onChange('include_belt1_alt1', e.target.checked)} className="w-3 h-3" />Belt 1 Alt 1</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_belt1_alt2} onChange={(e) => onChange('include_belt1_alt2', e.target.checked)} className="w-3 h-3" />Belt 1 Alt 2</label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PartNumberSearchInput value={entry.belt1_part_number} onChange={(v) => onChange('belt1_part_number', v)} className={inputClass} placeholder="Belt 1 P/N" />
        <PartNumberSearchInput value={entry.belt1_alt1} onChange={(v) => onChange('belt1_alt1', v)} className={inputClass} placeholder="Belt 1 Alt 1" />
        <PartNumberSearchInput value={entry.belt1_alt2} onChange={(v) => onChange('belt1_alt2', v)} className={inputClass} placeholder="Belt 1 Alt 2" />
      </div>

      {/* Belt 2 */}
      <div className="grid grid-cols-3 gap-1 mb-0.5">
        <label className={labelClass}><input type="checkbox" checked={entry.include_belt2} onChange={(e) => onChange('include_belt2', e.target.checked)} className="w-3 h-3" />Belt 2 P/N</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_belt2_alt1} onChange={(e) => onChange('include_belt2_alt1', e.target.checked)} className="w-3 h-3" />Belt 2 Alt 1</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_belt2_alt2} onChange={(e) => onChange('include_belt2_alt2', e.target.checked)} className="w-3 h-3" />Belt 2 Alt 2</label>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <PartNumberSearchInput value={entry.belt2_part_number} onChange={(v) => onChange('belt2_part_number', v)} className={inputClass} placeholder="Belt 2 P/N" />
        <PartNumberSearchInput value={entry.belt2_alt1} onChange={(v) => onChange('belt2_alt1', v)} className={inputClass} placeholder="Belt 2 Alt 1" />
        <PartNumberSearchInput value={entry.belt2_alt2} onChange={(v) => onChange('belt2_alt2', v)} className={inputClass} placeholder="Belt 2 Alt 2" />
      </div>

      {/* Oil Weight & Quantity */}
      <div className="grid grid-cols-2 gap-1 mb-0.5">
        <label className={labelClass}><input type="checkbox" checked={entry.include_oil_weight} onChange={(e) => onChange('include_oil_weight', e.target.checked)} className="w-3 h-3" />Oil Weight (e.g. 15W-40)</label>
        <label className={labelClass}><input type="checkbox" checked={entry.include_oil_quantity} onChange={(e) => onChange('include_oil_quantity', e.target.checked)} className="w-3 h-3" />Oil Quantity (e.g. 8 qts)</label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PartNumberSearchInput value={entry.oil_weight} onChange={(v) => onChange('oil_weight', v)} className={inputClass} placeholder="Oil Weight (e.g. 15W-40)" />
        <input type="text" value={entry.oil_quantity} onChange={(e) => onChange('oil_quantity', e.target.value)} className={textInputClass} placeholder="Oil Quantity (e.g. 8 qts)" />
      </div>

      {/* Gas Ignition Parts */}
      {entry.fuel_type === 'gas' && (
        <div className={`grid grid-cols-2 gap-2 border-t ${borderClass} pt-2`}>
          <p className={`col-span-2 ${gasTitle}`}>Gas Ignition Parts</p>
          <div className="grid grid-cols-2 gap-1 mb-0.5">
            <label className={labelClass}><input type="checkbox" checked={entry.include_spark_plug} onChange={(e) => onChange('include_spark_plug', e.target.checked)} className="w-3 h-3" />Spark Plug P/N</label>
            <label className={labelClass}><input type="checkbox" checked={entry.include_distributor_cap} onChange={(e) => onChange('include_distributor_cap', e.target.checked)} className="w-3 h-3" />Distributor Cap P/N</label>
          </div>
          <PartNumberSearchInput value={entry.spark_plug_part_number} onChange={(v) => onChange('spark_plug_part_number', v)} className={inputClass} placeholder="Spark Plug P/N" />
          <PartNumberSearchInput value={entry.distributor_cap_part_number} onChange={(v) => onChange('distributor_cap_part_number', v)} className={inputClass} placeholder="Distributor Cap P/N" />
          <div className="grid grid-cols-2 gap-1 mb-0.5">
            <label className={labelClass}><input type="checkbox" checked={entry.include_rotor} onChange={(e) => onChange('include_rotor', e.target.checked)} className="w-3 h-3" />Rotor P/N</label>
            <label className={labelClass}><input type="checkbox" checked={entry.include_plug_wires} onChange={(e) => onChange('include_plug_wires', e.target.checked)} className="w-3 h-3" />Plug Wires P/N</label>
          </div>
          <PartNumberSearchInput value={entry.rotor_part_number} onChange={(v) => onChange('rotor_part_number', v)} className={inputClass} placeholder="Rotor P/N" />
          <PartNumberSearchInput value={entry.plug_wires_part_number} onChange={(v) => onChange('plug_wires_part_number', v)} className={inputClass} placeholder="Plug Wires P/N" />
        </div>
      )}
    </div>
  );
}

export { SERVICE_PART_FIELDS, INCLUDE_FIELDS };
