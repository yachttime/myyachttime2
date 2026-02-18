import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { X, Printer, AlertCircle, Filter } from 'lucide-react';

interface VendorReportRow {
  part_id: string;
  part_number: string;
  name: string;
  quantity_on_hand: number;
  unit_cost: number;
  unit_price: number;
  is_active: boolean;
  used_this_year: number;
}

interface VendorGroup {
  vendor_id: string | null;
  vendor_name: string;
  parts: VendorReportRow[];
}

interface Props {
  onClose: () => void;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export function VendorPartsReport({ onClose }: Props) {
  const [vendorGroups, setVendorGroups] = useState<VendorGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadReport();
  }, []);

  async function loadReport() {
    try {
      setLoading(true);
      setError(null);

      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();

      const [partsResult, txResult] = await Promise.all([
        supabase
          .from('parts_inventory')
          .select(`
            id, part_number, name, quantity_on_hand, unit_cost, unit_price, is_active, vendor_id,
            vendors (id, vendor_name)
          `)
          .order('part_number'),
        supabase
          .from('part_transactions')
          .select('part_id, quantity_change')
          .in('transaction_type', ['sale', 'remove'])
          .gte('transaction_date', yearStart)
      ]);

      if (partsResult.error) throw partsResult.error;
      if (txResult.error) throw txResult.error;

      const usageMap: Record<string, number> = {};
      for (const tx of txResult.data ?? []) {
        const qty = Math.abs(tx.quantity_change);
        usageMap[tx.part_id] = (usageMap[tx.part_id] ?? 0) + qty;
      }

      const grouped: Record<string, VendorGroup> = {};

      for (const part of partsResult.data ?? []) {
        const vendorId: string = (part as any).vendors?.id ?? 'unassigned';
        const vendorName: string = (part as any).vendors?.vendor_name ?? 'No Vendor Assigned';

        if (!grouped[vendorId]) {
          grouped[vendorId] = { vendor_id: vendorId === 'unassigned' ? null : vendorId, vendor_name: vendorName, parts: [] };
        }

        grouped[vendorId].parts.push({
          part_id: part.id,
          part_number: part.part_number,
          name: part.name,
          quantity_on_hand: part.quantity_on_hand,
          unit_cost: part.unit_cost,
          unit_price: part.unit_price,
          is_active: part.is_active,
          used_this_year: usageMap[part.id] ?? 0,
        });
      }

      setVendorGroups(
        Object.values(grouped).sort((a, b) => a.vendor_name.localeCompare(b.vendor_name))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredGroups = useMemo(() => {
    return vendorGroups
      .filter(g => selectedVendor === 'all' || (g.vendor_id ?? 'unassigned') === selectedVendor)
      .map(g => ({
        ...g,
        parts: g.parts.filter(p => {
          if (statusFilter === 'active') return p.is_active;
          if (statusFilter === 'inactive') return !p.is_active;
          return true;
        }),
      }))
      .filter(g => g.parts.length > 0);
  }, [vendorGroups, selectedVendor, statusFilter]);

  function handlePrint() {
    const rows = filteredGroups.map(group => {
      const totalUsed = group.parts.reduce((s, p) => s + p.used_this_year, 0);
      const totalOnHand = group.parts.reduce((s, p) => s + p.quantity_on_hand, 0);
      const totalValue = group.parts.reduce((s, p) => s + p.quantity_on_hand * p.unit_cost, 0);

      const partRows = group.parts.map((part, idx) => `
        <tr style="background:${idx % 2 === 1 ? '#f9fafb' : 'white'}">
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;font-weight:600;color:#111">${part.part_number}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;color:#111">
            ${part.name}
            ${!part.is_active ? '<span style="font-size:9px;background:#fee2e2;color:#b91c1c;border-radius:3px;padding:1px 4px;margin-left:6px">Inactive</span>' : ''}
          </td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:center">
            <span style="font-size:10px;font-weight:500;padding:2px 6px;border-radius:3px;background:${part.is_active ? '#dcfce7' : '#f3f4f6'};color:${part.is_active ? '#15803d' : '#6b7280'}">
              ${part.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${part.quantity_on_hand <= 0 ? '#dc2626' : '#111'}">${part.quantity_on_hand}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:${part.used_this_year > 0 ? '#1d4ed8' : '#9ca3af'};font-weight:${part.used_this_year > 0 ? 500 : 400}">${part.used_this_year}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111">$${part.unit_cost.toFixed(2)}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #e5e7eb;text-align:right;color:#111">$${(part.quantity_on_hand * part.unit_cost).toFixed(2)}</td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom:24px;page-break-inside:avoid">
          <div style="background:#1e3a5f;color:white;padding:6px 10px;font-weight:bold;font-size:13px;border-radius:4px 4px 0 0">
            ${group.vendor_name}
            <span style="font-weight:normal;font-size:11px;margin-left:8px;opacity:0.8">(${group.parts.length} part${group.parts.length !== 1 ? 's' : ''})</span>
          </div>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f0f4f8">
                <th style="padding:5px 8px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">Part #</th>
                <th style="padding:5px 8px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">Name</th>
                <th style="padding:5px 8px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">Status</th>
                <th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">On Hand</th>
                <th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">Used (YTD)</th>
                <th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">Unit Cost</th>
                <th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid #ccc;color:#374151">Inventory Value</th>
              </tr>
            </thead>
            <tbody>
              ${partRows}
              <tr style="background:#f0f4f8;font-weight:600;color:#111">
                <td colspan="3" style="padding:5px 8px;border-top:2px solid #d1d5db;color:#111">Vendor Totals</td>
                <td style="padding:5px 8px;border-top:2px solid #d1d5db;text-align:right;color:#111">${totalOnHand}</td>
                <td style="padding:5px 8px;border-top:2px solid #d1d5db;text-align:right;color:#111">${totalUsed}</td>
                <td style="padding:5px 8px;border-top:2px solid #d1d5db;color:#111"></td>
                <td style="padding:5px 8px;border-top:2px solid #d1d5db;text-align:right;color:#111">$${totalValue.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const filterNote = statusFilter !== 'all' ? ` &bull; ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} parts only` : '';

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Parts Inventory by Vendor</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; background: white; }
      @media print { body { padding: 10px; } }
    </style>
  </head>
  <body>
    <h1 style="font-size:18px;font-weight:bold;margin-bottom:2px;color:#111">Parts Inventory by Vendor</h1>
    <p style="font-size:11px;color:#555;margin-bottom:16px">
      Generated: ${dateStr} &bull; ${filteredGroups.length} vendor${filteredGroups.length !== 1 ? 's' : ''} &bull; ${totalParts} total part${totalParts !== 1 ? 's' : ''}${filterNote}
    </p>
    ${rows}
  </body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
        URL.revokeObjectURL(url);
      });
    }
  }

  const totalParts = filteredGroups.reduce((s, v) => s + v.parts.length, 0);

  const vendorOptions = useMemo(() => {
    return vendorGroups.map(g => ({
      value: g.vendor_id ?? 'unassigned',
      label: g.vendor_name,
    }));
  }, [vendorGroups]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Parts Report by Vendor</h2>
            <p className="text-sm text-gray-500 mt-0.5">All parts grouped by vendor &mdash; usage reflects current calendar year</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Vendor</label>
            <select
              value={selectedVendor}
              onChange={e => setSelectedVendor(e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Vendors</option>
              {vendorOptions.map(v => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Status</label>
            <div className="flex rounded-md border border-gray-300 overflow-hidden">
              {(['all', 'active', 'inactive'] as StatusFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? s === 'active'
                        ? 'bg-green-600 text-white'
                        : s === 'inactive'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-700 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {(selectedVendor !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setSelectedVendor('all'); setStatusFilter('all'); }}
              className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">
            {filteredGroups.length} vendor{filteredGroups.length !== 1 ? 's' : ''} &bull; {totalParts} part{totalParts !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading report...</div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-400">No parts match the selected filters.</div>
          ) : (
            <div ref={printRef}>
              <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '2px', color: '#111' }}>Parts Inventory by Vendor</h1>
              <div className="report-meta" style={{ fontSize: '11px', color: '#555', marginBottom: '16px' }}>
                Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} &nbsp;&bull;&nbsp; {filteredGroups.length} vendor{filteredGroups.length !== 1 ? 's' : ''} &nbsp;&bull;&nbsp; {totalParts} total part{totalParts !== 1 ? 's' : ''}
                {statusFilter !== 'all' && <> &nbsp;&bull;&nbsp; {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} parts only</>}
              </div>

              {filteredGroups.map((group) => {
                const totalUsed = group.parts.reduce((s, p) => s + p.used_this_year, 0);
                const totalOnHand = group.parts.reduce((s, p) => s + p.quantity_on_hand, 0);
                const totalValue = group.parts.reduce((s, p) => s + p.quantity_on_hand * p.unit_cost, 0);

                return (
                  <div key={group.vendor_id ?? 'unassigned'} className="vendor-section mb-6">
                    <div
                      className="vendor-header"
                      style={{ background: '#1e3a5f', color: 'white', padding: '6px 10px', fontWeight: 'bold', fontSize: '13px', borderRadius: '4px 4px 0 0' }}
                    >
                      {group.vendor_name}
                      <span style={{ fontWeight: 'normal', fontSize: '11px', marginLeft: '8px', opacity: 0.8 }}>
                        ({group.parts.length} part{group.parts.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f0f4f8' }}>
                          <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>Part #</th>
                          <th style={{ padding: '5px 8px', textAlign: 'left', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>Name</th>
                          <th style={{ padding: '5px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>Status</th>
                          <th style={{ padding: '5px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>On Hand</th>
                          <th style={{ padding: '5px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>Used (YTD)</th>
                          <th style={{ padding: '5px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>Unit Cost</th>
                          <th style={{ padding: '5px 8px', textAlign: 'right', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', borderBottom: '1px solid #ccc', color: '#374151' }}>Inventory Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.parts.map((part, idx) => (
                          <tr key={part.part_id} style={{ background: idx % 2 === 1 ? '#f9fafb' : 'white' }}>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#111' }}>{part.part_number}</td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', color: '#111' }}>
                              {part.name}
                              {!part.is_active && (
                                <span style={{ fontSize: '9px', background: '#fee2e2', color: '#b91c1c', borderRadius: '3px', padding: '1px 4px', marginLeft: '6px' }}>
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'center' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 500,
                                padding: '2px 6px',
                                borderRadius: '3px',
                                background: part.is_active ? '#dcfce7' : '#f3f4f6',
                                color: part.is_active ? '#15803d' : '#6b7280'
                              }}>
                                {part.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                              <span style={{ color: part.quantity_on_hand <= 0 ? '#dc2626' : '#111' }}>
                                {part.quantity_on_hand}
                              </span>
                            </td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>
                              {part.used_this_year > 0 ? (
                                <span style={{ color: '#1d4ed8', fontWeight: 500 }}>{part.used_this_year}</span>
                              ) : (
                                <span style={{ color: '#9ca3af' }}>0</span>
                              )}
                            </td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#111' }}>
                              ${part.unit_cost.toFixed(2)}
                            </td>
                            <td style={{ padding: '5px 8px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#111' }}>
                              ${(part.quantity_on_hand * part.unit_cost).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        <tr className="vendor-totals" style={{ background: '#f0f4f8', fontWeight: 600, color: '#111' }}>
                          <td colSpan={3} style={{ padding: '5px 8px', borderTop: '2px solid #d1d5db', color: '#111' }}>Vendor Totals</td>
                          <td style={{ padding: '5px 8px', borderTop: '2px solid #d1d5db', textAlign: 'right', color: '#111' }}>{totalOnHand}</td>
                          <td style={{ padding: '5px 8px', borderTop: '2px solid #d1d5db', textAlign: 'right', color: '#111' }}>{totalUsed}</td>
                          <td style={{ padding: '5px 8px', borderTop: '2px solid #d1d5db', color: '#111' }}></td>
                          <td style={{ padding: '5px 8px', borderTop: '2px solid #d1d5db', textAlign: 'right', color: '#111' }}>${totalValue.toFixed(2)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
