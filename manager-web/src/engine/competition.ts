// Runs a whole competition from its data-driven format.

import { knockoutPairs, roundRobin, type Fixture } from './fixtures';
import { simulatePenalties, simulateScore, type TeamStrength } from './match';
import type { Rng } from './rng';
import type {
  CompetitionFormat,
  GroupStage,
  KnockoutStage,
  LeagueStage,
  MatchResult,
  Stage,
  SwissStage,
  TableRow,
  TieRules,
} from './types';

export type StrengthOf = (clubId: string) => TeamStrength;

export interface StageResult {
  stageId: string;
  matches: MatchResult[];
  /** League: one table. Groups: one per group. Knockout: none. */
  tables: TableRow[][];
  /** Knockout: winners per round, last entry holds the champion. */
  rounds: string[][];
  advanced: string[];
}

export interface CompetitionResult {
  formatId: string;
  stages: StageResult[];
  champion: string;
}

export function emptyRow(clubId: string): TableRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

/** Points, then goal difference, then goals scored. Head-to-head can be added per competition later. */
export function sortTable(rows: TableRow[]): TableRow[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
      b.goalsFor - a.goalsFor ||
      a.clubId.localeCompare(b.clubId),
  );
}

function playTable(
  clubIds: readonly string[],
  stage: LeagueStage | GroupStage | SwissStage,
  strength: StrengthOf,
  rng: Rng,
  fixtures: Fixture[] = roundRobin(clubIds, (stage as LeagueStage).rounds ?? 1),
): { table: TableRow[]; matches: MatchResult[] } {
  const rows = new Map(clubIds.map((id) => [id, emptyRow(id)]));
  const matches: MatchResult[] = [];
  for (const f of fixtures) {
    const score = simulateScore(strength(f.homeId), strength(f.awayId), rng);
    matches.push({ homeId: f.homeId, awayId: f.awayId, ...score });
    const home = rows.get(f.homeId)!;
    const away = rows.get(f.awayId)!;
    home.played++;
    away.played++;
    home.goalsFor += score.homeGoals;
    home.goalsAgainst += score.awayGoals;
    away.goalsFor += score.awayGoals;
    away.goalsAgainst += score.homeGoals;
    if (score.homeGoals > score.awayGoals) {
      home.won++;
      away.lost++;
      home.points += stage.points.win;
      away.points += stage.points.loss;
    } else if (score.homeGoals < score.awayGoals) {
      away.won++;
      home.lost++;
      away.points += stage.points.win;
      home.points += stage.points.loss;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += stage.points.draw;
      away.points += stage.points.draw;
    }
  }
  return { table: sortTable([...rows.values()]), matches };
}

/** Plays one tie and returns its winner. */
export function playTie(
  a: string,
  b: string,
  rules: TieRules,
  strength: StrengthOf,
  rng: Rng,
): { winner: string; matches: MatchResult[] } {
  if (rules.legs === 1) {
    const score = simulateScore(strength(a), strength(b), rng, rules.neutralVenue);
    const match: MatchResult = { homeId: a, awayId: b, ...score };
    if (score.homeGoals !== score.awayGoals) {
      return { winner: score.homeGoals > score.awayGoals ? a : b, matches: [match] };
    }
    match.penalties = simulatePenalties(rng);
    return { winner: match.penalties.home > match.penalties.away ? a : b, matches: [match] };
  }

  // Two legs: `a` hosts the first leg, `b` the second (so `b` should be the better seed).
  const first = simulateScore(strength(a), strength(b), rng);
  const second = simulateScore(strength(b), strength(a), rng);
  const leg1: MatchResult = { homeId: a, awayId: b, ...first };
  const leg2: MatchResult = { homeId: b, awayId: a, ...second };
  const aTotal = first.homeGoals + second.awayGoals;
  const bTotal = first.awayGoals + second.homeGoals;
  if (aTotal !== bTotal) return { winner: aTotal > bTotal ? a : b, matches: [leg1, leg2] };
  if (rules.awayGoals && second.awayGoals !== first.awayGoals) {
    return { winner: second.awayGoals > first.awayGoals ? a : b, matches: [leg1, leg2] };
  }
  leg2.penalties = simulatePenalties(rng);
  return { winner: leg2.penalties.home > leg2.penalties.away ? b : a, matches: [leg1, leg2] };
}

function runLeague(clubIds: string[], stage: LeagueStage, strength: StrengthOf, rng: Rng): StageResult {
  const { table, matches } = playTable(clubIds, stage, strength, rng);
  return { stageId: stage.id, matches, tables: [table], rounds: [], advanced: table.map((r) => r.clubId) };
}

/** Deals clubs (in seeding order) into groups pot by pot, drawing within each pot. */
export function dealGroups(clubIds: readonly string[], groupCount: number, rng: Rng): string[][] {
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  const pots = Math.ceil(clubIds.length / groupCount);
  for (let pot = 0; pot < pots; pot++) {
    const drawn = rng.shuffle(clubIds.slice(pot * groupCount, (pot + 1) * groupCount));
    drawn.forEach((id, g) => groups[g].push(id));
  }
  return groups;
}

