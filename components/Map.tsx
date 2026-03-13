'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import L from 'leaflet';
import { VenstertijdFeature, Filters, CATEGORY_COLORS } from '@/types/venstertijden';

const TILE_LAYERS: Record<string, { name: string; url: string; attribution: string; subdomains?: string; maxZoom?: number }> = {
  cartodb: {
    name: 'CartoDB Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a> | Data: <a href="https://data.ndw.nu">NDW</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    maxZoom: 19,
  },
  esri_satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar',
    maxZoom: 19,
  },
};

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
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [activeLayer, setActiveLayer] = useState('cartodb');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [52.15, 5.4], zoom: 8, zoomControl: false });
    L.control.zoom({ position: 'topright' }).addTo(map);
    const layer = TILE_LAYERS.cartodb;
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution, subdomains: layer.subdomains || 'abc', maxZoom: layer.maxZoom || 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const config = TILE_LAYERS[activeLayer];
    if (!config) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    tileLayerRef.current = L.tileLayer(config.url, {
      attribution: config.attribution, subdomains: config.subdomains || 'abc', maxZoom: config.maxZoom || 19,
    }).addTo(mapRef.current);
    tileLayerRef.current.setZIndex(0);
  }, [activeLayer]);

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
      <div className="absolute bottom-5 right-3 z-[1000]">
        <select value={activeLayer} onChange={(e) => setActiveLayer(e.target.value)}
          className="bg-white border border-gray-300 rounded-md shadow-sm px-2 py-1 text-sm text-gray-700 cursor-pointer">
          {Object.entries(TILE_LAYERS).map(([key, l]) => <option key={key} value={key}>{l.name}</option>)}
        </select>
      </div>
    </div>
  );
});

export default Map;
