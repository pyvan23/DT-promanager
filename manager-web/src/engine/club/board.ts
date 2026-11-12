// The board ("comisión directiva"): season objective, confidence in the manager, dismissal
// and job offers from other clubs.

import type { BoardState } from '../game-types';
import type { Rng } from '../rng';
import type { Club, Division, World } from '../types';
import type { BoardObjective, JobOffer, SeasonEvaluation } from './club-types';
import { averagePlayerWage, clamp } from './economy';

export const INITIAL_CONFIDENCE = 60;
/** Below this confidence the manager is dismissed. */
export const FIRING_THRESHOLD = 25;
/** Crossing below this confidence earns a warning ("ultimátum"). */
export const WARNING_THRESHOLD = 35;

export const OBJECTIVE_NAMES: Record<BoardObjective, string> = {
  campeon: 'Salir campeón',
  'clasificar-copa': 'Clasificar a una copa internacional',
  'mitad-tabla': 'Terminar en la mitad de tabla',
  'no-descender': 'No descender',
  ascender: 'Ascender',
};

/** Position the club is expected to reach, from the reputation ranking of its division (1 = favourite). */
export function expectedPosition(club: Club, division: Division, world: World): number {
  const reps = division.clubIds
    .map((id) => world.clubs.find((c) => c.id === id))
    .filter((c): c is Club => !!c && c.id !== club.id)
    .map((c) => c.reputation);
  return 1 + reps.filter((r) => r > club.reputation).length;
}

/** Board objective from the expected position: top → title/cups, middle → mid-table, bottom → survival; strong clubs in lower tiers → promotion. */
export function objectiveFor(club: Club, division: Division, world: World): BoardObjective {
  const size = Math.max(1, division.clubIds.length);
  const pos = expectedPosition(club, division, world);
  if (division.promotion) {
    if (pos <= Math.max(1, Math.ceil(division.promotion.count * 1.5))) return 'ascender';
    if (division.relegation.length > 0 && pos > size * 0.75) return 'no-descender';
    return 'mitad-tabla';
  }
  if (pos <= Math.max(1, Math.round(size * 0.1))) return 'campeon';
  if (pos <= Math.max(2, Math.round(size * 0.3))) return 'clasificar-copa';
  if (division.relegation.length > 0 && pos > size * 0.65) return 'no-descender';
  return 'mitad-tabla';
}

export function initialBoard(club: Club, division: Division, world: World): BoardState {
  return { objective: objectiveFor(club, division, world), confidence: INITIAL_CONFIDENCE, warnings: 0 };
}

/** Confidence after a match: big wins in important games please, defeats hurt more when the club aims high. */
export function updateBoardAfterMatch(board: BoardState, result: 'W' | 'D' | 'L', importance: number): BoardState {
  const imp = clamp(importance, 0, 1);
  const ambitious = board.objective === 'campeon' || board.objective === 'ascender';
  const modest = board.objective === 'no-descender';
  let delta: number;
  if (result === 'W') delta = (2 + 3 * imp) * (modest ? 1.3 : 1);
  else if (result === 'D') delta = ambitious ? -1 - imp : modest ? 0.5 : -0.3 * imp;
  else delta = -(3 + 5 * imp) * (ambitious ? 1.3 : 1);
  const confidence = Math.round(clamp(board.confidence + delta, 0, 100) * 10) / 10;
  const warned = board.confidence >= WARNING_THRESHOLD && confidence < WARNING_THRESHOLD;
  return { ...board, confidence, warnings: board.warnings + (warned ? 1 : 0) };
}

/** True when the board loses patience mid-season. */
export const shouldFireMidSeason = (board: BoardState) => board.confidence < FIRING_THRESHOLD - 10;

function targetPosition(objective: BoardObjective, size: number): number {
  switch (objective) {
    case 'campeon':
      return 1;
    case 'clasificar-copa':
      return Math.max(2, Math.round(size * 0.25));
    case 'mitad-tabla':
      return Math.ceil(size / 2);
    case 'ascender':
      return 2;
    case 'no-descender':
      return Math.max(1, size - 3);
  }
}

/**
 * End-of-season review. `balanceDelta` is the change of the club balance over the season
 * (positive = the club made money).
 */
