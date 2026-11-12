// Economic calibration shared by the club module: how much money each country and tier moves.
// All amounts in US dollars. Figures are rough orders of magnitude, not real club accounts:
// a Premier League giant moves hundreds of millions a year, an Argentine Primera C club a few
// hundred thousand.

import { COUNTRY_STRENGTH } from '../../data/europe';
import type { Club, Player } from '../types';

export interface CountryEconomy {
  /** Average yearly TV income of a top-flight club. */
  tvTop: number;
  /** Yearly shirt/main sponsor value of an average top-flight club. */
  sponsorTop: number;
  /** Average ticket price in the top flight. */
  ticketTop: number;
  /** Share of revenue spent on player wages. */
  wageShare: number;
  /** Stadium size multiplier (European grounds are bigger for the same stature). */
  stadiumScale: number;
  /** Monthly club membership ("cuota social") as a share of the ticket price; 0 = no member income. */
  memberFee: number;
}

const ECONOMY: Record<string, CountryEconomy> = {
  ENG: { tvTop: 150e6, sponsorTop: 40e6, ticketTop: 75, wageShare: 0.62, stadiumScale: 1.15, memberFee: 0 },
  ESP: { tvTop: 70e6, sponsorTop: 25e6, ticketTop: 55, wageShare: 0.6, stadiumScale: 1.25, memberFee: 0.3 },
  ITA: { tvTop: 55e6, sponsorTop: 18e6, ticketTop: 40, wageShare: 0.62, stadiumScale: 1.25, memberFee: 0 },
  DEU: { tvTop: 60e6, sponsorTop: 25e6, ticketTop: 35, wageShare: 0.55, stadiumScale: 1.3, memberFee: 0.2 },
  FRA: { tvTop: 35e6, sponsorTop: 15e6, ticketTop: 35, wageShare: 0.65, stadiumScale: 1.2, memberFee: 0 },
  PRT: { tvTop: 12e6, sponsorTop: 6e6, ticketTop: 22, wageShare: 0.6, stadiumScale: 1.15, memberFee: 0.4 },
  NLD: { tvTop: 10e6, sponsorTop: 7e6, ticketTop: 30, wageShare: 0.6, stadiumScale: 1.0, memberFee: 0 },
  BEL: { tvTop: 8e6, sponsorTop: 5e6, ticketTop: 25, wageShare: 0.6, stadiumScale: 0.9, memberFee: 0 },
  SCO: { tvTop: 4e6, sponsorTop: 4e6, ticketTop: 32, wageShare: 0.6, stadiumScale: 1.05, memberFee: 0 },
  TUR: { tvTop: 18e6, sponsorTop: 8e6, ticketTop: 18, wageShare: 0.7, stadiumScale: 1.15, memberFee: 0.2 },
  ARG: { tvTop: 4.5e6, sponsorTop: 2.5e6, ticketTop: 14, wageShare: 0.6, stadiumScale: 1.0, memberFee: 0.7 },
};

const DEFAULT_ECONOMY: CountryEconomy = { tvTop: 6e6, sponsorTop: 3e6, ticketTop: 18, wageShare: 0.6, stadiumScale: 1, memberFee: 0.2 };

export const countryEconomy = (country: string): CountryEconomy => ECONOMY[country] ?? DEFAULT_ECONOMY;


/** Typical (middle) reputation of a division level, before the country bonus. */
const LEVEL_MID_REP: Record<number, number> = { 1: 65, 2: 52, 3: 44, 4: 36, 5: 28 };

/** Reputation of an average club of that country and level. */
export function referenceReputation(country: string, level: number): number {
  return (LEVEL_MID_REP[Math.min(5, Math.max(1, level))] ?? 28) + (COUNTRY_STRENGTH[country] ?? 0);
}

/** Share of top-flight TV money that each level gets. */
function tvLevelFactor(country: string, level: number): number {
  if (level <= 1) return 1;
  if (country === 'ARG') return [1, 1, 0.1, 0.025, 0.006, 0.002][Math.min(5, level)];
  return level === 2 ? (country === 'ENG' ? 0.08 : 0.12) : 0.02;
}

