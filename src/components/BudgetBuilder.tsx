import { useState, useEffect, useCallback } from 'react';
import { X, Package, FileText, CheckCircle, Circle, DollarSign, Loader2, AlertTriangle, ChevronRight, ChevronLeft, Plus, Minus, Gauge, Zap, Wrench, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BudgetBuilderProps {
  yachtId: string;
  yachtName: string;
  budgetYear: number;
  existingBudgetId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

interface EstimatePackage {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface OffseasonEstimate {
  id: string;
  estimate_number: string;
  customer_name: string | null;
  total_amount: number;
  created_at: string;
}

interface SelectedItem {
  id: string;
  type: 'package' | 'offseason_estimate';
  name: string;
  amount: number;
  quantity: number;
}

interface HourUsage {
  label: string;
  hoursUsed: number;
}

interface MotorEquipment {
  id: string;
  label: string;
  equipmentType: 'engine' | 'generator';
  modelName: string;
  manufacturer: string;
}

interface ServiceRecommendation {
  interval: 200 | 600;
  label: string;
  recommendedQty: number;
  basisHours: number;
  basisLabel: string;
  matchedPackageId: string | null;
}

export const BudgetBuilder = ({ yachtId, yachtName, budgetYear, existingBudgetId, onClose, onSaved }: BudgetBuilderProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [packages, setPackages] = useState<EstimatePackage[]>([]);
  const [packageTotals, setPackageTotals] = useState<Record<string, number>>({});
  const [offseasonEstimates, setOffseasonEstimates] = useState<OffseasonEstimate[]>([]);
  const [packageQuantities, setPackageQuantities] = useState<Record<string, number>>({});
  const [selectedEstimates, setSelectedEstimates] = useState<Set<string>>(new Set());
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingOffseason, setLoadingOffseason] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasExistingItems, setHasExistingItems] = useState(false);

  // Hours data
  const [engineHours, setEngineHours] = useState<HourUsage[]>([]);
  const [generatorHours, setGeneratorHours] = useState<HourUsage[]>([]);
  const [loadingHours, setLoadingHours] = useState(true);
  const [motorEquipment, setMotorEquipment] = useState<MotorEquipment[]>([]);

  const loadMotorEquipment = useCallback(async () => {
    try {
      const [enginesRes, generatorsRes] = await Promise.all([
        supabase.from('yacht_engines').select('id, label, description, model_number, catalog_id').eq('yacht_id', yachtId).order('sort_order'),
        supabase.from('yacht_generators').select('id, label, description, model_number, catalog_id').eq('yacht_id', yachtId).order('sort_order'),
      ]);

      if (enginesRes.error) throw enginesRes.error;
      if (generatorsRes.error) throw generatorsRes.error;

      const equipmentRows = [
        ...(enginesRes.data || []).map((row) => ({ ...row, equipmentType: 'engine' as const })),
        ...(generatorsRes.data || []).map((row) => ({ ...row, equipmentType: 'generator' as const })),
      ];
      const catalogIds = equipmentRows.map((row) => row.catalog_id).filter((id): id is string => Boolean(id));
      const catalogById = new Map<string, { model_name: string; manufacturer: string | null }>();

      if (catalogIds.length > 0) {
        const { data, error } = await supabase
          .from('engine_catalog')
          .select('id, model_name, manufacturer')
          .in('id', catalogIds);
        if (error) throw error;
        (data || []).forEach((catalog) => catalogById.set(catalog.id, catalog));
      }

      setMotorEquipment(equipmentRows.map((row) => {
        const catalog = row.catalog_id ? catalogById.get(row.catalog_id) : undefined;
        return {
          id: row.id,
          label: row.label || (row.equipmentType === 'engine' ? 'Engine' : 'Generator'),
          equipmentType: row.equipmentType,
          modelName: catalog?.model_name || row.model_number || row.description || '',
          manufacturer: catalog?.manufacturer || '',
        };
      }).filter((row) => row.modelName.trim()));
    } catch (err) {
      console.error('Error loading motor catalog references:', err);
      setMotorEquipment([]);
    }
  }, [yachtId]);

  const loadHours = useCallback(async () => {
    setLoadingHours(true);
    try {
      const priorYear = budgetYear - 1;
      const yearStart = `${priorYear}-01-01`;
      const yearEnd = `${priorYear}-12-31`;

      const { data, error: tiError } = await supabase
        .from('trip_inspections')
        .select('id, yacht_id, created_at, port_engine_hours, stbd_engine_hours, port_gen_hours, stbd_gen_hours')
        .eq('yacht_id', yachtId)
        .gte('created_at', yearStart)
        .lte('created_at', yearEnd);

      if (tiError) throw tiError;

      const inspections = (data || []) as any[];

      // Also load engine/generator labels
      const [engRes, genRes] = await Promise.all([
        supabase.from('yacht_engines').select('id, label, sort_order').eq('yacht_id', yachtId).order('sort_order'),
        supabase.from('yacht_generators').select('id, label, sort_order').eq('yacht_id', yachtId).order('sort_order'),
      ]);

      const engineLabels = (engRes.data || []) as any[];
      const generatorLabels = (genRes.data || []) as any[];

      // Track min/max for each hour field
      const bounds: Record<string, { min?: number; max?: number }> = {
        port_engine: {},
        stbd_engine: {},
        port_gen: {},
        stbd_gen: {},
      };

      const track = (val: any, key: string) => {
        if (val == null) return;
        const n = Number(val);
        if (isNaN(n)) return;
        if (bounds[key].min == null || n < bounds[key].min!) bounds[key].min = n;
        if (bounds[key].max == null || n > bounds[key].max!) bounds[key].max = n;
      };

      inspections.forEach((ti) => {
        track(ti.port_engine_hours, 'port_engine');
        track(ti.stbd_engine_hours, 'stbd_engine');
        track(ti.port_gen_hours, 'port_gen');
        track(ti.stbd_gen_hours, 'stbd_gen');
      });

      const computeUsed = (b: { min?: number; max?: number }) =>
        b.min != null && b.max != null ? Math.round((b.max - b.min) * 10) / 10 : 0;

      // Build engine hours list
      const engUsage: HourUsage[] = [];
      const portEngLabel = engineLabels.find((e) => e.label.toLowerCase().includes('port'))?.label || 'Port Engine';
      const stbdEngLabel = engineLabels.find((e) => e.label.toLowerCase().includes('starboard') || e.label.toLowerCase().includes('stbd'))?.label || 'Starboard Engine';

      const pEngUsed = computeUsed(bounds.port_engine);
      const sEngUsed = computeUsed(bounds.stbd_engine);
      if (pEngUsed > 0) engUsage.push({ label: portEngLabel, hoursUsed: pEngUsed });
      if (sEngUsed > 0) engUsage.push({ label: stbdEngLabel, hoursUsed: sEngUsed });

      // If we only have generic labels, use those
      if (engUsage.length === 0 && engineLabels.length > 0) {
        engineLabels.forEach((e, idx) => {
          const used = idx === 0 ? pEngUsed : idx === 1 ? sEngUsed : 0;
          if (used > 0) engUsage.push({ label: e.label, hoursUsed: used });
        });
      }

      // Build generator hours list
      const genUsage: HourUsage[] = [];
      const portGenLabel = generatorLabels.find((g) => g.label.toLowerCase().includes('port'))?.label || 'Port Generator';
      const stbdGenLabel = generatorLabels.find((g) => g.label.toLowerCase().includes('starboard') || g.label.toLowerCase().includes('stbd'))?.label || 'Starboard Generator';

      const pGenUsed = computeUsed(bounds.port_gen);
      const sGenUsed = computeUsed(bounds.stbd_gen);
      if (pGenUsed > 0) genUsage.push({ label: portGenLabel, hoursUsed: pGenUsed });
      if (sGenUsed > 0) genUsage.push({ label: stbdGenLabel, hoursUsed: sGenUsed });

      if (genUsage.length === 0 && generatorLabels.length > 0) {
        generatorLabels.forEach((g, idx) => {
          const used = idx === 0 ? pGenUsed : idx === 1 ? sGenUsed : 0;
          if (used > 0) genUsage.push({ label: g.label, hoursUsed: used });
        });
      }

      setEngineHours(engUsage);
      setGeneratorHours(genUsage);
    } catch (err: any) {
      console.error('Error loading hours:', err);
    } finally {
      setLoadingHours(false);
    }
  }, [yachtId, budgetYear]);

  const loadPackages = useCallback(async () => {
    setLoadingPackages(true);
    try {
      const { data: pkgs, error: pkgError } = await supabase
        .from('estimate_packages')
        .select('id, name, description, is_active')
        .eq('is_active', true)
        .order('name');

      if (pkgError) throw pkgError;

      const pkgList = pkgs || [];
      setPackages(pkgList);

      const totals: Record<string, number> = {};
      await Promise.all(
        pkgList.map(async (pkg) => {
          const [laborRes, partsRes] = await Promise.all([
            supabase.from('estimate_package_labor').select('hours, rate').eq('package_id', pkg.id),
            supabase.from('estimate_package_parts').select('quantity, unit_price').eq('package_id', pkg.id),
          ]);

          const laborTotal = (laborRes.data || []).reduce((sum, l) => sum + (Number(l.hours) || 0) * (Number(l.rate) || 0), 0);
          const partsTotal = (partsRes.data || []).reduce((sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0), 0);
          totals[pkg.id] = laborTotal + partsTotal;
        })
      );
      setPackageTotals(totals);
    } catch (err: any) {
      setError(`Failed to load packages: ${err.message}`);
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  const loadOffseason = useCallback(async () => {
    setLoadingOffseason(true);
    try {
      const { data, error: estError } = await supabase
        .from('estimates')
        .select('id, estimate_number, customer_name, total_amount, created_at')
        .eq('yacht_id', yachtId)
        .eq('is_offseason', true)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (estError) throw estError;
      setOffseasonEstimates((data || []) as OffseasonEstimate[]);
    } catch (err: any) {
      setError(`Failed to load off-season estimates: ${err.message}`);
    } finally {
      setLoadingOffseason(false);
    }
  }, [yachtId]);

  const loadExistingItems = useCallback(async () => {
    if (!existingBudgetId) return;
    try {
      const { data, error: itemsError } = await supabase
        .from('yacht_budget_items')
        .select('id, item_type, source_id, name, amount, quantity')
        .eq('budget_id', existingBudgetId)
        .order('created_at');

      if (itemsError) throw itemsError;

      if (data && data.length > 0) {
        setHasExistingItems(true);
        const pkgQty: Record<string, number> = {};
        const estIds = new Set<string>();
        data.forEach((d: any) => {
          if (d.item_type === 'package' && d.source_id) {
            pkgQty[d.source_id] = Number(d.quantity) || 1;
          } else if (d.item_type === 'offseason_estimate' && d.source_id) {
            estIds.add(d.source_id);
          }
        });
        setPackageQuantities(pkgQty);
        setSelectedEstimates(estIds);
      }
    } catch (err: any) {
      console.error('Error loading existing budget items:', err);
    }
  }, [existingBudgetId]);

  useEffect(() => {
    loadPackages();
    loadOffseason();
    loadExistingItems();
    loadHours();
    loadMotorEquipment();
  }, [loadPackages, loadOffseason, loadExistingItems, loadHours, loadMotorEquipment]);

  const packageMatchesMotor = (pkg: EstimatePackage, motor: MotorEquipment) => {
    const searchableText = `${pkg.name} ${pkg.description || ''}`.toLowerCase();
    const manufacturerTerms = motor.manufacturer
      .toLowerCase()
      .trim()
      .split(/[^a-z0-9.]+/)
      .filter((term) => term.length > 2 && term !== 'marine');
    const modelTerms = motor.modelName.toLowerCase().trim().match(/\d+(?:\.\d+)?|[a-z]{3,}/g) || [];
    const brandMatches = manufacturerTerms.length === 0 || manufacturerTerms.some((term) => searchableText.includes(term));
    const modelMatches = modelTerms.length === 0 || modelTerms.some((term) => searchableText.includes(term));
    return brandMatches && modelMatches;
  };

  const associatedMotorPackages = motorEquipment
    .filter((motor) => motor.equipmentType === 'engine')
    .map((motor) => ({ motor, packages: packages.filter((pkg) => packageMatchesMotor(pkg, motor)) }))
    .filter((entry) => entry.packages.length > 0);

  // Compute service recommendations for each generator independently
  const recommendations: ServiceRecommendation[] = (() => {
    if (generatorHours.length === 0) return [];

    const findMatchingPackage = (keywords: string[]): string | null => {
      const lower = keywords.map((k) => k.toLowerCase());
      const match = packages.find((p) => {
        const searchableText = `${p.name} ${p.description || ''}`.toLowerCase();
        return lower.every((k) => searchableText.includes(k));
      });
      return match?.id || null;
    };

    return generatorHours.flatMap((generator) => {
      const recs: ServiceRecommendation[] = [];
      const oil200Qty = Math.floor(generator.hoursUsed / 200);
      const oil600Qty = Math.floor(generator.hoursUsed / 600);

      if (oil200Qty > 0) {
        recs.push({
          interval: 200,
          label: '200hr Generator Oil Change',
          recommendedQty: oil200Qty,
          basisHours: generator.hoursUsed,
          basisLabel: generator.label,
          matchedPackageId: findMatchingPackage(['200', 'oil']),
        });
      }

      if (oil600Qty > 0) {
        recs.push({
          interval: 600,
          label: '600hr Generator Oil Change + Impeller',
          recommendedQty: oil600Qty,
          basisHours: generator.hoursUsed,
          basisLabel: generator.label,
          matchedPackageId: findMatchingPackage(['600']),
        });
      }

      return recs;
    });
  })();

  const applyRecommendation = (rec: ServiceRecommendation) => {
    if (!rec.matchedPackageId) return;
    setPackageQuantities((prev) => ({
      ...prev,
      [rec.matchedPackageId!]: (prev[rec.matchedPackageId!] || 0) + rec.recommendedQty,
    }));
  };

  const selectedPackageItems: SelectedItem[] = packages
    .filter(p => (packageQuantities[p.id] || 0) > 0)
    .map(p => ({
      id: p.id,
      type: 'package' as const,
      name: p.name,
      amount: (packageTotals[p.id] || 0) * (packageQuantities[p.id] || 0),
      quantity: packageQuantities[p.id] || 0,
    }));

  const selectedEstimateItems: SelectedItem[] = offseasonEstimates
    .filter(e => selectedEstimates.has(e.id))
    .map(e => ({ id: e.id, type: 'offseason_estimate' as const, name: `Estimate ${e.estimate_number}`, amount: Number(e.total_amount) || 0, quantity: 1 }));

  const allSelectedItems = [...selectedPackageItems, ...selectedEstimateItems];
  const grandTotal = allSelectedItems.reduce((sum, item) => sum + item.amount, 0);
  const selectedPackageCount = selectedPackageItems.length;

  const incrementPackage = (id: string) => {
    setPackageQuantities(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const decrementPackage = (id: string) => {
    setPackageQuantities(prev => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const toggleEstimate = (id: string) => {
    setSelectedEstimates(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const budgetData = {
        yacht_id: yachtId,
        budget_year: budgetYear,
        budget_amount: grandTotal,
        management_fees: 0,
        trip_inspection_fees: 0,
        spring_startup_cost: 0,
        oil_change_200hr: 0,
        oil_change_600hr: 0,
        preventive_maintenance: 0,
        winter_repairs_upgrades: 0,
        winterizations: 0,
        water_filters: 0,
        misc_1: 0,
        misc_1_notes: '',
        misc_2: 0,
        misc_2_notes: '',
        updated_at: new Date().toISOString(),
      };

      let budgetId = existingBudgetId;

      if (budgetId) {
        const { error: updateErr } = await supabase
          .from('yacht_budgets')
          .update({ ...budgetData, budget_amount: grandTotal })
          .eq('id', budgetId);
        if (updateErr) throw updateErr;

        const { error: deleteErr } = await supabase
          .from('yacht_budget_items')
          .delete()
          .eq('budget_id', budgetId);
        if (deleteErr) throw deleteErr;
      } else {
        const { data: newBudget, error: insertErr } = await supabase
          .from('yacht_budgets')
          .insert({ ...budgetData, budget_amount: grandTotal })
          .select('id')
          .single();
        if (insertErr) throw insertErr;
        budgetId = newBudget.id;
      }

      if (allSelectedItems.length > 0 && budgetId) {
        const itemsToInsert = allSelectedItems.map(item => ({
          budget_id: budgetId,
          yacht_id: yachtId,
          item_type: item.type,
          source_id: item.id,
          name: item.name,
          amount: item.amount,
          quantity: item.quantity,
        }));

        const { error: itemsErr } = await supabase
          .from('yacht_budget_items')
          .insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      onSaved();
    } catch (err: any) {
      setError(`Failed to save budget: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const fmtHrs = (n: number) => n > 0 ? n.toFixed(1) : '—';
  const totalEngineHrs = engineHours.reduce((s, e) => s + e.hoursUsed, 0);
  const totalGenHrs = generatorHours.reduce((s, g) => s + g.hoursUsed, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold text-white">Build Budget for {yachtName}</h2>
            <p className="text-sm text-slate-400">Year {budgetYear} — Select packages and off-season estimates</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-700/50">
          {[
            { num: 1, label: 'Packages' },
            { num: 2, label: 'Off-Season' },
            { num: 3, label: 'Review' },
          ].map((s, idx) => (
            <div key={s.num} className="flex items-center gap-2">
              {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                step === s.num ? 'bg-teal-500/20 text-teal-300' : step > s.num ? 'text-emerald-400' : 'text-slate-500'
              }`}>
                {step > s.num ? <CheckCircle className="w-3.5 h-3.5" /> : <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs">{s.num}</span>}
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {hasExistingItems && step === 1 && (
            <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>A budget already exists for {budgetYear}. Saving will replace the existing budget items. The manual category amounts will be reset to $0 — add those separately after building.</span>
            </div>
          )}

          {/* Step 1: Packages */}
          {step === 1 && (
            <div>
              {/* Hours Summary Panel */}
              <div className="mb-4 bg-slate-800/60 border border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Last Season Usage ({budgetYear - 1})</h3>
                  {loadingHours && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
                </div>

                {!loadingHours && engineHours.length === 0 && generatorHours.length === 0 ? (
                  <p className="text-xs text-slate-500">No trip inspection hour data found for {budgetYear - 1}. Recommendations will not be available.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Engine hours */}
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Gauge className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Engine Hours</span>
                      </div>
                      {engineHours.length > 0 ? (
                        <div className="space-y-1">
                          {engineHours.map((e, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{e.label}</span>
                              <span className="text-blue-300 font-semibold tabular-nums">{fmtHrs(e.hoursUsed)} hrs</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
                            <span className="text-slate-400 font-medium">Total</span>
                            <span className="text-blue-200 font-bold tabular-nums">{fmtHrs(totalEngineHrs)} hrs</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No engine hours recorded</p>
                      )}
                    </div>

                    {/* Generator hours */}
                    <div className="bg-slate-900/50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">Generator Hours</span>
                      </div>
                      {generatorHours.length > 0 ? (
                        <div className="space-y-1">
                          {generatorHours.map((g, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-slate-300">{g.label}</span>
                              <span className="text-amber-300 font-semibold tabular-nums">{fmtHrs(g.hoursUsed)} hrs</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-700/50">
                            <span className="text-slate-400 font-medium">Total</span>
                            <span className="text-amber-200 font-bold tabular-nums">{fmtHrs(totalGenHrs)} hrs</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No generator hours recorded</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Motor catalog references */}
              {motorEquipment.length > 0 && (
                <div className="mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="w-4 h-4 text-blue-300" />
                    <h3 className="text-sm font-semibold text-blue-100">Selected Motors</h3>
                  </div>
                  <div className="space-y-2">
                    {motorEquipment.map((motor) => (
                      <div key={motor.id} className="flex items-center justify-between gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-white">{motor.label}</div>
                          <div className="text-xs text-blue-200 truncate">
                            {motor.manufacturer ? `${motor.manufacturer} ` : ''}{motor.modelName}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-blue-300 shrink-0">Motor database</span>
                      </div>
                    ))}
                  </div>
                  {associatedMotorPackages.length > 0 && (
                    <div className="mb-4 rounded-lg border border-teal-500/30 bg-teal-500/10 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-teal-400" />
                        <h3 className="text-sm font-semibold text-teal-200">Engine Package Recommendations</h3>
                      </div>
                      <p className="text-xs text-teal-300/70 mb-3">Matched to the selected engine models. Choose the package for each motor.</p>
                      <div className="space-y-3">
                        {associatedMotorPackages.map(({ motor, packages: motorPackages }) => {
                          const isPort = motor.label.toLowerCase().includes('port');
                          const sideLabel = isPort ? 'PORT' : 'STARBOARD';
                          const sideClasses = isPort
                            ? 'border-l-4 border-l-sky-400 bg-sky-950/40'
                            : 'border-l-4 border-l-amber-400 bg-amber-950/30';
                          const sideText = isPort ? 'text-sky-200' : 'text-amber-200';
                          const sideBadge = isPort ? 'bg-sky-400/20 text-sky-200' : 'bg-amber-400/20 text-amber-200';
                          return (
                            <div key={motor.id} className={`rounded-lg p-3 ${sideClasses}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded ${sideBadge}`}>{sideLabel}</span>
                                <span className="text-sm font-medium text-white">{motor.label}</span>
                              </div>
                              <div className={`text-xs font-semibold ${sideText} mb-2`}>
                                {motor.manufacturer ? `${motor.manufacturer} ` : ''}{motor.modelName}
                              </div>
                              <div className="space-y-2">
                                {motorPackages.map((pkg) => {
                                  const qty = packageQuantities[pkg.id] || 0;
                                  return (
                                    <div key={pkg.id} className="flex items-center gap-3 rounded-lg bg-slate-950/55 px-3 py-2">
                                      <Wrench className={`w-4 h-4 shrink-0 ${isPort ? 'text-sky-300' : 'text-amber-300'}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-white truncate">{pkg.name}</div>
                                        {pkg.description && <div className="text-[11px] text-slate-400 truncate">{pkg.description}</div>}
                                      </div>
                                      <button
                                        onClick={() => incrementPackage(pkg.id)}
                                        disabled={saving}
                                        className="rounded bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50 shrink-0"
                                      >
                                        {qty > 0 ? `Add another (${qty})` : 'Recommend'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Service Recommendations */}
              {recommendations.length > 0 && (
                <div className="mb-4 bg-teal-500/10 border border-teal-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <h3 className="text-sm font-semibold text-teal-200">Service Recommendations</h3>
                  </div>
                  <p className="text-xs text-teal-300/70 mb-3">Based on generator hours from {budgetYear - 1}. Click "Apply" to set the package quantity automatically.</p>
                  <div className="space-y-2">
                    {recommendations.map((rec, i) => {
                      const matchedPkg = rec.matchedPackageId ? packages.find((p) => p.id === rec.matchedPackageId) : null;
                      const currentQty = rec.matchedPackageId ? packageQuantities[rec.matchedPackageId] || 0 : 0;
                      const isApplied = currentQty === rec.recommendedQty;
                      const isPort = rec.basisLabel.toLowerCase().includes('port');
                      const sideLabel = isPort ? 'PORT' : 'STARBOARD';
                      const sideClasses = isPort
                        ? 'border-l-4 border-l-sky-400 bg-sky-950/40'
                        : 'border-l-4 border-l-amber-400 bg-amber-950/30';
                      return (
                        <div key={i} className={`flex items-center gap-3 rounded-lg p-3 ${sideClasses}`}>
                          <Wrench className={`w-4 h-4 shrink-0 ${isPort ? 'text-sky-300' : 'text-amber-300'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[10px] font-black tracking-widest px-2 py-0.5 rounded ${isPort ? 'bg-sky-400/20 text-sky-200' : 'bg-amber-400/20 text-amber-200'}`}>
                                {sideLabel}
                              </span>
                              <div className="text-sm font-medium text-white">
                                {rec.recommendedQty}x {rec.label}
                              </div>
                            </div>
                            <div className="text-xs text-slate-300">
                              Based on <span className="font-semibold text-white">{fmtHrs(rec.basisHours)} hrs</span> on <span className={`font-bold ${isPort ? 'text-sky-200' : 'text-amber-200'}`}>{rec.basisLabel}</span> — every {rec.interval} hrs
                            </div>
                            {matchedPkg ? (
                              <div className="text-xs text-teal-400 mt-0.5">Matches: {matchedPkg.name}{isApplied && ' (applied)'}</div>
                            ) : (
                              <div className="text-xs text-slate-500 mt-0.5">No matching package found — set quantity manually below</div>
                            )}
                          </div>
                          {rec.matchedPackageId && (
                            <button
                              onClick={() => applyRecommendation(rec)}
                              disabled={saving || isApplied}
                              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                                isApplied
                                  ? 'bg-teal-500/20 text-teal-300 cursor-default'
                                  : 'bg-teal-600 hover:bg-teal-700 text-white'
                              }`}
                            >
                              {isApplied ? 'Applied' : 'Apply'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Package selection */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Estimate Packages</h3>
                <span className="text-xs text-slate-400">{selectedPackageCount} selected</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">Use the + and − buttons to set how many times each service occurs during the year.</p>
              {loadingPackages ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading packages...
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No active estimate packages found.</div>
              ) : (
                <div className="space-y-2">
                  {packages.map(pkg => {
                    const qty = packageQuantities[pkg.id] || 0;
                    const perUnit = packageTotals[pkg.id] || 0;
                    const lineTotal = perUnit * qty;
                    return (
                      <div
                        key={pkg.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          qty > 0
                            ? 'bg-teal-500/10 border-teal-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {qty > 0 ? <CheckCircle className="w-5 h-5 text-teal-400" /> : <Circle className="w-5 h-5 text-slate-600" />}
                        </div>
                        <Package className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{pkg.name}</div>
                          {pkg.description && <div className="text-xs text-slate-400 truncate">{pkg.description}</div>}
                          {qty > 1 && (
                            <div className="text-xs text-teal-400 mt-0.5">{fmt(perUnit)} each x {qty}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {qty > 0 ? (
                            <>
                              <button
                                onClick={() => decrementPackage(pkg.id)}
                                className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                                disabled={saving}
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-white tabular-nums">{qty}</span>
                              <button
                                onClick={() => incrementPackage(pkg.id)}
                                className="w-7 h-7 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors"
                                disabled={saving}
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => incrementPackage(pkg.id)}
                              className="px-3 h-7 flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs transition-colors"
                              disabled={saving}
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                          )}
                        </div>
                        {qty > 0 && (
                          <div className="text-sm font-semibold text-emerald-400 shrink-0 w-20 text-right">{fmt(lineTotal)}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Offseason Estimates */}
          {step === 2 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">Off-Season Estimates</h3>
                <span className="text-xs text-slate-400">{selectedEstimates.size} selected</span>
              </div>
              {loadingOffseason ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading off-season estimates...
                </div>
              ) : offseasonEstimates.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">No off-season estimates found for this yacht.</div>
              ) : (
                <div className="space-y-2">
                  {offseasonEstimates.map(est => {
                    const selected = selectedEstimates.has(est.id);
                    return (
                      <button
                        key={est.id}
                        onClick={() => toggleEstimate(est.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                          selected
                            ? 'bg-teal-500/10 border-teal-500/50'
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        {selected ? <CheckCircle className="w-5 h-5 text-teal-400 shrink-0" /> : <Circle className="w-5 h-5 text-slate-600 shrink-0" />}
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">Estimate {est.estimate_number}</div>
                          {est.customer_name && <div className="text-xs text-slate-400 truncate">{est.customer_name}</div>}
                          <div className="text-xs text-slate-500">{new Date(est.created_at).toLocaleDateString()}</div>
                        </div>
                        <div className="text-sm font-semibold text-emerald-400 shrink-0">{fmt(Number(est.total_amount) || 0)}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Review & Save</h3>
              {allSelectedItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No items selected. Go back and select at least one package or off-season estimate.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hours recap on review */}
                  {(engineHours.length > 0 || generatorHours.length > 0) && (
                    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{budgetYear - 1} Hours Used</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                        {engineHours.length > 0 && (
                          <span>Engine: <span className="text-blue-300 font-medium">{fmtHrs(totalEngineHrs)} hrs</span></span>
                        )}
                        {generatorHours.length > 0 && (
                          <span>Generator: <span className="text-amber-300 font-medium">{fmtHrs(totalGenHrs)} hrs</span></span>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedPackageItems.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Packages</div>
                      <div className="space-y-1">
                        {selectedPackageItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="text-sm text-white">{item.name}</span>
                              {item.quantity > 1 && (
                                <span className="text-xs text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded">x{item.quantity}</span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-emerald-400">{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedEstimateItems.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Off-Season Estimates</div>
                      <div className="space-y-1">
                        {selectedEstimateItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-slate-400" />
                              <span className="text-sm text-white">{item.name}</span>
                            </div>
                            <span className="text-sm font-semibold text-emerald-400">{fmt(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="border-t border-slate-700 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-emerald-400" />
                        <span className="text-sm font-semibold text-slate-300">Grand Total</span>
                      </div>
                      <span className="text-xl font-bold text-emerald-400">{fmt(grandTotal)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      This will be saved as the {budgetYear} budget for {yachtName}. You can still add manual category amounts after building.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <button
            onClick={() => step > 1 ? setStep((step - 1) as 1 | 2) : onClose()}
            disabled={saving}
            className="flex items-center gap-1 px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          <div className="flex items-center gap-3">
            {allSelectedItems.length > 0 && (
              <span className="text-sm text-slate-400">
                Total: <span className="text-emerald-400 font-semibold">{fmt(grandTotal)}</span>
              </span>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep((step + 1) as 2 | 3)}
                disabled={saving}
                className="flex items-center gap-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving || allSelectedItems.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> Save Budget</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
