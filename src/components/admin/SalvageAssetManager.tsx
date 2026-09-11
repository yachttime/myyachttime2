import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useConfirm } from '../../hooks/useConfirm';
import { Plus, Edit2, Trash2, X, Package, Search, Box, LifeBuoy, ChevronDown, ChevronRight } from 'lucide-react';

interface SalvageAsset {
  id: string;
  company_id: string;
  name: string;
  category: string | null;
  description: string | null;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
}

interface SalvageAssetPackage {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface SalvageAssetPackageItem {
  id: string;
  package_id: string;
  asset_id: string;
  quantity: number;
  unit_price: number | null;
  asset?: SalvageAsset;
}

interface SalvageAssetManagerProps {
  userId: string;
  companyId: string;
  userRole: string;
}

export function SalvageAssetManager({ userId, companyId, userRole }: SalvageAssetManagerProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [tab, setTab] = useState<'assets' | 'packages'>('assets');
  const [assets, setAssets] = useState<SalvageAsset[]>([]);
  const [packages, setPackages] = useState<SalvageAssetPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showAssetModal, setShowAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<SalvageAsset | null>(null);
  const [assetForm, setAssetForm] = useState({ name: '', category: '', description: '', unit_cost: '0', is_active: true });
  const [assetSearch, setAssetSearch] = useState('');

  const [showPackageModal, setShowPackageModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<SalvageAssetPackage | null>(null);
  const [packageForm, setPackageForm] = useState({ name: '', description: '', is_active: true });
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const [packageItems, setPackageItems] = useState<SalvageAssetPackageItem[]>([]);
  const [packageItemsLoading, setPackageItemsLoading] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [itemForm, setItemForm] = useState({ asset_id: '', quantity: '1', unit_price: '' });

  const isMaster = userRole === 'master';

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadAssets = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('salvage_assets')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (err) { setError('Failed to load assets'); return; }
    setAssets(data as SalvageAsset[] || []);
  }, [companyId]);

