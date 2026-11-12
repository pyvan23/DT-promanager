// European countries, their pyramids and cups, and the UEFA club competitions, as data.
// Division club lists come from src/data/real/<ISO>/<level>.json; a country or division
// without a file is simply absent, and cups that lack entrants are reported as pending.

import type { CompetitionDef, CompetitionFormat, Country, Division, EntryRule, TieRules } from '../engine/types';
import { CONMEBOL_EXCHANGE, CONMEBOL_STRENGTH } from './conmebol';

const POINTS = { win: 3, draw: 1, loss: 0 };
const SINGLE_HOME: TieRules = { legs: 1, awayGoals: false, neutralVenue: false };
const SINGLE_NEUTRAL: TieRules = { legs: 1, awayGoals: false, neutralVenue: true };
const TWO_LEGS: TieRules = { legs: 2, awayGoals: false, neutralVenue: false };

export const EUROPE_COUNTRIES: Country[] = [
  { id: 'ENG', name: 'Inglaterra', confederation: 'UEFA' },
  { id: 'ESP', name: 'España', confederation: 'UEFA' },
  { id: 'ITA', name: 'Italia', confederation: 'UEFA' },
  { id: 'DEU', name: 'Alemania', confederation: 'UEFA' },
  { id: 'FRA', name: 'Francia', confederation: 'UEFA' },
  { id: 'PRT', name: 'Portugal', confederation: 'UEFA' },
  { id: 'NLD', name: 'Países Bajos', confederation: 'UEFA' },
  { id: 'BEL', name: 'Bélgica', confederation: 'UEFA' },
  { id: 'SCO', name: 'Escocia', confederation: 'UEFA' },
  { id: 'TUR', name: 'Turquía', confederation: 'UEFA' },
];

/** Reputation bonus per country so league strength roughly follows reality (Argentina = 0). */
export const COUNTRY_STRENGTH: Record<string, number> = {
  ENG: 9, ESP: 8, ITA: 7, DEU: 7, FRA: 5, PRT: 3, NLD: 2, TUR: 1, BEL: 1, SCO: -2, ARG: 0,
  ...CONMEBOL_STRENGTH,
};

/** Clubs exchanged between level 1 and level 2 each season (only applied when both exist). */
const EXCHANGE: Record<string, number> = { ENG: 3, ESP: 3, ITA: 3, DEU: 3, FRA: 2, PRT: 2, NLD: 2, BEL: 2, SCO: 1, TUR: 3 };

export const EURO_LEAGUE: CompetitionFormat = {
  id: 'euro-league',
  name: 'Liga',
  stages: [{ kind: 'league', id: 'liga', name: 'Liga', rounds: 2, points: POINTS }],
};

export const DOMESTIC_CUP: CompetitionFormat = {
  id: 'domestic-cup',
  name: 'Copa nacional',
  stages: [{ kind: 'knockout', id: 'eliminatorias', name: 'Eliminatorias', tie: SINGLE_HOME, finalTie: SINGLE_NEUTRAL }],
};

const uefaLeaguePhase = (id: string, name: string, matchesPerTeam: number): CompetitionFormat => ({
  id,
  name,
  stages: [
    { kind: 'swiss', id: 'fase-liga', name: 'Fase de liga', matchesPerTeam, points: POINTS, advance: 24 },
    { kind: 'knockout', id: 'playoffs', name: 'Play-offs', tie: TWO_LEGS, byes: 8, maxRounds: 1 },
    { kind: 'knockout', id: 'final', name: 'Fase final', tie: TWO_LEGS, finalTie: SINGLE_NEUTRAL },
  ],
});

export const UCL_FORMAT = uefaLeaguePhase('ucl', 'UEFA Champions League', 8);
export const UEL_FORMAT = uefaLeaguePhase('uel', 'UEFA Europa League', 8);
export const UECL_FORMAT = uefaLeaguePhase('uecl', 'UEFA Conference League', 6);
export const SUPERCUP_FORMAT: CompetitionFormat = {
  id: 'uefa-supercup',
  name: 'Supercopa de Europa',
  stages: [{ kind: 'knockout', id: 'final', name: 'Final', tie: SINGLE_NEUTRAL }],
};

export const EUROPE_FORMATS = [EURO_LEAGUE, DOMESTIC_CUP, UCL_FORMAT, UEL_FORMAT, UECL_FORMAT, SUPERCUP_FORMAT];

