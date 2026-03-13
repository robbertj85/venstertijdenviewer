import { NextRequest, NextResponse } from 'next/server';

const RVV_CODES = ['C1', 'C6', 'C7', 'C7a', 'C7b', 'C12', 'G7', 'G5', 'C17', 'C21'];

const G4_G40: Record<string, string> = {
  GM0363: 'Amsterdam', GM0599: 'Rotterdam', GM0518: 'Den Haag', GM0344: 'Utrecht',
  GM0361: 'Alkmaar', GM0141: 'Almelo', GM0034: 'Almere', GM0484: 'Alphen aan den Rijn',
  GM0307: 'Amersfoort', GM0362: 'Amstelveen', GM0200: 'Apeldoorn', GM0202: 'Arnhem',
  GM0106: 'Assen', GM0758: 'Breda', GM0503: 'Delft', GM0150: 'Deventer',
  GM0505: 'Dordrecht', GM0228: 'Ede', GM0772: 'Eindhoven', GM0114: 'Emmen',
  GM0153: 'Enschede', GM0513: 'Gouda', GM0014: 'Groningen', GM0392: 'Haarlem',
  GM0394: 'Haarlemmermeer', GM0917: 'Heerlen', GM0794: 'Helmond', GM0164: 'Hengelo',
  GM0796: "'s-Hertogenbosch", GM0402: 'Hilversum', GM0405: 'Hoorn', GM0080: 'Leeuwarden',
  GM0546: 'Leiden', GM0995: 'Lelystad', GM0935: 'Maastricht', GM0268: 'Nijmegen',
  GM0828: 'Oss', GM1674: 'Roosendaal', GM0606: 'Schiedam', GM1883: 'Sittard-Geleen',
  GM0855: 'Tilburg', GM0983: 'Venlo', GM0479: 'Zaanstad', GM0637: 'Zoetermeer',
  GM0193: 'Zwolle',
};

const TIME_PATTERNS = [
  /\d{1,2}[.:]\d{2}/,
  /\d{1,2}-\d{1,2}\s*h\b/,
  /\d{1,2}\s*h\b/,
  /\d{1,2}:\d{2}\s*-\s*\d{1,2}/,
];

function hasTimeWindow(text: string): boolean {
  return TIME_PATTERNS.some(p => p.test(text));
}

function categorize(rvv: string) {
  if (['G7', 'C1'].includes(rvv)) return 'bezorgvenster';
  if (['C6', 'C12'].includes(rvv)) return 'spitsafsluiting';
  if (['C7', 'C7a', 'C7b', 'C21'].includes(rvv)) return 'vrachtverbod_met_tijd';
  return 'overig';
}

interface NdwFeature {
  type: string;
  id: string;
  geometry: { type: string; coordinates: [number, number] };
  properties: Record<string, unknown>;
}

// In-memory cache: 1 hour TTL
const CACHE_TTL = 3600_000; // 1 hour in ms
const cache = new Map<string, { data: NdwFeature[]; ts: number }>();

async function fetchRvvCode(rvvCode: string, version: 'v4' | 'v5'): Promise<NdwFeature[]> {
  const key = `${version}:${rvvCode}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const url = `https://data.ndw.nu/api/rest/static-road-data/traffic-signs/${version}/current-state?rvvCode=${rvvCode}`;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return cached?.data || [];
    const data = await res.json();
    const features = data.features || [];
    cache.set(key, { data: features, ts: Date.now() });
    return features;
  } catch {
    return cached?.data || [];
  }
}