  const loadPackages = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('salvage_asset_packages')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    if (err) { setError('Failed to load packages'); return; }
    setPackages(data as SalvageAssetPackage[] || []);
  }, [companyId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadAssets(), loadPackages()]);
      setLoading(false);
    })();
  }, [loadAssets, loadPackages]);

  const loadPackageItems = async (pkgId: string) => {
    setPackageItemsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('salvage_asset_package_items')
        .select(`*, asset:salvage_assets(*)`)
        .eq('package_id', pkgId)
        .order('created_at');
      if (err) throw err;
      setPackageItems(data as SalvageAssetPackageItem[] || []);
    } catch {
      setError('Failed to load package items');
    } finally {
      setPackageItemsLoading(false);
    }
  };

  const filteredAssets = assets.filter(a => {
    if (!assetSearch) return true;
    const s = assetSearch.toLowerCase();
    return a.name?.toLowerCase().includes(s) || a.category?.toLowerCase().includes(s) || a.description?.toLowerCase().includes(s);
  });

  function openAssetModal(asset?: SalvageAsset) {
    if (asset) {
      setEditingAsset(asset);
      setAssetForm({ name: asset.name, category: asset.category || '', description: asset.description || '', unit_cost: String(asset.unit_cost), is_active: asset.is_active });
    } else {
      setEditingAsset(null);
      setAssetForm({ name: '', category: '', description: '', unit_cost: '0', is_active: true });
    }
    setShowAssetModal(true);
  }

  async function handleSaveAsset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      name: assetForm.name.trim(),
      category: assetForm.category.trim() || null,
      description: assetForm.description.trim() || null,
      unit_cost: parseFloat(assetForm.unit_cost) || 0,
      is_active: assetForm.is_active,
      company_id: companyId,
    };
    try {
      if (editingAsset) {
        const { error: err } = await supabase.from('salvage_assets').update(payload).eq('id', editingAsset.id);
        if (err) throw err;
        showSuccessMsg('Asset updated');
      } else {
        const { error: err } = await supabase.from('salvage_assets').insert({ ...payload, created_by: userId });
        if (err) throw err;
        showSuccessMsg('Asset created');
      }
      setShowAssetModal(false);
      await loadAssets();
    } catch {
      setError('Failed to save asset');
    }
  }

  async function handleDeleteAsset(asset: SalvageAsset) {
    const ok = await confirm(`Delete asset "${asset.name}"? This cannot be undone.`);
    if (!ok) return;
    const { error: err } = await supabase.from('salvage_assets').delete().eq('id', asset.id);
    if (err) { setError('Failed to delete asset'); return; }
    showSuccessMsg('Asset deleted');
    await loadAssets();
  }

  function openPackageModal(pkg?: SalvageAssetPackage) {
    if (pkg) {
      setEditingPackage(pkg);
      setPackageForm({ name: pkg.name, description: pkg.description || '', is_active: pkg.is_active });
    } else {
      setEditingPackage(null);
      setPackageForm({ name: '', description: '', is_active: true });
    }
    setShowPackageModal(true);
  }

  async function handleSavePackage(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const payload = {
      name: packageForm.name.trim(),
      description: packageForm.description.trim() || null,
      is_active: packageForm.is_active,
      company_id: companyId,
    };
    try {
      if (editingPackage) {
        const { error: err } = await supabase.from('salvage_asset_packages').update(payload).eq('id', editingPackage.id);
        if (err) throw err;
        showSuccessMsg('Package updated');
      } else {
        const { error: err } = await supabase.from('salvage_asset_packages').insert({ ...payload, created_by: userId });
        if (err) throw err;
        showSuccessMsg('Package created');
      }
      setShowPackageModal(false);
      await loadPackages();
    } catch {
      setError('Failed to save package');
    }
  }

  async function handleDeletePackage(pkg: SalvageAssetPackage) {
    const ok = await confirm(`Delete package "${pkg.name}"? All items in this package will be removed.`);
    if (!ok) return;
    const { error: err } = await supabase.from('salvage_asset_packages').delete().eq('id', pkg.id);
    if (err) { setError('Failed to delete package'); return; }
    showSuccessMsg('Package deleted');
    if (expandedPackage === pkg.id) setExpandedPackage(null);
    await loadPackages();
  }

  async function togglePackage(pkgId: string) {
    if (expandedPackage === pkgId) {
      setExpandedPackage(null);
      return;
    }
    setExpandedPackage(pkgId);
    await loadPackageItems(pkgId);
  }

  function openAddItemModal() {
    setItemForm({ asset_id: '', quantity: '1', unit_price: '' });
    setShowAddItemModal(true);
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemForm.asset_id || !expandedPackage) return;
    setError('');
    try {
      const { error: err } = await supabase.from('salvage_asset_package_items').insert({
        package_id: expandedPackage,
        asset_id: itemForm.asset_id,
        quantity: parseFloat(itemForm.quantity) || 1,
        unit_price: itemForm.unit_price ? parseFloat(itemForm.unit_price) : null,
      });
      if (err) throw err;
      setShowAddItemModal(false);
      await loadPackageItems(expandedPackage);
      showSuccessMsg('Item added to package');
    } catch {
      setError('Failed to add item');
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!expandedPackage) return;
    const { error: err } = await supabase.from('salvage_asset_package_items').delete().eq('id', itemId);
    if (err) { setError('Failed to remove item'); return; }
    await loadPackageItems(expandedPackage);
    showSuccessMsg('Item removed');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-red-500/20 p-3 rounded-xl">
          <LifeBuoy className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Salvage Asset Database</h2>
          <p className="text-slate-400 text-sm">Manage reusable salvage assets and pre-set packages</p>
        </div>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500/50 text-green-400 p-3 rounded-lg text-sm">{success}</div>}

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => setTab('assets')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${tab === 'assets' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
        >
          <Box className="w-4 h-4 inline mr-2" />Assets
        </button>
        <button
          onClick={() => setTab('packages')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${tab === 'packages' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-slate-400 hover:text-slate-300'}`}
        >
          <Package className="w-4 h-4 inline mr-2" />Packages
        </button>
      </div>

      {/* Assets tab */}
      {tab === 'assets' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={assetSearch}
                onChange={e => setAssetSearch(e.target.value)}
                placeholder="Search assets..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button onClick={() => openAssetModal()} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              <Plus className="w-4 h-4" />Add Asset
            </button>
          </div>

          {filteredAssets.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No salvage assets yet. Click "Add Asset" to create one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map(asset => (
                <div key={asset.id} className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{asset.name}</h3>
                      {asset.category && <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{asset.category}</span>}
                    </div>
                    {!asset.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Inactive</span>}
                  </div>
                  {asset.description && <p className="text-sm text-slate-400 mb-3 line-clamp-2">{asset.description}</p>}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-amber-400">${asset.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <div className="flex gap-2">
                      <button onClick={() => openAssetModal(asset)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {isMaster && (
                        <button onClick={() => handleDeleteAsset(asset)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Packages tab */}
      {tab === 'packages' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end gap-4">
            <button onClick={() => openPackageModal()} className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors">
              <Plus className="w-4 h-4" />Add Package
            </button>
          </div>

          {packages.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No salvage asset packages yet. Click "Add Package" to create one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {packages.map(pkg => {
                const isExpanded = expandedPackage === pkg.id;
                const totalCost = packageItems.reduce((sum, item) => {
                  const price = item.unit_price ?? item.asset?.unit_cost ?? 0;
                  return sum + (price * (item.quantity || 0));
                }, 0);
                return (
                  <div key={pkg.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      <button onClick={() => togglePackage(pkg.id)} className="text-slate-400 hover:text-white transition-colors">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      <div className="flex-1">
                        <h3 className="font-semibold text-white">{pkg.name}</h3>
                        {pkg.description && <p className="text-sm text-slate-400">{pkg.description}</p>}
                      </div>
                      {!pkg.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">Inactive</span>}
                      {isExpanded && packageItems.length > 0 && (
                        <span className="text-sm font-bold text-amber-400">${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                      <div className="flex gap-2">
                        <button onClick={() => openPackageModal(pkg)} className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isMaster && (
                          <button onClick={() => handleDeletePackage(pkg)} className="p-1.5 text-slate-400 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                        {packageItemsLoading ? (
                          <div className="text-center py-4 text-slate-400 text-sm">Loading items...</div>
                        ) : packageItems.length === 0 ? (
                          <div className="text-center py-4 text-slate-400 text-sm">
                            <p>No items in this package yet.</p>
                            <button onClick={openAddItemModal} className="mt-2 inline-flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm font-medium">
                              <Plus className="w-4 h-4" />Add asset to package
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {packageItems.map(item => {
                              const price = item.unit_price ?? item.asset?.unit_cost ?? 0;
                              const lineTotal = price * (item.quantity || 0);
                              return (
                                <div key={item.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg p-3">
                                  <div className="flex-1">
                                    <span className="font-medium text-white text-sm">{item.asset?.name || 'Unknown asset'}</span>
                                    {item.asset?.category && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">{item.asset.category}</span>}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="text-slate-400">Qty: {item.quantity}</span>
                                    <span className="text-slate-400">${price.toFixed(2)} each</span>
                                    <span className="font-semibold text-amber-400">${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <button onClick={() => handleDeleteItem(item.id)} className="p-1 text-slate-400 hover:text-red-400 transition-colors">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                            <button onClick={openAddItemModal} className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-sm font-medium pt-2">
                              <Plus className="w-4 h-4" />Add another asset
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Asset modal */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold">{editingAsset ? 'Edit Asset' : 'New Salvage Asset'}</h2>
              <button onClick={() => setShowAssetModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSaveAsset} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input type="text" required value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Category</label>
                <input type="text" value={assetForm.category} onChange={e => setAssetForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Recovery, Fuel, Dive Gear"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea value={assetForm.description} onChange={e => setAssetForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Unit Cost *</label>
                <input type="number" step="0.01" min="0" required value={assetForm.unit_cost} onChange={e => setAssetForm(f => ({ ...f, unit_cost: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={assetForm.is_active} onChange={e => setAssetForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-900" />
                Active
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded-lg transition-colors">
                  {editingAsset ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowAssetModal(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Package modal */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold">{editingPackage ? 'Edit Package' : 'New Salvage Asset Package'}</h2>
              <button onClick={() => setShowPackageModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSavePackage} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Name *</label>
                <input type="text" required value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea value={packageForm.description} onChange={e => setPackageForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={packageForm.is_active} onChange={e => setPackageForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="rounded border-slate-600 bg-slate-900" />
                Active
              </label>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded-lg transition-colors">
                  {editingPackage ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => setShowPackageModal(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add item to package modal */}
      {showAddItemModal && expandedPackage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold">Add Asset to Package</h2>
              <button onClick={() => setShowAddItemModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Asset *</label>
                <select required value={itemForm.asset_id} onChange={e => setItemForm(f => ({ ...f, asset_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500">
                  <option value="">Select an asset...</option>
                  {assets.filter(a => a.is_active).map(a => (
                    <option key={a.id} value={a.id}>{a.name} (${a.unit_cost.toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Quantity *</label>
                <input type="number" step="0.01" min="0" required value={itemForm.quantity} onChange={e => setItemForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Override Price (optional)</label>
                <input type="number" step="0.01" min="0" value={itemForm.unit_price} onChange={e => setItemForm(f => ({ ...f, unit_price: e.target.value }))}
                  placeholder="Leave blank to use asset's unit cost"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 rounded-lg transition-colors">
                  Add to Package
                </button>
                <button type="button" onClick={() => setShowAddItemModal(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
