// Core data model. Everything here is plain data so it can be saved as JSON
// (local saves, imported databases, server sync later).

import type { Contract, PlayerCondition, PlayerSeasonStats } from './game-types';

/** Detailed positions, using Argentine football terms. */
export type Position =
  | 'ARQ' // arquero
  | 'LD' // lateral derecho
  | 'DFC' // defensor central
  | 'LI' // lateral izquierdo
  | 'MCD' // volante central / cinco
  | 'MD' // volante por derecha
  | 'MC' // volante interno
  | 'MI' // volante por izquierda
  | 'MCO' // enganche
  | 'ED' // extremo derecho
  | 'EI' // extremo izquierdo
  | 'DC'; // centrodelantero

export type Line = 'ARQ' | 'DEF' | 'MED' | 'DEL';

export const POSITION_LINE: Record<Position, Line> = {
  ARQ: 'ARQ',
  LD: 'DEF',
  DFC: 'DEF',
  LI: 'DEF',
  MCD: 'MED',
  MD: 'MED',
  MC: 'MED',
  MI: 'MED',
  MCO: 'MED',
  ED: 'DEL',
  EI: 'DEL',
  DC: 'DEL',
};

/** Skills on a 1-99 scale. */
export interface PlayerAttributes {
  speed: number;
  stamina: number;
  aggression: number;
  quality: number;
  goalkeeping: number;
  tackling: number;
  passing: number;
  dribbling: number;
  shooting: number;
  /** Finishing inside the box and aerial play, separate from long-range shooting. */
  heading: number;
}

export interface Player {
  id: string;
  name: string;
  birthDate: string; // ISO yyyy-mm-dd
  nationality: string; // ISO 3166 alpha-3
  position: Position;
  /** Other positions the player can cover, best first (up to 6). */
  altPositions: Position[];
  attributes: PlayerAttributes;
  clubId: string | null;
  /** Day-to-day state; absent in worlds created before the day-by-day game (treated as fresh). */
  condition?: PlayerCondition;
  contract?: Contract;
  stats?: PlayerSeasonStats[];
  /** Youth player of the club's academy (not yet in the first-team squad). */
  youth?: boolean;
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  country: string; // ISO 3166 alpha-3
  reputation: number; // 1-99, used for seeding and finances
  stadium: string;
  region: Region;
  /** Hex colours for badges and kits in the UI. */
  colors: { primary: string; secondary: string };
}

/** How a tie between two clubs is decided in a knockout round. */
export interface TieRules {
  legs: 1 | 2;
  /** Away goals rule for two-legged ties (CONMEBOL dropped it in 2022). */
  awayGoals: boolean;
  /** Single-leg ties: true = neutral venue, false = first-drawn club hosts. */
  neutralVenue: boolean;
}

export interface LeagueStage {
  kind: 'league';
  id: string;
  name: string;
  /** Number of times each pair meets (1 = single round robin, 2 = home and away). */
  rounds: 1 | 2;
  points: { win: number; draw: number; loss: number };
}

export interface GroupStage {
  kind: 'groups';
  id: string;
  name: string;
  groupCount: number;
  rounds: 1 | 2;
  points: { win: number; draw: number; loss: number };
  /** How many from each group advance (in finishing order). */
  advancePerGroup: number;
}

export interface KnockoutStage {
  kind: 'knockout';
  id: string;
  name: string;
  tie: TieRules;
  /** Rules for the last round, e.g. a single-match final. */
  finalTie?: TieRules;
  /** The best `byes` seeds skip this stage and advance directly. */
  byes?: number;
  /** Stop after this many rounds (e.g. 1 for a play-off round); default plays down to a champion. */
  maxRounds?: number;
}

/**
 * Single-table "league phase" (UEFA format since 2024-25): every club plays `matchesPerTeam`
 * different opponents, half at home, and the top `advance` clubs go through in table order.
 */
export interface SwissStage {
  kind: 'swiss';
  id: string;
  name: string;
  matchesPerTeam: number;
  points: { win: number; draw: number; loss: number };
  advance: number;
}

export type Stage = LeagueStage | GroupStage | KnockoutStage | SwissStage;

