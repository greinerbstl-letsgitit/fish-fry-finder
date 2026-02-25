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

/** US state abbreviations for autocomplete */
export const US_STATE_ABBREVS = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
] as const;

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

export type CitySuggestion = { city: string; stateAbbr: string };

/** Hardcoded major Missouri and Illinois cities for reliable autocomplete fallback */
const MAJOR_MO_IL_CITIES: CitySuggestion[] = [
  { city: "Alton", stateAbbr: "IL" },
  { city: "Ballwin", stateAbbr: "MO" },
  { city: "Barnhart", stateAbbr: "MO" },
  { city: "Bella Villa", stateAbbr: "MO" },
  { city: "Belleville", stateAbbr: "IL" },
  { city: "Bellefontaine Neighbors", stateAbbr: "MO" },
  { city: "Berkeley", stateAbbr: "MO" },
  { city: "Black Jack", stateAbbr: "MO" },
  { city: "Breckenridge Hills", stateAbbr: "MO" },
  { city: "Brentwood", stateAbbr: "MO" },
  { city: "Bridgeton", stateAbbr: "MO" },
  { city: "Carbondale", stateAbbr: "IL" },
  { city: "Chesterfield", stateAbbr: "MO" },
  { city: "Clayton", stateAbbr: "MO" },
  { city: "Columbia", stateAbbr: "MO" },
  { city: "Concord", stateAbbr: "MO" },
  { city: "Crestwood", stateAbbr: "MO" },
  { city: "Creve Coeur", stateAbbr: "MO" },
  { city: "Crystal City", stateAbbr: "MO" },
  { city: "DeSoto", stateAbbr: "MO" },
  { city: "Des Peres", stateAbbr: "MO" },
  { city: "Edwardsville", stateAbbr: "IL" },
  { city: "Ellisville", stateAbbr: "MO" },
  { city: "Eureka", stateAbbr: "MO" },
  { city: "Fenton", stateAbbr: "MO" },
  { city: "Ferguson", stateAbbr: "MO" },
  { city: "Festus", stateAbbr: "MO" },
  { city: "Florissant", stateAbbr: "MO" },
  { city: "Frontenac", stateAbbr: "MO" },
  { city: "Glendale", stateAbbr: "MO" },
  { city: "Granite City", stateAbbr: "MO" },
  { city: "Hanley Hills", stateAbbr: "MO" },
  { city: "Hazelwood", stateAbbr: "MO" },
  { city: "Herald", stateAbbr: "MO" },
  { city: "High Ridge", stateAbbr: "MO" },
  { city: "Hillsdale", stateAbbr: "MO" },
  { city: "House Springs", stateAbbr: "MO" },
  { city: "Imperial", stateAbbr: "MO" },
  { city: "Independence", stateAbbr: "MO" },
  { city: "Jennings", stateAbbr: "MO" },
  { city: "Jefferson City", stateAbbr: "MO" },
  { city: "Kansas City", stateAbbr: "MO" },
  { city: "Kirkwood", stateAbbr: "MO" },
  { city: "Ladue", stateAbbr: "MO" },
  { city: "Lake Saint Louis", stateAbbr: "MO" },
  { city: "Lemay", stateAbbr: "MO" },
  { city: "Lindbergh", stateAbbr: "MO" },
  { city: "Manchester", stateAbbr: "MO" },
  { city: "Maplewood", stateAbbr: "MO" },
  { city: "Maryland Heights", stateAbbr: "MO" },
  { city: "Mehlville", stateAbbr: "MO" },
  { city: "Moline Acres", stateAbbr: "MO" },
  { city: "Normandy", stateAbbr: "MO" },
  { city: "Oakville", stateAbbr: "MO" },
  { city: "O'Fallon", stateAbbr: "MO" },
  { city: "Olivette", stateAbbr: "MO" },
  { city: "Overland", stateAbbr: "MO" },
  { city: "Pacific", stateAbbr: "MO" },
  { city: "Pagedale", stateAbbr: "MO" },
  { city: "Pevely", stateAbbr: "MO" },
  { city: "Pinelawn", stateAbbr: "MO" },
  { city: "Richmond Heights", stateAbbr: "MO" },
  { city: "Riverview", stateAbbr: "MO" },
  { city: "Rock Hill", stateAbbr: "MO" },
  { city: "Saint Ann", stateAbbr: "MO" },
  { city: "Saint Charles", stateAbbr: "MO" },
  { city: "Saint James", stateAbbr: "MO" },
  { city: "Saint John", stateAbbr: "MO" },
  { city: "Saint Joseph", stateAbbr: "MO" },
  { city: "Saint Louis", stateAbbr: "MO" },
  { city: "Saint Peters", stateAbbr: "MO" },
  { city: "Shrewsbury", stateAbbr: "MO" },
  { city: "Spanish Lake", stateAbbr: "MO" },
  { city: "Springfield", stateAbbr: "MO" },
  { city: "Sunset Hills", stateAbbr: "MO" },
  { city: "Sycamore Hills", stateAbbr: "MO" },
  { city: "Town and Country", stateAbbr: "MO" },
  { city: "Troy", stateAbbr: "MO" },
  { city: "University City", stateAbbr: "MO" },
  { city: "Valley Park", stateAbbr: "MO" },
  { city: "Velda City", stateAbbr: "MO" },
  { city: "Velda Village Hills", stateAbbr: "MO" },
  { city: "Vinita Park", stateAbbr: "MO" },
  { city: "Warson Woods", stateAbbr: "MO" },
  { city: "Webster Groves", stateAbbr: "MO" },
  { city: "Wentzville", stateAbbr: "MO" },
  { city: "Wildwood", stateAbbr: "MO" },
  { city: "Winchester", stateAbbr: "MO" },
  { city: "Wood River", stateAbbr: "MO" },
  { city: "Woodson Terrace", stateAbbr: "MO" },
];