const div = (country: string, level: number) => `${country.toLowerCase()}-${level}`;
const places = (country: string, from: number, to: number): EntryRule => ({ kind: 'division', divisionId: div(country, 1), from, to });
const cupWinner = (country: string): EntryRule => ({
  kind: 'champion',
  competitionId: `${country.toLowerCase()}-cup`,
  fallbackDivisionId: div(country, 1),
});

/** Division record for a country level; `size` comes from the data file. */
export function europeDivision(country: string, level: number, name: string, levels: number[]): Omit<Division, 'clubIds'> {
  const exchange = EXCHANGE[country] ?? CONMEBOL_EXCHANGE[country] ?? 2;
  const below = levels.includes(level + 1);
  const above = levels.includes(level - 1);
  return {
    id: div(country, level),
    name,
    country,
    level,
    formatId: EURO_LEAGUE.id,
    promotion: above ? { count: exchange, to: div(country, level - 1) } : null,
    relegation: below ? [{ count: exchange, to: div(country, level + 1) }] : [],
    relegationByAverages: false,
  };
}

/** Domestic cup: the largest power of two that the country's divisions can fill, top flight first. */
export function domesticCup(country: string, cupName: string, sizes: { level: number; size: number }[]): CompetitionDef {
  const total = sizes.reduce((s, d) => s + d.size, 0);
  const size = 2 ** Math.floor(Math.log2(Math.min(64, total)));
  const entries: EntryRule[] = [];
  let left = size;
  for (const d of [...sizes].sort((a, b) => a.level - b.level)) {
    const take = Math.min(left, d.size);
    if (take > 0) entries.push({ kind: 'division', divisionId: div(country, d.level), from: 1, to: take });
    left -= take;
  }
  return { id: `${country.toLowerCase()}-cup`, name: cupName, formatId: DOMESTIC_CUP.id, scope: 'domestic', country, size, entries };
}

/**
 * UEFA cups. Only ten leagues exist in the game for now, so their shares are scaled up to fill
 * 36-club league phases (real shares are smaller and other countries fill the rest).
 */
export const UEFA_COMPETITIONS: CompetitionDef[] = [
  {
    id: 'champions-league', name: 'UEFA Champions League', formatId: UCL_FORMAT.id, scope: 'continental', confederation: 'UEFA', size: 36,
    entries: [
      places('ENG', 1, 5), places('ESP', 1, 5), places('ITA', 1, 5), places('DEU', 1, 5), places('FRA', 1, 4),
      places('PRT', 1, 3), places('NLD', 1, 3), places('BEL', 1, 2), places('SCO', 1, 2), places('TUR', 1, 2),
    ],
  },
  {
    id: 'europa-league', name: 'UEFA Europa League', formatId: UEL_FORMAT.id, scope: 'continental', confederation: 'UEFA', size: 36,
    after: ['champions-league'],
    entries: [
      places('ENG', 6, 7), cupWinner('ENG'), places('ESP', 6, 7), cupWinner('ESP'), places('ITA', 6, 7), cupWinner('ITA'),
      places('DEU', 6, 7), cupWinner('DEU'), places('FRA', 5, 6), cupWinner('FRA'), places('PRT', 4, 5), cupWinner('PRT'),
      places('NLD', 4, 5), cupWinner('NLD'), places('BEL', 3, 4), cupWinner('BEL'), places('SCO', 3, 3), cupWinner('SCO'),
      places('TUR', 3, 3), cupWinner('TUR'), places('ENG', 8, 8), places('ESP', 8, 8),
      places('ITA', 8, 8), places('DEU', 8, 8), places('FRA', 7, 7), places('PRT', 6, 6), places('NLD', 6, 6), places('BEL', 5, 5),
    ],
  },
  {
    id: 'conference-league', name: 'UEFA Conference League', formatId: UECL_FORMAT.id, scope: 'continental', confederation: 'UEFA', size: 36,
    after: ['europa-league'],
    entries: [
      places('ENG', 9, 12), places('ESP', 9, 12), places('ITA', 9, 12), places('DEU', 9, 12), places('FRA', 8, 11),
      places('PRT', 7, 9), places('NLD', 7, 9), places('BEL', 6, 7), places('SCO', 4, 6), places('TUR', 4, 8),
    ],
  },
  {
    id: 'uefa-supercup', name: 'Supercopa de Europa', formatId: SUPERCUP_FORMAT.id, scope: 'continental', confederation: 'UEFA', size: 2,
    entries: [
      { kind: 'champion', competitionId: 'champions-league' },
      { kind: 'champion', competitionId: 'europa-league' },
    ],
  },
];
