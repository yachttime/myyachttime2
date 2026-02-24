import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, X, Package, Wrench, Box, Search } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm';

interface EstimatePackage {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

interface PackageLabor {
  id: string;
  package_id: string;
  labor_code_id: string;
  hours: number;
  rate: number;
  description: string;
  labor_code?: {
    code: string;
    name: string;
    hourly_rate: number;
  };
}

interface PackagePart {
  id: string;
  package_id: string;
  part_id: string | null;
  mercury_part_id: string | null;
  marine_wholesale_part_id: string | null;
  part_source: string;
  part_number_display: string;
  description_display: string;
  quantity: number;
  unit_price: number;
  description: string;
  part?: {
    part_number: string;
    description: string;
    unit_price: number;
  };
}

interface LaborCode {
  id: string;
  code: string;
  name: string;
  hourly_rate: number;
}

type PartSource = 'inventory' | 'mercury' | 'marine_wholesale';

interface PartSearchResult {
  id: string;
  part_number: string;
  alternative_part_numbers?: string;
  description: string;
  unit_price: number;
  source: PartSource;
  source_label: string;
  is_alt?: boolean;
}

interface EstimatePackagesProps {
  userId: string;
}

export function EstimatePackages({ userId }: EstimatePackagesProps) {
  const { confirm, ConfirmDialog } = useConfirm();
  const [packages, setPackages] = useState<EstimatePackage[]>([]);
  const [laborCodes, setLaborCodes] = useState<LaborCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<EstimatePackage | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [packageLabor, setPackageLabor] = useState<PackageLabor[]>([]);
  const [packageParts, setPackageParts] = useState<PackagePart[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true
  });

  const [laborFormData, setLaborFormData] = useState({
    labor_code_id: '',
    hours: 1,
    rate: 0,
    description: ''
  });

