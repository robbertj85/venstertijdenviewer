'use client';

import { useState, useEffect, useRef, useMemo, useCallback, useId } from 'react';
import dynamic from 'next/dynamic';
import { VenstertijdFeature, Filters, CATEGORY_COLORS, CATEGORY_LABELS } from '@/types/venstertijden';
import FilterPanel from '@/components/FilterPanel';
import DetailPanel from '@/components/DetailPanel';
import SearchBar from '@/components/SearchBar';
import AboutModal from '@/components/AboutModal';

const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">Kaart laden...</div>,
});

export default function Home() {
  const [features, setFeatures] = useState<VenstertijdFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiVersion, setApiVersion] = useState<'v4' | 'v5'>('v4');
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ categories: [], gemeenten: [], rvvCodes: [] });
  const [selected, setSelected] = useState<VenstertijdFeature | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [nwbVersion, setNwbVersion] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const mapRef = useRef<{ flyTo: (lat: number, lng: number, zoom?: number) => void; showSearchPin: (lat: number, lng: number, label: string) => void; clearSearchPin: () => void }>(null);
  const fetchId = useRef(0);

  // Load static data from /data/*.json (instant), or live from API on refresh
  const loadStatic = useCallback(async (version: 'v4' | 'v5') => {
    const id = ++fetchId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/data/${version}.json`);
      if (!res.ok) throw new Error(`Statisch bestand niet gevonden`);
      const data = await res.json();
      if (id !== fetchId.current) return;
      setFeatures(data.features || []);
      setApiVersion(version);
      setNwbVersion(data.metadata?.nwbVersion || null);
      setFetchedAt(data.metadata?.fetchedAt || null);
    } catch (e) {
      if (id !== fetchId.current) return;
      setError(e instanceof Error ? e.message : 'Fout bij laden');
    } finally {
      if (id === fetchId.current) setLoading(false);
    }
  }, []);

  const fetchLive = useCallback(async (version: 'v4' | 'v5') => {
    const id = ++fetchId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/signs?version=${version}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (id !== fetchId.current) return;
      setFeatures(data.features || []);
      setApiVersion(version);
      setNwbVersion(data.metadata?.nwbVersion || null);
      setFetchedAt(data.metadata?.fetchedAt || null);
    } catch (e) {
      if (id !== fetchId.current) return;
      // Fallback to static on API failure
      setError(`Live refresh mislukt (${e instanceof Error ? e.message : '?'}), statische data geladen`);
      await loadStatic(version);
    } finally {
      if (id === fetchId.current) setLoading(false);
    }
  }, [loadStatic]);

  // Initial load from static files (fast)
  useEffect(() => { loadStatic('v4'); }, [loadStatic]);

  const filtered = useMemo(() => {
    return features.filter((f) => {
      const p = f.properties;
      if (filters.categories.length > 0 && !filters.categories.includes(p.categorie)) return false;
      if (filters.gemeenten.length > 0 && !filters.gemeenten.includes(p.gemeente)) return false;
      if (filters.rvvCodes.length > 0 && !filters.rvvCodes.includes(p.rvvCode)) return false;
      return true;
    });
  }, [features, filters]);

  const summaryStats = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const f of filtered) {
      cats[f.properties.categorie] = (cats[f.properties.categorie] || 0) + 1;
    }
    return cats;
  }, [filtered]);

  const handleSelect = useCallback((feature: VenstertijdFeature) => {
    setSelected(feature);
    setMobileSidebarOpen(false);
  }, []);

  const handleSearchSelect = useCallback((lat: number, lng: number, label: string) => {
    mapRef.current?.flyTo(lat, lng, 16);
    mapRef.current?.showSearchPin(lat, lng, label);
  }, []);

  const selectKey = useId();

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelected(null); setMobileSidebarOpen(false); setShowAbout(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 z-[1100] shrink-0 relative">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 whitespace-nowrap">Venstertijdenviewer</h1>
          <span className="hidden lg:inline text-xs text-gray-400">Verkeersborden met tijdvensters</span>
          <SearchBar onSelect={handleSearchSelect} />
          <div className="hidden xl:flex gap-2 ml-2">
            {Object.entries(CATEGORY_LABELS).filter(([k]) => k !== 'overig').map(([key, label]) => (
              <span key={key} className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                <span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: CATEGORY_COLORS[key] }} />
                {label}: {summaryStats[key] || 0}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* About button */}
          <button onClick={() => setShowAbout(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition flex items-center">
            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Over
          </button>
          {/* API version toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button onClick={() => loadStatic('v4')} disabled={loading}
              className={`px-3 py-1 text-xs font-bold transition-colors ${apiVersion === 'v4' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:text-gray-700'}`}>
              V4
            </button>
            <button onClick={() => loadStatic('v5')} disabled={loading}
              className={`px-3 py-1 text-xs font-bold transition-colors ${apiVersion === 'v5' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:text-gray-700'}`}>
              V5
            </button>
          </div>
          <button onClick={() => fetchLive(apiVersion)} disabled={loading}
            className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1">
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Laden...' : 'Live refresh'}
          </button>
          <div className="hidden md:flex flex-col items-end text-[9px] text-gray-400 leading-tight">
            {nwbVersion && <span title="Versie van het NWB wegenbestand waaraan NDW de bordlocaties koppelt">NWB {nwbVersion}</span>}
            {fetchedAt && <span title="Tijdstip waarop data is opgehaald van data.ndw.nu">NDW fetch {new Date(fetchedAt).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          {/* Mobile sidebar toggle */}
          <button onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)} className="sm:hidden px-2 py-1 text-gray-500 hover:bg-gray-100 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1zm0 6a1 1 0 011-1h16a1 1 0 010 2H4a1 1 0 01-1-1z" /></svg>
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
          <span>Fout: {error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left sidebar - filters */}
        <div className={`${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} sm:translate-x-0 absolute sm:relative z-30 w-72 bg-white border-r border-gray-200 h-full overflow-y-auto custom-scrollbar transition-transform`}>
          <FilterPanel features={features} filters={filters} onChange={setFilters} />
        </div>

        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-20 sm:hidden" onClick={() => setMobileSidebarOpen(false)} />
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <Map features={features} filters={filters} onSelect={handleSelect} selectedId={selected?.properties.id} ref={mapRef} />

          {/* Visible count */}
          <div className="absolute top-3 left-3 z-[1000] bg-white/90 backdrop-blur rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm">
            {filtered.length} / {features.length} borden zichtbaar
            <span className="ml-2 text-gray-400">API {apiVersion.toUpperCase()}</span>
          </div>

          {/* Legend */}
          <div className="absolute bottom-5 left-3 z-[1000] bg-white rounded-lg shadow-md px-3 py-2 hidden sm:block">
            <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Categorie</div>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[key] }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar - detail panel */}
        {selected && (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <DetailPanel key={selected.properties.id} feature={selected} onClose={() => setSelected(null)} />
            </div>
            {/* Mobile */}
            <div className="md:hidden">
              <DetailPanel key={`m-${selected.properties.id}`} feature={selected} onClose={() => setSelected(null)} mobile />
            </div>
          </>
        )}
      </div>

      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />
    </div>
  );
}
