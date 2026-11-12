// The season calendar: every division and cup scheduled on real dates, a pre-season for the
// user's club, and a day-by-day loop. The calendar is plain data and is saved with the game.
// Simplification: every country plays a calendar-year season (Jan–Dec), as Argentina does.

import { COMPETITIONS } from '../../data/competitions';
import { DIVISION_FORMATS } from '../../data/divisions';
import { EUROPE_FORMATS } from '../../data/europe';
import { COMPETITION_DEFS } from '../../data/cups';
import { type CompetitionResult } from '../competition';
import { cupOrder, resolveEntrants, type CompetitionSeason } from '../cups';
import { simulatePenalties, simulateScore, type TeamStrength } from '../match';
import { createRng, type Rng } from '../rng';
import { bestEleven } from '../squad';
import { teamStrength } from '../match';
import { POSITION_LINE, type CompetitionDef, type CompetitionFormat, type Player, type World } from '../types';
import type { MatchReport, ScheduledMatch } from '../game-types';
import { MIDWEEK, WEEKEND, addDays, daysBetween, nextWeekday, spreadSlots, weekday } from './dates';
import { REAL_CALENDARS } from '../../data/real';
import {
  advanceRun,
  aggregateBefore,
  groupTable,
  isDecisive,
  plannedSlots,
  runResult,
  setExtraEntrants,
  startRun,
  type CompetitionRun,
  type MatchBook,
} from './runner';

export const ALL_FORMATS: CompetitionFormat[] = [...DIVISION_FORMATS, ...COMPETITIONS, ...EUROPE_FORMATS, ...FRIENDLY_FORMATS()];

function FRIENDLY_FORMATS(): CompetitionFormat[] {
  return [
    {
      id: 'torneo-verano',
      name: 'Torneo de Verano',
      stages: [{ kind: 'knockout', id: 'final', name: 'Cuadro', tie: { legs: 1, awayGoals: false, neutralVenue: true } }],
    },
  ];
}

const formatById = new Map(ALL_FORMATS.map((f) => [f.id, f]));
export const formatOf = (id: string): CompetitionFormat => {
  const f = formatById.get(id);
  if (!f) throw new Error(`Unknown format ${id}`);
  return f;
};

export interface DeferredExtra {
  targetRunId: string;
  stageId: string;
  sourceRunId: string;
  sourceStageId: string;
  place: number;
}

export interface SeasonCalendar {
  season: number;
  /** Current day: everything before it has been played. */
  date: string;
  seed: number;
  userClubId: string | null;
  matches: ScheduledMatch[];
  runs: Record<string, CompetitionRun>;
  /** Run id → display name (division, cup, friendly tournament). */
  names: Record<string, string>;
  kinds: Record<string, 'division' | 'cup' | 'friendly'>;
  pending: Record<string, string>;
  deferred: DeferredExtra[];
  /** Runs waiting for deferred extras before starting the given stage. */
  waiting: Record<string, string>;
  nextId: number;
  endDate: string;
}

// ------------------------------------------------------------------ match book

const indexCache = new WeakMap<ScheduledMatch[], { byId: Map<string, ScheduledMatch>; busy: Map<string, Set<string>> }>();

function index(cal: SeasonCalendar) {
  let idx = indexCache.get(cal.matches);
  if (!idx) {
    idx = { byId: new Map(), busy: new Map() };
    for (const m of cal.matches) {
      idx.byId.set(m.id, m);
      for (const c of [m.homeId, m.awayId]) (idx.busy.get(c) ?? idx.busy.set(c, new Set()).get(c)!).add(m.date);
    }
    indexCache.set(cal.matches, idx);
  }
  return idx;
}

