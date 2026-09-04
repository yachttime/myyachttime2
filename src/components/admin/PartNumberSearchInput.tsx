import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PartNumberSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}

interface PartSearchResult {
  partNumber: string;
  description: string;
  source: string;
  price: string;
}

export default function PartNumberSearchInput({ value, onChange, placeholder, className }: PartNumberSearchInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [results, setResults] = useState<PartSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
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

  const searchParts = async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    setLoading(true);

    const searchLower = query.toLowerCase().replace(/[-\s]/g, '');

    const inventoryResults: PartSearchResult[] = [];
    const { data: invData } = await supabase
      .from('parts_inventory')
      .select('id, part_number, name, unit_price, alternative_part_numbers, is_active')
      .eq('is_active', true)
      .or(`part_number.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(15);

    for (const p of invData || []) {
      const partNum = (p.part_number || '').trim();
      const altNum = (p.alternative_part_numbers || '').trim();
      const partNumNorm = partNum.toLowerCase().replace(/[-\s]/g, '');
      const altNumNorm = altNum.toLowerCase().replace(/[-\s]/g, '');
      if (partNumNorm.includes(searchLower) || altNumNorm.includes(searchLower)) {
        inventoryResults.push({
          partNumber: partNum,
          description: p.name,
          source: 'Inventory',
          price: `$${p.unit_price}`,
        });
      }
    }

    const { data: mercuryData } = await supabase
      .from('mercury_marine_parts')
      .select('id, part_number, description, msrp, is_active')
      .eq('is_active', true)
      .or(`part_number.ilike.%${query}%,description.ilike.%${query}%`)
      .order('part_number')
      .limit(10);

    const mercuryResults: PartSearchResult[] = (mercuryData || []).map(p => ({
      partNumber: p.part_number,
      description: p.description,
      source: 'Mercury',
      price: p.msrp ? `$${p.msrp}` : '-',
    }));

    const { data: wholesaleData } = await supabase
      .from('marine_wholesale_parts')
      .select('id, sku, mfg_part_number, description, list_price, is_active')
      .eq('is_active', true)
      .or(`sku.ilike.%${query}%,mfg_part_number.ilike.%${query}%,description.ilike.%${query}%`)
      .order('sku')
      .limit(10);

    const wholesaleResults: PartSearchResult[] = (wholesaleData || []).map(p => ({
      partNumber: p.sku,
      description: p.description,
      source: 'Wholesale',
      price: p.list_price ? `$${p.list_price}` : '-',
    }));

    const combined = [...inventoryResults, ...mercuryResults, ...wholesaleResults];
    setResults(combined);
    setShowDropdown(combined.length > 0);
    setLoading(false);
  };

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchParts(val), 300);
  };

  const selectResult = (result: PartSearchResult) => {
    onChange(result.partNumber);
    setShowDropdown(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (value.trim().length >= 2) searchParts(value); }}
          className={`${className || ''} pl-7 pr-2`}
          placeholder={placeholder}
        />
      </div>
      {showDropdown && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-52 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400">Searching parts...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400">No parts found</div>
          )}
          {!loading && results.map((result, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => selectResult(result)}
              className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium text-white">{result.partNumber}</span>
                  <span className="text-[10px] text-slate-400 ml-1 truncate">{result.description}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded">{result.source}</span>
                  <span className="text-[10px] text-slate-400">{result.price}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
