// Incremental competition runner. A competition advances as its matches are played:
// table stages schedule all their fixtures up front, knockout stages schedule one round
// at a time once the previous round is decided. All state is plain data (saveable).

import { dealGroups, emptyRow, seedPairs, sortTable, type CompetitionResult, type StageResult } from '../competition';
import { knockoutPairs, roundRobin } from '../fixtures';
import { createRng } from '../rng';
import type { CompetitionFormat, MatchResult, Stage, TableRow, TieRules } from '../types';
import type { ScheduledMatch } from '../game-types';

export interface TieState {
  id: string;
  /** Worse seed (hosts the first leg of two-legged ties). */
  a: string;
  /** Better seed (hosts single-leg ties unless neutral, and the second leg). */
  b: string;
  rules: TieRules;
  matchIds: string[];
  winner?: string;
}

export interface StageRun {
  stageId: string;
  kind: Stage['kind'];
  clubs: string[];
  /** Table stages: one entry per group (league and swiss have a single group). */
  groups: string[][];
  byes: string[];
  rounds: TieState[][];
  matchIds: string[];
  slotStart: number;
  advanced?: string[];
}

export interface CompetitionRun {
  id: string;
  formatId: string;
  extra: Record<string, string[]>;
  /** Match dates available to this competition, in order. */
  slots: string[];
  stages: StageRun[];
  seed: number;
  champion?: string;
}

/** Where the runner reads and creates matches (the season calendar implements it). */
export interface MatchBook {
  add(match: Omit<ScheduledMatch, 'id' | 'status'>): string;
  get(id: string): ScheduledMatch;
}

const isTable = (s: Stage) => s.kind !== 'knockout';

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
const rngFor = (run: CompetitionRun, key: string) => createRng((run.seed ^ hash(`${run.id}:${key}`)) >>> 0);

// ------------------------------------------------------------------ slot planning

function knockoutRounds(stage: Extract<Stage, { kind: 'knockout' }>, clubs: number): TieRules[] {
  const playing = clubs - (stage.byes ?? 0);
  const rules: TieRules[] = [];
  for (let alive = playing; alive > 1 && rules.length < (stage.maxRounds ?? Infinity); alive /= 2) {
    rules.push(alive === 2 && stage.finalTie ? stage.finalTie : stage.tie);
  }
  return rules;
}

function roundRobinDays(size: number, rounds: number): number {
  return (size % 2 === 0 ? size - 1 : size) * rounds;
}

