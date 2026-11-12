// Squad helpers: player ratings per line and picking a starting eleven.

import { POSITION_LINE, type Line, type Player } from './types';

/** Rating of a player in a line of the pitch, 1-99. */
export function lineRating(p: Player, line: Line): number {
  const a = p.attributes;
  switch (line) {
    case 'ARQ':
      return 0.7 * a.goalkeeping + 0.15 * a.quality + 0.15 * a.speed;
    case 'DEF':
      return 0.35 * a.tackling + 0.15 * a.heading + 0.15 * a.speed + 0.1 * a.stamina + 0.1 * a.aggression + 0.15 * a.quality;
    case 'MED':
      return 0.3 * a.passing + 0.15 * a.dribbling + 0.15 * a.stamina + 0.15 * a.tackling + 0.25 * a.quality;
    case 'DEL':
      return 0.3 * a.shooting + 0.2 * a.heading + 0.2 * a.dribbling + 0.1 * a.speed + 0.2 * a.quality;
  }
}

/** Overall rating in the player's main position. */
export function overall(p: Player): number {
  return Math.round(lineRating(p, POSITION_LINE[p.position]));
}

/** Default formation 4-4-2. */
const FORMATION: Record<Line, number> = { ARQ: 1, DEF: 4, MED: 4, DEL: 2 };

/**
 * Best eleven for the formation, filling each line with the best players whose main
 * position is in that line; gaps are covered by the best remaining players.
 */
export function bestEleven(squad: readonly Player[]): Player[] {
  const used = new Set<string>();
  const eleven: Player[] = [];
  for (const line of ['ARQ', 'DEF', 'MED', 'DEL'] as Line[]) {
    const candidates = squad
      .filter((p) => !used.has(p.id) && POSITION_LINE[p.position] === line)
      .sort((a, b) => lineRating(b, line) - lineRating(a, line))
      .slice(0, FORMATION[line]);
    for (const p of candidates) {
      used.add(p.id);
      eleven.push(p);
    }
  }
  const missing = 11 - eleven.length;
  if (missing > 0) {
    const rest = squad.filter((p) => !used.has(p.id)).sort((a, b) => overall(b) - overall(a));
    eleven.push(...rest.slice(0, missing));
  }
  return eleven;
}