export interface CompetitionFormat {
  id: string;
  name: string;
  /** Stages run in order; each stage receives the clubs that advanced from the previous one. */
  stages: Stage[];
}

export interface MatchResult {
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  /** Set when a knockout tie went to penalties. */
  penalties?: { home: number; away: number };
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

/**
 * AFA splits lower tiers by affiliation: Buenos Aires metro clubs (direct affiliates) and
 * interior clubs (indirect affiliates) climb through different divisions.
 */
export type Region = 'metro' | 'interior';

export interface RelegationRule {
  count: number;
  to: string;
  /** Only clubs from this region count for this rule; omitted = any club. */
  region?: Region;
}

/** One tier of the league pyramid. Promotion and relegation counts are editable data. */
export interface Division {
  id: string;
  name: string;
  /** ISO 3166 alpha-3 of the country whose pyramid this division belongs to. */
  country: string;
  /** 1 = top flight. Several divisions can share a level (e.g. B Metro and Federal A). */
  level: number;
  formatId: string;
  clubIds: string[];
  promotion: { count: number; to: string } | null;
  relegation: RelegationRule[];
  /** Relegation decided by the average of points per game over recent seasons (Argentine "promedios"). */
  relegationByAverages: boolean;
  /**
   * Two tournaments per year (Argentine Apertura and Clausura), each with its own champion;
   * promotion, relegation and qualification use the annual table of both.
   */
  splitSeason?: boolean;
}

/** Points record for one club in one season, used for the relegation averages. */
export interface SeasonRecord {
  season: number;
  clubId: string;
  divisionId: string;
  points: number;
  played: number;
}

export type Confederation = 'CONMEBOL' | 'UEFA' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';

export interface Country {
  id: string; // ISO 3166 alpha-3
  name: string;
  confederation: Confederation;
}

/**
 * Where a cup's entrants come from. Rules are evaluated against the previous season's
 * results (as real qualification works); in the first season, divisions are ordered by
 * club reputation instead.
 */
export type EntryRule =
  /** Clubs finishing in places [from, to] (1-based, inclusive) of a division's final ranking. */
  | { kind: 'division'; divisionId: string; from: number; to: number }
  /**
   * Champion of another competition (e.g. the Copa Argentina winner goes to the Libertadores).
   * When that club already qualified, or there is no champion yet (first season), the spot
   * passes to the next club of `fallbackDivisionId`.
   */
  | { kind: 'champion'; competitionId: string; fallbackDivisionId?: string }
  /** Clubs finishing in `place` of every group of a stage (e.g. Libertadores thirds into the Sudamericana). */
  | { kind: 'group-place'; competitionId: string; stageId: string; place: number; joinStageId: string }
  /** Explicit list, e.g. invited clubs. */
  | { kind: 'clubs'; clubIds: string[] };

export interface CompetitionDef {
  id: string;
  name: string;
  formatId: string;
  scope: 'domestic' | 'continental';
  /** Domestic: owning country. Continental: owning confederation. */
  country?: string;
  confederation?: Confederation;
  /** Entrants must reach this number exactly; otherwise the competition is skipped as pending. */
  size: number;
  entries: EntryRule[];
  /** Same-season dependencies: competitions that must be played first (for 'group-place' rules). */
  after?: string[];
}

/** What a season leaves behind for the next one's qualification rules. */
export interface QualificationState {
  season: number;
  /** Final ranking per division. */
  rankings: Record<string, string[]>;
  /** Champion per competition. */
  champions: Record<string, string>;
}

export interface World {
  seed: number;
  season: number; // e.g. 2026
  countries: Country[];
  clubs: Club[];
  players: Player[];
  divisions: Division[];
  competitions: CompetitionDef[];
  history: SeasonRecord[];
  /** Results of the last completed season, used to fill the next season's cups. */
  qualification?: QualificationState;
  /**
   * Real line-ups of the first season's cups (e.g. the 32 clubs of the 2026 Libertadores
   * group stage), used instead of the entry rules for that season only.
   */
  fixedEntrants?: { season: number; entrants: Record<string, string[]> };
}
