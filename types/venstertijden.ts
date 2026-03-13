// V4 sign from NDW API
export interface V4TextSign {
  type: string; // VOOR, UIT, TIJD, VRIJ, OTHER
  text: string;
}

export interface V4Properties {
  validated: string;
  rvvCode: string;
  status: string;
  textSigns: V4TextSign[];
  placement: string;
  side: string;
  bearing: number;
  fraction: number;
  drivingDirection: string;
  roadName: string;
  roadSectionId: number;
  nwbVersion: string;
  countyName: string;
  countyCode: string;
  openingHours?: string;
}

// V5 sign from NDW API
export interface V5SupplementarySign {
  text: string;
  openingHours?: string;
  signCode?: string;
  externalReferences?: unknown[];
}

export interface V5Conditions {
  restrictions: {
    vehicleType?: string[];
    category?: string[];
    timeValidity?: string;
  };
  exemptions: unknown[];
}

export interface V5Properties {
  externalReferences: unknown[];
  rvvCode: string;
  supplementarySigns: V5SupplementarySign[];
  placement: string;
  bearing: number;
  roadSectionId: number;
  operatorCode: string;
  operatorName: string;
  nwbVersion: string;
  privateProperty: boolean;
  conditions: V5Conditions;
  registeredOn: string;
  lastModifiedOn: string;
}

// Unified sign model used in the app
export interface VenstertijdSign {
  id: string;
  gemeente: string;
  gemeenteCode: string;
  rvvCode: string;
  categorie: 'bezorgvenster' | 'spitsafsluiting' | 'vrachtverbod_met_tijd' | 'overig';
  latitude: number;
  longitude: number;
  straat: string;
  venstertijdTekst: string;
  openingHours: string | null;
  timeValidity: string | null;
  vehicleTypes: string[];
  onderborden: { type: string; text: string; signCode?: string; openingHours?: string }[];
  apiVersion: 'v4' | 'v5';
  nwbVersion?: string | null;
  registeredOn?: string;
  lastModifiedOn?: string;
}

export interface VenstertijdenData {
  type: 'FeatureCollection';
  features: VenstertijdFeature[];
  metadata: {
    apiVersion: string;
    fetchedAt: string;
    totalSigns: number;
  };
}

export interface VenstertijdFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: VenstertijdSign;
}

export interface Filters {
  categories: string[];
  gemeenten: string[];
  rvvCodes: string[];
}

export const CATEGORY_COLORS: Record<string, string> = {
  bezorgvenster: '#3b82f6',
  spitsafsluiting: '#eab308',
  vrachtverbod_met_tijd: '#f97316',
  overig: '#6b7280',
};

export const CATEGORY_LABELS: Record<string, string> = {
  bezorgvenster: 'Bezorgvenster',
  spitsafsluiting: 'Spitsafsluiting',
  vrachtverbod_met_tijd: 'Vrachtverbod',
  overig: 'Overig',
};

export const RVV_DESCRIPTIONS: Record<string, string> = {
  C1: 'Gesloten in beide richtingen',
  C6: 'Gesloten voor motorvoertuigen > 2 wielen',
  C7: 'Gesloten voor vrachtauto\'s',
  C7a: 'Gesloten voor autobussen',
  C7b: 'Gesloten voor bussen en vrachtauto\'s',
  C12: 'Gesloten voor alle motorvoertuigen',
  C17: 'Gesloten voor te lange voertuigen',
  C21: 'Gesloten voor te zware voertuigen',
  G5: 'Erf',
  G7: 'Voetgangerszone',
};

export const RVV_SIGN_IMAGES: Record<string, string> = {
  C1: '/signs/C1.svg',
  C6: '/signs/C6.svg',
  C7: '/signs/C7.svg',
  C7a: '/signs/C7a.svg',
  C7b: '/signs/C7b.svg',
  C12: '/signs/C12.svg',
  C17: '/signs/C17.svg',
  C21: '/signs/C21.svg',
  G5: '/signs/G5.svg',
  G7: '/signs/G7.svg',
};

export function categorize(rvvCode: string): VenstertijdSign['categorie'] {
  if (['G7', 'C1'].includes(rvvCode)) return 'bezorgvenster';
  if (['C6', 'C12'].includes(rvvCode)) return 'spitsafsluiting';
  if (['C7', 'C7a', 'C7b', 'C21'].includes(rvvCode)) return 'vrachtverbod_met_tijd';
  return 'overig';
}
