/**
 * Geographic utilities for distance calculation and city normalization.
 * Uses zippopotam.us API (free, no key required) for zip/city lookups.
 */

/** Normalize city name for matching: st/st./saint, ft/fort, mt/mount, n/north, s/south, e/east, w/west */
export function normalizeCityName(name: string): string {
  if (!name || typeof name !== "string") return "";
  let s = name.trim().toLowerCase();
  // Word-boundary style replacements for common abbreviations
  const replacements: [RegExp, string][] = [
    [/\bst\.?\b/g, "saint"],
    [/\bft\.?\b/g, "fort"],
    [/\bmt\.?\b/g, "mount"],
    [/\bn\.?\b/g, "north"],
    [/\bs\.?\b/g, "south"],
    [/\be\.?\b/g, "east"],
    [/\bw\.?\b/g, "west"],
  ];
  for (const [re, replacement] of replacements) {
    s = s.replace(re, replacement);
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Check if normalized city A matches normalized city B (A contains B or vice versa) */
export function citiesMatch(a: string, b: string): boolean {
  const na = normalizeCityName(a);
  const nb = normalizeCityName(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/** Haversine formula: distance in miles between two lat/lng points */
export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export type ZippopotamPlace = {
  "place name": string;
  longitude: string;
  latitude: string;
  "post code"?: string;
};

export type ZippopotamZipResponse = {
  places: ZippopotamPlace[];
};

export type ZippopotamCityResponse = {
  places: ZippopotamPlace[];
};

/** Fetch lat/lng for a US zip code via zippopotam.us */
export async function fetchZipCoords(
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const cleaned = String(zip).replace(/\D/g, "").slice(0, 5);
  if (cleaned.length < 5) return null;
  try {
    const res = await fetch(
      `https://api.zippopotam.us/us/${cleaned}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ZippopotamZipResponse;
    const place = data.places?.[0];
    if (!place?.latitude || !place?.longitude) return null;
    return {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
    };
  } catch {
    return null;
  }
}

/** US state name to 2-letter abbreviation */
const STATE_TO_ABBR: Record<string, string> = {
  alabama: "al",
  alaska: "ak",
  arizona: "az",
  arkansas: "ar",
  california: "ca",
  colorado: "co",
  connecticut: "ct",
  delaware: "de",
  florida: "fl",
  georgia: "ga",
  hawaii: "hi",
  idaho: "id",
  illinois: "il",
  indiana: "in",
  iowa: "ia",
  kansas: "ks",
  kentucky: "ky",
  louisiana: "la",
  maine: "me",
  maryland: "md",
  massachusetts: "ma",
  michigan: "mi",
  minnesota: "mn",
  mississippi: "ms",
  missouri: "mo",
  montana: "mt",
  nebraska: "ne",
  nevada: "nv",
  "new hampshire": "nh",
  "new jersey": "nj",
  "new mexico": "nm",
  "new york": "ny",
  "north carolina": "nc",
  "north dakota": "nd",
  ohio: "oh",
  oklahoma: "ok",
  oregon: "or",
  pennsylvania: "pa",
  "rhode island": "ri",
  "south carolina": "sc",
  "south dakota": "sd",
  tennessee: "tn",
  texas: "tx",
  utah: "ut",
  vermont: "vt",
  virginia: "va",
  washington: "wa",
  "west virginia": "wv",
  wisconsin: "wi",
  wyoming: "wy",
  "district of columbia": "dc",
  "washington dc": "dc",
};

function getStateAbbr(state: string): string {
  if (!state) return "";
  const s = state.trim();
  if (s.length === 2) return s.toLowerCase();
  return STATE_TO_ABBR[s.toLowerCase()] ?? s.toLowerCase();
}

/** Fetch lat/lng for a US city via zippopotam.us (requires state). Uses first place as centroid. */
export async function fetchCityCoords(
  city: string,
  state: string
): Promise<{ lat: number; lng: number } | null> {
  const cityEnc = encodeURIComponent(city.trim());
  const stateAbbr = getStateAbbr(state);
  if (!cityEnc || !stateAbbr) return null;
  try {
    const res = await fetch(
      `https://api.zippopotam.us/us/${stateAbbr}/${cityEnc}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ZippopotamCityResponse;
    const place = data.places?.[0];
    if (!place?.latitude || !place?.longitude) return null;
    return {
      lat: parseFloat(place.latitude),
      lng: parseFloat(place.longitude),
    };
  } catch {
    return null;
  }
}
