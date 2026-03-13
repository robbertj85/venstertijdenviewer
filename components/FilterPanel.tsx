'use client';

import { useMemo, useState } from 'react';
import { VenstertijdFeature, Filters, CATEGORY_COLORS, CATEGORY_LABELS, RVV_DESCRIPTIONS, RVV_SIGN_IMAGES } from '@/types/venstertijden';

interface FilterPanelProps {
  features: VenstertijdFeature[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

// Natural sort for RVV codes: C1 < C6 < C7 < C7a < C7b < C12 < C17 < C21 < G5 < G7
function rvvSort(a: string, b: string): number {
  const re = /^([A-Z]+)(\d+)(.*)$/;
  const ma = a.match(re), mb = b.match(re);
  if (!ma || !mb) return a.localeCompare(b);
  if (ma[1] !== mb[1]) return ma[1].localeCompare(mb[1]);
  const na = parseInt(ma[2]), nb = parseInt(mb[2]);
  if (na !== nb) return na - nb;
  return ma[3].localeCompare(mb[3]);
}

type GemeenteSort = 'count' | 'az' | 'za';

export default function FilterPanel({ features, filters, onChange }: FilterPanelProps) {
  const [gemeenteSearch, setGemeenteSearch] = useState('');
  const [gemeenteSort, setGemeenteSort] = useState<GemeenteSort>('count');

  const stats = useMemo(() => {
    const categories: Record<string, number> = {};
    const gemeenten: Record<string, number> = {};
    const rvvCodes: Record<string, number> = {};

    for (const f of features) {
      const p = f.properties;
      categories[p.categorie] = (categories[p.categorie] || 0) + 1;
      gemeenten[p.gemeente] = (gemeenten[p.gemeente] || 0) + 1;
      rvvCodes[p.rvvCode] = (rvvCodes[p.rvvCode] || 0) + 1;
    }
    return { categories, gemeenten, rvvCodes };
  }, [features]);

  const filteredGemeenten = useMemo(() => {
    const entries = Object.entries(stats.gemeenten);
    if (gemeenteSort === 'az') entries.sort((a, b) => a[0].localeCompare(b[0], 'nl'));
    else if (gemeenteSort === 'za') entries.sort((a, b) => b[0].localeCompare(a[0], 'nl'));
    else entries.sort((a, b) => b[1] - a[1]);
    if (!gemeenteSearch) return entries;
    const q = gemeenteSearch.toLowerCase();
    return entries.filter(([name]) => name.toLowerCase().includes(q));
  }, [stats.gemeenten, gemeenteSearch, gemeenteSort]);

  const toggleCategory = (cat: string) => {
    const cats = filters.categories.includes(cat)
      ? filters.categories.filter(c => c !== cat)
      : [...filters.categories, cat];
    onChange({ ...filters, categories: cats });
  };

  const toggleGemeente = (g: string) => {
    const gs = filters.gemeenten.includes(g)
      ? filters.gemeenten.filter(x => x !== g)
      : [...filters.gemeenten, g];
    onChange({ ...filters, gemeenten: gs });
  };

  const toggleRvv = (r: string) => {
    const rs = filters.rvvCodes.includes(r)
      ? filters.rvvCodes.filter(x => x !== r)
      : [...filters.rvvCodes, r];
    onChange({ ...filters, rvvCodes: rs });
  };

  const resetFilters = () => onChange({ categories: [], gemeenten: [], rvvCodes: [] });

  const hasFilters = filters.categories.length > 0 || filters.gemeenten.length > 0 || filters.rvvCodes.length > 0;

  return (
    <div className="p-3 space-y-4">
      {/* Summary */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3">
        <div className="text-xl font-bold text-gray-900">{features.length}</div>
        <div className="text-xs text-gray-500">borden met venstertijden</div>
        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
          {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'overig').map(([key, label]) => (
            <div key={key}>
              <div className="text-base font-bold" style={{ color: CATEGORY_COLORS[key] }}>
                {stats.categories[key] || 0}
              </div>
              <div className="text-[9px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Categorie</div>
        <div className="space-y-0.5">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = stats.categories[key] || 0;
            if (count === 0) return null;
            const active = filters.categories.length === 0 || filters.categories.includes(key);
            return (
              <button key={key} onClick={() => toggleCategory(key)}
                className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs transition-colors ${active ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-gray-400'}`}>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[key], opacity: active ? 1 : 0.3 }} />
                  <span className={active ? 'font-medium' : ''}>{label}</span>
                </div>
                <span className="text-[10px] text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* RVV code filter */}
      <div>
        <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">RVV code</div>
        <div className="space-y-0.5">
          {Object.entries(stats.rvvCodes).sort((a, b) => rvvSort(a[0], b[0])).map(([code, count]) => {
            const active = filters.rvvCodes.length === 0 || filters.rvvCodes.includes(code);
            const signImg = RVV_SIGN_IMAGES[code];
            return (
              <button key={code} onClick={() => toggleRvv(code)}
                className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-xs transition-colors ${active ? 'bg-gray-100 text-gray-800' : 'bg-gray-50 text-gray-400'}`}>
                <div className="flex items-center gap-2">
                  {signImg && <img src={signImg} alt={code} className="w-5 h-5 object-contain" style={{ opacity: active ? 1 : 0.3 }} />}
                  <span className={`font-mono text-[10px] px-1 py-0.5 rounded ${active ? 'bg-gray-200 font-bold' : 'bg-gray-100'}`}>{code}</span>
                  <span className="text-[10px] text-gray-500 truncate">{RVV_DESCRIPTIONS[code] || ''}</span>
                </div>
                <span className="text-[10px] text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gemeente filter */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
            Gemeente ({Object.keys(stats.gemeenten).length})
          </div>
          <div className="flex gap-0.5">
            {(['count', 'az', 'za'] as const).map((s) => (
              <button key={s} onClick={() => setGemeenteSort(s)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${gemeenteSort === s ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}>
                {s === 'count' ? '#' : s === 'az' ? 'A→Z' : 'Z→A'}
              </button>
            ))}
          </div>
        </div>
        <input type="text" placeholder="Zoek gemeente..." value={gemeenteSearch} onChange={e => setGemeenteSearch(e.target.value)}
          className="w-full px-2.5 py-1 border border-gray-200 rounded-lg text-xs mb-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0">
          {filteredGemeenten.map(([name, count]) => {
            const active = filters.gemeenten.length === 0 || filters.gemeenten.includes(name);
            return (
              <button key={name} onClick={() => toggleGemeente(name)}
                className={`w-full flex items-center justify-between px-2.5 py-0.5 rounded text-xs transition-colors ${active ? 'text-gray-800' : 'text-gray-400'}`}>
                <span className={active ? 'font-medium' : ''}>{name}</span>
                <span className="text-[10px] text-gray-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      {hasFilters && (
        <button onClick={resetFilters} className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors">
          Reset filters
        </button>
      )}
    </div>
  );
}
