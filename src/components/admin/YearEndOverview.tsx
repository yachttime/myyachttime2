import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Ship, ClipboardCheck, Wrench, DollarSign, Users, UserCheck, UserX } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface YachtRow {
  id: string;
  name: string;
  is_active: boolean;
  invoiceGross: number;
  inspectionCount: number;
  repairRequests: number;
  userCount: number;
  usersLoggedIn: number;
  usersNeverLoggedIn: number;
}

interface Props {
  companyId: string | undefined;
}

export default function YearEndOverview({ companyId }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<YachtRow[]>([]);
  const [sortKey, setSortKey] = useState<'name' | 'invoiceGross' | 'inspectionCount' | 'repairRequests' | 'userCount' | 'usersLoggedIn' | 'usersNeverLoggedIn'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const yearStart = `${selectedYear}-01-01`;
  const yearEnd = `${selectedYear}-12-31`;

  const loadData = useCallback(async () => {
    if (!companyId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [yachtsRes, yiRes, eiRes, tiRes, rrRes, usersRes] = await Promise.all([
        supabase.from('yachts').select('id, name, is_active').eq('company_id', companyId),
        supabase.from('yacht_invoices')
          .select('id, yacht_id, invoice_amount_numeric, repair_request_id, repair_requests!repair_request_id(estimating_invoice_id), stripe_payment_intent_id, repair_title')
          .gte('invoice_date', yearStart).lte('invoice_date', yearEnd),
        supabase.from('estimating_invoices')
          .select('id, yacht_id, total_amount, archived, payment_status')
          .gte('invoice_date', yearStart).lte('invoice_date', yearEnd),
        supabase.from('trip_inspections')
          .select('id, yacht_id, created_at')
          .gte('created_at', yearStart).lte('created_at', yearEnd),
        supabase.from('repair_requests')
          .select('id, yacht_id, archived, created_at, estimating_invoice_id, yacht_invoices!repair_request_id(payment_status)')
          .gte('created_at', yearStart).lte('created_at', yearEnd),
        supabase.from('user_profiles').select('id, yacht_id, last_sign_in_at').eq('company_id', companyId),
      ]);

      if (yachtsRes.error) throw yachtsRes.error;
      if (yiRes.error) throw yiRes.error;
      if (eiRes.error) throw eiRes.error;
      if (tiRes.error) throw tiRes.error;
      if (rrRes.error) throw rrRes.error;
      if (usersRes.error) throw usersRes.error;

      const TEST_YACHT_NAMES = ['adonia', 'oceanus'];
      const yachts = ((yachtsRes.data || []) as { id: string; name: string; is_active: boolean }[])
        .filter(y => !TEST_YACHT_NAMES.includes(y.name.toLowerCase()));
      const map = new Map<string, YachtRow>();
      for (const y of yachts) {
        map.set(y.id, {
          id: y.id, name: y.name, is_active: y.is_active,
          invoiceGross: 0, inspectionCount: 0,
          repairRequests: 0, userCount: 0, usersLoggedIn: 0, usersNeverLoggedIn: 0,
        });
      }

      // Build dedup set from estimating invoices
      const estPaymentIds = new Set<string>(
        (eiRes.data || []).map((ei: any) => ei.final_payment_stripe_payment_intent_id || ei.stripe_payment_intent_id).filter(Boolean)
      );

      // Add estimating invoice totals (include archived only if paid)
      for (const ei of (eiRes.data || []) as any[]) {
        if (ei.archived && ei.payment_status !== 'paid') continue;
        const row = map.get(ei.yacht_id);
        if (row) row.invoiceGross += Number(ei.total_amount) || 0;
      }

      // Add yacht invoice totals with dedup
      for (const yi of (yiRes.data || []) as any[]) {
        if (yi.repair_request_id && yi.repair_requests?.estimating_invoice_id) continue;
        if (yi.stripe_payment_intent_id && estPaymentIds.has(yi.stripe_payment_intent_id)) continue;
        if (yi.repair_title && yi.repair_title.startsWith('Work Order WO')) continue;
        const row = map.get(yi.yacht_id);
        if (row) row.invoiceGross += Number(yi.invoice_amount_numeric) || 0;
      }

      // Trip inspection counts
      for (const ti of (tiRes.data || []) as any[]) {
        const row = map.get(ti.yacht_id);
        if (row) row.inspectionCount += 1;
      }

      // Repair request counts
      for (const rr of (rrRes.data || []) as any[]) {
        const row = map.get(rr.yacht_id);
        if (!row) continue;
        row.repairRequests += 1;
      }

      // User login stats per yacht
      for (const u of (usersRes.data || []) as any[]) {
        const row = map.get(u.yacht_id);
        if (!row) continue;
        row.userCount += 1;
        if (u.last_sign_in_at) {
          row.usersLoggedIn += 1;
        } else {
          row.usersNeverLoggedIn += 1;
        }
      }

      setRows(Array.from(map.values()));
    } catch (err: any) {
      console.error('Error loading year-end overview:', err);
      setError(err.message || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  }, [companyId, yearStart, yearEnd]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totals = rows.reduce(
    (acc, r) => ({
      invoiceGross: acc.invoiceGross + r.invoiceGross,
      inspectionCount: acc.inspectionCount + r.inspectionCount,
      repairRequests: acc.repairRequests + r.repairRequests,
      userCount: acc.userCount + r.userCount,
      usersLoggedIn: acc.usersLoggedIn + r.usersLoggedIn,
      usersNeverLoggedIn: acc.usersNeverLoggedIn + r.usersNeverLoggedIn,
    }),
    { invoiceGross: 0, inspectionCount: 0, repairRequests: 0, userCount: 0, usersLoggedIn: 0, usersNeverLoggedIn: 0 }
  );

  const sortedRows = [...rows].sort((a, b) => {
    let cmp: number;
    if (sortKey === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else {
      cmp = (a as any)[sortKey] - (b as any)[sortKey];
    }
    return sortAsc ? cmp : -cmp;
  });

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name');
    }
  };

  const fmtMoney = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const yachtCount = rows.length;
  const fleetAvg = yachtCount > 0 ? totals.invoiceGross / yachtCount : 0;
  const avgMoney = (total: number) => yachtCount > 0 ? fmtMoney(total / yachtCount) : '—';
  const avgNum = (total: number) => yachtCount > 0 ? (total / yachtCount).toFixed(1) : '—';

  const pctVsAvg = (gross: number) => {
    if (fleetAvg === 0) return null;
    return ((gross - fleetAvg) / fleetAvg) * 100;
  };

  const availableYears: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) availableYears.push(y);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-amber-500" />
          <div>
            <h2 className="text-2xl font-bold">Yachts End-of-Year Overview</h2>
            <p className="text-slate-400">Fleet-wide totals for the calendar year</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-slate-400 text-sm">Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-amber-500 focus:outline-none"
          >
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-500/20 p-2.5 rounded-lg">
              <DollarSign className="w-6 h-6 text-emerald-500" />
            </div>
            <span className="text-slate-400 text-sm">Invoice Gross</span>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{fmtMoney(totals.invoiceGross)}</p>
          <p className="text-xs text-emerald-500/50 mt-1">{avgMoney(totals.invoiceGross)} avg / yacht</p>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-amber-500/20 p-2.5 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-slate-400 text-sm">Trip Inspections</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{totals.inspectionCount}</p>
          <p className="text-xs text-amber-500/50 mt-1">{avgNum(totals.inspectionCount)} avg / yacht</p>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-500/20 p-2.5 rounded-lg">
              <Wrench className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-slate-400 text-sm">Repair Requests</span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{totals.repairRequests}</p>
          <p className="text-xs text-blue-500/50 mt-1">{avgNum(totals.repairRequests)} avg / yacht</p>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-violet-500/20 p-2.5 rounded-lg">
              <Users className="w-6 h-6 text-violet-400" />
            </div>
            <span className="text-slate-400 text-sm">Total Users</span>
          </div>
          <p className="text-2xl font-bold text-violet-400">{totals.userCount}</p>
          <p className="text-xs text-violet-500/50 mt-1">{avgNum(totals.userCount)} avg / yacht</p>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-green-500/20 p-2.5 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-400" />
            </div>
            <span className="text-slate-400 text-sm">Users Logged In</span>
          </div>
          <p className="text-2xl font-bold text-green-400">{totals.usersLoggedIn}</p>
          <p className="text-xs text-green-500/50 mt-1">{avgNum(totals.usersLoggedIn)} avg / yacht</p>
        </div>
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-5 border border-slate-700">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-red-500/20 p-2.5 rounded-lg">
              <UserX className="w-6 h-6 text-red-400" />
            </div>
            <span className="text-slate-400 text-sm">Never Logged In</span>
          </div>
          <p className="text-2xl font-bold text-red-400">{totals.usersNeverLoggedIn}</p>
          <p className="text-xs text-red-500/50 mt-1">{avgNum(totals.usersNeverLoggedIn)} avg / yacht</p>
        </div>
      </div>

      {/* Per-yacht table */}
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 text-slate-400 text-sm">
                <th className="text-left px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('name')}>
                  Yacht {sortKey === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="text-right px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('invoiceGross')}>
                  Invoice Gross {sortKey === 'invoiceGross' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="text-center px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('inspectionCount')}>
                  Inspections {sortKey === 'inspectionCount' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="text-center px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('repairRequests')}>
                  Repair Requests {sortKey === 'repairRequests' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="text-center px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('userCount')}>
                  Users {sortKey === 'userCount' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="text-center px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('usersLoggedIn')}>
                  Logged In {sortKey === 'usersLoggedIn' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
                <th className="text-center px-4 py-3 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('usersNeverLoggedIn')}>
                  Never Logged In {sortKey === 'usersNeverLoggedIn' ? (sortAsc ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="inline-flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      Loading fleet data...
                    </div>
                  </td>
                </tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No yachts found for this company.
                  </td>
                </tr>
              ) : (
                sortedRows.map(r => (
                  <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Ship className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <span className="font-medium">{r.name}</span>
                          {!r.is_active && (
                            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">Inactive</span>
                          )}
                        </div>
                        {r.userCount > 0 && (
                          <div className="text-xs mt-1 ml-6 flex items-center gap-1.5 flex-wrap">
                            <span className="bg-violet-500/20 text-violet-300 font-semibold px-2 py-0.5 rounded-md">{r.userCount} {r.userCount === 1 ? 'user' : 'users'}</span>
                            <span className="text-green-400/80">{r.usersLoggedIn} logged in</span>
                            <span className="text-slate-600">·</span>
                            <span className="text-red-400/80">{r.usersNeverLoggedIn} never</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      {fmtMoney(r.invoiceGross)}
                      {(() => {
                        const pct = pctVsAvg(r.invoiceGross);
                        if (pct === null || pct === 0) return null;
                        const above = pct > 0;
                        return (
                          <div className="text-xs mt-0.5">
                            <span className={above ? 'text-green-400' : 'text-red-400'}>
                              {above ? '+' : ''}{pct.toFixed(0)}% {above ? 'above' : 'below'} avg
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-amber-400">{r.inspectionCount}</td>
                    <td className="px-4 py-3 text-center text-blue-400">{r.repairRequests}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/20 text-violet-300 font-bold text-base">{r.userCount}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-green-400">{r.usersLoggedIn}</td>
                    <td className="px-4 py-3 text-center text-red-400">{r.usersNeverLoggedIn}</td>
                  </tr>
                ))
              )}
            </tbody>
            {!loading && sortedRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-600 font-bold">
                  <td className="px-4 py-3">Total ({rows.length} yachts)</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-400">{fmtMoney(totals.invoiceGross)}</td>
                  <td className="px-4 py-3 text-center text-amber-400">{totals.inspectionCount}</td>
                  <td className="px-4 py-3 text-center text-blue-400">{totals.repairRequests}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 font-bold text-lg">{totals.userCount}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-green-400">{totals.usersLoggedIn}</td>
                  <td className="px-4 py-3 text-center text-red-400">{totals.usersNeverLoggedIn}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