function sponsorLevelFactor(country: string, level: number): number {
  if (level <= 1) return 1;
  if (country === 'ARG') return [1, 1, 0.15, 0.04, 0.012, 0.005][Math.min(5, level)];
  return level === 2 ? 0.15 : 0.04;
}

function priceLevelFactor(level: number): number {
  return [1, 1, 0.55, 0.4, 0.3, 0.25][Math.min(5, Math.max(1, level))];
}

/** Guess the level of a club from its reputation, for callers that do not know its division. */
export function guessLevel(club: Club): number {
  let best = 1;
  let bestGap = Infinity;
  for (let level = 1; level <= 5; level++) {
    const gap = Math.abs(club.reputation - referenceReputation(club.country, level));
    if (gap < bestGap) {
      bestGap = gap;
      best = level;
    }
  }
  return best;
}

/**
 * Expected stadium capacity (no randomness): grows exponentially with stature. A top Argentine
 * club (rep ~77) lands near 60k, a Primera C club (rep ~30) near 5k, a European giant 70-85k.
 */
export function baseCapacity(club: Club, level: number): number {
  const eco = countryEconomy(club.country);
  const stature = club.reputation - (COUNTRY_STRENGTH[club.country] ?? 0);
  const lowerTierPenalty = level >= 5 ? 0.6 : 1;
  const raw = 5000 * Math.exp(0.0529 * (stature - 30)) * eco.stadiumScale * lowerTierPenalty;
  return Math.round(Math.min(85_000, Math.max(800, raw)) / 100) * 100;
}

/** Ticket price the market expects for this club. */
export function referenceTicketPrice(club: Club, level: number): number {
  const eco = countryEconomy(club.country);
  const rel = club.reputation - referenceReputation(club.country, level);
  const price = eco.ticketTop * priceLevelFactor(level) * Math.exp(0.015 * rel);
  return Math.max(1, Math.round(price * 2) / 2);
}

export function annualTvIncome(club: Club, level: number): number {
  const eco = countryEconomy(club.country);
  const rel = club.reputation - referenceReputation(club.country, level);
  return Math.round(eco.tvTop * tvLevelFactor(club.country, level) * Math.exp(0.03 * rel));
}

export function annualSponsorValue(club: Club, level: number): number {
  const eco = countryEconomy(club.country);
  const rel = club.reputation - referenceReputation(club.country, level);
  return Math.round(eco.sponsorTop * sponsorLevelFactor(club.country, level) * Math.exp(0.05 * rel));
}

/** Monthly membership income ("cuotas sociales"), relevant mostly for Argentine clubs. */
export function monthlyMemberIncome(club: Club, level: number, capacity = baseCapacity(club, level)): number {
  const eco = countryEconomy(club.country);
  return Math.round(capacity * 0.8 * referenceTicketPrice(club, level) * eco.memberFee);
}

/** Expected yearly revenue: TV + sponsor + gate (19 home league games at ~80%) + members + merchandising. */
export function estimatedAnnualRevenue(club: Club, level: number): number {
  const capacity = baseCapacity(club, level);
  const gate = capacity * 0.8 * referenceTicketPrice(club, level) * 19;
  const core = annualTvIncome(club, level) + annualSponsorValue(club, level) + gate + monthlyMemberIncome(club, level, capacity) * 12;
  return Math.round(core * 1.08); // merchandising and other income
}

/** Average monthly wage of a first-team player of this club. */
export function averagePlayerWage(club: Club, level: number, squadSize = 28): number {
  const eco = countryEconomy(club.country);
  return (estimatedAnnualRevenue(club, level) * eco.wageShare) / 12 / squadSize;
}

/** Monthly wage estimate for a player without a contract: better players earn more than the club average. */
export function estimateWage(player: Player, club: Club, level: number): number {
  const avg = averagePlayerWage(club, level);
  const factor = Math.exp(0.08 * (player.attributes.quality - club.reputation + 2));
  const youth = player.youth ? 0.1 : 1;
  return Math.max(150, Math.round((avg * factor * youth) / 10) * 10);
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Yearly TV income of an average club of that country and level. */
export const averageTvIncome = (country: string, level: number): number =>
  Math.round(countryEconomy(country).tvTop * tvLevelFactor(country, level));
