// Shared contract for the day-by-day game: player condition and contracts, tactics and
// lineups, detailed match reports, club finances and the season calendar.
// Engine modules (calendar, match, market, club) and the UI all build on these types.

import type { Position } from './types';

// ---------------------------------------------------------------- players

/** Day-to-day state of a player. All 0-100 unless noted. */
export interface PlayerCondition {
  fitness: number; // match sharpness / stamina left; drops after matches, recovers daily
  morale: number;
  form: number; // recent performances, drives small rating bonuses
  injuryDays: number; // 0 = available
  injury?: string; // description, e.g. "desgarro"
  suspensionMatches: number; // 0 = available
  yellowCards: number; // accumulated in the current competition cycle
}

/** Money is in a single game currency (US dollars) for every country. */
export interface Contract {
  wage: number; // per month
  untilSeason: number; // last season covered (inclusive)
  releaseClause?: number;
  /** "Seguro" in the original: insurance paid while injured. */
  insured?: boolean;
}

export interface PlayerSeasonStats {
  season: number;
  clubId: string;
  appearances: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  minutes: number;
  /** Goals conceded while playing as goalkeeper. */
  conceded: number;
  ratingSum: number; // sum of match ratings (1-10), divide by appearances
}

// ---------------------------------------------------------------- tactics

export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '5-3-2' | '4-5-1' | '3-4-3';
export type Mentality = 'muy-defensiva' | 'defensiva' | 'equilibrada' | 'ofensiva' | 'muy-ofensiva';

export interface Tactics {
  formation: Formation;
  mentality: Mentality;
  pressing: 'baja' | 'media' | 'alta';
  tempo: 'lento' | 'normal' | 'rapido';
  marking: 'zonal' | 'hombre';
}

/** Slots of a formation in order (goalkeeper first); `starters[i]` plays `slots[i]`. */
export interface Lineup {
  starters: string[]; // 11 player ids
  bench: string[]; // up to 9
  captainId?: string;
  penaltyTakerId?: string;
  freeKickTakerId?: string;
}

export interface TeamSheet {
  clubId: string;
  tactics: Tactics;
  lineup: Lineup;
}

// ---------------------------------------------------------------- matches

export type MatchEventKind =
  | 'kickoff'
  | 'goal'
  | 'own-goal'
  | 'penalty-goal'
  | 'penalty-miss'
  | 'chance'
  | 'save'
  | 'yellow'
  | 'second-yellow'
  | 'red'
  | 'injury'
  | 'substitution'
  | 'half-time'
  | 'full-time'
  | 'extra-time'
  | 'shootout';

export interface MatchEvent {
  minute: number; // 1-120
  kind: MatchEventKind;
  clubId: string;
  playerId?: string;
  /** Assist provider for goals; player coming on for substitutions. */
  otherPlayerId?: string;
  /** Commentary line in Spanish (rioplatense). */
  text: string;
}

export interface MatchStats {
  possession: [number, number]; // home %, away %
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  yellow: [number, number];
  red: [number, number];
}

export interface MatchReport {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  penalties?: { home: number; away: number };
  events: MatchEvent[];
  stats: MatchStats;
  /** 1-10 rating per player who played. */
  ratings: Record<string, number>;
  minutesPlayed: Record<string, number>;
  attendance?: number;
}

// ---------------------------------------------------------------- calendar

export type MatchStatus = 'scheduled' | 'played';

export interface ScheduledMatch {
  id: string;
  date: string; // ISO yyyy-mm-dd
  competitionId: string; // division id, cup id, or 'amistoso' / summer trophy id
  stageId: string;
  /** Matchday number in league stages, round index in knockouts. */
  round: number;
  /** Group/zone index for group stages. */
  group?: number;
  /** Links the two legs of a knockout tie. */
  tieId?: string;
  leg?: 1 | 2;
  homeId: string;
  awayId: string;
  neutral: boolean;
  status: MatchStatus;
  result?: {
    homeGoals: number;
    awayGoals: number;
    penalties?: { home: number; away: number };
    /** Goal scorers (also for quick-simulated matches, for top-scorer tables). */
    scorers?: { clubId: string; playerId: string; minute: number }[];
  };
  /** Full report, kept only for matches involving the user's club. */
  report?: MatchReport;
}

// ---------------------------------------------------------------- club

export interface Stadium {
  name: string;
  capacity: number;
  ticketPrice: number; // average, per spectator
  /** 0-100; affects attendance and injuries. */
  pitchQuality: number;
}

export interface StaffMember {
  role: 'segundo-entrenador' | 'preparador-fisico' | 'medico' | 'ojeador' | 'entrenador-juveniles' | 'secretario-tecnico';
  name: string;
  quality: number; // 1-99
  wage: number; // per month
}

export interface Transaction {
  date: string;
  kind: 'taquilla' | 'tv' | 'sponsor' | 'premios' | 'traspaso' | 'sueldos' | 'empleados' | 'estadio' | 'seguros' | 'otros';
  amount: number; // positive = income
  description: string;
}

export interface ClubFinances {
  balance: number;
  /** Money the board allows for transfers this season. */
  transferBudget: number;
  wageBudget: number; // per month
  sponsor?: { name: string; perSeason: number; untilSeason: number };
  ledger: Transaction[];
}

/** Board objective and confidence in the manager ("evaluación del mánager"). */
export interface BoardState {
  objective: 'campeon' | 'clasificar-copa' | 'mitad-tabla' | 'no-descender' | 'ascender';
  confidence: number; // 0-100; below a threshold the manager is fired
  warnings: number;
}

export interface ClubState {
  clubId: string;
  stadium: Stadium;
  finances: ClubFinances;
  staff: StaffMember[];
  board: BoardState;
  tactics: Tactics;
  lineup?: Lineup;
  /** Players the user follows ("cartera"). */
  shortlist: string[];
}

// ---------------------------------------------------------------- market

export type OfferStatus = 'pendiente' | 'aceptada' | 'rechazada' | 'contraoferta' | 'retirada';

export interface TransferOffer {
  id: string;
  date: string;
  playerId: string;
  fromClubId: string; // buying club
  toClubId: string; // selling club (current club of the player)
  kind: 'traspaso' | 'cesion';
  fee: number;
  /** Contract offered to the player. */
  contract: Contract;
  status: OfferStatus;
  counterFee?: number;
}

export interface MarketState {
  transferList: string[]; // players declared transferable
  loanList: string[]; // players declared loanable
  offers: TransferOffer[];
  /** Transfer windows as ISO date ranges (inclusive). */
  windows: { from: string; to: string }[];
}

// ---------------------------------------------------------------- re-export for convenience
export type { Position };
