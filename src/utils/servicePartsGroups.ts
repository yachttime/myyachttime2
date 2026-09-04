import type { EngineGenFormEntry } from '../components/admin/EditYachtModal';

const PART_FIELDS = [
  'oil_filter_part_number', 'oil_filter_alt1', 'oil_filter_alt2',
  'fuel_filter_part_number', 'fuel_filter_alt1', 'fuel_filter_alt2',
  'impeller_part_number', 'impeller_alt1', 'impeller_alt2',
  'belt1_part_number', 'belt1_alt1', 'belt1_alt2',
  'belt2_part_number', 'belt2_alt1', 'belt2_alt2',
  'oil_weight', 'oil_quantity',
  'spark_plug_part_number', 'distributor_cap_part_number',
  'rotor_part_number', 'plug_wires_part_number',
  'include_oil_filter', 'include_oil_filter_alt1', 'include_oil_filter_alt2',
  'include_fuel_filter', 'include_fuel_filter_alt1', 'include_fuel_filter_alt2',
  'include_impeller', 'include_impeller_alt1', 'include_impeller_alt2',
  'include_belt1', 'include_belt1_alt1', 'include_belt1_alt2',
  'include_belt2', 'include_belt2_alt1', 'include_belt2_alt2',
  'include_oil_weight', 'include_oil_quantity',
  'include_spark_plug', 'include_distributor_cap',
  'include_rotor', 'include_plug_wires',
] as const;

export type PartField = typeof PART_FIELDS[number];

export interface ModelGroup {
  indices: number[];
  modelNumber: string;
  isShared: boolean;
}

function normalizeModel(model: string): string {
  return (model || '').trim().toLowerCase();
}

export function getModelGroups(entries: EngineGenFormEntry[]): ModelGroup[] {
  const groups: ModelGroup[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < entries.length; i++) {
    if (visited.has(i)) continue;
    const model = normalizeModel(entries[i].model_number);
    const indices = [i];
    visited.add(i);

    if (model) {
      for (let j = i + 1; j < entries.length; j++) {
        if (visited.has(j)) continue;
        if (normalizeModel(entries[j].model_number) === model) {
          indices.push(j);
          visited.add(j);
        }
      }
    }

    groups.push({ indices, modelNumber: entries[i].model_number, isShared: indices.length > 1 });
  }

  return groups;
}

export function syncPartsToGroup(
  entries: EngineGenFormEntry[],
  group: ModelGroup,
  field: PartField,
  value: string | boolean
): EngineGenFormEntry[] {
  const updated = [...entries];
  for (const idx of group.indices) {
    updated[idx] = { ...updated[idx], [field]: value };
  }
  return updated;
}

export function getGroupLabels(entries: EngineGenFormEntry[], group: ModelGroup): string {
  return group.indices.map(i => entries[i]?.label || `#${i + 1}`).filter(Boolean).join(' & ');
}