function bookFor(cal: SeasonCalendar): MatchBook {
  return {
    add(m) {
      const idx = index(cal);
      // Never in the past, and never two matches on the same day for one club.
      let date = m.date <= cal.date ? addDays(cal.date, 1) : m.date;
      for (let i = 0; i < 10 && [m.homeId, m.awayId].some((c) => idx.busy.get(c)?.has(date)); i++) date = addDays(date, 1);
      const match: ScheduledMatch = { ...m, date, id: `m${++cal.nextId}`, status: 'scheduled' };
      cal.matches.push(match);
      idx.byId.set(match.id, match);
      for (const c of [match.homeId, match.awayId]) (idx.busy.get(c) ?? idx.busy.set(c, new Set()).get(c)!).add(date);
      return match.id;
    },
    get(id) {
      const m = index(cal).byId.get(id);
      if (!m) throw new Error(`Unknown match ${id}`);
      return m;
    },
  };
}

// ------------------------------------------------------------------ creation

/** Leaves the World Cup weeks out of a window (Argentine competitions stop). */
function withoutWorldCup(w: SlotWindow, season: number): SlotWindow {
  return { ...w, blackout: { from: `${season}-${WORLD_CUP.from}`, to: `${season}-${WORLD_CUP.to}` } };
}

const window = (season: number, kind: 'division' | 'domestic' | 'continental' | 'supercup'): SlotWindow => {
  switch (kind) {
    case 'division':
      return { from: `${season}-02-07`, to: `${season}-11-29`, days: WEEKEND };
    case 'domestic':
      return { from: `${season}-03-04`, to: `${season}-11-18`, days: [3] };
    case 'continental':
      return { from: `${season}-03-03`, to: `${season}-11-26`, days: MIDWEEK };
    case 'supercup':
      return { from: `${season}-01-28`, to: `${season}-01-28`, days: [3] };
  }
};

/** 2026 World Cup: Argentine league football stops (real calendar). */
const WORLD_CUP = { from: '06-08', to: '07-20' };

interface SlotWindow {
  from: string;
  to: string;
  days: number[];
  /** Dates inside the window with no matches (e.g. the World Cup). */
  blackout?: { from: string; to: string };
}

function slotsFor(format: CompetitionFormat, entrants: number, extra: Record<string, number>, w: SlotWindow, realKey?: string, season?: number) {
  const planned = plannedSlots(format, entrants, extra);
  const real = realKey && season ? realStages(realKey, season) : null;
  if (real) return slotsFromReal(format, planned, real, w);
  const total = planned.reduce((s, n) => s + n, 0);
  if (!w.blackout) return spreadSlots(w.from, w.to, total, w.days);
  // Split the slots between the stretch before and after the break, by length.
  const before = Math.max(1, daysBetween(w.from, w.blackout.from));
  const after = Math.max(1, daysBetween(w.blackout.to, w.to));
  const n1 = Math.round((total * before) / (before + after));
  return [...spreadSlots(w.from, addDays(w.blackout.from, -1), n1, w.days), ...spreadSlots(addDays(w.blackout.to, 1), w.to, total - n1, w.days)];
}

/** Moves a real-calendar date from `baseSeason` to `season`, keeping the weekday. */
function shiftToSeason(date: string, baseSeason: number, season: number): string {
  if (season === baseSeason) return date;
  const moved = `${Number(date.slice(0, 4)) + (season - baseSeason)}${date.slice(4)}`;
  const target = weekday(date);
  for (let d = 0; d <= 3; d++) {
    for (const s of [d, -d]) {
      const c = addDays(moved, s);
      if (weekday(c) === target) return c;
    }
  }
  return moved;
}

/** Real stage dates of a competition (from data/real/calendar-*.json), shifted to the season. */
function realStages(key: string, season: number): { stage: string; dates: string[] }[] | null {
  const file = REAL_CALENDARS.find((f) => f.competitions[key]);
  const comp = file?.competitions[key];
  if (!file || !comp?.stages?.length) return null;
  // Seasons run January to December: a competition crossing into the next year (European
  // 2026-27 cups) keeps the approximate windows.
  if (comp.stages.some((s) => s.dates.some((d) => Number(d.slice(0, 4)) !== file.season))) return null;
  return comp.stages.map((s) => ({ stage: s.stage, dates: s.dates.filter(Boolean).map((d) => shiftToSeason(d, file.season, season)).sort() }));
}

