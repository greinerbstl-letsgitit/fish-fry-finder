/** Abbreviation groups for Catholic/place names. Order: longer first (ste before st). */
const ABBREV_GROUPS: { pattern: RegExp; forms: string[] }[] = [
  { pattern: /\b(ste\.?|sainte)\b/gi, forms: ["ste.", "ste", "sainte"] },
  { pattern: /\b(st\.?|saint)\b/gi, forms: ["st.", "st", "saint"] },
  { pattern: /\b(ft\.?|fort)\b/gi, forms: ["ft.", "ft", "fort"] },
  { pattern: /\b(h\.|holy)\b/gi, forms: ["h.", "holy"] },
];

/** Generate search variants. E.g. "st. cletus" → ["st. cletus", "st cletus", "saint cletus"]. */
export function getSearchVariants(s: string): string[] {
  const lower = s.toLowerCase().trim();
  if (!lower) return [];
  const results = new Set<string>([lower]);
  for (const { pattern, forms } of ABBREV_GROUPS) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(lower)) {
      for (const form of forms) {
        results.add(lower.replace(new RegExp(pattern.source, pattern.flags), form));
      }
    }
  }
  return Array.from(results);
}

/** Returns true if any variant of search matches any variant of target (bidirectional includes). */
export function matchesWithVariants(searchStr: string, targetStr: string): boolean {
  const searchVariants = getSearchVariants(searchStr);
  const targetVariants = getSearchVariants(targetStr);
  for (const sv of searchVariants) {
    for (const tv of targetVariants) {
      if (tv.includes(sv) || sv.includes(tv)) return true;
    }
  }
  return false;
}
