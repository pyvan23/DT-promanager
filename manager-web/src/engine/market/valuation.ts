// Market value and fair wage of a player, in US dollars.
//
// Calibration (approximate real orders of magnitude):
//   Premier League star (overall ~90, prime age)        ~60-120 M
//   Liga Profesional (ARG) regular starter (overall ~70) ~1-8 M
//   Primera C (ARG, overall ~30)                        ~10-50 k

import type { Club, Player } from '../types';
import { overall } from '../squad';

/** How much each country's market pays relative to Argentina (= 1). */
export const COUNTRY_MARKET: Record<string, number> = {
  ENG: 2.6,
  ESP: 1.9,
  ITA: 1.8,
  DEU: 1.8,
  FRA: 1.6,
  PRT: 1.25,
  NLD: 1.25,
  TUR: 1.1,
  BEL: 1.05,
  SCO: 0.85,
  ARG: 1,
};

/** Rough minimum monthly wage of a professional squad player per country. */
export const COUNTRY_MIN_WAGE: Record<string, number> = {
  ENG: 4000,
  ESP: 3000,
  ITA: 3000,
  DEU: 3000,
  FRA: 3000,
  PRT: 1500,
  NLD: 2500,
  TUR: 2000,
  BEL: 2500,
  SCO: 1500,
  ARG: 500,
};

const marketOf = (country: string) => COUNTRY_MARKET[country] ?? 1;

/** Age in whole years on a given ISO date. */
export function ageOn(birthDate: string, date: string): number {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = date.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

/** Age used for valuations during a season (calendar-year seasons: age at mid-year). */
export const ageInSeason = (player: Player, season: number) => ageOn(player.birthDate, `${season}-07-01`);

/** Extra overall points a young player is "worth" for his potential. */
export function potentialBonus(age: number, ov = 60): number {
  if (age >= 24) return 0;
  const raw = age <= 17 ? 10 : [8, 6, 5, 3, 2, 1][age - 18];
  // Little room left to grow for players already close to the ceiling.
  return raw * Math.max(0, Math.min(1, (99 - ov) / 25));
}

/** Value multiplier for age: flat at the 24-28 peak, falling hard after 32. */
export function ageFactor(age: number): number {
  if (age <= 28) return 1;
  const table = [0.82, 0.66, 0.52, 0.38, 0.24, 0.15, 0.09, 0.05, 0.03];
  return table[Math.min(age - 29, table.length - 1)];
}

/** Multiplier for the seasons left on the contract (selling clubs lose leverage). */
export function contractFactor(player: Player, season: number): number {
  if (!player.contract) return 1;
  const left = player.contract.untilSeason - season + 1;
  if (left <= 0) return 0.25;
  if (left === 1) return 0.65;
  if (left === 2) return 0.88;
  return 1;
}

/** Reputation adjusts within a country's market (big clubs sell dearer). */
const reputationFactor = (club: Club | null | undefined) => (club ? 0.75 + (0.5 * club.reputation) / 99 : 0.85);

/** Core curve: value of an overall at prime age in the reference (Argentine) market. */
const coreValue = (ov: number) =>
  3_000_000 * Math.exp(0.12 * (Math.min(ov, 85) - 70) + 0.08 * Math.max(0, ov - 85));

/**
 * Market value in USD. `club` is the player's current club (null for free agents, valued
 * as if in an average market of his nationality's level).
 */
export function playerValue(player: Player, club: Club | null | undefined, season: number): number {
  const age = ageInSeason(player, season);
  const base = overall(player);
  const ov = base + potentialBonus(age, base);
  const market = club ? marketOf(club.country) : 1;
  const value = coreValue(ov) * ageFactor(age) * contractFactor(player, season) * market * reputationFactor(club);
  return roundMoney(value);
}

/**
 * Reasonable monthly wage in USD at `club` (the club paying it). Veterans keep earning more
 * than their market value suggests; youngsters earn for their current level, not potential.
 */
export function fairWage(player: Player, club: Club | null | undefined, season: number): number {
  const age = ageInSeason(player, season);
  const market = club ? marketOf(club.country) : 1;
  const ageW = Math.max(ageFactor(age), age >= 33 ? 0.35 : 0.6);
  const youthW = age <= 20 ? 0.6 : age <= 22 ? 0.8 : 1;
  const base = coreValue(overall(player)) * ageW * youthW * market * reputationFactor(club);
  const wage = 0.03 * Math.pow(base, 0.95);
  const floor = COUNTRY_MIN_WAGE[club?.country ?? 'ARG'] ?? 500;
  return roundMoney(Math.max(floor, wage));
}

/** Rounds money to 2 significant-ish figures so numbers look like real fees. */
export function roundMoney(x: number): number {
  if (x <= 0) return 0;
  const step = x >= 10_000_000 ? 100_000 : x >= 1_000_000 ? 50_000 : x >= 100_000 ? 5_000 : x >= 10_000 ? 500 : 50;
  return Math.max(step, Math.round(x / step) * step);
}
