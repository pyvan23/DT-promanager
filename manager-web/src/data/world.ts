// Builds a fictional starting world: every division of the pyramid filled with
// invented clubs and players. Real data can replace it later through an importer.

import { createRng, type Rng } from '../engine/rng';
import { POSITION_LINE, type Club, type Player, type PlayerAttributes, type Position, type Region, type World } from '../engine/types';
import { COUNTRIES } from './countries';
import { COMPETITION_DEFS } from './cups';
import { DIVISION_TEMPLATES } from './divisions';
import { CONMEBOL_COUNTRIES } from './conmebol';
import { COUNTRY_STRENGTH, EUROPE_COUNTRIES, UEFA_COMPETITIONS, domesticCup, europeDivision } from './europe';
import { CLUB_PREFIXES, COLORS, FIRST_NAMES, PLACE_NAMES, STADIUM_PREFIXES, SURNAMES } from './names';
import { REAL_COUNTRY_DIVISIONS, REAL_DIVISIONS, REAL_QUALIFICATIONS, REAL_SQUADS, slug, type RealClub, type RealSquadFile } from './real';

/** Typical club level (reputation) range per pyramid level. */
const LEVEL_REPUTATION: Record<number, [number, number]> = {
  1: [54, 76],
  2: [44, 60],
  3: [36, 52],
  4: [28, 44],
  5: [20, 36],
};

/** Squad template: main position and how many of each. */
const SQUAD: [Position, number][] = [
  ['ARQ', 3],
  ['LD', 2], ['DFC', 4], ['LI', 2],
  ['MCD', 2], ['MC', 2], ['MD', 1], ['MI', 1], ['MCO', 2],
  ['ED', 1], ['EI', 1], ['DC', 3],
];

/** Positions a player can also cover, by main position. */
const ALTERNATES: Record<Position, Position[]> = {
  ARQ: [],
  LD: ['MD', 'DFC', 'LI'],
  DFC: ['MCD', 'LD', 'LI'],
  LI: ['MI', 'DFC', 'LD'],
  MCD: ['DFC', 'MC'],
  MD: ['ED', 'LD', 'MC'],
  MC: ['MCD', 'MCO', 'MD', 'MI'],
  MI: ['EI', 'LI', 'MC'],
  MCO: ['MC', 'DC', 'ED', 'EI'],
  ED: ['MD', 'EI', 'DC'],
  EI: ['MI', 'ED', 'DC'],
  DC: ['ED', 'EI', 'MCO'],
};

/** Which attributes matter most per line; the rest are generated lower. */
const KEY_ATTRIBUTES: Record<string, (keyof PlayerAttributes)[]> = {
  ARQ: ['goalkeeping'],
  DEF: ['tackling', 'heading', 'aggression'],
  MED: ['passing', 'dribbling', 'stamina'],
  DEL: ['shooting', 'heading', 'dribbling', 'speed'],
};

const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));

function attributesFor(position: Position, level: number, rng: Rng): PlayerAttributes {
  const line = POSITION_LINE[position];
  const key = new Set(KEY_ATTRIBUTES[line]);
  // Key skills sit a little above the player's level; a 90+ needs a top club and a lucky roll.
  const roll = (base: number) => clamp(base + rng.int(-8, 8));
  const attrs: PlayerAttributes = {
    speed: 0, stamina: 0, aggression: 0, quality: 0, goalkeeping: 0,
    tackling: 0, passing: 0, dribbling: 0, shooting: 0, heading: 0,
  };
  for (const k of Object.keys(attrs) as (keyof PlayerAttributes)[]) {
    if (k === 'goalkeeping') attrs[k] = line === 'ARQ' ? roll(level + 4) : clamp(rng.int(3, 20));
    else if (key.has(k)) attrs[k] = roll(level + 4);
    else attrs[k] = roll(level - (line === 'ARQ' ? 20 : 8));
  }
  attrs.quality = roll(level);
  return attrs;
}

