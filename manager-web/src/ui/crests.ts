// Index of real crest images. Loaded through a glob so the build works whether
// crests.json exists, is empty, or is still being filled in.

import { SHOW_REAL_CRESTS } from './config';

export interface CrestEntry {
  file: string; // path under public/, e.g. "escudos/ar-boca-juniors.png"
  source: string;
  license: string;
}

// One index per source (crests.json for Argentina, crests-europe.json, ...), merged.
const modules = import.meta.glob<Record<string, CrestEntry>>('../data/real/crests*.json', { eager: true, import: 'default' });
const CRESTS: Record<string, CrestEntry> = Object.assign({}, ...Object.values(modules));

/** Public URL of the club's real crest, or null to fall back to the generic shield. */
export function crestUrl(clubId: string): string | null {
  if (!SHOW_REAL_CRESTS) return null;
  const entry = CRESTS[clubId];
  return entry?.file ? import.meta.env.BASE_URL + entry.file.replace(/^\//, '') : null;
}
