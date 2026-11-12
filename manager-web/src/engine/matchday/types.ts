// Types of the detailed match engine (local to matchday; the shared contract is game-types.ts).

import type { Player, Position } from '../types';
import type { MatchEvent, MatchReport, MatchStats, Tactics, TeamSheet } from '../game-types';
import type { Rng } from '../rng';

export interface KnockoutRules {
  /** The match must produce a winner (draw ⇒ extra time and/or penalties). */
  needWinner: boolean;
  /** Play 30 minutes of extra time before penalties. */
  extraTime: boolean;
  /** Second legs: goals of the first leg, seen from THIS match's home and away clubs. */
  aggregate?: { home: number; away: number };
}

export interface MatchInput {
  home: TeamSheet;
  away: TeamSheet;
  players: Map<string, Player>;
  neutral?: boolean;
  knockout?: KnockoutRules;
  rng: Rng;
  /** Club names for the commentary (defaults to the club id). */
  names?: Record<string, string>;
  /**
   * Automatic decisions (tactical substitutions, late mentality changes) per side; default true.
   * Injuries and keeper red cards are always handled automatically when possible.
   */
  ai?: { home?: boolean; away?: boolean };
}

/** MatchEvent with stoppage-time minute and the score right after the event. */
export interface LiveEvent extends MatchEvent {
  /** Stoppage minute (45+2 ⇒ minute 45, added 2). */
  added?: number;
  score: [number, number];
}

export interface MatchInjury {
  playerId: string;
  clubId: string;
  minute: number;
  days: number;
  description: string;
}

export interface DetailedMatchReport extends MatchReport {
  events: LiveEvent[];
  injuries: MatchInjury[];
  /** Stoppage time played in each period. */
  addedTime: number[];
  extraTime: boolean;
  /** Players sent off (straight or second yellow). */
  sentOff: string[];
}

export type MatchPhase =
  | 'not-started'
  | 'first-half'
  | 'half-time'
  | 'second-half'
  | 'before-extra-time'
  | 'extra-time'
  | 'penalties'
  | 'finished';

export interface OnPitchPlayer {
  playerId: string;
  /** Position of the slot he occupies (may differ from his natural position). */
  position: Position;
  /** 0-100, drops with the minutes. */
  energy: number;
  yellow: number;
}

export interface LiveTeamState {
  clubId: string;
  goals: number;
  tactics: Tactics;
  onPitch: OnPitchPlayer[];
  /** Bench players still available to come on. */
  bench: string[];
  subsUsed: number;
  subsLeft: number;
  windowsLeft: number;
  sentOff: string[];
  ai: boolean;
}

export interface LiveState {
  /** Last minute played (0 before kick-off). */
  minute: number;
  added: number;
  phase: MatchPhase;
  homeGoals: number;
  awayGoals: number;
  penalties?: { home: number; away: number };
  stats: MatchStats;
  home: LiveTeamState;
  away: LiveTeamState;
  finished: boolean;
}

export interface LiveMatch {
  /** Plays up to `minutes` minutes (stoppage minutes count) and returns the new events. */
  step(minutes: number): LiveEvent[];
  state(): LiveState;
  /** Throws an Error (Spanish message) when the change is not allowed. */
  substitute(clubId: string, outId: string, inId: string): LiveEvent;
  setTactics(clubId: string, tactics: Tactics): void;
  /** Turns automatic decisions on/off for a club. */
  setAi(clubId: string, on: boolean): void;
  /** Simulates the rest of the match. */
  finish(): DetailedMatchReport;
  readonly events: readonly LiveEvent[];
}