  const [partSource, setPartSource] = useState<PartSource>('inventory');
  const [partSearch, setPartSearch] = useState('');
  const [partSearchResults, setPartSearchResults] = useState<PartSearchResult[]>([]);
  const [partSearchLoading, setPartSearchLoading] = useState(false);
  const [selectedPartResult, setSelectedPartResult] = useState<PartSearchResult | null>(null);
  const [showPartDropdown, setShowPartDropdown] = useState(false);
  const [partQuantity, setPartQuantity] = useState(1);
  const [partUnitPrice, setPartUnitPrice] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedPackage) {
      fetchPackageItems(selectedPackage);
    }
  }, [selectedPackage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowPartDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setPartSearch('');
    setSelectedPartResult(null);
    setPartSearchResults([]);
    setShowPartDropdown(false);
    setPartUnitPrice(0);
  }, [partSource]);

  useEffect(() => {
    if (!partSearch.trim() || partSearch.length < 2) {
      setPartSearchResults([]);
      setShowPartDropdown(false);
      return;
    }
    if (selectedPartResult) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => searchParts(partSearch), 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [partSearch, partSource]);

  async function searchParts(term: string) {
    setPartSearchLoading(true);
    try {
      if (partSource === 'inventory') {
        const { data } = await supabase
          .from('parts_inventory')
          .select('id, part_number, alternative_part_numbers, name, description, unit_price')
          .or(`part_number.ilike.%${term}%,alternative_part_numbers.ilike.%${term}%,name.ilike.%${term}%,description.ilike.%${term}%`)
          .eq('is_active', true)
          .limit(30)
          .order('part_number');
        const results: PartSearchResult[] = [];
        const seen = new Set<string>();
        for (const p of (data || [])) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          const displayDesc = p.name || p.description || '';
          results.push({
            id: p.id,
            part_number: p.part_number,
            alternative_part_numbers: p.alternative_part_numbers || '',
            description: displayDesc,
            unit_price: p.unit_price ?? 0,
            source: 'inventory' as PartSource,
            source_label: 'Shop',
            is_alt: false
          });
          if (p.alternative_part_numbers) {
            results.push({
              id: p.id + '_alt',
              part_number: p.alternative_part_numbers,
              alternative_part_numbers: p.part_number,
              description: displayDesc,
              unit_price: p.unit_price ?? 0,
              source: 'inventory' as PartSource,
              source_label: 'Shop',
              is_alt: true
            });
          }
        }
        setPartSearchResults(results);
      } else if (partSource === 'mercury') {
        const { data } = await supabase
          .from('mercury_marine_parts')
          .select('id, part_number, description, msrp, dealer_price')
          .or(`part_number.ilike.%${term}%,description.ilike.%${term}%`)
          .eq('is_active', true)
          .limit(30)
          .order('part_number');
        setPartSearchResults((data || []).map(p => ({
          id: p.id,
          part_number: p.part_number,
          description: p.description,
          unit_price: p.msrp ?? p.dealer_price ?? 0,
          source: 'mercury' as PartSource,
          source_label: 'Mercury'
        })));
      } else if (partSource === 'marine_wholesale') {
        const { data } = await supabase
          .from('marine_wholesale_parts')
          .select('id, sku, mfg_part_number, description, list_price, cost')
          .or(`sku.ilike.%${term}%,mfg_part_number.ilike.%${term}%,description.ilike.%${term}%`)
          .eq('is_active', true)
          .limit(30)
          .order('sku');
        setPartSearchResults((data || []).map(p => ({
          id: p.id,
          part_number: p.sku || p.mfg_part_number || '',
          description: p.description,
          unit_price: p.list_price ?? p.cost ?? 0,
          source: 'marine_wholesale' as PartSource,
          source_label: 'Marine Wholesale'
        })));
      }
      setShowPartDropdown(true);
    } catch (err) {
      console.error('Part search error:', err);
    } finally {
      setPartSearchLoading(false);
    }
  }

  function selectPartResult(result: PartSearchResult) {
    const normalized = result.is_alt
      ? { ...result, id: result.id.replace('_alt', '') }
      : result;
    setSelectedPartResult(normalized);
    setPartSearch(normalized.part_number);
    setPartUnitPrice(normalized.unit_price);
    setShowPartDropdown(false);
  }

  async function fetchData() {
    try {
      const [packagesRes, laborCodesRes] = await Promise.all([
        supabase.from('estimate_packages').select('*').order('name'),
        supabase.from('labor_codes').select('id, code, name, hourly_rate').eq('is_active', true).order('code'),
      ]);
      if (packagesRes.data) setPackages(packagesRes.data);
      if (laborCodesRes.data) setLaborCodes(laborCodesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPackageItems(packageId: string) {
    try {
      const [laborRes, partsRes] = await Promise.all([
        supabase
          .from('estimate_package_labor')
          .select(`*, labor_code:labor_codes(code, name, hourly_rate)`)
          .eq('package_id', packageId),
        supabase
          .from('estimate_package_parts')
          .select(`*, part:parts_inventory(part_number, name, description, alternative_part_numbers, unit_price)`)
          .eq('package_id', packageId)
      ]);
      if (laborRes.data) setPackageLabor(laborRes.data as PackageLabor[]);
      if (partsRes.data) setPackageParts(partsRes.data as PackagePart[]);
    } catch (error) {
      console.error('Error fetching package items:', error);
    }
  }

  function openModal(pkg?: EstimatePackage) {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({ name: pkg.name, description: pkg.description, is_active: pkg.is_active });
      setSelectedPackage(pkg.id);
    } else {
      setEditingPackage(null);
      setFormData({ name: '', description: '', is_active: true });
    }
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingPackage(null);
    setFormData({ name: '', description: '', is_active: true });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingPackage) {
        const { error } = await supabase
          .from('estimate_packages')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingPackage.id);
        if (error) throw error;
        closeModal();
        fetchData();
      } else {
        const { data, error } = await supabase
          .from('estimate_packages')
          .insert({ ...formData, created_by: userId })
          .select()
          .single();
        if (error) throw error;
        closeModal();
        await fetchData();
        if (data) setSelectedPackage(data.id);
      }
    } catch (error) {
      console.error('Error saving package:', error);
      alert('Error saving package');
    }
  }

  async function handleDelete(id: string) {
    if (!await confirm({ message: 'Are you sure you want to delete this package?', variant: 'danger' })) return;
    try {
      const { error } = await supabase.from('estimate_packages').delete().eq('id', id);
      if (error) throw error;
      if (selectedPackage === id) {
        setSelectedPackage(null);
        setPackageLabor([]);
        setPackageParts([]);
      }
      fetchData();
    } catch (error) {
      console.error('Error deleting package:', error);
      alert('Error deleting package');
    }
  }

  async function addLaborToPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackage || !laborFormData.labor_code_id) return;
    try {
      const selectedLabor = laborCodes.find(lc => lc.id === laborFormData.labor_code_id);
      const { error } = await supabase.from('estimate_package_labor').insert({
        package_id: selectedPackage,
        labor_code_id: laborFormData.labor_code_id,
        hours: laborFormData.hours,
        rate: laborFormData.rate || selectedLabor?.hourly_rate || 0,
        description: laborFormData.description
      });
      if (error) throw error;
      setLaborFormData({ labor_code_id: '', hours: 1, rate: 0, description: '' });
      fetchPackageItems(selectedPackage);
    } catch (error) {
      console.error('Error adding labor:', error);
      alert('Error adding labor to package');
    }
  }

  async function addPartToPackage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPackage || !selectedPartResult) return;
    try {
      const payload: Record<string, unknown> = {
        package_id: selectedPackage,
        quantity: partQuantity,
        unit_price: partUnitPrice,
        part_source: partSource,
        part_number_display: selectedPartResult.part_number,
        description_display: selectedPartResult.description,
        description: '',
      };

      if (partSource === 'inventory') {
        payload.part_id = selectedPartResult.id;
      } else if (partSource === 'mercury') {
        payload.mercury_part_id = selectedPartResult.id;
      } else if (partSource === 'marine_wholesale') {
        payload.marine_wholesale_part_id = selectedPartResult.id;
      }

      const { error } = await supabase.from('estimate_package_parts').insert(payload);
      if (error) throw error;

      setSelectedPartResult(null);
      setPartSearch('');
      setPartQuantity(1);
      setPartUnitPrice(0);
      fetchPackageItems(selectedPackage);
    } catch (error) {
      console.error('Error adding part:', error);
      alert('Error adding part to package');
    }
  }

  async function removeLabor(id: string) {
    if (!await confirm({ message: 'Remove this labor from the package?', variant: 'warning' })) return;
    try {
      const { error } = await supabase.from('estimate_package_labor').delete().eq('id', id);
      if (error) throw error;
      if (selectedPackage) fetchPackageItems(selectedPackage);
    } catch (error) {
      console.error('Error removing labor:', error);
    }
  }

  async function removePart(id: string) {
    if (!await confirm({ message: 'Remove this part from the package?', variant: 'warning' })) return;
    try {
      const { error } = await supabase.from('estimate_package_parts').delete().eq('id', id);
      if (error) throw error;
      if (selectedPackage) fetchPackageItems(selectedPackage);
    } catch (error) {
      console.error('Error removing part:', error);
    }
  }

  function handleLaborCodeChange(laborCodeId: string) {
    const selectedLabor = laborCodes.find(lc => lc.id === laborCodeId);
    setLaborFormData({ ...laborFormData, labor_code_id: laborCodeId, rate: selectedLabor?.hourly_rate || 0 });
  }

  function getPartDisplayName(part: PackagePart): string {
    if (part.part_number_display) return `${part.part_number_display} - ${part.description_display}`;
    if (part.part) return `${part.part.part_number} - ${(part.part as any).name || part.part.description}`;
    return 'Unknown Part';
  }

  function getPartSourceBadge(source: string) {
    if (source === 'mercury') return <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Mercury</span>;
    if (source === 'marine_wholesale') return <span className="text-xs px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-medium">Wholesale</span>;
    return <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium">Shop</span>;
  }

  const calculatePackageTotal = () => {
    const laborTotal = packageLabor.reduce((sum, labor) => sum + (labor.hours * labor.rate), 0);
    const partsTotal = packageParts.reduce((sum, part) => sum + (part.quantity * part.unit_price), 0);
    return laborTotal + partsTotal;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-700">Loading packages...</div>
      </div>
    );
  }

  const sourceOptions: { value: PartSource; label: string }[] = [
    { value: 'inventory', label: 'Shop Inventory' },
    { value: 'mercury', label: 'Mercury Marine' },
    { value: 'marine_wholesale', label: 'Marine Wholesale' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estimate Packages</h2>
          <p className="text-gray-600 mt-1">Create package templates with labor and parts</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Package
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Available Packages</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {packages.length === 0 ? (
              <div className="p-8 text-center text-gray-700">No packages created yet</div>
            ) : (
              packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedPackage === pkg.id ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedPackage(pkg.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-gray-600" />
                        <span className="font-semibold text-gray-900">{pkg.name}</span>
                        {!pkg.is_active && (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">Inactive</span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openModal(pkg); }}
                        className="p-1 text-gray-600 hover:text-blue-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(pkg.id); }}
                        className="p-1 text-gray-600 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              {selectedPackage ? 'Package Details' : 'Select a Package'}
            </h3>
            {selectedPackage && (
              <button
                onClick={() => { setSelectedPackage(null); setPackageLabor([]); setPackageParts([]); }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium"
              >
                Done
              </button>
            )}
          </div>

          {selectedPackage ? (
            <div className="p-4 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    Labor Items
                  </h4>
                </div>
                <form onSubmit={addLaborToPackage} className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={laborFormData.labor_code_id}
                      onChange={(e) => handleLaborCodeChange(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      required
                    >
                      <option value="">Select Labor Code</option>
                      {laborCodes.map(lc => (
                        <option key={lc.id} value={lc.id}>{lc.code} - {lc.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="Hours"
                      value={laborFormData.hours}
                      onChange={(e) => setLaborFormData({...laborFormData, hours: parseFloat(e.target.value) || 0})}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                      step="0.25"
                      min="0"
                      required
                    />
                  </div>
                  <input
                    type="number"
                    placeholder="Rate (optional)"
                    value={laborFormData.rate}
                    onChange={(e) => setLaborFormData({...laborFormData, rate: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                    step="0.01"
                    min="0"
                  />
                  <button type="submit" className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add Labor
                  </button>
                </form>
                <div className="space-y-2">
                  {packageLabor.map(labor => (
                    <div key={labor.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900">
                          {labor.labor_code?.code} - {labor.labor_code?.name}
                        </div>
                        <div className="text-xs text-gray-600">
                          {labor.hours}h @ ${labor.rate}/hr = ${(labor.hours * labor.rate).toFixed(2)}
                        </div>
                      </div>
                      <button onClick={() => removeLabor(labor.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {packageLabor.length === 0 && (
                    <div className="text-sm text-gray-700 text-center py-2">No labor items</div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    Parts
                  </h4>
                </div>
                <form onSubmit={addPartToPackage} className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg">
                    {sourceOptions.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPartSource(opt.value)}
                        className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                          partSource === opt.value
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div ref={searchRef} className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                      <input
                        type="text"
                        placeholder={`Search ${sourceOptions.find(o => o.value === partSource)?.label}...`}
                        value={partSearch}
                        onChange={(e) => {
                          setPartSearch(e.target.value);
                          if (selectedPartResult) setSelectedPartResult(null);
                        }}
                        onFocus={() => { if (partSearchResults.length > 0) setShowPartDropdown(true); }}
                        className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                        autoComplete="off"
                      />
                      {partSearchLoading && (
                        <div className="absolute right-2.5 top-2.5 w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {showPartDropdown && partSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {partSearchResults.map(result => (
                          <button
                            key={result.id}
                            type="button"
                            onMouseDown={() => selectPartResult(result)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-gray-900 truncate">{result.part_number}</span>
                                {result.is_alt ? (
                                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">Alt #</span>
                                ) : result.alternative_part_numbers ? (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium whitespace-nowrap">Primary</span>
                                ) : null}
                              </div>
                              <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">${result.unit_price.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 truncate">{result.description}</span>
                              {result.alternative_part_numbers && (
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                  {result.is_alt ? `Primary: ${result.alternative_part_numbers}` : `Alt: ${result.alternative_part_numbers}`}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showPartDropdown && partSearch.length >= 2 && partSearchResults.length === 0 && !partSearchLoading && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2">
                        <p className="text-sm text-gray-500">No results found</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={partQuantity}
                        onChange={(e) => setPartQuantity(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        step="0.1"
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                      <input
                        type="number"
                        value={partUnitPrice}
                        onChange={(e) => setPartUnitPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedPartResult}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 inline mr-1" />
                    Add Part
                  </button>
                </form>

                <div className="space-y-2">
                  {packageParts.map(part => (
                    <div key={part.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{getPartDisplayName(part)}</span>
                          {getPartSourceBadge(part.part_source)}
                        </div>
                        <div className="text-xs text-gray-600">
                          Qty: {part.quantity} @ ${Number(part.unit_price).toFixed(2)} = ${(part.quantity * Number(part.unit_price)).toFixed(2)}
                        </div>
                      </div>
                      <button onClick={() => removePart(part.id)} className="p-1 text-red-600 hover:bg-red-50 rounded ml-2 shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {packageParts.length === 0 && (
                    <div className="text-sm text-gray-700 text-center py-2">No parts</div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-900">Package Total</span>
                  <span className="text-xl font-bold text-gray-900">${calculatePackageTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-700">
              Select a package to view and edit its items
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingPackage ? 'Edit Package' : 'New Package'}
              </h3>
              <button onClick={closeModal} className="text-gray-600 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingPackage ? 'Update' : 'Create'}
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