const TABLE_STAGE = /grup|zona|liga|regular|league/i;

/**
 * Builds the competition's slot list from real stage dates: table stages take the dates of
 * the real group/league phases, knockout stages the dates of the real rounds, in order. When
 * our format needs more dates than the real calendar lists, extra ones follow a week apart.
 */
function slotsFromReal(format: CompetitionFormat, planned: number[], real: { stage: string; dates: string[] }[], w: SlotWindow): string[] {
  const tablePool = real.filter((s) => TABLE_STAGE.test(s.stage)).flatMap((s) => s.dates);
  const knockoutPool = real.filter((s) => !TABLE_STAGE.test(s.stage)).flatMap((s) => s.dates);
  const slots: string[] = [];
  const seasonEnd = `${(tablePool[0] ?? knockoutPool[0] ?? w.from).slice(0, 4)}-12-20`;
  format.stages.forEach((stage, i) => {
    const pool = stage.kind === 'knockout' ? knockoutPool : tablePool;
    const take = pool.splice(0, planned[i]);
    const missing = planned[i] - take.length;
    // Not enough real dates for our format: spread the rest before the end of the season.
    const lastReal = take[take.length - 1] ?? slots[slots.length - 1] ?? w.from;
    const extra = missing > 0 ? spreadSlots(addDays(lastReal, 3), seasonEnd, missing, w.days) : [];
    for (let d of [...take, ...extra]) {
      const last = slots[slots.length - 1];
      while (last && d <= last) d = addDays(d, 1);
      slots.push(d);
    }
  });
  return slots;
}

/** Default windows of a split-season tournament when the real calendar has no dates. */
const SPLIT_WINDOWS = {
  apertura: (season: number): SlotWindow => ({ from: `${season}-01-24`, to: `${season}-05-31`, days: WEEKEND }),
  clausura: (season: number): SlotWindow => ({ from: `${season}-07-24`, to: `${season}-12-13`, days: WEEKEND }),
};

function reputationOrder(world: World, ids: string[]): string[] {
  const rep = new Map(world.clubs.map((c) => [c.id, c.reputation]));
  return [...ids].sort((a, b) => (rep.get(b) ?? 0) - (rep.get(a) ?? 0));
}

/** Pre-season for the user's club: friendlies against similar clubs and, for top-flight clubs, a summer tournament. */
function schedulePreseason(world: World, cal: SeasonCalendar, book: MatchBook) {
  const user = world.clubs.find((c) => c.id === cal.userClubId);
  if (!user) return;
  const rng = createRng(cal.seed ^ 0x5eed);
  const division = world.divisions.find((d) => d.clubIds.includes(user.id));
  const sameCountry = world.clubs.filter((c) => c.id !== user.id && c.country === user.country);
  const similar = sameCountry.filter((c) => Math.abs(c.reputation - user.reputation) <= 10);
  const rivals = rng.shuffle(similar.length >= 3 ? similar : sameCountry).slice(0, 3);
  ['-01-10', '-01-14', '-01-18'].forEach((d, i) => {
    const rival = rivals[i];
    if (!rival) return;
    const home = i % 2 === 0;
    book.add({
      date: `${cal.season}${d}`, competitionId: 'amistoso', stageId: 'amistoso', round: i + 1,
      homeId: home ? user.id : rival.id, awayId: home ? rival.id : user.id, neutral: false,
    });
  });

  if (division?.level === 1) {
    const others = reputationOrder(world, division.clubIds.filter((id) => id !== user.id)).slice(0, 3);
    const entrants = reputationOrder(world, [user.id, ...others]);
    const format = formatOf('torneo-verano');
    const run = startRun('torneo-verano', format, entrants, {}, [`${cal.season}-01-22`, `${cal.season}-01-25`], cal.seed, book);
    cal.runs[run.id] = run;
    cal.names[run.id] = user.country === 'ARG' ? 'Torneo de Verano' : 'Torneo de pretemporada';
    cal.kinds[run.id] = 'friendly';
  }
}

