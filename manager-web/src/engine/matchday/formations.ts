// Formation slots (for the pitch view and for the engine) and automatic lineup selection.

import { POSITION_LINE, type Line, type Player, type Position } from '../types';
import type { Formation, Lineup, PlayerCondition, Tactics } from '../game-types';
import { lineRating } from '../squad';

/** One place in a formation. Coordinates are 0-100: x left→right, y own goal (0) → rival goal (100). */
export interface FormationSlot {
  position: Position;
  x: number;
  y: number;
}

const s = (position: Position, x: number, y: number): FormationSlot => ({ position, x, y });
const GK = s('ARQ', 50, 5);
const BACK4 = [s('LD', 85, 26), s('DFC', 62, 20), s('DFC', 38, 20), s('LI', 15, 26)];
const BACK3 = [s('DFC', 74, 22), s('DFC', 50, 19), s('DFC', 26, 22)];

export const FORMATION_SLOTS: Record<Formation, FormationSlot[]> = {
  '4-4-2': [GK, ...BACK4, s('MD', 85, 54), s('MC', 60, 50), s('MC', 40, 50), s('MI', 15, 54), s('DC', 60, 80), s('DC', 40, 80)],
  '4-3-3': [GK, ...BACK4, s('MC', 68, 50), s('MCD', 50, 42), s('MC', 32, 50), s('ED', 82, 78), s('DC', 50, 84), s('EI', 18, 78)],
  '4-2-3-1': [GK, ...BACK4, s('MCD', 62, 40), s('MCD', 38, 40), s('MD', 82, 62), s('MCO', 50, 64), s('MI', 18, 62), s('DC', 50, 85)],
  '3-5-2': [GK, ...BACK3, s('MD', 88, 52), s('MC', 65, 48), s('MCD', 50, 40), s('MC', 35, 48), s('MI', 12, 52), s('DC', 60, 80), s('DC', 40, 80)],
  '5-3-2': [GK, s('LD', 88, 32), s('DFC', 70, 20), s('DFC', 50, 18), s('DFC', 30, 20), s('LI', 12, 32), s('MC', 68, 48), s('MCD', 50, 44), s('MC', 32, 48), s('DC', 60, 78), s('DC', 40, 78)],
  '4-5-1': [GK, ...BACK4, s('MD', 85, 56), s('MC', 65, 50), s('MCD', 50, 42), s('MC', 35, 50), s('MI', 15, 56), s('DC', 50, 82)],
  '3-4-3': [GK, ...BACK3, s('MD', 85, 50), s('MC', 60, 46), s('MC', 40, 46), s('MI', 15, 50), s('ED', 80, 78), s('DC', 50, 84), s('EI', 20, 78)],
};

export const FORMATIONS = Object.keys(FORMATION_SLOTS) as Formation[];

/** Rating penalty for playing `p` in `slot`: main position 0, alternative -5, same line -12, other line -30. */
export function positionPenalty(p: Player, slot: Position): number {
  if (p.position === slot) return 0;
  if (p.altPositions.includes(slot)) return -5;
  if (POSITION_LINE[p.position] === POSITION_LINE[slot]) return -12;
  return -30;
}

/** Rating of `p` playing in `slot` (1-99 scale, out-of-position penalty included). */
export function slotRating(p: Player, slot: Position): number {
  return lineRating(p, POSITION_LINE[slot]) + positionPenalty(p, slot);
}

export function isAvailable(c: PlayerCondition | undefined): boolean {
  return !c || (c.injuryDays <= 0 && c.suspensionMatches <= 0);
}

/** Small preference for fit players when picking the eleven. */
function fitnessFactor(c: PlayerCondition | undefined): number {
  return c ? 0.8 + 0.2 * (c.fitness / 100) : 1;
}

/**
 * Assigns players to slots greedily by the best (player, slot) pairs. Returns one player id
 * per slot (or undefined when there are not enough players).
 */
