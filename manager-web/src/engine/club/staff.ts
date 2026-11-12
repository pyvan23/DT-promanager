// Club employees: what they do for the team, the job market and hiring/firing.

import { FIRST_NAMES, SURNAMES } from '../../data/names';
import type { ClubState, StaffMember } from '../game-types';
import type { Rng } from '../rng';
import type { Club } from '../types';
import type { StaffEffects, StaffRole } from './club-types';
import { averagePlayerWage, clamp, guessLevel } from './economy';
import { addTransactions } from './ledger';

export const STAFF_ROLES: StaffRole[] = [
  'segundo-entrenador', 'preparador-fisico', 'medico', 'ojeador', 'entrenador-juveniles', 'secretario-tecnico',
];

export const STAFF_ROLE_NAMES: Record<StaffRole, string> = {
  'segundo-entrenador': 'Segundo entrenador',
  'preparador-fisico': 'Preparador físico',
  medico: 'Médico',
  ojeador: 'Ojeador',
  'entrenador-juveniles': 'Entrenador de juveniles',
  'secretario-tecnico': 'Secretario técnico',
};

/** Wage of each role relative to the club's average player wage. */
const ROLE_WAGE: Record<StaffRole, number> = {
  'segundo-entrenador': 0.5,
  'preparador-fisico': 0.35,
  medico: 0.35,
  ojeador: 0.25,
  'entrenador-juveniles': 0.3,
  'secretario-tecnico': 0.4,
};

/** Months of wage paid when an employee is dismissed. */
export const SEVERANCE_MONTHS = 6;

/** Quality assumed for a vacant role: the job gets done badly by whoever is around. */
const VACANT_QUALITY = 15;

export function staffWage(role: StaffRole, quality: number, club: Club, level = guessLevel(club)): number {
  const wage = averagePlayerWage(club, level) * ROLE_WAGE[role] * Math.exp(0.035 * (quality - club.reputation));
  return Math.max(200, Math.round(wage / 10) * 10);
}

const randomName = (rng: Rng) =>
  `${FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]} ${SURNAMES[rng.int(0, SURNAMES.length - 1)]}`;

export function makeStaffMember(role: StaffRole, quality: number, club: Club, rng: Rng, level = guessLevel(club)): StaffMember {
  const q = clamp(Math.round(quality), 1, 99);
  return { role, name: randomName(rng), quality: q, wage: staffWage(role, q, club, level) };
}

/** Initial staff: the six roles, around the club's level. */
export function initialStaff(club: Club, rng: Rng, level = guessLevel(club)): StaffMember[] {
  return STAFF_ROLES.map((role) => makeStaffMember(role, club.reputation + rng.int(-15, 6), club, rng, level));
}

export function staffEffects(staff: readonly StaffMember[]): StaffEffects {
  const q = (role: StaffRole) => {
    const best = staff.filter((s) => s.role === role).reduce((m, s) => Math.max(m, s.quality), 0);
    return (best || VACANT_QUALITY) / 99;
  };
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return {
    fitnessRecovery: round(0.85 + 0.4 * q('preparador-fisico')),
    injuryDays: round(1.2 - 0.45 * q('medico')),
    scoutAccuracy: round(0.25 + 0.75 * q('ojeador')),
    youthQuality: round(0.85 + 0.35 * q('entrenador-juveniles')),
    trainingProgress: round(0.85 + 0.35 * q('segundo-entrenador')),
    negotiationDiscount: round(0.15 * q('secretario-tecnico')),
  };
}

/**
 * Candidates available for a role: 3-5 people, from cheap and modest to expensive and good.
 * `level` is the club's division level (guessed from reputation when omitted).
 */
export function staffCandidates(role: StaffRole, club: Club, rng: Rng, level = guessLevel(club)): StaffMember[] {
  const count = rng.int(3, 5);
  const out: StaffMember[] = [];
  for (let i = 0; i < count; i++) {
    const spread = -20 + (35 * i) / Math.max(1, count - 1); // -20 .. +15 around the club level
    out.push(makeStaffMember(role, club.reputation + spread + rng.int(-4, 4), club, rng, level));
  }
  return out.sort((a, b) => b.quality - a.quality);
}

export const severanceFor = (member: StaffMember) => member.wage * SEVERANCE_MONTHS;

/** Dismisses the employee in `role` (if any), paying the severance. */
export function fireStaff(state: ClubState, role: StaffRole, date: string): ClubState {
  const member = state.staff.find((s) => s.role === role);
  if (!member) return state;
  const next = { ...state, staff: state.staff.filter((s) => s !== member) };
  return addTransactions(next, [
    {
      date,
      kind: 'empleados',
      amount: -severanceFor(member),
      description: `Indemnización a ${member.name} (${STAFF_ROLE_NAMES[role].toLowerCase()})`,
    },
  ]);
}

/** Hires a candidate, dismissing (with severance) whoever held the role. */
export function hireStaff(state: ClubState, candidate: StaffMember, date: string): ClubState {
  const cleared = fireStaff(state, candidate.role, date);
  return { ...cleared, staff: [...cleared.staff, { ...candidate }] };
}