export function createSeasonCalendar(world: World, userClubId: string | null): SeasonCalendar {
  const season = world.season;
  const cal: SeasonCalendar = {
    season,
    date: `${season}-01-05`,
    seed: (world.seed ^ (season * 7919)) >>> 0,
    userClubId,
    matches: [],
    runs: {},
    names: {},
    kinds: {},
    pending: {},
    deferred: [],
    waiting: {},
    nextId: 0,
    endDate: `${season}-12-20`,
  };
  const book = bookFor(cal);

  schedulePreseason(world, cal, book);

  for (const division of world.divisions) {
    const format = formatOf(division.formatId);
    const entrants = reputationOrder(world, division.clubIds);
    if (division.splitSeason) {
      // Apertura (first half) and Clausura (second half, after the World Cup break).
      const a = slotsFor(format, entrants.length, {}, SPLIT_WINDOWS.apertura(season), `${division.id}-apertura`, season);
      const c = slotsFor(format, entrants.length, {}, SPLIT_WINDOWS.clausura(season), `${division.id}-clausura`, season);
      cal.runs[division.id] = startRun(division.id, format, entrants, {}, a, cal.seed, book);
      cal.runs[`${division.id}-clausura`] = startRun(`${division.id}-clausura`, format, entrants, {}, c, (cal.seed ^ 0xc1a05) >>> 0, book);
      cal.names[division.id] = `Torneo Apertura (${division.name})`;
      cal.names[`${division.id}-clausura`] = `Torneo Clausura (${division.name})`;
      cal.kinds[division.id] = 'division';
      cal.kinds[`${division.id}-clausura`] = 'division';
      continue;
    }
    const w = window(season, 'division');
    const slots = slotsFor(format, entrants.length, {}, division.country === 'ARG' ? withoutWorldCup(w, season) : w, division.id, season);
    cal.runs[division.id] = startRun(division.id, format, entrants, {}, slots, cal.seed, book);
    cal.names[division.id] = division.name;
    cal.kinds[division.id] = 'division';
  }

  const defs = world.competitions ?? COMPETITION_DEFS;
  const taken = new Set<string>();
  for (const def of cupOrder(defs)) {
    const fixed = world.fixedEntrants?.season === season ? world.fixedEntrants.entrants[def.id] : undefined;
    const usable = fixed && fixed.length === def.size && !(def.scope === 'continental' && fixed.some((id) => taken.has(id)));
    const { entrants } = usable ? { entrants: fixed } : resolveEntrants(def, world, new Map(), def.scope === 'continental' ? taken : new Set());
    if (entrants.length !== def.size) {
      cal.pending[def.id] = `Faltan clubes clasificados: ${entrants.length} de ${def.size} (se completará al sumar más países).`;
      cal.names[def.id] = def.name;
      cal.kinds[def.id] = 'cup';
      continue;
    }
    const format = formatOf(def.formatId);
    const later = deferredRules(def);
    const extraCounts = Object.fromEntries(later.map((r) => [r.stageId, expectedExtra(defs, r)]));
    const base = window(season, def.id === 'uefa-supercup' ? 'supercup' : def.scope === 'continental' ? 'continental' : 'domestic');
    const w = def.confederation === 'CONMEBOL' || def.country === 'ARG' ? withoutWorldCup(base, season) : base;
    const run = startRun(def.id, format, entrants, {}, slotsFor(format, entrants.length, extraCounts, w, def.id, season), cal.seed, book);
    cal.runs[def.id] = run;
    cal.names[def.id] = def.name;
    cal.kinds[def.id] = 'cup';
    for (const r of later) {
      cal.deferred.push({ targetRunId: def.id, stageId: r.stageId, sourceRunId: r.sourceRunId, sourceStageId: r.sourceStageId, place: r.place });
      cal.waiting[def.id] = r.stageId;
    }
    if (def.scope === 'continental') entrants.forEach((id) => taken.add(id));
  }
  // Clubs that later join a cup (e.g. Libertadores thirds) are already counted in the slot plan.
  return cal;
}