export function endOfSeasonEvaluation(
  board: BoardState,
  finalPosition: number,
  divisionSize: number,
  promoted: boolean,
  relegated: boolean,
  wonTitles: number,
  balanceDelta: number,
): SeasonEvaluation {
  const size = Math.max(1, divisionSize);
  const target = targetPosition(board.objective, size);
  let delta: number;
  let met: boolean;
  if (relegated) {
    met = false;
    delta = board.objective === 'no-descender' ? -40 : -55;
  } else if (board.objective === 'ascender') {
    met = promoted;
    delta = promoted ? 25 : -10 - (60 * Math.max(0, finalPosition - target)) / size;
  } else if (board.objective === 'no-descender') {
    met = true;
    delta = 12 + (40 * Math.max(0, target - finalPosition)) / size;
  } else {
    met = finalPosition <= target;
    delta = met ? 12 + (40 * (target - finalPosition)) / size : -8 - (80 * (finalPosition - target)) / size;
  }
  if (promoted && board.objective !== 'ascender') delta += 20;
  delta += 8 * wonTitles;
  delta += balanceDelta > 0 ? 4 : balanceDelta < 0 ? -6 : 0;

  const confidence = Math.round(clamp(board.confidence + delta, 0, 100));
  const fired = confidence < FIRING_THRESHOLD || (relegated && confidence < 45);
  const next: BoardState = { ...board, confidence: fired ? confidence : Math.max(confidence, 40), warnings: fired ? board.warnings : 0 };

  const titles = wonTitles > 0 ? ` ${wonTitles === 1 ? 'La vuelta olímpica' : `Las ${wonTitles} vueltas olímpicas`} no se olvidan más.` : '';
  const money = balanceDelta < 0 ? ' Eso sí: las cuentas quedaron en rojo y el tesorero anda con cara larga.' : '';
  let message: string;
  if (fired) {
    message = relegated
      ? 'Nos fuimos al descenso y esto no tiene vuelta. La comisión directiva decidió prescindir de tus servicios. Gracias por todo, pero acá se terminó el ciclo.'
      : `Se te pidió ${OBJECTIVE_NAMES[board.objective].toLowerCase()} y terminamos ${finalPosition}.º. Así no va más: la directiva resolvió rescindirte el contrato.${titles}`;
  } else if (relegated) {
    message = 'Nos tocó bajar de categoría, pero la directiva te sigue bancando. Ahora hay que volver rápido, no hay margen para otro papelón.';
  } else if (promoted) {
    message = `¡Ascendimos! La gente está de fiesta y en la comisión directiva están chochos con vos.${titles}${money}`;
  } else if (met && delta >= 25) {
    message = `Temporada bárbara: superaste largamente lo que te pedimos. La directiva te renueva la confianza sin dudarlo.${titles}${money}`;
  } else if (met) {
    message = `Objetivo cumplido (${OBJECTIVE_NAMES[board.objective].toLowerCase()}). La directiva está conforme y seguís al frente del equipo.${titles}${money}`;
  } else if (confidence < 45) {
    message = `No se cumplió el objetivo y la paciencia se está agotando. Seguís, pero el año que viene no hay más changüí.${titles}${money}`;
  } else {
    message = `Quedamos un poco por debajo de lo esperado, pero la directiva entiende el contexto y te da otra oportunidad.${titles}${money}`;
  }
  return { board: next, fired, message };
}

/**
 * Clubs that would hire a manager of this reputation (1-99): a few clubs around or slightly
 * above his level, never far above it.
 */
export function jobOffers(world: World, managerReputation: number, rng: Rng, excludeClubIds: readonly string[] = []): JobOffer[] {
  const divisionOf = new Map<string, Division>();
  for (const d of world.divisions) for (const id of d.clubIds) divisionOf.set(id, d);
  const pool = world.clubs.filter(
    (c) =>
      !excludeClubIds.includes(c.id) &&
      divisionOf.has(c.id) &&
      c.reputation <= managerReputation + 6 &&
      c.reputation >= managerReputation - 22,
  );
  // Weighted draw without replacement: clubs nearer the manager's level are likelier.
  const weighted = pool
    .map((c) => ({ c, key: rng.next() * (1 / (1 + Math.abs(c.reputation - managerReputation + 4) / 6)) }))
    .sort((a, b) => b.key - a.key || a.c.id.localeCompare(b.c.id));
  const count = Math.min(weighted.length, rng.int(2, 4));
  return weighted.slice(0, count).map(({ c }) => {
    const division = divisionOf.get(c.id)!;
    return {
      clubId: c.id,
      clubName: c.name,
      divisionId: division.id,
      divisionName: division.name,
      objective: objectiveFor(c, division, world),
      wage: Math.round((averagePlayerWage(c, division.level) * 1.5) / 100) * 100,
    };
  });
}
