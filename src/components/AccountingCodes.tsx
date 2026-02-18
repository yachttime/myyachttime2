import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Info, RefreshCw } from 'lucide-react';

interface QboAccount {
  id: string;
  qbo_account_id: string;
  account_name: string;
  account_number: string | null;
  account_type: string | null;
  account_subtype: string | null;
  active: boolean;
  last_synced_at: string | null;
}

interface AccountingCodesProps {
  userId: string;
}

const typeColors: Record<string, string> = {
  Income: 'bg-green-100 text-green-800',
  Expense: 'bg-red-100 text-red-800',
  Asset: 'bg-blue-100 text-blue-800',
  Liability: 'bg-orange-100 text-orange-800',
  Equity: 'bg-yellow-100 text-yellow-800',
  'Cost of Goods Sold': 'bg-rose-100 text-rose-800',
};

export function AccountingCodes({ userId }: AccountingCodesProps) {
  const [accounts, setAccounts] = useState<QboAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('quickbooks_accounts')
        .select('id, qbo_account_id, account_name, account_number, account_type, account_subtype, active, last_synced_at')
        .order('account_number', { ascending: true });

      if (fetchError) throw fetchError;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error loading QB accounts:', err);
      setError('Failed to load QuickBooks accounts');
    } finally {
      setLoading(false);
    }
  };

  const filtered = accounts.filter(a => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.account_name.toLowerCase().includes(q) ||
      (a.account_number || '').toLowerCase().includes(q) ||
      (a.account_type || '').toLowerCase().includes(q)
    );
  });

  if (loading) {
    return <div className="p-8 text-center">Loading accounts...</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-900">QuickBooks Accounts</h2>
        <button
          onClick={loadAccounts}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <Info className="w-5 h-5 mt-0.5 flex-shrink-0 text-blue-500" />
        <div>
          <p className="font-semibold mb-1">QuickBooks Chart of Accounts</p>
          <p>These accounts are synced from your QuickBooks company file. Use the <strong>QuickBooks</strong> tab to map labor codes and parts to specific accounts for invoice export.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, number, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm"
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Account Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  {accounts.length === 0
                    ? 'No QuickBooks accounts found. Sync your accounts from the QuickBooks tab.'
                    : 'No accounts match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((acct) => (
                <tr key={acct.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {acct.account_number || <span className="text-gray-400 italic">—</span>}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {acct.account_name}
                    {acct.account_subtype && (
                      <div className="text-xs text-gray-400 mt-0.5">{acct.account_subtype}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {acct.account_type ? (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[acct.account_type] || 'bg-gray-100 text-gray-700'}`}>
                        {acct.account_type}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {acct.active ? (
                      <span className="text-green-600 font-medium">Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {accounts.length > 0 && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          {filtered.length} of {accounts.length} accounts
        </div>
      )}
    </div>
  );
}
