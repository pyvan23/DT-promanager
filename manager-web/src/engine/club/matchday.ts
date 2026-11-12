// Gate receipts: how many people come to a home match and how much they pay.

import type { ClubState, ScheduledMatch, Transaction } from '../game-types';
import type { Rng } from '../rng';
import type { ClubContext } from './club-types';
import { clamp, referenceTicketPrice } from './economy';
import { addTransactions } from './ledger';

export interface MatchdayOptions {
  /** Recent run of the team, -1 (awful) .. 1 (great); 0 when unknown. */
  form?: number;
  /** Price the public considers fair. Defaults to the market price of `context`, else the current price (no price effect). */
  referencePrice?: number;
  context?: ClubContext;
}

export interface MatchdayIncome {
  attendance: number;
  /** Null when the club is the away side of a match at the rival's ground (only the home club collects). */
  transaction: Transaction | null;
  /** Club state with the transaction applied. */
  clubState: ClubState;
}

/** Share of the gate each club receives at a neutral venue (the organiser keeps the rest). */
const NEUTRAL_SHARE = 0.4;

/**
 * Demand multiplier for a price `ratio` times the fair price. Elasticity grows with the price:
 * below the fair price demand is inelastic (raising prices brings more money), well above it
 * people stay home.
 */
export function priceDemandFactor(ratio: number): number {
  const r = Math.max(0.05, ratio);
  return Math.pow(1 / r, 0.5 + 0.5 * r);
}

export function matchdayIncome(
  clubState: ClubState,
  match: ScheduledMatch,
  opponentReputation: number,
  clubReputation: number,
  competitionImportance: number,
  rng: Rng,
  options: MatchdayOptions = {},
): MatchdayIncome {
  const isHome = match.homeId === clubState.clubId;
  const isAway = match.awayId === clubState.clubId;
  if (!match.neutral && !isHome) return { attendance: 0, transaction: null, clubState };
  if (match.neutral && !isHome && !isAway) return { attendance: 0, transaction: null, clubState };

  const { stadium } = clubState;
  const fair =
    options.referencePrice ??
    (options.context ? referenceTicketPrice(options.context.club, options.context.division.level) : stadium.ticketPrice);
  const fill = 0.45 + 0.55 * (clamp(clubReputation, 1, 99) / 99);
  const rival = 0.8 + 0.45 * (clamp(opponentReputation, 1, 99) / 99);
  const importance = 0.85 + 0.35 * clamp(competitionImportance, 0, 1);
  const form = 1 + 0.12 * clamp(options.form ?? 0, -1, 1);
  const pitch = 0.95 + 0.1 * (stadium.pitchQuality / 100);
  const price = priceDemandFactor(stadium.ticketPrice / Math.max(0.5, fair));
  const noise = 0.92 + 0.16 * rng.next();
  const demand = stadium.capacity * fill * rival * importance * form * pitch * price * noise;
  const attendance = Math.max(0, Math.min(stadium.capacity, Math.round(demand)));

  const share = match.neutral ? NEUTRAL_SHARE : 1;
  const amount = Math.round(attendance * stadium.ticketPrice * share);
  const transaction: Transaction = {
    date: match.date,
    kind: 'taquilla',
    amount,
    description: `Taquilla: ${attendance.toLocaleString('es-AR')} espectadores${match.neutral ? ' (cancha neutral)' : ''}`,
  };
  return { attendance, transaction, clubState: addTransactions(clubState, [transaction]) };
}
