// Starting state of a club: stadium, staff, finances, sponsor and board.

import type { ClubState, Stadium, Tactics, Transaction } from '../game-types';
import type { Rng } from '../rng';
import type { Club, Division, Player, World } from '../types';
import { initialBoard } from './board';
import { annualSponsorValue, baseCapacity, clamp, estimatedAnnualRevenue, estimateWage, referenceTicketPrice } from './economy';
import { initialStaff } from './staff';

/** Placeholder tactics; the tactics module replaces them with the club's defaults. */
const PLACEHOLDER_TACTICS: Tactics = {
  formation: '4-4-2',
  mentality: 'equilibrada',
  pressing: 'media',
  tempo: 'normal',
  marking: 'zonal',
};

const SPONSORS_ARG = [
  'Banco del Plata', 'Cervecería Austral', 'TecnoSur', 'Aseguradora Andina', 'Lácteos La Pampa', 'Transportes del Litoral',
  'Supermercados El Ombú', 'Yerba Tres Ríos', 'Constructora Riachuelo', 'Telefonía Pampeana',
];
const SPONSORS_EUROPE = [
  'Nordline Telecom', 'Atlas Airways', 'Meridian Bank', 'Volta Energy', 'Bluecrest Insurance', 'Helix Motors',
  'Orion Bet', 'Silverline Logistics', 'Aurora Foods', 'Crown Digital',
];

/** Monthly wage of a player: contract when present, estimate otherwise. */
export const playerWage = (player: Player, club: Club, level: number) => player.contract?.wage ?? estimateWage(player, club, level);

export function initialStadium(club: Club, level: number, rng: Rng): Stadium {
  const capacity = Math.round((baseCapacity(club, level) * (0.88 + rng.next() * 0.24)) / 100) * 100;
  return {
    name: club.stadium,
    capacity: Math.max(500, capacity),
    ticketPrice: referenceTicketPrice(club, level),
    pitchQuality: clamp(Math.round(48 + club.reputation * 0.4 + rng.int(-8, 8)), 20, 98),
  };
}

export function initialClubState(club: Club, division: Division, world: World, season: number, rng: Rng): ClubState {
  const level = division.level;
  const stadium = initialStadium(club, level, rng);
  const staff = initialStaff(club, rng, level);

  const players = world.players.filter((p) => p.clubId === club.id);
  const wageBill = players.reduce((s, p) => s + playerWage(p, club, level), 0);
  const revenue = estimatedAnnualRevenue(club, level);
  const wageBudget = Math.round((1.2 * wageBill) / 1000) * 1000;
  const transferBudget = Math.round((revenue * (0.12 + 0.12 * rng.next())) / 10_000) * 10_000;
  const balance = Math.round((revenue * (0.08 + 0.25 * rng.next())) / 10_000) * 10_000;

  const names = club.country === 'ARG' ? SPONSORS_ARG : SPONSORS_EUROPE;
  const sponsor = {
    name: names[rng.int(0, names.length - 1)],
    perSeason: Math.round((annualSponsorValue(club, level) * (0.9 + 0.2 * rng.next())) / 1000) * 1000,
    untilSeason: season + rng.int(0, 2),
  };

  const opening: Transaction = {
    date: `${season}-01-01`,
    kind: 'otros',
    amount: balance,
    description: 'Saldo inicial de la temporada',
  };

  return {
    clubId: club.id,
    stadium,
    finances: { balance, transferBudget, wageBudget, sponsor, ledger: [opening] },
    staff,
    board: initialBoard(club, division, world),
    tactics: { ...PLACEHOLDER_TACTICS },
    shortlist: [],
  };
}