/** Generate search term variations to try multiple API calls (e.g. saint/st, fort/ft) */
function getSearchVariations(partial: string): string[] {
  const p = partial.trim().toLowerCase();
  if (!p) return [];
  const variations = new Set<string>([p]);
  const expandMap: Record<string, string> = {
    st: "saint",
    "st.": "saint",
    ft: "fort",
    "ft.": "fort",
    mt: "mount",
    "mt.": "mount",
    n: "north",
    "n.": "north",
    s: "south",
    "s.": "south",
    e: "east",
    "e.": "east",
    w: "west",
    "w.": "west",
  };
  const abbreviateMap: Record<string, string> = {
    saint: "st",
    fort: "ft",
    mount: "mt",
    north: "n",
    south: "s",
    east: "e",
    west: "w",
  };
  const expanded = expandMap[p];
  if (expanded) variations.add(expanded);
  const abbreviated = abbreviateMap[p];
  if (abbreviated) variations.add(abbreviated);
  if (p === "fallon") variations.add("ofallon");
  if (p === "ofallon" || p === "o'fallon") variations.add("fallon");
  if (p.startsWith("spring") && p.length < 10) variations.add("springfield");
  if (p.startsWith("columb") && p.length < 8) variations.add("columbia");
  if (p.startsWith("jefferson") && p.length < 12) variations.add("jefferson city");
  if (p.startsWith("kansas") && p.length < 10) variations.add("kansas city");
  return Array.from(variations);
}

function cityMatchesQuery(city: string, query: string): boolean {
  const normCity = normalizeCityName(city);
  const normQuery = normalizeCityName(query);
  if (!normCity || !normQuery) return false;
  return normCity.includes(normQuery) || normQuery.includes(normCity);
}

/** Fetch city suggestions from zippopotam.us for autocomplete. Requires state. */
export async function fetchCitySuggestions(
  stateInput: string,
  partialCity: string
): Promise<CitySuggestion[]> {
  const stateAbbr = getStateAbbr(stateInput);
  const partial = partialCity.trim();
  if (!stateAbbr || stateAbbr.length < 2 || partial.length < 2) {
    return [];
  }

  const seen = new Set<string>();
  const results: CitySuggestion[] = [];

  const addUnique = (s: CitySuggestion) => {
    const key = `${s.city.toLowerCase()}|${s.stateAbbr}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(s);
    }
  };

  const stateUpper = stateAbbr.toUpperCase();

  const fromHardcoded = MAJOR_MO_IL_CITIES.filter(
    (c) =>
      c.stateAbbr === stateUpper &&
      cityMatchesQuery(c.city, partial)
  );
  fromHardcoded.forEach(addUnique);

  const variations = getSearchVariations(partial);
  const fetchPromises = variations.map(async (term) => {
    try {
      const cityEnc = encodeURIComponent(term);
      const res = await fetch(
        `https://api.zippopotam.us/us/${stateAbbr}/${cityEnc}`,
        { cache: "no-store" }
      );
      if (!res.ok) return [];
      const data = (await res.json()) as ZippopotamCityResponse & {
        "state abbreviation"?: string;
      };
      const stateFromApi = (data["state abbreviation"] ?? stateAbbr).toUpperCase();
      if (stateFromApi !== stateUpper) return [];
      const places: CitySuggestion[] = [];
      for (const place of data.places ?? []) {
        const name = place["place name"]?.trim();
        if (name) {
          places.push({ city: name, stateAbbr: stateFromApi });
        }
      }
      return places;
    } catch {
      return [];
    }
  });

  const apiResults = await Promise.all(fetchPromises);
  for (const batch of apiResults) {
    for (const s of batch) {
      if (cityMatchesQuery(s.city, partial)) {
        addUnique(s);
      }
    }
  }

  results.sort((a, b) =>
    a.city.localeCompare(b.city, undefined, { sensitivity: "base" })
  );
  return results;
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
