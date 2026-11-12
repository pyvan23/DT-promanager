// Fixtures for the matchday tests: synthetic squads around a given level.

import type { Player, Position } from '../types';
import type { PlayerCondition, TeamSheet } from '../game-types';
import { createRng } from '../rng';
import { autoLineup, defaultTactics } from './formations';

const SQUAD: [Position, number][] = [
  ['ARQ', 3], ['LD', 2], ['DFC', 4], ['LI', 2], ['MCD', 2], ['MC', 3], ['MD', 1], ['MI', 1], ['MCO', 1], ['ED', 1], ['EI', 1], ['DC', 3],
];

export function makeSquad(clubId: string, level: number, seed = 1): Player[] {
  const rng = createRng(seed);
  const players: Player[] = [];
  let n = 0;
  for (const [position, count] of SQUAD) {
    for (let i = 0; i < count; i++) {
      const v = () => Math.max(1, Math.min(99, level + rng.int(-8, 8)));
      const gk = position === 'ARQ';
      const attributes = {
        speed: v(), stamina: v(), aggression: v(), quality: v(), passing: v(), dribbling: v(),
        goalkeeping: gk ? v() : 15, tackling: gk ? 25 : v(), shooting: gk ? 20 : v(), heading: gk ? 25 : v(),
      };
      players.push({
        id: `${clubId}-${++n}`, name: `${clubId.toUpperCase()} Jugador ${n}`, birthDate: '1998-01-01', nationality: 'ARG',
        position, altPositions: [], attributes, clubId,
      });
    }
  }
  return players;
}

export function sheetFor(clubId: string, squad: Player[], cond?: (p: Player) => PlayerCondition | undefined): TeamSheet {
  const tactics = defaultTactics();
  return { clubId, tactics, lineup: autoLineup(squad, tactics.formation, cond) };
}

export function playersMap(...squads: Player[][]): Map<string, Player> {
  return new Map(squads.flat().map((p) => [p.id, p]));
}
