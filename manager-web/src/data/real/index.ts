// Real-world data files (clubs per division, squads per club). Kept apart from the
// engine so the game can ship with or without them: each file is optional and
// createWorld falls back to fictional clubs/players where a file is missing.

import type { Position } from '../../engine/types';

export interface RealClub {
  name: string;
  shortName: string;
  city: string;
  province: string;
  /** "directa" or "indirecta", optionally followed by free-text detail. */
  affiliation: string;
  stadium: string;
  colors: { primary: string; secondary: string };
  /** 5 = one of the "big five", 1 = small club. */
  stature: number;
}

export interface RealDivisionFile {
  division: string;
  season: number;
  sources: string[];
  formatNotes: string;
  clubs: RealClub[];
}

export interface RealPlayer {
  name: string;
  position: Position;
  altPositions?: Position[];
  birthDate?: string; // yyyy-mm-dd; missing = age estimated
  nationality?: string; // ISO 3166 alpha-3
  /** Optional hand-tuned overall 1-99; otherwise derived from club level and age. */
  rating?: number;
}

export interface RealSquadFile {
  club: string; // shortName of the club, as in the division file
  season: number;
  sources: string[];
  players: RealPlayer[];
}

// crests*.json live here too but are indexes of crest images, not divisions.
const divisionModules = import.meta.glob<RealDivisionFile>(['./*.json', '!./crests*.json', '!./comp-logos.json', '!./calendar-*.json', '!./qualification-*.json', '!./trophies.json', '!./federations.json'], { eager: true, import: 'default' });
const squadModules = import.meta.glob<RealSquadFile>('./squads/*.json', { eager: true, import: 'default' });

/** Division file of a non-Argentine country, stored as <ISO>/<level>.json. */
export interface RealCountryDivisionFile extends RealDivisionFile {
  country: string;
  name: string;
  domesticCup?: { name: string; formatNotes?: string };
}

const countryModules = import.meta.glob<RealCountryDivisionFile>('./*/[0-9].json', { eager: true, import: 'default' });

/** Other countries' divisions: country ISO → level → file. */
export const REAL_COUNTRY_DIVISIONS: Record<string, Record<number, RealCountryDivisionFile>> = {};
for (const [p, file] of Object.entries(countryModules)) {
  const m = p.match(/^\.\/([A-Z]{3})\/(\d)\.json$/);
  if (m) (REAL_COUNTRY_DIVISIONS[m[1]] ??= {})[Number(m[2])] = file;
}

/** Real match dates of a season, per competition and stage (see calendar-2026.json). */
export interface RealCalendarFile {
  season: number;
  competitions: Record<string, { name: string; stages: { stage: string; dates: string[] }[] }>;
}

const calendarModules = import.meta.glob<RealCalendarFile>('./calendar-*.json', { eager: true, import: 'default' });
export const REAL_CALENDARS: RealCalendarFile[] = Object.values(calendarModules);

/** Real cup line-ups and previous champions for a starting season (see qualification-2026.json). */
export interface RealQualificationFile {
  season: number;
  entrants: Record<string, { club: string; country: string; missing?: boolean }[]>;
  champions2025?: Record<string, { club: string; country: string } | undefined>;
}

const qualificationModules = import.meta.glob<RealQualificationFile>('./qualification-*.json', { eager: true, import: 'default' });
export const REAL_QUALIFICATIONS: RealQualificationFile[] = Object.values(qualificationModules);

/** Real club lists by division id (file name without extension). */
export const REAL_DIVISIONS: Record<string, RealDivisionFile> = Object.fromEntries(
  Object.entries(divisionModules).map(([path, file]) => [path.replace(/^\.\/|\.json$/g, ''), file]),
);

export function slug(text: string): string {
  return text
    // Letters that do not decompose into base letter + accent (Turkish ı, German ß, Nordic ø…).
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Real squads by club slug (slug of the club's shortName). */
export const REAL_SQUADS: Record<string, RealSquadFile> = Object.fromEntries(
  Object.values(squadModules).map((file) => [slug(file.club), file]),
);
