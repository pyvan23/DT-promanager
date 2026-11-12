// Player contracts: initial contracts for new worlds, renewal demands and whether a player
// accepts an offered contract.

import type { Contract } from '../game-types';
import type { Rng } from '../rng';
import type { Club, Player, World } from '../types';
import { overall } from '../squad';
import { COUNTRY_MARKET, ageInSeason, fairWage, playerValue, roundMoney } from './valuation';

/** Chance that a contract in each country carries a release clause (Spain: mandatory). */
export const RELEASE_CLAUSE_CHANCE: Record<string, number> = {
  ESP: 1,
  PRT: 0.8,
  ARG: 0.5,
  TUR: 0.3,
  FRA: 0.1,
  ITA: 0.1,
};

/** Clause as a multiple of market value, [min, max]. */
const CLAUSE_MULTIPLE: Record<string, [number, number]> = {
  ESP: [2.5, 6],
  PRT: [2, 5],
  ARG: [1.5, 3.5],
};

/** Typical contract length in seasons for an age. */
export function contractYears(age: number): [number, number] {
  if (age <= 28) return [2, 5];
  if (age <= 31) return [1, 3];
  if (age <= 33) return [1, 2];
  return [1, 1];
}

function releaseClause(player: Player, club: Club, season: number, rng: Rng): number | undefined {
  const chance = RELEASE_CLAUSE_CHANCE[club.country] ?? 0.05;
  if (rng.next() >= chance) return undefined;
  const [lo, hi] = CLAUSE_MULTIPLE[club.country] ?? [2, 4];
  // Clause is set on the value with a full-length contract, so it does not shrink over time.
  const fullValue = playerValue({ ...player, contract: undefined }, club, season);
  return roundMoney(Math.max(fullValue * (lo + rng.next() * (hi - lo)), 50_000));
}

/** Contract for a player in a world created without contracts. */
export function initialContract(player: Player, club: Club, season: number, rng: Rng): Contract {
  const [lo, hi] = contractYears(ageInSeason(player, season));
  const years = rng.int(lo, hi);
  const wage = roundMoney(fairWage(player, club, season) * (0.8 + rng.next() * 0.4));
  const clause = releaseClause(player, club, season, rng);
  return {
    wage,
    untilSeason: season + years - 1,
    ...(clause !== undefined ? { releaseClause: clause } : {}),
    insured: false,
  };
}

/** Returns a new world where every player with a club and no contract gets one. */
export function withInitialContracts(world: World, rng: Rng): World {
  const clubs = new Map(world.clubs.map((c) => [c.id, c]));
  return {
    ...world,
    players: world.players.map((p) => {
      const club = p.clubId ? clubs.get(p.clubId) : undefined;
      return club && !p.contract ? { ...p, contract: initialContract(p, club, world.season, rng) } : p;
    }),
  };
}

/**
 * What the player asks to renew with his club: a raise over his fair wage when he is good
 * for the club's level, and a length that depends on his age. Renewals start next season.
 */
export function renewalDemand(player: Player, club: Club, season: number): Contract {
  const age = ageInSeason(player, season + 1);
  const fair = fairWage(player, club, season);
  const current = player.contract?.wage ?? 0;
  // A player above the club's level knows he could leave, and asks for more.
  const leverage = Math.max(0, Math.min(0.4, (overall(player) - club.reputation) / 50));
  const wage = roundMoney(Math.max(current * 1.05, fair * (1.1 + leverage)));
  const [lo, hi] = contractYears(age);
  const years = Math.round((lo + hi) / 2);
  const clauseMul = CLAUSE_MULTIPLE[club.country];
  const contract: Contract = { wage, untilSeason: season + years, insured: player.contract?.insured ?? false };
  if (clauseMul && (RELEASE_CLAUSE_CHANCE[club.country] ?? 0) >= 0.5) {
    const fullValue = playerValue({ ...player, contract: undefined }, club, season);
    contract.releaseClause = roundMoney(fullValue * ((clauseMul[0] + clauseMul[1]) / 2));
  }
  return contract;
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Probability (0-1) that the player signs `offered` with `buyingClub`. Ambition: he prefers
 * higher reputation clubs and stronger leagues, and above all a better wage. Renewals are
 * the case buyingClub === sellingClub. `sellingClub` null = free agent.
 */
export function contractAcceptanceChance(
  player: Player,
  currentContract: Contract | undefined,
  offered: Contract,
  buyingClub: Club,
  sellingClub: Club | null,
  season: number,
): number {
  const age = ageInSeason(player, season);
  const renewal = sellingClub !== null && sellingClub.id === buyingClub.id;
  // Reference wage: what he earns now (or would fairly earn at the buying club if he has nothing).
  const reference = renewal
    ? renewalDemand(player, buyingClub, season).wage
    : Math.max(currentContract?.wage ?? 0, fairWage(player, buyingClub, season) * (sellingClub ? 0.9 : 0.7));
  let u = 3 * Math.log(Math.max(1, offered.wage) / Math.max(1, reference));
  if (!renewal) {
    const fromRep = sellingClub?.reputation ?? Math.max(1, overall(player) - 10);
    u += (buyingClub.reputation - fromRep) / 10;
    const fromMarket = COUNTRY_MARKET[sellingClub?.country ?? ''] ?? 1;
    u += 0.6 * Math.log((COUNTRY_MARKET[buyingClub.country] ?? 1) / fromMarket);
    // A player far above the club's level does not want to go there.
    u -= Math.max(0, overall(player) - buyingClub.reputation - 12) / 6;
    // Free agents want a job: the bar is lower.
    if (!sellingClub) u += 1;
  }
  // Older players value security; young ones flexibility (mild).
  const years = offered.untilSeason - season + 1;
  u += age >= 30 ? 0.25 * Math.min(years - 1, 3) : 0;
  if (years <= 0) return 0;
  return sigmoid(2 * u + (renewal ? 0.3 : 0.5));
}

/** Rolls whether the player accepts the offered contract. */
export function playerAcceptsContract(
  player: Player,
  currentContract: Contract | undefined,
  offeredContract: Contract,
  buyingClub: Club,
  sellingClub: Club | null,
  season: number,
  rng: Rng,
): boolean {
  return rng.next() < contractAcceptanceChance(player, currentContract, offeredContract, buyingClub, sellingClub, season);
}

/** Players under contract whose deal ends with `season` (or earlier), with a club. */
export function expiringPlayers(world: World, season: number): Player[] {
  return world.players.filter((p) => p.clubId !== null && p.contract !== undefined && p.contract.untilSeason <= season);
}