export function assignSlots(
  players: readonly Player[],
  slots: readonly Position[],
  score: (p: Player, slot: Position) => number = slotRating,
): (string | undefined)[] {
  const pairs: { i: number; j: number; v: number }[] = [];
  players.forEach((p, i) => slots.forEach((slot, j) => pairs.push({ i, j, v: score(p, slot) })));
  // Stable order for equal values keeps the result deterministic.
  pairs.sort((a, b) => b.v - a.v || a.j - b.j || a.i - b.i);
  const out: (string | undefined)[] = slots.map(() => undefined);
  const usedPlayer = new Set<number>();
  let filled = 0;
  for (const { i, j } of pairs) {
    if (filled === slots.length) break;
    if (usedPlayer.has(i) || out[j] !== undefined) continue;
    out[j] = players[i].id;
    usedPlayer.add(i);
    filled++;
  }
  return out;
}

/**
 * Best eleven for the formation plus a bench of up to 9 (a reserve goalkeeper first when
 * there is one). Injured and suspended players are left out.
 */
export function autoLineup(
  squad: readonly Player[],
  formation: Formation,
  conditionOf: (p: Player) => PlayerCondition | undefined = (p) => p.condition,
): Lineup {
  const available = squad.filter((p) => isAvailable(conditionOf(p)));
  const slots = FORMATION_SLOTS[formation].map((sl) => sl.position);
  const score = (p: Player, slot: Position) => slotRating(p, slot) * fitnessFactor(conditionOf(p));

  // Goalkeeper first so a real keeper is never pushed out by a high-rated outfield pair.
  const keepers = available.filter((p) => p.position === 'ARQ').sort((a, b) => score(b, 'ARQ') - score(a, 'ARQ'));
  const gk = keepers[0] ?? [...available].sort((a, b) => score(b, 'ARQ') - score(a, 'ARQ'))[0];
  // Reserve keepers only play outfield when there are not enough outfield players.
  const outfieldPool = available.filter((p) => p !== gk && p.position !== 'ARQ');
  const outfield = assignSlots(
    outfieldPool.length >= 10 ? outfieldPool : available.filter((p) => p !== gk),
    slots.slice(1),
    score,
  );
  const starters = [gk?.id, ...outfield].filter((id): id is string => id !== undefined);

  const used = new Set(starters);
  const rest = available.filter((p) => !used.has(p.id));
  const bench: string[] = [];
  const take = (p: Player | undefined) => {
    if (p && !used.has(p.id) && bench.length < 9) {
      bench.push(p.id);
      used.add(p.id);
    }
  };
  const bestIn = (line: Line) =>
    rest.filter((p) => !used.has(p.id) && POSITION_LINE[p.position] === line).sort((a, b) => score(b, b.position) - score(a, a.position));
  take(bestIn('ARQ')[0]);
  // Cover each outfield line, then the best of the rest.
  for (const line of ['DEF', 'MED', 'DEL'] as Line[]) take(bestIn(line)[0]);
  for (const line of ['DEF', 'MED', 'DEL'] as Line[]) take(bestIn(line)[0]);
  rest
    .filter((p) => !used.has(p.id) && p.position !== 'ARQ')
    .sort((a, b) => score(b, b.position) - score(a, a.position))
    .forEach(take);

  const byId = new Map(squad.map((p) => [p.id, p]));
  const xi = starters.map((id) => byId.get(id)!);
  const best = (f: (p: Player) => number) => [...xi].sort((a, b) => f(b) - f(a))[0]?.id;
  return {
    starters,
    bench,
    captainId: best((p) => p.attributes.quality + (conditionOf(p)?.morale ?? 70) / 10),
    penaltyTakerId: best((p) => (p.position === 'ARQ' ? 0 : 0.7 * p.attributes.shooting + 0.3 * p.attributes.quality)),
    freeKickTakerId: best((p) => (p.position === 'ARQ' ? 0 : 0.5 * p.attributes.shooting + 0.5 * p.attributes.passing)),
  };
}

export function defaultTactics(): Tactics {
  return { formation: '4-4-2', mentality: 'equilibrada', pressing: 'media', tempo: 'normal', marking: 'zonal' };
}