function processV4(features: NdwFeature[], rvvCode: string) {
  const results: Record<string, unknown>[] = [];
  for (const feat of features) {
    const p = feat.properties;
    const cc = p.countyCode as string;
    if (!G4_G40[cc]) continue;

    const textSigns = (p.textSigns as { type: string; text: string }[]) || [];
    const timeTexts = textSigns.filter(ts => hasTimeWindow(ts.text)).map(ts => ts.text);
    const hasOH = !!(p.openingHours as string)?.trim();
    if (timeTexts.length === 0 && !hasOH) continue;

    results.push({
      type: 'Feature',
      id: feat.id,
      geometry: feat.geometry,
      properties: {
        id: feat.id,
        gemeente: G4_G40[cc],
        gemeenteCode: cc,
        rvvCode,
        categorie: categorize(rvvCode),
        straat: p.roadName || '',
        latitude: feat.geometry.coordinates[1],
        longitude: feat.geometry.coordinates[0],
        venstertijdTekst: timeTexts.join(' / '),
        openingHours: (p.openingHours as string) || null,
        timeValidity: null,
        vehicleTypes: [],
        onderborden: textSigns.map(ts => ({ type: ts.type, text: ts.text })),
        apiVersion: 'v4',
        nwbVersion: p.nwbVersion || null,
      },
    });
  }
  return results;
}

function processV5(features: NdwFeature[], rvvCode: string) {
  const results: Record<string, unknown>[] = [];
  for (const feat of features) {
    const p = feat.properties;
    const cc = p.operatorCode as string;
    if (!G4_G40[cc]) continue;

    const sups = (p.supplementarySigns as { text: string; openingHours?: string; signCode?: string }[]) || [];
    const conds = (p.conditions as { restrictions: { vehicleType?: string[]; timeValidity?: string }; exemptions: unknown[] }) || { restrictions: {}, exemptions: [] };

    const timeTexts = sups.filter(s => hasTimeWindow(s.text)).map(s => s.text);
    const hasOH = sups.some(s => !!s.openingHours);
    const hasTV = !!conds.restrictions?.timeValidity;
    if (timeTexts.length === 0 && !hasOH && !hasTV) continue;

    results.push({
      type: 'Feature',
      id: feat.id,
      geometry: feat.geometry,
      properties: {
        id: feat.id,
        gemeente: (p.operatorName as string) || G4_G40[cc],
        gemeenteCode: cc,
        rvvCode,
        categorie: categorize(rvvCode),
        straat: '',
        latitude: feat.geometry.coordinates[1],
        longitude: feat.geometry.coordinates[0],
        venstertijdTekst: timeTexts.join(' / '),
        openingHours: sups.find(s => s.openingHours)?.openingHours || null,
        timeValidity: conds.restrictions?.timeValidity || null,
        vehicleTypes: conds.restrictions?.vehicleType || [],
        onderborden: sups.map(s => ({ type: s.signCode || '', text: s.text, signCode: s.signCode, openingHours: s.openingHours })),
        apiVersion: 'v5',
        nwbVersion: p.nwbVersion || null,
        registeredOn: p.registeredOn,
        lastModifiedOn: p.lastModifiedOn,
      },
    });
  }
  return results;
}

export async function GET(request: NextRequest) {
  const version = (request.nextUrl.searchParams.get('version') || 'v4') as 'v4' | 'v5';
  const rvvFilter = request.nextUrl.searchParams.get('rvvCode');
  const codes = rvvFilter ? [rvvFilter] : RVV_CODES;

  const allFeatures: Record<string, unknown>[] = [];

  // Fetch all RVV codes in parallel
  const fetches = codes.map(async (code) => {
    const features = await fetchRvvCode(code, version);
    return version === 'v5' ? processV5(features, code) : processV4(features, code);
  });

  const results = await Promise.all(fetches);
  for (const batch of results) {
    allFeatures.push(...batch);
  }

  // Find most common NWB version
  const nwbCounts: Record<string, number> = {};
  for (const f of allFeatures) {
    const nwb = (f as { properties: { nwbVersion?: string } }).properties?.nwbVersion;
    if (nwb) nwbCounts[nwb] = (nwbCounts[nwb] || 0) + 1;
  }
  const nwbVersion = Object.entries(nwbCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const response = {
    type: 'FeatureCollection',
    features: allFeatures,
    metadata: {
      apiVersion: version,
      fetchedAt: new Date().toISOString(),
      totalSigns: allFeatures.length,
      rvvCodes: codes,
      nwbVersion,
    },
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
