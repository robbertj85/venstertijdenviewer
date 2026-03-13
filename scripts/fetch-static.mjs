import { writeFileSync } from 'fs';

const RVV_CODES = ['C1', 'C6', 'C7', 'C7a', 'C7b', 'C12', 'G7', 'G5', 'C17', 'C21'];
const G4_G40 = {
  GM0363:'Amsterdam',GM0599:'Rotterdam',GM0518:'Den Haag',GM0344:'Utrecht',
  GM0361:'Alkmaar',GM0141:'Almelo',GM0034:'Almere',GM0484:'Alphen aan den Rijn',
  GM0307:'Amersfoort',GM0362:'Amstelveen',GM0200:'Apeldoorn',GM0202:'Arnhem',
  GM0106:'Assen',GM0758:'Breda',GM0503:'Delft',GM0150:'Deventer',
  GM0505:'Dordrecht',GM0228:'Ede',GM0772:'Eindhoven',GM0114:'Emmen',
  GM0153:'Enschede',GM0513:'Gouda',GM0014:'Groningen',GM0392:'Haarlem',
  GM0394:'Haarlemmermeer',GM0917:'Heerlen',GM0794:'Helmond',GM0164:'Hengelo',
  GM0796:"'s-Hertogenbosch",GM0402:'Hilversum',GM0405:'Hoorn',GM0080:'Leeuwarden',
  GM0546:'Leiden',GM0995:'Lelystad',GM0935:'Maastricht',GM0268:'Nijmegen',
  GM0828:'Oss',GM1674:'Roosendaal',GM0606:'Schiedam',GM1883:'Sittard-Geleen',
  GM0855:'Tilburg',GM0983:'Venlo',GM0479:'Zaanstad',GM0637:'Zoetermeer',
  GM0193:'Zwolle'
};

const TIME_PATTERNS = [/\d{1,2}[.:]\d{2}/, /\d{1,2}-\d{1,2}\s*h\b/, /\d{1,2}\s*h\b/, /\d{1,2}:\d{2}\s*-\s*\d{1,2}/];
function hasTimeWindow(t) { return TIME_PATTERNS.some(p => p.test(t)); }
function categorize(r) {
  if (['G7','C1'].includes(r)) return 'bezorgvenster';
  if (['C6','C12'].includes(r)) return 'spitsafsluiting';
  if (['C7','C7a','C7b','C21'].includes(r)) return 'vrachtverbod_met_tijd';
  return 'overig';
}

async function fetchAll(version) {
  const all = [];
  for (const code of RVV_CODES) {
    const url = `https://data.ndw.nu/api/rest/static-road-data/traffic-signs/${version}/current-state?rvvCode=${code}`;
    console.log(`Fetching ${version} ${code}...`);
    try {
      const r = await fetch(url);
      if (!r.ok) { console.log(`  HTTP ${r.status}`); continue; }
      const d = await r.json();
      const feats = d.features || [];
      console.log(`  Got ${feats.length} features`);
      for (const f of feats) {
        const p = f.properties;
        const cc = version === 'v5' ? p.operatorCode : p.countyCode;
        if (!G4_G40[cc]) continue;
        const sups = version === 'v5' ? (p.supplementarySigns || []) : [];
        const ts4 = version === 'v4' ? (p.textSigns || []) : [];
        const timeTexts = version === 'v5'
          ? sups.filter(s => hasTimeWindow(s.text)).map(s => s.text)
          : ts4.filter(s => hasTimeWindow(s.text)).map(s => s.text);
        const hasOH = version === 'v5' ? sups.some(s => !!s.openingHours) : !!(p.openingHours || '').trim();
        const conds = version === 'v5' ? (p.conditions || { restrictions: {}, exemptions: [] }) : null;
        const hasTV = version === 'v5' && !!conds?.restrictions?.timeValidity;
        if (timeTexts.length === 0 && !hasOH && !hasTV) continue;

        const props = version === 'v5' ? {
          id: f.id, gemeente: p.operatorName || G4_G40[cc], gemeenteCode: cc, rvvCode: code,
          categorie: categorize(code), straat: '',
          latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0],
          venstertijdTekst: timeTexts.join(' / '),
          openingHours: sups.find(s => s.openingHours)?.openingHours || null,
          timeValidity: conds?.restrictions?.timeValidity || null,
          vehicleTypes: conds?.restrictions?.vehicleType || [],
          onderborden: sups.map(s => ({ type: s.signCode || '', text: s.text, signCode: s.signCode, openingHours: s.openingHours })),
          apiVersion: 'v5', nwbVersion: p.nwbVersion || null,
          registeredOn: p.registeredOn, lastModifiedOn: p.lastModifiedOn
        } : {
          id: f.id, gemeente: G4_G40[cc], gemeenteCode: cc, rvvCode: code,
          categorie: categorize(code), straat: p.roadName || '',
          latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0],
          venstertijdTekst: timeTexts.join(' / '),
          openingHours: p.openingHours || null, timeValidity: null, vehicleTypes: [],
          onderborden: ts4.map(s => ({ type: s.type, text: s.text })),
          apiVersion: 'v4', nwbVersion: p.nwbVersion || null
        };
        all.push({ type: 'Feature', id: f.id, geometry: f.geometry, properties: props });
      }
    } catch (e) { console.log(`  Error: ${e.message}`); }
  }
  const nwbC = {};
  for (const f of all) { const n = f.properties.nwbVersion; if (n) nwbC[n] = (nwbC[n] || 0) + 1; }
  const nwbV = Object.entries(nwbC).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { type: 'FeatureCollection', features: all, metadata: { apiVersion: version, fetchedAt: new Date().toISOString(), totalSigns: all.length, rvvCodes: RVV_CODES, nwbVersion: nwbV } };
}

const v4 = await fetchAll('v4');
writeFileSync('public/data/v4.json', JSON.stringify(v4));
console.log(`V4 done: ${v4.features.length} features, NWB: ${v4.metadata.nwbVersion}`);

const v5 = await fetchAll('v5');
writeFileSync('public/data/v5.json', JSON.stringify(v5));
console.log(`V5 done: ${v5.features.length} features, NWB: ${v5.metadata.nwbVersion}`);
