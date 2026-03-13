'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { VenstertijdFeature, CATEGORY_COLORS, CATEGORY_LABELS, RVV_DESCRIPTIONS, RVV_SIGN_IMAGES } from '@/types/venstertijden';

interface DetailPanelProps {
  feature: VenstertijdFeature;
  onClose: () => void;
  mobile?: boolean;
}

function MiniMapView({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) { (mapRef.current as L.Map).remove(); mapRef.current = null; }
      const map = L.map(containerRef.current, { center: [lat, lng], zoom: 17, zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      const icon = L.divIcon({
        className: 'sign-marker',
        html: '<div style="width:14px;height:14px;background:#003366;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([lat, lng], { icon }).addTo(map);
      setTimeout(() => { if (!cancelled) map.invalidateSize(); }, 100);
      mapRef.current = map;
    });
    return () => { cancelled = true; if (mapRef.current) { (mapRef.current as L.Map).remove(); mapRef.current = null; } };
  }, [lat, lng]);

  return <div ref={containerRef} className="rounded-lg overflow-hidden border border-gray-200" style={{ height: '144px' }} />;
}

export default function DetailPanel({ feature, onClose, mobile }: DetailPanelProps) {
  const [showV4Json, setShowV4Json] = useState(false);
  const [showV5Json, setShowV5Json] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [v4Json, setV4Json] = useState<string | null>(null);
  const [v5Json, setV5Json] = useState<string | null>(null);
  const [v4Raw, setV4Raw] = useState<Record<string, unknown> | null>(null);
  const [v5Raw, setV5Raw] = useState<Record<string, unknown> | null>(null);
  const [v4Loading, setV4Loading] = useState(false);
  const [v5Loading, setV5Loading] = useState(false);
  const [diffLoading, setDiffLoading] = useState(false);

  const [resolvedStraat, setResolvedStraat] = useState<string | null>(null);

  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  const catColor = CATEGORY_COLORS[p.categorie] || '#999';
  const catLabel = CATEGORY_LABELS[p.categorie] || p.categorie;
  const rvvDesc = RVV_DESCRIPTIONS[p.rvvCode] || '';

  // Reverse geocode via PDOK when street name is missing
  useEffect(() => {
    setResolvedStraat(null);
    if (p.straat) return;
    let cancelled = false;
    fetch(`/api/v1/geocode?lat=${lat}&lon=${lng}`)
      .then(res => res.json())
      .then(data => { if (!cancelled && data.straat) setResolvedStraat(data.straat); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [p.id, p.straat, lat, lng]);

  const delta = 0.003;
  const bbox = `${(lng - delta).toFixed(5)},${(lat - delta).toFixed(5)},${(lng + delta).toFixed(5)},${(lat + delta).toFixed(5)}`;
  const georgeUrl = `https://wegkenmerken.ndw.nu/kaart/verkeersborden/${p.id}?kaartlagen=BRT,TRAFFIC_SIGN&zichtbaar-gebied=${bbox}`;

  // Fetch raw API data on demand
  const fetchApiJson = async (version: 'v4' | 'v5') => {
    const setJson = version === 'v4' ? setV4Json : setV5Json;
    const setRaw = version === 'v4' ? setV4Raw : setV5Raw;
    const setLoadingFn = version === 'v4' ? setV4Loading : setV5Loading;
    setLoadingFn(true);
    try {
      const url = `https://data.ndw.nu/api/rest/static-road-data/traffic-signs/${version}/current-state?rvvCode=${p.rvvCode}`;
      const res = await fetch(url);
      if (!res.ok) { setJson(`Error: HTTP ${res.status}`); return; }
      const data = await res.json();
      const sign = (data.features || []).find((f: { id: string }) => f.id === p.id);
      if (sign) {
        setJson(JSON.stringify(sign, null, 2));
        setRaw(sign as Record<string, unknown>);
      } else {
        setJson('Sign not found in response');
      }
    } catch (e) {
      setJson(`Error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setLoadingFn(false);
    }
  };

  // Fetch both V4 and V5 for diff comparison
  const fetchDiff = async () => {
    setDiffLoading(true);
    const promises: Promise<void>[] = [];
    if (!v4Raw) promises.push(fetchApiJson('v4'));
    if (!v5Raw) promises.push(fetchApiJson('v5'));
    await Promise.all(promises);
    setDiffLoading(false);
  };

  // Compute diff between V4 and V5
  const diffItems = useMemo(() => {
    if (!v4Raw && !v5Raw) return null;
    const items: { field: string; v4: string; v5: string; changed: boolean }[] = [];
    const v4p = (v4Raw as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;
    const v5p = (v5Raw as Record<string, unknown>)?.properties as Record<string, unknown> | undefined;

    const fields = [
      { key: 'roadName / straat', v4k: 'roadName', v5k: null },
      { key: 'rvvCode', v4k: 'rvvCode', v5k: 'rvvCode' },
      { key: 'nwbVersion', v4k: 'nwbVersion', v5k: 'nwbVersion' },
      { key: 'openingHours', v4k: 'openingHours', v5k: null },
      { key: 'placement', v4k: 'placement', v5k: 'placement' },
      { key: 'bearing', v4k: 'bearing', v5k: 'bearing' },
      { key: 'validated / registeredOn', v4k: 'validated', v5k: 'registeredOn' },
      { key: 'lastModifiedOn', v4k: null, v5k: 'lastModifiedOn' },
      { key: 'operatorCode / countyCode', v4k: 'countyCode', v5k: 'operatorCode' },
      { key: 'operatorName / countyName', v4k: 'countyName', v5k: 'operatorName' },
      { key: 'status', v4k: 'status', v5k: null },
      { key: 'privateProperty', v4k: null, v5k: 'privateProperty' },
    ];

    for (const f of fields) {
      const v4v = f.v4k && v4p ? String(v4p[f.v4k] ?? '-') : '-';
      const v5v = f.v5k && v5p ? String(v5p[f.v5k] ?? '-') : '-';
      items.push({ field: f.key, v4: v4v, v5: v5v, changed: v4v !== v5v });
    }

    // V5-specific: supplementarySigns with openingHours
    const v5sups = v5p?.supplementarySigns as { text: string; openingHours?: string; signCode?: string }[] | undefined;
    if (v5sups?.some(s => s.openingHours)) {
      items.push({
        field: 'supplementarySigns.openingHours',
        v4: '-',
        v5: v5sups.filter(s => s.openingHours).map(s => s.openingHours).join(', '),
        changed: true,
      });
    }

    // V5-specific: conditions
    const v5conds = v5p?.conditions as { restrictions?: { vehicleType?: string[]; timeValidity?: string } } | undefined;
    if (v5conds?.restrictions?.timeValidity) {
      items.push({ field: 'conditions.timeValidity', v4: '-', v5: v5conds.restrictions.timeValidity, changed: true });
    }
    if (v5conds?.restrictions?.vehicleType?.length) {
      items.push({ field: 'conditions.vehicleType', v4: '-', v5: v5conds.restrictions.vehicleType.join(', '), changed: true });
    }

    // V4-specific: textSigns count
    const v4ts = v4p?.textSigns as unknown[] | undefined;
    const v5ss = v5sups || [];
    items.push({ field: 'onderborden count', v4: String(v4ts?.length ?? '-'), v5: String(v5ss.length), changed: (v4ts?.length ?? 0) !== v5ss.length });

    return items;
  }, [v4Raw, v5Raw]);

  // Reset state on sign change
  useEffect(() => {
    setShowV4Json(false);
    setShowV5Json(false);
    setShowDiff(false);
    setV4Json(null);
    setV5Json(null);
    setV4Raw(null);
    setV5Raw(null);
  }, [p.id]);

  const wrapperClass = mobile
    ? 'fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar safe-bottom'
    : 'w-96 bg-white border-l border-gray-200 overflow-y-auto custom-scrollbar h-full';

  return (
    <div className={wrapperClass}>
      {mobile && (
        <div className="sticky top-0 bg-white pt-3 pb-1 z-10">
          <div className="bottom-sheet-handle" />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{p.straat || resolvedStraat || 'Onbekende straat'}</h2>
            <p className="text-sm text-gray-500">{p.gemeente} ({p.gemeenteCode})</p>
          </div>
          <button onClick={onClose} className="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded" aria-label="Sluiten">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Category & RVV badges */}
        <div className="flex items-center gap-3 mb-4">
          {RVV_SIGN_IMAGES[p.rvvCode] && (
            <img src={RVV_SIGN_IMAGES[p.rvvCode]} alt={p.rvvCode} className="w-10 h-10 object-contain shrink-0" />
          )}
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold text-white" style={{ background: catColor }}>
              {catLabel}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
              {p.rvvCode}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-500">
              {rvvDesc}
            </span>
          </div>
        </div>

        {/* Time window - highlighted */}
        {p.venstertijdTekst && (
          <div className="mb-4 bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Venstertijd (tekst)</div>
            <div className="text-sm text-gray-800 font-medium">{p.venstertijdTekst}</div>
          </div>
        )}

        {/* Structured fields */}
        {(p.openingHours || p.timeValidity) && (
          <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-3 rounded-r-lg">
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Gestructureerde tijden (OSM)</div>
            {p.openingHours && (
              <div className="text-sm"><span className="text-gray-500">openingHours:</span> <code className="text-green-800 font-mono text-xs bg-green-100 px-1 rounded">{p.openingHours}</code></div>
            )}
            {p.timeValidity && (
              <div className="text-sm mt-1"><span className="text-gray-500">timeValidity:</span> <code className="text-green-800 font-mono text-xs bg-green-100 px-1 rounded">{p.timeValidity}</code></div>
            )}
          </div>
        )}

        {/* Vehicle types */}
        {p.vehicleTypes && p.vehicleTypes.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Voertuigtypen</div>
            <div className="flex flex-wrap gap-1">
              {p.vehicleTypes.map((vt) => (
                <span key={vt} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{vt}</span>
              ))}
            </div>
          </div>
        )}

        {/* Onderborden */}
        {p.onderborden && p.onderborden.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Onderborden ({p.onderborden.length})</div>
            <div className="space-y-1.5">
              {p.onderborden.map((ob, i) => (
                <div key={i} className="bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span className="inline-block px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-[10px] font-bold shrink-0 mt-0.5">
                      {ob.signCode || ob.type || '?'}
                    </span>
                    <span className="text-sm text-gray-700">{ob.text}</span>
                  </div>
                  {ob.openingHours && (
                    <div className="mt-1 ml-8 text-xs text-green-700 font-mono bg-green-50 px-1.5 py-0.5 rounded inline-block">
                      {ob.openingHours}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API version badge */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">API data</div>
          <div className="flex gap-2 items-center">
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.apiVersion === 'v5' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
              Geladen via {p.apiVersion.toUpperCase()}
            </span>
            {p.lastModifiedOn && (
              <span className="text-xs text-gray-400">Laatst gewijzigd: {p.lastModifiedOn}</span>
            )}
          </div>
        </div>

        {/* V4 vs V5 diff */}
        <div className="mb-4">
          <button onClick={() => { setShowDiff(!showDiff); if (!showDiff && (!v4Raw || !v5Raw)) fetchDiff(); }}
            className="w-full text-left px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-sm font-medium text-indigo-700 flex justify-between items-center">
            <span>V4 vs V5 vergelijking</span>
            <svg className={`w-4 h-4 transition-transform ${showDiff ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showDiff && (
            <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
              {diffLoading && !diffItems ? (
                <div className="p-3 text-xs text-gray-400 animate-pulse">V4 en V5 ophalen...</div>
              ) : diffItems ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-2 py-1 font-medium">Veld</th>
                      <th className="text-left px-2 py-1 font-medium">V4</th>
                      <th className="text-left px-2 py-1 font-medium">V5</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diffItems.map((d) => (
                      <tr key={d.field} className={d.changed ? 'bg-amber-50' : ''}>
                        <td className="px-2 py-1 text-gray-600 font-medium">{d.field}</td>
                        <td className="px-2 py-1 font-mono text-[10px] text-gray-700 max-w-[120px] truncate" title={d.v4}>{d.v4}</td>
                        <td className="px-2 py-1 font-mono text-[10px] text-gray-700 max-w-[120px] truncate" title={d.v5}>{d.v5}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-3 text-xs text-gray-400">Klik om te laden</div>
              )}
            </div>
          )}
        </div>

        {/* Raw API JSON sections */}
        <div className="mb-4 space-y-2">
          <button onClick={() => { setShowV4Json(!showV4Json); if (!v4Json && !showV4Json) fetchApiJson('v4'); }}
            className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 flex justify-between items-center">
            <span>V4 API Response</span>
            <svg className={`w-4 h-4 transition-transform ${showV4Json ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showV4Json && (
            <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
              {v4Loading ? <div className="text-gray-400 text-xs animate-pulse">Laden...</div> :
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{v4Json || 'Klik om te laden'}</pre>}
            </div>
          )}

          <button onClick={() => { setShowV5Json(!showV5Json); if (!v5Json && !showV5Json) fetchApiJson('v5'); }}
            className="w-full text-left px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-sm font-medium text-purple-700 flex justify-between items-center">
            <span>V5 API Response</span>
            <svg className={`w-4 h-4 transition-transform ${showV5Json ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showV5Json && (
            <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
              {v5Loading ? <div className="text-purple-400 text-xs animate-pulse">Laden...</div> :
                <pre className="text-xs text-purple-400 font-mono whitespace-pre-wrap">{v5Json || 'Klik om te laden'}</pre>}
            </div>
          )}
        </div>

        {/* Mini map */}
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Locatie</div>
          <MiniMapView lat={lat} lng={lng} />
          <div className="flex gap-2 mt-2">
            <a href={`https://www.google.com/maps/@${lat},${lng},18z`} target="_blank" rel="noopener"
              className="text-xs text-blue-600 hover:underline">Google Maps</a>
            <a href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`} target="_blank" rel="noopener"
              className="text-xs text-blue-600 hover:underline">Street View</a>
          </div>
        </div>

        {/* George deeplink */}
        <a href={georgeUrl} target="_blank" rel="noopener"
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          Open in George
        </a>

        {/* Footer */}
        <div className="text-xs text-gray-400 space-y-0.5 border-t border-gray-100 pt-3">
          <div>{lat.toFixed(6)}, {lng.toFixed(6)}</div>
          <div className="font-mono">{p.id.substring(0, 8)}...</div>
        </div>
      </div>
    </div>
  );
}