function birthDate(season: number, rng: Rng): string {
  const year = season - rng.int(17, 35);
  const month = String(rng.int(1, 12)).padStart(2, '0');
  const day = String(rng.int(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function randomAlternates(position: Position, rng: Rng): Position[] {
  return rng.shuffle(ALTERNATES[position]).slice(0, rng.int(0, Math.min(3, ALTERNATES[position].length)));
}

function fictionalName(rng: Rng): string {
  return `${FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]} ${SURNAMES[rng.int(0, SURNAMES.length - 1)]}`;
}

function makePlayers(club: Club, season: number, rng: Rng, nextId: () => string): Player[] {
  const players: Player[] = [];
  for (const [position, count] of SQUAD) {
    for (let i = 0; i < count; i++) {
      // Each squad has a spread: a few players above and below the club level.
      const level = club.reputation + rng.int(-12, 8);
      players.push({
        id: nextId(),
        name: fictionalName(rng),
        birthDate: birthDate(season, rng),
        nationality: rng.next() < 0.88 ? 'ARG' : (['URY', 'PRY', 'COL', 'CHL', 'BOL', 'VEN'] as const)[rng.int(0, 5)],
        position,
        altPositions: randomAlternates(position, rng),
        attributes: attributesFor(position, level, rng),
        clubId: club.id,
      });
    }
  }
  return players;
}

/** Level adjustment by age: players peak in their late twenties. */
function ageModifier(age: number): number {
  if (age <= 19) return -9;
  if (age <= 22) return -4;
  if (age <= 25) return 0;
  if (age <= 30) return 3;
  if (age <= 33) return 0;
  return -4;
}

/** Common non-ISO codes found in source data (FIFA-style) mapped to ISO 3166 alpha-3. */
const NATIONALITY_ALIASES: Record<string, string> = { PAR: 'PRY', URU: 'URY', CHI: 'CHL', HOL: 'NLD', ALE: 'DEU', GER: 'DEU' };

function normalizeNationality(code: string | undefined): string {
  if (!code) return 'ARG';
  const upper = code.toUpperCase();
  return NATIONALITY_ALIASES[upper] ?? upper;
}

/** Minimum squad size; real squads with fewer players are topped up with fictional youth players. */
const MIN_SQUAD = 22;

/**
 * Identity of a real player across squad files. Sources lag behind transfers and loans, so the
 * same person can appear in two squads; same name and a birth date within a few days (or
 * missing) counts as the same player.
 */
function sameRealPlayer(a: { name: string; birthDate?: string }, b: { name: string; birthDate?: string }): boolean {
  if (slug(a.name) !== slug(b.name)) return false;
  if (!a.birthDate || !b.birthDate) return true;
  return Math.abs(Date.parse(a.birthDate) - Date.parse(b.birthDate)) <= 3 * 86_400_000;
}

function realPlayers(
  club: Club,
  squad: RealSquadFile,
  season: number,
  rng: Rng,
  nextId: () => string,
  taken: Map<string, { name: string; birthDate?: string }[]>,
): Player[] {
  // A player already placed in an earlier squad (higher division first) stays there.
  const fresh = squad.players.filter((rp) => {
    const key = slug(rp.name);
    const seen = taken.get(key) ?? [];
    if (seen.some((s) => sameRealPlayer(s, rp))) return false;
    taken.set(key, [...seen, rp]);
    return true;
  });
  const players: Player[] = fresh.map((rp) => {
    // Source dates can be malformed (day 0, placeholders); fall back to an estimated age.
    const validDate = rp.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(rp.birthDate) && !Number.isNaN(Date.parse(rp.birthDate));
    const born = validDate ? rp.birthDate! : birthDate(season, rng);
    const age = season - Number(born.slice(0, 4));
    const level = rp.rating ?? club.reputation + ageModifier(age) + rng.int(-8, 5);
    return {
      id: nextId(),
      name: rp.name,
      birthDate: born,
      nationality: normalizeNationality(rp.nationality),
      position: rp.position,
      altPositions: rp.altPositions ?? randomAlternates(rp.position, rng),
      attributes: attributesFor(rp.position, level, rng),
      clubId: club.id,
    };
  });
  // Top up thin squads with academy players, keeping at least two keepers.
  const keepers = players.filter((p) => p.position === 'ARQ').length;
  const fill: Position[] = [
    ...Array<Position>(Math.max(0, 2 - keepers)).fill('ARQ'),
    ...rng.shuffle<Position>(['DFC', 'LD', 'LI', 'MCD', 'MC', 'MCO', 'ED', 'EI', 'DC', 'DFC', 'MC', 'DC']),
  ];
  for (let i = 0; players.length < MIN_SQUAD; i++) {
    const position = fill[i % fill.length];
    players.push({
      id: nextId(),
      name: fictionalName(rng),
      birthDate: `${season - rng.int(17, 19)}-0${rng.int(1, 9)}-1${rng.int(0, 9)}`,
      nationality: 'ARG',
      position,
      altPositions: randomAlternates(position, rng),
      attributes: attributesFor(position, club.reputation - 10 + rng.int(-5, 5), rng),
      clubId: club.id,
    });
  }
  return players;
}

/** Reputation from the division's level band, the club's stature (1-5) and the country's strength. */
function realReputation(level: number, stature: number, country: string, rng: Rng): number {
  const [low, high] = LEVEL_REPUTATION[Math.min(level, 5)];
  const base = low + ((high - low) * (Math.min(5, Math.max(1, stature)) - 1)) / 4;
  return Math.min(95, Math.round(base + (COUNTRY_STRENGTH[country] ?? 0)) + rng.int(-2, 2));
}

/** Argentine ids keep the historical "ar-" prefix; other countries use their ISO code. */
const clubId = (country: string, shortName: string) =>
  `${country === 'ARG' ? 'ar' : country.toLowerCase()}-${slug(shortName)}`;

function realClub(rc: RealClub, level: number, rng: Rng, country = 'ARG'): Club {
  return {
    id: clubId(country, rc.shortName),
    name: rc.name,
    shortName: rc.shortName,
    country,
    reputation: realReputation(level, rc.stature, country, rng),
    stadium: rc.stadium,
    // Source files sometimes add detail after the value, e.g. "indirecta (invitado; Liga X)".
    region: rc.affiliation.trim().toLowerCase().startsWith('directa') ? 'metro' : 'interior',
    colors: rc.colors,
  };
}

function pickColors(rng: Rng): Club['colors'] {
  const primary = COLORS[rng.int(0, COLORS.length - 1)];
  let secondary = COLORS[rng.int(0, COLORS.length - 1)];
  while (secondary === primary) secondary = COLORS[rng.int(0, COLORS.length - 1)];
  return { primary, secondary };
}

/**
 * Real starting point of the season: the clubs that actually play each cup (by club name
 * and country) and last season's champions, from data/real/qualification-<season>.json.
 */
function withRealQualification(world: World): World {
  const file = REAL_QUALIFICATIONS.find((f) => f.season === world.season);
  if (!file) return world;
  const idOf = (club: string, country: string) => {
    const id = clubId(country, club);
    return world.clubs.some((c) => c.id === id) ? id : undefined;
  };
  const entrants: Record<string, string[]> = {};
  for (const [cup, list] of Object.entries(file.entrants ?? {})) {
    const ids = list.map((e) => idOf(e.club, e.country)).filter((x): x is string => !!x);
    // Only usable if every club exists in our data; otherwise the entry rules decide.
    if (ids.length === list.length && new Set(ids).size === ids.length) entrants[cup] = ids;
  }
  const champions: Record<string, string> = {};
  for (const [comp, c] of Object.entries(file.champions2025 ?? {})) {
    const id = c && idOf(c.club, c.country);
    if (id) champions[comp] = id;
  }
  return {
    ...world,
    fixedEntrants: { season: world.season, entrants },
    qualification: { season: world.season - 1, rankings: {}, champions },
  };
}

/**
 * @param useRealData use the club and squad files in src/data/real where present
 *        (false = fully fictional world, e.g. for a build that ships without real names).
 */
export function createWorld(seed: number, season = 2026, useRealData = true): World {
  const rng = createRng(seed);
  const places = rng.shuffle(PLACE_NAMES);
  let placeIndex = 0;
  let clubCounter = 0;
  let playerCounter = 0;
  const nextPlayerId = () => `p${++playerCounter}`;

  const clubs: Club[] = [];
  const players: Player[] = [];
  const placedRealPlayers = new Map<string, { name: string; birthDate?: string }[]>();
  const divisions = DIVISION_TEMPLATES.map(({ size, clubRegion, ...division }) => {
    const real = useRealData ? REAL_DIVISIONS[division.id] : undefined;
    if (real) {
      const clubIds: string[] = [];
      for (const rc of real.clubs) {
        const club = realClub(rc, division.level, rng);
        const squad = REAL_SQUADS[slug(rc.shortName)];
        clubs.push(club);
        clubIds.push(club.id);
        players.push(
          ...(squad
            ? realPlayers(club, squad, season, rng, nextPlayerId, placedRealPlayers)
            : makePlayers(club, season, rng, nextPlayerId)),
        );
      }
      return { ...division, clubIds };
    }

    const [low, high] = LEVEL_REPUTATION[division.level];
    const clubIds: string[] = [];
    for (let i = 0; i < size; i++) {
      const place = places[placeIndex % places.length] + (placeIndex >= places.length ? ` ${Math.floor(placeIndex / places.length) + 1}` : '');
      placeIndex++;
      const prefix = CLUB_PREFIXES[rng.int(0, CLUB_PREFIXES.length - 1)];
      const region: Region = clubRegion === 'mixed' ? (rng.next() < 0.55 ? 'metro' : 'interior') : clubRegion;
      const club: Club = {
        id: `c${++clubCounter}`,
        name: `${prefix} ${place}`,
        shortName: place,
        country: 'ARG',
        // Spread reputations so each division has favourites and strugglers.
        reputation: Math.round(high - ((high - low) * i) / Math.max(1, size - 1)) + rng.int(-2, 2),
        stadium: `${STADIUM_PREFIXES[rng.int(0, STADIUM_PREFIXES.length - 1)]} ${place}`,
        region,
        colors: pickColors(rng),
      };
      clubs.push(club);
      clubIds.push(club.id);
      players.push(...makePlayers(club, season, rng, nextPlayerId));
    }
    return { ...division, clubIds };
  });

  // Other countries: only from real data files (no fictional European pyramids).
  const countries = [...COUNTRIES];
  const competitions = [...COMPETITION_DEFS];
  if (useRealData) {
    for (const country of [...EUROPE_COUNTRIES, ...CONMEBOL_COUNTRIES]) {
      const files = REAL_COUNTRY_DIVISIONS[country.id];
      if (!files) continue;
      countries.push(country);
      const levels = Object.keys(files).map(Number).sort();
      for (const level of levels) {
        const file = files[level];
        const clubIds: string[] = [];
        for (const rc of file.clubs) {
          const club = realClub(rc, level, rng, country.id);
          clubs.push(club);
          clubIds.push(club.id);
          players.push(...makePlayers(club, season, rng, nextPlayerId)); // real European squads: later
        }
        divisions.push({ ...europeDivision(country.id, level, file.name, levels), clubIds });
      }
      const cupName = files[levels[0]].domesticCup?.name ?? `Copa de ${country.name}`;
      competitions.push(domesticCup(country.id, cupName, levels.map((level) => ({ level, size: files[level].clubs.length }))));
    }
    if (countries.some((c) => c.confederation === 'UEFA')) competitions.push(...UEFA_COMPETITIONS);
  }

  const world: World = { seed, season, countries, clubs, players, divisions, competitions, history: [] };
  return useRealData ? withRealQualification(world) : world;
}
