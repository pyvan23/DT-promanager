// Prize money per competition. Continental cups dwarf domestic ones: reaching the Champions
// League round of 16 pays more than winning the Copa Argentina dozens of times.

import type { Transaction } from '../game-types';
import type { World } from '../types';
import type { PrizeEvent } from './club-types';
import { averageTvIncome, countryEconomy } from './economy';

export interface CupPrizeTable {
  participation: number;
  win: number;
  draw: number;
  /** Bonus for reaching a knockout round, by rounds from the final: [final, semifinal, quarterfinal, ...]. */
  rounds: number[];
  runnerUp: number;
  /** Extra bonus for lifting the trophy. */
  champion: number;
}

export const CUP_PRIZES: Record<string, CupPrizeTable> = {
  'champions-league': { participation: 20e6, win: 2.3e6, draw: 0.7e6, rounds: [18.5e6, 15e6, 12.5e6, 11e6, 1e6], runnerUp: 0, champion: 6.5e6 },
  'europa-league': { participation: 4.3e6, win: 0.45e6, draw: 0.15e6, rounds: [7e6, 2.8e6, 1.8e6, 1.2e6, 0.3e6], runnerUp: 0, champion: 6e6 },
  'conference-league': { participation: 3.2e6, win: 0.4e6, draw: 0.13e6, rounds: [3e6, 2e6, 1.3e6, 0.8e6, 0.2e6], runnerUp: 0, champion: 2e6 },
  'uefa-supercup': { participation: 4e6, win: 0, draw: 0, rounds: [], runnerUp: 0, champion: 1e6 },
  'copa-libertadores': { participation: 3e6, win: 0.33e6, draw: 0, rounds: [7e6, 2.3e6, 1.7e6, 1.25e6, 1e6], runnerUp: 0, champion: 16e6 },
  'copa-sudamericana': { participation: 0.9e6, win: 0.1e6, draw: 0, rounds: [2e6, 1e6, 0.8e6, 0.6e6, 0.5e6], runnerUp: 0, champion: 4.5e6 },
  'copa-argentina': { participation: 15e3, win: 0, draw: 0, rounds: [150e3, 80e3, 50e3, 35e3, 25e3, 15e3], runnerUp: 0, champion: 450e3 },
};

/** Domestic cups of European countries (`eng-cup`, ...): scaled by the country's TV money. */
function domesticCupTable(country: string): CupPrizeTable {
  const base = countryEconomy(country).tvTop * 0.03;
  return {
    participation: base * 0.01,
    win: 0,
    draw: 0,
    rounds: [0.5, 0.3, 0.15, 0.08, 0.04, 0.02].map((f) => base * f),
    runnerUp: 0,
    champion: base * 0.5,
  };
}

function cupTable(world: World, competitionId: string): CupPrizeTable | undefined {
  if (CUP_PRIZES[competitionId]) return CUP_PRIZES[competitionId];
  const def = world.competitions.find((c) => c.id === competitionId);
  if (def?.scope === 'domestic' && def.country) return domesticCupTable(def.country);
  if (def) return domesticCupTable('');
  return undefined;
}

function roundPrize(rounds: number[], roundsFromFinal: number): number {
  if (rounds.length === 0 || roundsFromFinal < 0) return 0;
  if (roundsFromFinal < rounds.length) return rounds[roundsFromFinal];
  return rounds[rounds.length - 1] * Math.pow(0.5, roundsFromFinal - rounds.length + 1);
}

/** Prize money for an achievement in a competition (a cup id or a division id). 0 when it pays nothing. */
export function prizeAmount(world: World, competitionId: string, event: PrizeEvent): number {
  const division = world.divisions.find((d) => d.id === competitionId);
  if (division) {
    const pool = averageTvIncome(division.country, division.level);
    switch (event.kind) {
      case 'champion':
        return Math.round(pool * 0.15);
      case 'runner-up':
        return Math.round(pool * 0.06);
      case 'promotion': {
        const target = division.promotion ? world.divisions.find((d) => d.id === division.promotion!.to) : undefined;
        return target ? Math.round(averageTvIncome(target.country, target.level) * 0.1) : 0;
      }
      default:
        return 0;
    }
  }
  const table = cupTable(world, competitionId);
  if (!table) return 0;
  const amount = (() => {
    switch (event.kind) {
      case 'participation':
        return table.participation;
      case 'win':
        return table.win;
      case 'draw':
        return table.draw;
      case 'round':
        return roundPrize(table.rounds, event.roundsFromFinal);
      case 'runner-up':
        return table.runnerUp;
      case 'champion':
        return table.champion;
      case 'promotion':
        return 0;
    }
  })();
  return Math.round(amount);
}

const EVENT_TEXT: Record<PrizeEvent['kind'], string> = {
  participation: 'participación',
  win: 'partido ganado',
  draw: 'partido empatado',
  round: 'clasificación de ronda',
  'runner-up': 'subcampeonato',
  champion: 'campeonato',
  promotion: 'ascenso',
};

/** Prize as a ledger entry (amount 0 when the event pays nothing; `addTransactions` drops those). */
export function prizeTransaction(world: World, competitionId: string, event: PrizeEvent, date: string): Transaction {
  const name =
    world.competitions.find((c) => c.id === competitionId)?.name ??
    world.divisions.find((d) => d.id === competitionId)?.name ??
    competitionId;
  return { date, kind: 'premios', amount: prizeAmount(world, competitionId, event), description: `Premio por ${EVENT_TEXT[event.kind]}: ${name}` };
}
