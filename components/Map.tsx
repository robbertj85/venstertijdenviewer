'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
import { VenstertijdFeature, Filters, CATEGORY_COLORS } from '@/types/venstertijden';

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>';
const NDW_ATTRIBUTION = 'Data: <a href="https://data.ndw.nu">NDW</a>';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a> | ${NDW_ATTRIBUTION}`;

type BaseMapConfig =
  | { name: string; type: 'raster'; url: string; attribution: string; subdomains?: string; maxZoom?: number }
  | { name: string; type: 'vector'; style: string; attribution: string };

// CARTO's raster endpoint (basemaps.cartocdn.com/{style}/{z}/{x}/{y}.png) started
// serving an "API KEY REQUIRED" watermark in Aug 2026 and is being retired. Their
// vector GL styles serve the same cartography and currently need no key, so the
// CARTO layers below are vector. Raster layers stay as the no-WebGL fallback.
const TILE_LAYERS = {
  cartodb: {
    name: 'CARTO Positron',
    type: 'vector',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    attribution: CARTO_ATTRIBUTION,
  },
  cartoVoyager: {
    name: 'CARTO Voyager',
    type: 'vector',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    attribution: CARTO_ATTRIBUTION,
  },
  osm: {
    name: 'OpenStreetMap',
    type: 'raster',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: `${OSM_ATTRIBUTION} | ${NDW_ATTRIBUTION}`,
    maxZoom: 19,
  },
  esri_satellite: {
    name: 'Satellite',
    type: 'raster',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: `&copy; Esri, Maxar | ${NDW_ATTRIBUTION}`,
    maxZoom: 19,
  },
} satisfies Record<string, BaseMapConfig>;

type TileLayerKey = keyof typeof TILE_LAYERS;

// MapLibre needs WebGL2; older iOS and some GPUs don't have it.
function supportsWebGL2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

function getAvailableLayers(): TileLayerKey[] {
  const hasWebGL2 = supportsWebGL2();
  return (Object.keys(TILE_LAYERS) as TileLayerKey[]).filter(
    (key) => hasWebGL2 || TILE_LAYERS[key].type !== 'vector'
  );
}

// Own pane below tilePane (z-index 200), so the gemeentegrenzen WMS overlay stays
// on top whichever basemap is (re)added last.
const BASEMAP_PANE = 'basemap';

// maplibre-gl is pinned to v5 in package.json: with v6 the adapter's transform
// patching leaves the GL map in a state where it never requests tiles, so the
// style loads but the basemap stays blank.
function createBaseLayer(config: BaseMapConfig): L.Layer {
  if (config.type === 'vector') {
    // `pane` is a supported adapter option that its type definitions omit.
    const options: L.LeafletMaplibreGLOptions & { pane: string } = {
      style: config.style,
      pane: BASEMAP_PANE,
      attributionControl: { customAttribution: config.attribution },
    };
    const layer = maplibreGL(options);
    // The inner GL map only exists once the layer has been added to the map.
    layer.on('add', () => {
      layer.getMaplibreMap().on('error', (e) => {
        console.error('[basemap]', e.error?.message ?? e);
      });
    });
    return layer;
  }
  return L.tileLayer(config.url, {
    attribution: config.attribution, subdomains: config.subdomains || 'abc', maxZoom: config.maxZoom || 19, pane: BASEMAP_PANE,
  });
}

interface MapProps {
  features: VenstertijdFeature[];
  filters: Filters;
  onSelect?: (feature: VenstertijdFeature) => void;
  selectedId?: string | null;
}

export interface MapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  showSearchPin: (lat: number, lng: number, label: string) => void;
  clearSearchPin: () => void;
}

const Map = forwardRef<MapHandle, MapProps>(function Map({ features, filters, onSelect, selectedId }, ref) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const searchPinRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tileLayerRef = useRef<L.Layer | null>(null);
  const gemeenteLayerRef = useRef<L.TileLayer.WMS | null>(null);
  // Computed once on the client; falls back to a raster layer without WebGL2.
  const [availableLayers] = useState(getAvailableLayers);
  const [activeLayer, setActiveLayer] = useState<TileLayerKey>(availableLayers[0]);
  const [showGemeenten, setShowGemeenten] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Leaflet's animated zoom makes the GL basemap render a single zoom step
    // several times (CSS-scaled canvas mid-animation, then camera re-jumps), which
    // reads as flicker. Zooming is one discrete step instead.
    const map = L.map(containerRef.current, { center: [52.15, 5.4], zoom: 8, zoomControl: false, zoomAnimation: false });
    map.createPane(BASEMAP_PANE).style.zIndex = '150';
    L.control.zoom({ position: 'topright' }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const config: BaseMapConfig = TILE_LAYERS[activeLayer];
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = createBaseLayer(config).addTo(mapRef.current);
  }, [activeLayer]);

  // PDOK gemeentegrenzen WMS toggle
  useEffect(() => {
    if (!mapRef.current) return;
    if (showGemeenten && !gemeenteLayerRef.current) {
      gemeenteLayerRef.current = L.tileLayer.wms('https://service.pdok.nl/kadaster/bestuurlijkegebieden/wms/v1_0', {
        layers: 'Gemeentegebied',
        format: 'image/png',
        transparent: true,
        styles: '',
        opacity: 0.35,
      } as L.WMSOptions).addTo(mapRef.current);
      gemeenteLayerRef.current.setZIndex(1);
    } else if (!showGemeenten && gemeenteLayerRef.current) {
      mapRef.current.removeLayer(gemeenteLayerRef.current);
      gemeenteLayerRef.current = null;
    }
  }, [showGemeenten]);

  useImperativeHandle(ref, () => ({
    flyTo: (lat: number, lng: number, zoom?: number) => {
      mapRef.current?.flyTo([lat, lng], zoom ?? 14, { animate: true, duration: 1 });
    },
    showSearchPin: (lat: number, lng: number, label: string) => {
      if (!mapRef.current) return;
      if (searchPinRef.current) { searchPinRef.current.remove(); searchPinRef.current = null; }
      const icon = L.divIcon({
        className: 'search-pin',
        html: '<div style="width:12px;height:12px;background:#dc2626;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>',
        iconSize: [12, 12], iconAnchor: [6, 6],
      });
      searchPinRef.current = L.marker([lat, lng], { icon, zIndexOffset: 2000 })
        .bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -8], className: 'search-tooltip' })
        .addTo(mapRef.current);
    },
    clearSearchPin: () => {
      if (searchPinRef.current) { searchPinRef.current.remove(); searchPinRef.current = null; }
    },
  }));

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    const filtered = features.filter((f) => {
      const p = f.properties;
      if (filters.categories.length > 0 && !filters.categories.includes(p.categorie)) return false;
      if (filters.gemeenten.length > 0 && !filters.gemeenten.includes(p.gemeente)) return false;
      if (filters.rvvCodes.length > 0 && !filters.rvvCodes.includes(p.rvvCode)) return false;
      return true;
    });

    filtered.forEach((feature) => {
      const p = feature.properties;
      const [lng, lat] = feature.geometry.coordinates;
      const color = CATEGORY_COLORS[p.categorie] || '#999';
      const isSelected = p.id === selectedId;
      const size = isSelected ? 18 : 12;
      const borderWidth = isSelected ? 3 : 2;
      const borderColor = isSelected ? '#003366' : 'white';

      const icon = L.divIcon({
        className: 'sign-marker',
        html: `<div class="marker-icon" style="width:${size}px;height:${size}px;background:${color};border:${borderWidth}px solid ${borderColor};${isSelected ? 'box-shadow:0 0 0 3px rgba(0,51,102,0.3),0 2px 4px rgba(0,0,0,0.3);' : ''}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([lat, lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });
      const label = p.straat || p.gemeente;
      marker.bindTooltip(`<b>${p.rvvCode}</b> ${label}`, { direction: 'top', offset: [0, -size / 2], className: 'sign-tooltip' });
      marker.on('click', () => onSelect?.(feature));
      marker.addTo(markersRef.current!);
    });
  }, [features, filters, onSelect, selectedId]);

  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const feat = features.find(f => f.properties.id === selectedId);
    if (feat) {
      const [lng, lat] = feat.geometry.coordinates;
      mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 14), { animate: true });
    }
  }, [selectedId, features]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-5 right-3 z-[1000] flex flex-col gap-1.5 items-end">
        <button onClick={() => setShowGemeenten(!showGemeenten)}
          className={`px-2.5 py-1 rounded-md shadow-sm text-xs font-medium transition-colors ${showGemeenten ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          Gemeentegrenzen
        </button>
        <select value={activeLayer} onChange={(e) => setActiveLayer(e.target.value as TileLayerKey)}
          className="bg-white border border-gray-300 rounded-md shadow-sm px-2 py-1 text-sm text-gray-700 cursor-pointer">
          {availableLayers.map((key) => <option key={key} value={key}>{TILE_LAYERS[key].name}</option>)}
        </select>
      </div>
    </div>
  );
});

export default Map;
