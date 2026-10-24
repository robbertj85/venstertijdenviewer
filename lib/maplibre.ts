// MapLibre 6 no longer inlines its worker; it loads it from a URL. The file is
// copied into public/ by predev/prebuild (see package.json).
import { setWorkerUrl } from 'maplibre-gl';
import { withBase } from '@/lib/basePath';

setWorkerUrl(withBase('/maplibre-gl-worker.mjs'));

export { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