/**
 * Clubs are dealt into groups in seeding order (pot by pot), so strong seeds are spread out.
 * When the clubs do not divide evenly, the last pot is partial and some groups get one club less.
 */
function runGroups(clubIds: string[], stage: GroupStage, strength: StrengthOf, rng: Rng): StageResult {
  const smallest = Math.floor(clubIds.length / stage.groupCount);
  if (smallest < stage.advancePerGroup) {
    throw new Error(`${stage.id}: ${clubIds.length} clubs are too few for ${stage.groupCount} groups advancing ${stage.advancePerGroup}`);
  }
  const groups = dealGroups(clubIds, stage.groupCount, rng);

  const tables: TableRow[][] = [];
  const matches: MatchResult[] = [];
  for (const group of groups) {
    const played = playTable(group, stage, strength, rng);
    tables.push(played.table);
    matches.push(...played.matches);
  }
  // Order of qualifiers: all group winners first, then all runners-up, and so on.
  const advanced: string[] = [];
  for (let place = 0; place < stage.advancePerGroup; place++) {
    for (const table of tables) advanced.push(table[place].clubId);
  }
  return { stageId: stage.id, matches, tables, rounds: [], advanced };
}

/**
 * Pairs the top half of the seeding against the bottom half reversed (1 v n, 2 v n-1, ...),
 * so the better seed always hosts the second leg.
 */
export function seedPairs(clubIds: string[]): string[] {
  const order: string[] = [];
  const n = clubIds.length;
  for (let i = 0; i < n / 2; i++) order.push(clubIds[n - 1 - i], clubIds[i]);
  return order;
}

function runKnockout(clubIds: string[], stage: KnockoutStage, strength: StrengthOf, rng: Rng): StageResult {
  const byes = clubIds.slice(0, stage.byes ?? 0);
  const rounds: string[][] = [];
  const matches: MatchResult[] = [];
  let alive = seedPairs(clubIds.slice(byes.length));
  while (alive.length > 1 && rounds.length < (stage.maxRounds ?? Infinity)) {
    const rules = alive.length === 2 && stage.finalTie ? stage.finalTie : stage.tie;
    const winners: string[] = [];
    // Pairs come as [worse seed, better seed]; in single-leg ties the better seed hosts.
    for (const [worse, better] of knockoutPairs(alive)) {
      const tie =
        rules.legs === 1
          ? playTie(better, worse, rules, strength, rng)
          : playTie(worse, better, rules, strength, rng);
      winners.push(tie.winner);
      matches.push(...tie.matches);
    }
    rounds.push(winners);
    alive = winners;
  }
  return { stageId: stage.id, matches, tables: [], rounds, advanced: [...byes, ...alive] };
}

/**
 * League phase: the first `matchesPerTeam` matchdays of a round robin over a shuffled order,
 * so each club meets that many different opponents and home/away alternates.
 */
function runSwiss(clubIds: string[], stage: SwissStage, strength: StrengthOf, rng: Rng): StageResult {
  if (stage.matchesPerTeam >= clubIds.length) {
    throw new Error(`${stage.id}: ${stage.matchesPerTeam} matches need more than ${clubIds.length} clubs`);
  }
  const fixtures = roundRobin(rng.shuffle(clubIds), 1).filter((f) => f.matchday <= stage.matchesPerTeam);
  const { table, matches } = playTable(clubIds, stage, strength, rng, fixtures);
  return { stageId: stage.id, matches, tables: [table], rounds: [], advanced: table.slice(0, stage.advance).map((r) => r.clubId) };
}

function runStage(clubIds: string[], stage: Stage, strength: StrengthOf, rng: Rng): StageResult {
  switch (stage.kind) {
    case 'league':
      return runLeague(clubIds, stage, strength, rng);
    case 'groups':
      return runGroups(clubIds, stage, strength, rng);
    case 'knockout':
      return runKnockout(clubIds, stage, strength, rng);
    case 'swiss':
      return runSwiss(clubIds, stage, strength, rng);
  }
}

/**
 * @param entrants clubs in seeding order (best first).
 * @param extraEntrants clubs that join at a given stage, e.g. Libertadores third-placed
 *        clubs entering the Sudamericana knockout play-offs. They are appended after the qualifiers.
 */
export function runCompetition(
  format: CompetitionFormat,
  entrants: string[],
  strength: StrengthOf,
  rng: Rng,
  extraEntrants: Record<string, string[]> = {},
): CompetitionResult {
  const stages: StageResult[] = [];
  let clubs = entrants;
  for (const stage of format.stages) {
    clubs = [...clubs, ...(extraEntrants[stage.id] ?? [])];
    const result = runStage(clubs, stage, strength, rng);
    stages.push(result);
    clubs = result.advanced;
  }
  return { formatId: format.id, stages, champion: clubs[0] };
}