function deferredRules(def: CompetitionDef) {
  return def.entries.flatMap((r) =>
    r.kind === 'group-place' ? [{ stageId: r.joinStageId, sourceRunId: r.competitionId, sourceStageId: r.stageId, place: r.place }] : [],
  );
}

/** Clubs a deferred rule will add: one per group of the source stage. */
function expectedExtra(defs: CompetitionDef[], r: { sourceRunId: string; sourceStageId: string }): number {
  const source = defs.find((d) => d.id === r.sourceRunId);
  const stage = source && formatById.get(source.formatId)?.stages.find((s) => s.id === r.sourceStageId);
  return stage && stage.kind === 'groups' ? stage.groupCount : 0;
}

// ------------------------------------------------------------------ playing days

/** Players grouped by club, built once per players array (worlds change every day in a career). */
const squadIndex = new WeakMap<Player[], Map<string, Player[]>>();
function squadsOf(world: World): Map<string, Player[]> {
  let idx = squadIndex.get(world.players);
  if (!idx) {
    idx = new Map();
    for (const p of world.players) if (p.clubId) (idx.get(p.clubId) ?? idx.set(p.clubId, []).get(p.clubId)!).push(p);
    squadIndex.set(world.players, idx);
  }
  return idx;
}

/** Available players only: injured and suspended players miss matches. */
const available = (p: Player) => !p.youth && (!p.condition || (p.condition.injuryDays <= 0 && p.condition.suspensionMatches <= 0));

