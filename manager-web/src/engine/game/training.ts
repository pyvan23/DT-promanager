// Weekly training of the user's squad: a focus (which attributes improve) and an intensity
// (how much they improve versus how tired the players get and the risk of injuries).

import { staffEffects } from '../club';
import { createRng } from '../rng';
import type { Player, PlayerAttributes, World } from '../types';
import type { StaffMember } from '../game-types';

export type TrainingFocus = 'equilibrado' | 'fisico' | 'tecnico' | 'tactico' | 'ataque' | 'defensa' | 'arqueros';
export type TrainingIntensity = 'baja' | 'media' | 'alta';

export interface TrainingPlan {
  focus: TrainingFocus;
  intensity: TrainingIntensity;
}

export const DEFAULT_TRAINING: TrainingPlan = { focus: 'equilibrado', intensity: 'media' };

export const FOCUS_ATTRIBUTES: Record<TrainingFocus, (keyof PlayerAttributes)[]> = {
  equilibrado: ['speed', 'stamina', 'quality', 'passing', 'tackling', 'shooting'],
  fisico: ['speed', 'stamina', 'aggression'],
  tecnico: ['quality', 'dribbling', 'passing'],
  tactico: ['passing', 'tackling', 'quality'],
  ataque: ['shooting', 'heading', 'dribbling'],
  defensa: ['tackling', 'heading', 'aggression'],
  arqueros: ['goalkeeping'],
};

export const FOCUS_LABEL: Record<TrainingFocus, string> = {
  equilibrado: 'Equilibrado',
  fisico: 'Físico',
  tecnico: 'Técnico',
  tactico: 'Táctico',
  ataque: 'Ataque y definición',
  defensa: 'Defensa y juego aéreo',
  arqueros: 'Arqueros',
};

/** Daily fitness recovery multiplier: hard training leaves less energy for the weekend. */
export const INTENSITY_RECOVERY: Record<TrainingIntensity, number> = { baja: 1.25, media: 1, alta: 0.75 };
const INTENSITY_GAIN: Record<TrainingIntensity, number> = { baja: 0.5, media: 1, alta: 1.6 };
const INTENSITY_INJURY: Record<TrainingIntensity, number> = { baja: 0.002, media: 0.005, alta: 0.014 };

export interface TrainingReport {
  date: string;
  improved: { playerId: string; attribute: keyof PlayerAttributes }[];
  injured: { playerId: string; days: number }[];
}

const youngBonus = (age: number) => (age <= 21 ? 1.6 : age <= 25 ? 1.1 : age <= 29 ? 0.6 : age <= 32 ? 0.25 : 0.05);

/**
 * One week of training. Each player has a chance to gain +1 in one of the focus attributes,
 * higher for young players, hard training and a good assistant coach; hard training also
 * risks injuries.
 */
export function weeklyTraining(world: World, clubId: string, plan: TrainingPlan, staff: StaffMember[], date: string, seed: number): { world: World; report: TrainingReport } {
  const fx = staffEffects(staff);
  const report: TrainingReport = { date, improved: [], injured: [] };
  let h = 2166136261;
  for (const ch of `${clubId}:${date}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rng = createRng((seed ^ h) >>> 0);
  const season = Number(date.slice(0, 4));
  const players = world.players.map((p): Player => {
    if (p.clubId !== clubId) return p;
    if (p.condition && p.condition.injuryDays > 0) return p; // injured players do not train
    const age = season - Number(p.birthDate.slice(0, 4));
    const attrs = FOCUS_ATTRIBUTES[plan.focus].filter((k) => k !== 'goalkeeping' || p.position === 'ARQ');
    const chance = 0.12 * youngBonus(age) * INTENSITY_GAIN[plan.intensity] * fx.trainingProgress * (p.youth ? 1.3 : 1);
    let next = p;
    if (attrs.length && rng.next() < chance) {
      const attribute = attrs[rng.int(0, attrs.length - 1)];
      if (p.attributes[attribute] < 99) {
        next = { ...p, attributes: { ...p.attributes, [attribute]: p.attributes[attribute] + 1 } };
        report.improved.push({ playerId: p.id, attribute });
      }
    }
    if (rng.next() < INTENSITY_INJURY[plan.intensity] / fx.injuryDays) {
      const days = Math.max(3, Math.round(rng.int(4, 18) * fx.injuryDays));
      const c = next.condition ?? { fitness: 100, morale: 70, form: 50, injuryDays: 0, suspensionMatches: 0, yellowCards: 0 };
      next = { ...next, condition: { ...c, injuryDays: days, injury: 'lesión en el entrenamiento' } };
      report.injured.push({ playerId: p.id, days });
    }
    return next;
  });
  return { world: { ...world, players }, report };
}
