// Between seasons: players develop or decline with age, veterans retire, academies produce
// youth players, expired contracts are renewed or released, and the season's awards.

import { FIRST_NAMES, SURNAMES } from '../../data/names';
import { staffEffects } from '../club';
import { initialContract } from '../market';
import type { Rng } from '../rng';
import { POSITION_LINE, type Club, type Player, type PlayerAttributes, type Position, type World } from '../types';
import type { StaffMember } from '../game-types';

const clamp = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
export const ageIn = (p: Player, season: number) => season - Number(p.birthDate.slice(0, 4));

/** Attribute change for one season at a given age; physical skills fade first. */
function growth(age: number, physical: boolean, rng: Rng): number {
  if (age <= 19) return rng.int(2, 6);
  if (age <= 22) return rng.int(1, 4);
  if (age <= 25) return rng.int(0, 2);
  if (age <= 29) return rng.int(-1, 1);
  if (age <= 32) return physical ? rng.int(-3, 0) : rng.int(-1, 0);
  return physical ? rng.int(-5, -2) : rng.int(-3, -1);
}

const PHYSICAL: (keyof PlayerAttributes)[] = ['speed', 'stamina'];

export function developPlayers(world: World, nextSeason: number, rng: Rng): World {
  const players = world.players.map((p) => {
    const age = ageIn(p, nextSeason);
    const attributes = { ...p.attributes };
    for (const k of Object.keys(attributes) as (keyof PlayerAttributes)[]) {
      if (k === 'goalkeeping' && p.position !== 'ARQ') continue;
      attributes[k] = clamp(attributes[k] + growth(age, PHYSICAL.includes(k), rng));
    }
    // A fresh season: no carried-over cards or bans; fitness back to full.
    const condition = p.condition ? { ...p.condition, yellowCards: 0, suspensionMatches: 0, fitness: 100 } : p.condition;
    return { ...p, attributes, condition };
  });
  return { ...world, players };
}

/** Veterans retire: always from 39, likely from 36. Returns the world and who retired. */
export function retirePlayers(world: World, nextSeason: number, rng: Rng): { world: World; retired: Player[] } {
  const retired: Player[] = [];
  const players = world.players.filter((p) => {
    const age = ageIn(p, nextSeason);
    const goes = age >= 39 || (age >= 36 && rng.next() < 0.45) || (age >= 34 && !p.clubId && rng.next() < 0.6);
    if (goes) retired.push(p);
    return !goes;
  });
  return { world: { ...world, players }, retired };
}

const YOUTH_POSITIONS: Position[] = ['ARQ', 'DFC', 'DFC', 'LD', 'LI', 'MCD', 'MC', 'MCO', 'ED', 'EI', 'DC', 'DC'];

function youthPlayer(club: Club, nextSeason: number, n: number, quality: number, rng: Rng, academy: boolean): Player {
  const position = YOUTH_POSITIONS[rng.int(0, YOUTH_POSITIONS.length - 1)];
  const line = POSITION_LINE[position];
  // A good youth coach (quality ~60) is worth about +5 on every attribute.
  const base = Math.max(15, club.reputation - 22 + Math.round((quality - 50) / 2));
  const key: Record<string, (keyof PlayerAttributes)[]> = {
    ARQ: ['goalkeeping'], DEF: ['tackling', 'heading'], MED: ['passing', 'dribbling'], DEL: ['shooting', 'heading'],
  };
  const attributes = {} as PlayerAttributes;
  for (const k of ['speed', 'stamina', 'aggression', 'quality', 'goalkeeping', 'tackling', 'passing', 'dribbling', 'shooting', 'heading'] as const) {
    attributes[k] =
      k === 'goalkeeping' && position !== 'ARQ' ? rng.int(3, 15) : clamp(base + (key[line].includes(k) ? 6 : 0) + rng.int(-8, 8));
  }
  const year = nextSeason - rng.int(16, 18);
  return {
    id: `y${nextSeason}-${club.id}-${n}`,
    name: `${FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]} ${SURNAMES[rng.int(0, SURNAMES.length - 1)]}`,
    birthDate: `${year}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`,
    nationality: club.country === 'ENG' || club.country === 'SCO' ? 'GBR' : club.country,
    position,
    altPositions: [],
    attributes,
    clubId: club.id,
    youth: academy,
  };
}

/**
 * Academy intake. Every club gets two or three youngsters; AI clubs put them straight in
 * the squad (topping it up to keep ~24 players), the user's club keeps them in the academy.
 */
export function youthIntake(world: World, nextSeason: number, userClubId: string, userStaff: StaffMember[], rng: Rng): { world: World; userYouth: Player[] } {
  const userQuality = 50 * staffEffects(userStaff).youthQuality;
  const bySquad = new Map<string, number>();
  for (const p of world.players) if (p.clubId && !p.youth) bySquad.set(p.clubId, (bySquad.get(p.clubId) ?? 0) + 1);
  const added: Player[] = [];
  const userYouth: Player[] = [];
  for (const club of world.clubs) {
    const user = club.id === userClubId;
    const count = user ? rng.int(2, 4) : Math.max(rng.int(1, 3), 22 - (bySquad.get(club.id) ?? 0));
    for (let i = 0; i < count; i++) {
      const p = youthPlayer(club, nextSeason, i, user ? userQuality : 50, rng, user);
      p.contract = initialContract(p, club, nextSeason, rng);
      added.push(p);
      if (user) userYouth.push(p);
    }
  }
  return { world: { ...world, players: [...world.players, ...added] }, userYouth };
}

/**
 * Contracts that ended: AI clubs renew most of their players, others become free agents.
 * The user's players with an expired contract leave (the user should have renewed them).
 */
export function expireContracts(world: World, nextSeason: number, userClubId: string, rng: Rng): { world: World; userLeft: Player[]; freed: number } {
  const userLeft: Player[] = [];
  let freed = 0;
  const clubs = new Map(world.clubs.map((c) => [c.id, c]));
  const players = world.players.map((p) => {
    if (!p.clubId || !p.contract || p.contract.untilSeason >= nextSeason) return p;
    const club = clubs.get(p.clubId)!;
    if (p.clubId !== userClubId && rng.next() < 0.75) return { ...p, contract: initialContract(p, club, nextSeason, rng) };
    if (p.clubId === userClubId) userLeft.push(p);
    freed++;
    return { ...p, clubId: null };
  });
  return { world: { ...world, players }, userLeft, freed };
}

/** Moves an academy player into the first-team squad. */
export function promoteYouth(world: World, playerId: string): World {
  return { ...world, players: world.players.map((p) => (p.id === playerId ? { ...p, youth: false } : p)) };
}