/** Number of match dates each stage needs, given the entrant count. */
export function plannedSlots(format: CompetitionFormat, entrants: number, extra: Record<string, number> = {}): number[] {
  const out: number[] = [];
  let clubs = entrants;
  for (const stage of format.stages) {
    clubs += extra[stage.id] ?? 0;
    switch (stage.kind) {
      case 'league':
        out.push(roundRobinDays(clubs, stage.rounds));
        break;
      case 'groups':
        out.push(roundRobinDays(Math.ceil(clubs / stage.groupCount), stage.rounds));
        clubs = stage.groupCount * stage.advancePerGroup;
        break;
      case 'swiss':
        out.push(stage.matchesPerTeam);
        clubs = stage.advance;
        break;
      case 'knockout': {
        const rounds = knockoutRounds(stage, clubs);
        out.push(rounds.reduce((s, r) => s + r.legs, 0));
        const played = clubs - (stage.byes ?? 0);
        clubs = (stage.byes ?? 0) + played / 2 ** rounds.length;
        break;
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ starting stages

function slotDate(run: CompetitionRun, index: number): string {
  return run.slots[Math.min(index, run.slots.length - 1)];
}

function startStage(run: CompetitionRun, format: CompetitionFormat, index: number, clubs: string[], book: MatchBook) {
  const stage = format.stages[index];
  const previous = run.stages[index - 1];
  const used = previous ? previous.slotStart + plannedSlots({ ...format, stages: [format.stages[index - 1]] }, previous.clubs.length)[0] : 0;
  const run_: StageRun = { stageId: stage.id, kind: stage.kind, clubs, groups: [], byes: [], rounds: [], matchIds: [], slotStart: used };
  run.stages.push(run_);
  const rng = rngFor(run, `stage-${index}`);

  if (stage.kind === 'knockout') {
    run_.byes = clubs.slice(0, stage.byes ?? 0);
    scheduleKnockoutRound(run, stage, run_, seedPairs(clubs.slice(run_.byes.length)), book);
    return;
  }

  let fixtures: { group: number; matchday: number; homeId: string; awayId: string }[] = [];
  if (stage.kind === 'league') {
    run_.groups = [clubs];
    fixtures = roundRobin(clubs, stage.rounds).map((f) => ({ group: 0, ...f }));
  } else if (stage.kind === 'groups') {
    run_.groups = dealGroups(clubs, stage.groupCount, rng);
    fixtures = run_.groups.flatMap((g, gi) => roundRobin(g, stage.rounds).map((f) => ({ group: gi, ...f })));
  } else {
    run_.groups = [clubs];
    fixtures = roundRobin(rng.shuffle(clubs), 1)
      .filter((f) => f.matchday <= stage.matchesPerTeam)
      .map((f) => ({ group: 0, ...f }));
  }
  for (const f of fixtures) {
    run_.matchIds.push(
      book.add({
        date: slotDate(run, run_.slotStart + f.matchday - 1),
        competitionId: run.id,
        stageId: stage.id,
        round: f.matchday,
        group: f.group,
        homeId: f.homeId,
        awayId: f.awayId,
        neutral: false,
      }),
    );
  }
}

function scheduleKnockoutRound(
  run: CompetitionRun,
  stage: Extract<Stage, { kind: 'knockout' }>,
  stageRun: StageRun,
  ordered: string[],
  book: MatchBook,
) {
  const roundIndex = stageRun.rounds.length;
  const allRules = knockoutRounds(stage, stageRun.clubs.length);
  const rules = allRules[roundIndex];
  const slot = stageRun.slotStart + allRules.slice(0, roundIndex).reduce((s, r) => s + r.legs, 0);
  const ties: TieState[] = knockoutPairs(ordered).map(([worse, better], i) => {
    const tie: TieState = { id: `${run.id}:${stage.id}:${roundIndex}:${i}`, a: worse, b: better, rules, matchIds: [] };
    const base = { competitionId: run.id, stageId: stage.id, round: roundIndex, tieId: tie.id, neutral: rules.neutralVenue };
    if (rules.legs === 1) {
      tie.matchIds.push(book.add({ ...base, date: slotDate(run, slot), leg: 1, homeId: better, awayId: worse }));
    } else {
      tie.matchIds.push(book.add({ ...base, date: slotDate(run, slot), leg: 1, homeId: worse, awayId: better, neutral: false }));
      tie.matchIds.push(book.add({ ...base, date: slotDate(run, slot + 1), leg: 2, homeId: better, awayId: worse, neutral: false }));
    }
    return tie;
  });
  stageRun.rounds.push(ties);
  stageRun.matchIds.push(...ties.flatMap((t) => t.matchIds));
}

export function startRun(
  id: string,
  format: CompetitionFormat,
  entrants: string[],
  extra: Record<string, string[]>,
  slots: string[],
  seed: number,
  book: MatchBook,
): CompetitionRun {
  const run: CompetitionRun = { id, formatId: format.id, extra, slots, stages: [], seed };
  startStage(run, format, 0, [...entrants, ...(extra[format.stages[0].id] ?? [])], book);
  return run;
}

// ------------------------------------------------------------------ progress

export function groupTable(group: string[], matches: ScheduledMatch[], points: { win: number; draw: number; loss: number }): TableRow[] {
  const rows = new Map(group.map((id) => [id, emptyRow(id)]));
  for (const m of matches) {
    if (m.status !== 'played' || !m.result) continue;
    const home = rows.get(m.homeId);
    const away = rows.get(m.awayId);
    if (!home || !away) continue;
    const { homeGoals: h, awayGoals: a } = m.result;
    home.played++;
    away.played++;
    home.goalsFor += h;
    home.goalsAgainst += a;
    away.goalsFor += a;
    away.goalsAgainst += h;
    if (h > a) {
      home.won++; away.lost++; home.points += points.win; away.points += points.loss;
    } else if (h < a) {
      away.won++; home.lost++; away.points += points.win; home.points += points.loss;
    } else {
      home.drawn++; away.drawn++; home.points += points.draw; away.points += points.draw;
    }
  }
  return sortTable([...rows.values()]);
}

/** Winner of a tie once all its legs are played, or undefined. */
export function tieWinner(tie: TieState, book: MatchBook): string | undefined {
  const legs = tie.matchIds.map((id) => book.get(id));
  if (legs.some((m) => m.status !== 'played' || !m.result)) return undefined;
  let a = 0;
  let b = 0;
  let aAway = 0;
  let bAway = 0;
  for (const m of legs) {
    const homeIsA = m.homeId === tie.a;
    a += homeIsA ? m.result!.homeGoals : m.result!.awayGoals;
    b += homeIsA ? m.result!.awayGoals : m.result!.homeGoals;
    if (!m.neutral) {
      if (homeIsA) bAway += m.result!.awayGoals;
      else aAway += m.result!.awayGoals;
    }
  }
  if (a !== b) return a > b ? tie.a : tie.b;
  if (tie.rules.legs === 2 && tie.rules.awayGoals && aAway !== bAway) return aAway > bAway ? tie.a : tie.b;
  const last = legs[legs.length - 1];
  const pens = last.result!.penalties;
  if (!pens) return tie.b; // should not happen: a drawn decisive leg always carries penalties
  return pens.home > pens.away ? last.homeId : last.awayId;
}

/** Aggregate before a decisive leg, from the point of view of that leg's home side. */
export function aggregateBefore(match: ScheduledMatch, book: MatchBook, run: CompetitionRun): { home: number; away: number } | null {
  if (!match.tieId) return null;
  const tie = run.stages.flatMap((s) => s.rounds.flat()).find((t) => t.id === match.tieId);
  if (!tie) return null;
  let home = 0;
  let away = 0;
  for (const id of tie.matchIds) {
    const m = book.get(id);
    if (m.id === match.id || m.status !== 'played' || !m.result) continue;
    home += m.homeId === match.homeId ? m.result.homeGoals : m.result.awayGoals;
    away += m.homeId === match.homeId ? m.result.awayGoals : m.result.homeGoals;
  }
  return { home, away };
}

/** Whether this match must produce a winner (single-leg tie or second leg). */
export function isDecisive(match: ScheduledMatch, run: CompetitionRun): boolean {
  if (!match.tieId) return false;
  const tie = run.stages.flatMap((s) => s.rounds.flat()).find((t) => t.id === match.tieId);
  return !!tie && (tie.rules.legs === 1 || match.leg === 2);
}

/** Advances the competition after matches were played; schedules what comes next. */
export function advanceRun(run: CompetitionRun, format: CompetitionFormat, book: MatchBook): void {
  for (let guard = 0; guard < 20 && !run.champion; guard++) {
    const index = run.stages.length - 1;
    const stageRun = run.stages[index];
    const stage = format.stages[index];
    if (stageRun.advanced) return;

    if (isTable(stage)) {
      const matches = stageRun.matchIds.map((id) => book.get(id));
      if (matches.some((m) => m.status !== 'played')) return;
      const points = (stage as { points: { win: number; draw: number; loss: number } }).points;
      const tables = stageRun.groups.map((g) => groupTable(g, matches, points));
      if (stage.kind === 'groups') {
        const adv: string[] = [];
        for (let place = 0; place < stage.advancePerGroup; place++) for (const t of tables) adv.push(t[place].clubId);
        stageRun.advanced = adv;
      } else if (stage.kind === 'swiss') {
        stageRun.advanced = tables[0].slice(0, stage.advance).map((r) => r.clubId);
      } else {
        stageRun.advanced = tables[0].map((r) => r.clubId);
      }
    } else {
      const current = stageRun.rounds[stageRun.rounds.length - 1];
      for (const tie of current) tie.winner ??= tieWinner(tie, book);
      if (current.some((t) => !t.winner)) return;
      const winners = current.map((t) => t.winner!);
      const planned = knockoutRounds(stage, stageRun.clubs.length).length;
      if (winners.length > 1 && stageRun.rounds.length < planned) {
        scheduleKnockoutRound(run, stage, stageRun, winners, book);
        return;
      }
      stageRun.advanced = [...stageRun.byes, ...winners];
    }

    if (index + 1 < format.stages.length) {
      const next = format.stages[index + 1];
      startStage(run, format, index + 1, [...stageRun.advanced!, ...(run.extra[next.id] ?? [])], book);
    } else {
      run.champion = stageRun.advanced![0];
    }
  }
}

/** Joins clubs into a later stage after the run started (e.g. Libertadores thirds). */
export function setExtraEntrants(run: CompetitionRun, stageId: string, clubs: string[]): void {
  run.extra = { ...run.extra, [stageId]: clubs };
}

// ------------------------------------------------------------------ results view

function toMatchResult(m: ScheduledMatch): MatchResult {
  return { homeId: m.homeId, awayId: m.awayId, homeGoals: m.result!.homeGoals, awayGoals: m.result!.awayGoals, penalties: m.result!.penalties };
}

/** Same shape as the one-shot simulator's result, built from what has been played so far. */
export function runResult(run: CompetitionRun, format: CompetitionFormat, book: MatchBook): CompetitionResult {
  const stages: StageResult[] = run.stages.map((s, i) => {
    const stage = format.stages[i];
    const matches = s.matchIds.map((id) => book.get(id));
    const points = isTable(stage) ? (stage as { points: { win: number; draw: number; loss: number } }).points : null;
    return {
      stageId: s.stageId,
      matches: matches.filter((m) => m.status === 'played' && m.result).map(toMatchResult),
      tables: points ? s.groups.map((g) => groupTable(g, matches, points)) : [],
      rounds: s.rounds.filter((r) => r.every((t) => t.winner)).map((r) => r.map((t) => t.winner!)),
      advanced: s.advanced ?? [],
    };
  });
  return { formatId: format.id, stages, champion: run.champion ?? '' };
}
