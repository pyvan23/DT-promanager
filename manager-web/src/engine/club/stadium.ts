// Stadium management: expansions, ticket prices and the pitch.

import type { ClubState, Stadium } from '../game-types';
import type { ExpansionOption, StadiumWork } from './club-types';
import { clamp } from './economy';
import { addDays, addTransactions } from './ledger';

export const MAX_CAPACITY = 110_000;
const BLOCKS = [2_000, 5_000, 10_000, 20_000];

/** Building cost per seat, tied to the local price level (a seat costs more in London than in Morón). */
export const costPerSeat = (stadium: Stadium) => Math.round(400 + 45 * stadium.ticketPrice);

/** Available expansions in blocks of seats, with cost and construction time. */
export function expansionOptions(stadium: Stadium): ExpansionOption[] {
  return BLOCKS.filter((seats) => stadium.capacity + seats <= MAX_CAPACITY).map((seats) => ({
    seats,
    cost: Math.round((seats * costPerSeat(stadium)) / 1000) * 1000,
    days: Math.round(60 + seats / 50),
    newCapacity: stadium.capacity + seats,
  }));
}

/**
 * Starts an expansion: the cost is paid now, the seats arrive at `work.readyDate`
 * (apply them with `completeWorks`).
 */
export function applyExpansion(state: ClubState, option: ExpansionOption, date: string): { clubState: ClubState; work: StadiumWork } {
  const work: StadiumWork = { seats: option.seats, startDate: date, readyDate: addDays(date, option.days) };
  const clubState = addTransactions(state, [
    { date, kind: 'estadio', amount: -option.cost, description: `Ampliación del estadio: ${option.seats.toLocaleString('es-AR')} lugares` },
  ]);
  return { clubState, work };
}

/** Adds the seats of every work finished by `date`; returns the works still under way. */
export function completeWorks(state: ClubState, works: readonly StadiumWork[], date: string): { clubState: ClubState; pending: StadiumWork[] } {
  const done = works.filter((w) => w.readyDate <= date);
  const pending = works.filter((w) => w.readyDate > date);
  if (done.length === 0) return { clubState: state, pending };
  const seats = done.reduce((s, w) => s + w.seats, 0);
  const capacity = Math.min(MAX_CAPACITY, state.stadium.capacity + seats);
  return { clubState: { ...state, stadium: { ...state.stadium, capacity } }, pending };
}

export function setTicketPrice(state: ClubState, price: number): ClubState {
  const ticketPrice = clamp(Math.round(price * 2) / 2, 1, 1000);
  return { ...state, stadium: { ...state.stadium, ticketPrice } };
}

/** Cost of raising the pitch quality by `points`. */
export function pitchImprovementCost(stadium: Stadium, points: number): number {
  const real = clamp(Math.round(points), 0, 100 - stadium.pitchQuality);
  return Math.round(real * (200 + stadium.capacity * stadium.ticketPrice * 0.004));
}

/** Improves the pitch by `points` (capped at 100), paying for it. */
export function improvePitch(state: ClubState, points: number, date: string): ClubState {
  const real = clamp(Math.round(points), 0, 100 - state.stadium.pitchQuality);
  if (real === 0) return state;
  const cost = pitchImprovementCost(state.stadium, real);
  const next = { ...state, stadium: { ...state.stadium, pitchQuality: state.stadium.pitchQuality + real } };
  return addTransactions(next, [{ date, kind: 'estadio', amount: -cost, description: `Mejora del césped (+${real})` }]);
}
