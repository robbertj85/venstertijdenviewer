'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface SearchResult {
  id: string;
  weergavenaam: string;
  type: string;
  centroide_ll?: string; // "POINT(lon lat)"
}

interface SearchBarProps {
  onSelect: (lat: number, lng: number, label: string) => void;
}

export default function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      // Use 'free' endpoint which always returns centroide_ll
      const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${encodeURIComponent(q)}&fq=type:(adres OR weg OR woonplaats OR postcode)&rows=7`);
      if (!res.ok) return;
      const data = await res.json();
      const docs = (data.response?.docs || [])
        .filter((d: Record<string, string>) => d.centroide_ll)
        .map((d: Record<string, string>) => ({
          id: d.id,
          weergavenaam: d.weergavenaam,
          type: d.type,
          centroide_ll: d.centroide_ll,
        }));
      setResults(docs);
      setOpen(docs.length > 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (r: SearchResult) => {
    if (!r.centroide_ll) return;
    // Parse "POINT(lon lat)" format
    const match = r.centroide_ll.match(/POINT\(([\d.]+)\s+([\d.]+)\)/);
    if (match) {
      const lng = parseFloat(match[1]);
      const lat = parseFloat(match[2]);
      onSelect(lat, lng, r.weergavenaam);
    }
    setQuery(r.weergavenaam);
    setOpen(false);
  };

  const typeLabel: Record<string, string> = {
    adres: 'Adres',
    weg: 'Straat',
    woonplaats: 'Plaats',
    postcode: 'Postcode',
  };

  return (
    <div ref={containerRef} className="relative z-[1200]">
      <div className="flex items-center bg-gray-100 rounded-lg px-2.5 py-1">
        <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Zoek adres of straat..."
          className="bg-transparent border-none outline-none text-xs text-gray-700 placeholder-gray-400 ml-2 w-44 sm:w-56"
        />
        {loading && <div className="w-3 h-3 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden w-72">
          {results.map((r) => (
            <button key={r.id} onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer">
              <div className="text-xs text-gray-800 truncate">{r.weergavenaam}</div>
              <div className="text-[10px] text-gray-400">{typeLabel[r.type] || r.type}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