const strengthCache = new WeakMap<Player[], Map<string, TeamStrength>>();
function strengthOf(world: World, clubId: string): TeamStrength {
  let cache = strengthCache.get(world.players);
  if (!cache) strengthCache.set(world.players, (cache = new Map()));
  let s = cache.get(clubId);
  if (!s) {
    s = teamStrength(bestEleven((squadsOf(world).get(clubId) ?? []).filter(available)));
    cache.set(clubId, s);
  }
  return s;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function runOf(cal: SeasonCalendar, m: ScheduledMatch): CompetitionRun | undefined {
  return cal.runs[m.competitionId];
}

const elevenCache = new WeakMap<Player[], Map<string, Player[]>>();
function elevenOf(world: World, clubId: string): Player[] {
  let cache = elevenCache.get(world.players);
  if (!cache) elevenCache.set(world.players, (cache = new Map()));
  let xi = cache.get(clubId);
  if (!xi) cache.set(clubId, (xi = bestEleven((squadsOf(world).get(clubId) ?? []).filter(available))));
  return xi;
}

const SCORING_WEIGHT = { ARQ: 0, DEF: 0.35, MED: 1, DEL: 2.6 } as const;

/** Picks who scored each goal, weighted by line and finishing skills. */
function pickScorers(world: World, clubId: string, goals: number, rng: Rng): { clubId: string; playerId: string; minute: number }[] {
  const xi = elevenOf(world, clubId);
  const weights = xi.map((p) => SCORING_WEIGHT[POSITION_LINE[p.position]] * (p.attributes.shooting + p.attributes.heading));
  const total = weights.reduce((s, w) => s + w, 0);
  const out: { clubId: string; playerId: string; minute: number }[] = [];
  for (let g = 0; g < goals && total > 0; g++) {
    let r = rng.next() * total;
    const i = weights.findIndex((w) => (r -= w) <= 0);
    out.push({ clubId, playerId: xi[i < 0 ? xi.length - 1 : i].id, minute: rng.int(1, 90) });
  }
  return out;
}

/** Quick simulation for matches nobody watches; decisive knockout legs get penalties when level. */
function quickResult(world: World, cal: SeasonCalendar, m: ScheduledMatch, book: MatchBook) {
  const rng = createRng((cal.seed ^ hashId(m.id)) >>> 0);
  const score = simulateScore(strengthOf(world, m.homeId), strengthOf(world, m.awayId), rng, m.neutral);
  const scorers = [...pickScorers(world, m.homeId, score.homeGoals, rng), ...pickScorers(world, m.awayId, score.awayGoals, rng)].sort(
    (a, b) => a.minute - b.minute,
  );
  return { ...withPenalties(cal, m, book, score, rng), scorers };
}

/** Top scorers of a competition (all its stages), best first. */
export function topScorers(cal: SeasonCalendar, competitionId: string, limit = 20): { playerId: string; clubId: string; goals: number }[] {
  const goals = new Map<string, { playerId: string; clubId: string; goals: number }>();
  for (const m of cal.matches) {
    if (m.competitionId !== competitionId || m.status !== 'played') continue;
    for (const s of m.result?.scorers ?? []) {
      const row = goals.get(s.playerId) ?? { playerId: s.playerId, clubId: s.clubId, goals: 0 };
      row.goals++;
      goals.set(s.playerId, row);
    }
  }
  return [...goals.values()].sort((a, b) => b.goals - a.goals).slice(0, limit);
}

/** Goals conceded per club in a competition, for the "arquero menos vencido" table. */
export function leastConceded(cal: SeasonCalendar, competitionId: string): { clubId: string; conceded: number; played: number }[] {
  const rows = new Map<string, { clubId: string; conceded: number; played: number }>();
  for (const m of cal.matches) {
    if (m.competitionId !== competitionId || m.status !== 'played' || !m.result) continue;
    for (const [club, against] of [[m.homeId, m.result.awayGoals], [m.awayId, m.result.homeGoals]] as const) {
      const r = rows.get(club) ?? { clubId: club, conceded: 0, played: 0 };
      r.conceded += against;
      r.played++;
      rows.set(club, r);
    }
  }
  return [...rows.values()].sort((a, b) => a.conceded / Math.max(1, a.played) - b.conceded / Math.max(1, b.played));
}

function withPenalties(
  cal: SeasonCalendar,
  m: ScheduledMatch,
  book: MatchBook,
  score: { homeGoals: number; awayGoals: number; penalties?: { home: number; away: number } },
  rng = createRng((cal.seed ^ hashId(`${m.id}:pk`)) >>> 0),
) {
  const run = runOf(cal, m);
  if (!run || !isDecisive(m, run) || score.penalties) return score;
  const before = aggregateBefore(m, book, run) ?? { home: 0, away: 0 };
  const level = before.home + score.homeGoals === before.away + score.awayGoals;
  return level ? { ...score, penalties: simulatePenalties(rng) } : score;
}

/** Knockout context of a match for the detailed engine: must it produce a winner, and the first-leg score. */
export function knockoutContext(
  cal: SeasonCalendar,
  m: ScheduledMatch,
): { needWinner: boolean; extraTime: boolean; aggregate?: { home: number; away: number } } | undefined {
  const run = runOf(cal, m);
  if (!run || !isDecisive(m, run)) return undefined;
  const aggregate = m.leg === 2 ? (aggregateBefore(m, bookFor(cal), run) ?? undefined) : undefined;
  return { needWinner: true, extraTime: m.leg !== 2 && cal.kinds[m.competitionId] === 'cup', aggregate };
}

export function matchesOn(cal: SeasonCalendar, date: string): ScheduledMatch[] {
  return cal.matches.filter((m) => m.date === date && m.status === 'scheduled');
}

export function nextUserMatch(cal: SeasonCalendar): ScheduledMatch | undefined {
  if (!cal.userClubId) return undefined;
  return cal.matches
    .filter((m) => m.status === 'scheduled' && (m.homeId === cal.userClubId || m.awayId === cal.userClubId))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** Resolves clubs joining later stages once their source stage is complete. */
function resolveDeferred(cal: SeasonCalendar, book: MatchBook) {
  for (const d of cal.deferred) {
    const target = cal.runs[d.targetRunId];
    const source = cal.runs[d.sourceRunId];
    if (!target || target.extra[d.stageId]) continue;
    if (!source) {
      setExtraEntrants(target, d.stageId, []); // source cup pending: nobody drops in
      continue;
    }
    const stage = source.stages.find((s) => s.stageId === d.sourceStageId);
    if (!stage?.advanced) continue;
    const result = runResult(source, formatOf(source.formatId), book);
    const tables = result.stages.find((s) => s.stageId === d.sourceStageId)?.tables ?? [];
    setExtraEntrants(target, d.stageId, tables.map((t) => t[d.place - 1]?.clubId).filter((x): x is string => !!x));
  }
  for (const [runId, stageId] of Object.entries(cal.waiting)) {
    if (cal.runs[runId]?.extra[stageId]) delete cal.waiting[runId];
  }
}

function advanceAll(cal: SeasonCalendar, book: MatchBook) {
  resolveDeferred(cal, book);
  for (const run of Object.values(cal.runs)) {
    if (run.champion) continue;
    const waitingStage = cal.waiting[run.id];
    const format = formatOf(run.formatId);
    const nextStage = format.stages[run.stages.length]?.id;
    // Hold a run whose next stage needs clubs that are not known yet.
    if (waitingStage && waitingStage === nextStage) {
      const current = run.stages[run.stages.length - 1];
      if (current.matchIds.every((id) => book.get(id).status === 'played')) continue;
    }
    advanceRun(run, format, book);
  }
}

export interface DayResult {
  played: ScheduledMatch[];
}

/**
 * Plays every match of the current day and moves to the next one.
 * `reports` holds detailed reports for matches the user watched (by match id).
 */
export function playDay(world: World, cal: SeasonCalendar, reports: Record<string, MatchReport> = {}): DayResult {
  const book = bookFor(cal);
  const today = matchesOn(cal, cal.date);
  for (const m of today) {
    const report = reports[m.id];
    const score = report
      ? withPenalties(cal, m, book, { homeGoals: report.homeGoals, awayGoals: report.awayGoals, penalties: report.penalties })
      : quickResult(world, cal, m, book);
    m.result = score;
    m.status = 'played';
    if (report) m.report = report;
  }
  advanceAll(cal, book);
  cal.date = addDays(cal.date, 1);
  return { played: today };
}

/** Plays days until (not including) the next day the user's club plays, or until `until`. */
export function playUntilUserMatch(world: World, cal: SeasonCalendar, until = cal.endDate): ScheduledMatch | undefined {
  for (let guard = 0; guard < 400 && cal.date <= until; guard++) {
    const next = nextUserMatch(cal);
    if (next && next.date === cal.date) return next;
    if (isSeasonOver(cal)) return undefined;
    playDay(world, cal);
  }
  return nextUserMatch(cal);
}

export function isSeasonOver(cal: SeasonCalendar): boolean {
  return cal.matches.every((m) => m.status === 'played') && Object.values(cal.runs).every((r) => r.champion);
}

/** Plays the rest of the season with quick simulation. */
export function playToEnd(world: World, cal: SeasonCalendar): void {
  for (let guard = 0; guard < 500 && !isSeasonOver(cal); guard++) {
    // Jump straight to the next date with matches.
    const next = cal.matches.filter((m) => m.status === 'scheduled').reduce<string | null>((d, m) => (!d || m.date < d ? m.date : d), null);
    if (next && next > cal.date) cal.date = next;
    playDay(world, cal);
  }
}

// ------------------------------------------------------------------ results

/**
 * A division's season result. For split seasons (Apertura + Clausura) it is the annual table:
 * every match of both tournaments, ranked by total points; its leader is the "champion"
 * used for qualification, while each tournament keeps its own champion.
 */
export function divisionSeasonResult(cal: SeasonCalendar, divisionId: string): CompetitionResult | null {
  const first = competitionResult(cal, divisionId);
  const second = competitionResult(cal, `${divisionId}-clausura`);
  if (!first || !second) return first;
  const clubs = cal.runs[divisionId].stages[0].clubs;
  const book = bookFor(cal);
  const ids = [...cal.runs[divisionId].stages, ...cal.runs[`${divisionId}-clausura`].stages].flatMap((s) => s.matchIds);
  const table = groupTable(clubs, ids.map((id) => book.get(id)), { win: 3, draw: 1, loss: 0 });
  return {
    formatId: 'tabla-anual',
    champion: table[0].clubId,
    stages: [{ stageId: 'anual', matches: [...first.stages, ...second.stages].flatMap((s) => s.matches), tables: [table], rounds: [], advanced: table.map((r) => r.clubId) }],
  };
}

export function competitionResult(cal: SeasonCalendar, runId: string): CompetitionResult | null {
  const run = cal.runs[runId];
  return run ? runResult(run, formatOf(run.formatId), bookFor(cal)) : null;
}

/** Cup outcomes in the summary shape used by the UI and qualification. */
export function cupSeasons(world: World, cal: SeasonCalendar): CompetitionSeason[] {
  const book = bookFor(cal);
  const defs = world.competitions ?? COMPETITION_DEFS;
  return cupOrder(defs).map((def) => {
    const run = cal.runs[def.id];
    if (!run) return { competitionId: def.id, entrants: [], pending: cal.pending[def.id] };
    const stage0 = run.stages[0];
    return { competitionId: def.id, entrants: stage0.clubs, result: runResult(run, formatOf(run.formatId), book) };
  });
}

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOP';

/** Name of a knockout round from the number of ties still to be played in it. */
export function roundName(ties: number): string {
  if (ties === 1) return 'Final';
  if (ties === 2) return 'Semifinales';
  if (ties === 4) return 'Cuartos de final';
  if (ties === 8) return 'Octavos de final';
  if (ties === 16) return 'Dieciseisavos de final';
  if (ties === 32) return 'Treintaidosavos de final';
  return `Ronda de ${ties * 2}`;
}

export interface MatchLabel {
  /** "Copa Libertadores", "Liga Profesional", "Amistoso". */
  competition: string;
  /** "Fecha 3", "Grupo C · Fecha 2", "Octavos de final (vuelta)", "Play-offs (ida)". */
  stage: string;
  /** Both together, for headers. */
  full: string;
}

/** Human description of what a match is: competition, matchday or round, group and leg. */
export function matchLabel(cal: SeasonCalendar, m: ScheduledMatch): MatchLabel {
  if (m.competitionId === 'amistoso') return { competition: 'Amistoso', stage: 'Pretemporada', full: 'Amistoso de pretemporada' };
  const competition = cal.names[m.competitionId] ?? m.competitionId;
  const run = cal.runs[m.competitionId];
  const format = run ? formatById.get(run.formatId) : undefined;
  const stage = format?.stages.find((s) => s.id === m.stageId);
  let text = '';
  if (!stage || stage.kind === 'league' || stage.kind === 'swiss') {
    text = `${stage?.kind === 'swiss' ? 'Fase de liga · ' : ''}Fecha ${m.round}`;
  } else if (stage.kind === 'groups') {
    const zone = format!.id === 'liga-profesional' || format!.id.startsWith('primera') || format!.id === 'federal-a' ? 'Zona' : 'Grupo';
    text = `${zone} ${GROUP_LETTERS[m.group ?? 0] ?? (m.group ?? 0) + 1} · Fecha ${m.round}`;
  } else {
    const stageRun = run!.stages.find((s) => s.stageId === m.stageId);
    const ties = stageRun?.rounds[m.round]?.length ?? 1;
    const name = stage.maxRounds === 1 ? stage.name : roundName(ties);
    const leg = m.leg && stageRun?.rounds[m.round]?.[0]?.rules.legs === 2 ? (m.leg === 1 ? ' (ida)' : ' (vuelta)') : '';
    text = `${name}${leg}`;
  }
  return { competition, stage: text, full: `${competition} · ${text}` };
}

/** First match day of the regular season (for "Entrar en temporada"). */
export function seasonStart(cal: SeasonCalendar): string {
  return nextWeekday(`${cal.season}-02-07`, WEEKEND);
}
