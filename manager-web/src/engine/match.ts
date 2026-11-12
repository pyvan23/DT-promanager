// Match simulation. Goals for each side are Poisson draws whose expected value
// grows with the attack/defence gap. Simple on purpose: it is the baseline to tune
// against, and later versions can add tactics, form, morale and a minute-by-minute feed.

import { POSITION_LINE, type Player } from './types';
import type { Rng } from './rng';

export interface TeamStrength {
  attack: number; // 1-99
  defence: number; // 1-99
}

const BASE_GOALS = 1.25;
const HOME_ADVANTAGE = 1.15;

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 50;
}

/** Strength of an eleven, from its outfield and goalkeeping attributes. */
export function teamStrength(lineup: readonly Player[]): TeamStrength {
  const keeper = lineup.find((p) => p.position === 'ARQ');
  const outfield = lineup.filter((p) => p.position !== 'ARQ');
  const attack = avg(
    outfield.map((p) => {
      const a = p.attributes;
      const line = POSITION_LINE[p.position];
      const weight = line === 'DEL' ? 1.3 : line === 'MED' ? 1 : 0.5;
      return (
        weight * (0.25 * a.shooting + 0.15 * a.heading + 0.2 * a.dribbling + 0.2 * a.passing + 0.2 * a.quality)
      );
    }),
  ) / 0.95;
  const defence =
    0.6 *
      avg(
        outfield.map((p) => {
          const a = p.attributes;
          const line = POSITION_LINE[p.position];
          const weight = line === 'DEF' ? 1.3 : line === 'MED' ? 0.9 : 0.4;
          return weight * (0.45 * a.tackling + 0.25 * a.speed + 0.15 * a.stamina + 0.15 * a.quality);
        }),
      ) / 0.95 +
    0.4 * (keeper ? keeper.attributes.goalkeeping : 30);
  return { attack: Math.min(99, attack), defence: Math.min(99, defence) };
}

function poisson(lambda: number, rng: Rng): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = rng.next();
  while (p > limit) {
    k++;
    p *= rng.next();
  }
  return k;
}

export function expectedGoals(attacker: TeamStrength, defender: TeamStrength, home: boolean): number {
  // 40 keeps big mismatches near 4 total goals; smaller values made 80-vs-45 games average 6+.
  const gap = (attacker.attack - defender.defence) / 40;
  return BASE_GOALS * Math.exp(gap) * (home ? HOME_ADVANTAGE : 1);
}

export function simulateScore(
  home: TeamStrength,
  away: TeamStrength,
  rng: Rng,
  neutral = false,
): { homeGoals: number; awayGoals: number } {
  return {
    homeGoals: poisson(expectedGoals(home, away, !neutral), rng),
    awayGoals: poisson(expectedGoals(away, home, false), rng),
  };
}

/** Penalty shoot-out: five each, then sudden death. */
export function simulatePenalties(rng: Rng): { home: number; away: number } {
  const CONVERSION = 0.75;
  let home = 0;
  let away = 0;
  for (let i = 0; i < 5; i++) {
    if (rng.next() < CONVERSION) home++;
    if (rng.next() < CONVERSION) away++;
  }
  while (home === away) {
    const h = rng.next() < CONVERSION;
    const a = rng.next() < CONVERSION;
    home += h ? 1 : 0;
    away += a ? 1 : 0;
  }
  return { home, away };
}
