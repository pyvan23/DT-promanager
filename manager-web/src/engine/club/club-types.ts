// Types local to the club module (the shared contract lives in ../game-types.ts).

import type { BoardState, StaffMember } from '../game-types';
import type { Club, Division } from '../types';

export type StaffRole = StaffMember['role'];
export type BoardObjective = BoardState['objective'];

/** Club context that ClubState does not carry (country, reputation, division level). */
export interface ClubContext {
  club: Club;
  division: Division;
}

export interface ExpansionOption {
  seats: number;
  cost: number;
  days: number;
  newCapacity: number;
}

/** Stadium works in progress: paid up front, capacity added when ready. */
export interface StadiumWork {
  seats: number;
  startDate: string;
  readyDate: string;
}

/** Multipliers derived from the staff (1 = neutral). */
export interface StaffEffects {
  /** Daily fitness recovery multiplier (preparador físico). */
  fitnessRecovery: number;
  /** Injury duration multiplier, < 1 is shorter (médico). */
  injuryDays: number;
  /** 0-1 precision of scouting reports (ojeador): 1 = exact attributes. */
  scoutAccuracy: number;
  /** Quality multiplier of new youth players (entrenador de juveniles). */
  youthQuality: number;
  /** Training progress multiplier (segundo entrenador). */
  trainingProgress: number;
  /** Fraction off transfer fees and wages in negotiations (secretario técnico), 0-0.15. */
  negotiationDiscount: number;
}

export interface JobOffer {
  clubId: string;
  clubName: string;
  divisionId: string;
  divisionName: string;
  objective: BoardObjective;
  /** Monthly wage offered to the manager. */
  wage: number;
}

export interface SeasonEvaluation {
  board: BoardState;
  fired: boolean;
  message: string;
}

/** What a club achieved in a competition, for prize money. */
export type PrizeEvent =
  | { kind: 'participation' }
  | { kind: 'win' }
  | { kind: 'draw' }
  /** Reached a knockout round: 0 = final, 1 = semifinal, 2 = quarterfinal, 3 = round of 16... */
  | { kind: 'round'; roundsFromFinal: number }
  | { kind: 'runner-up' }
  | { kind: 'champion' }
  | { kind: 'promotion' };
