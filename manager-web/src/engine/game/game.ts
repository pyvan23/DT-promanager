// Game layer: one saveable state for a career and the commands the UI sends
// (like the original's CMODA* messages). Ties together the season calendar, the
// transfer market, the club's finances and board, and news.

import {
  addTransactions,
  completeWorks,
  endOfSeasonEvaluation,
  expectedPosition,
  objectiveFor,
  averagePlayerWage,
  initialClubState,
  jobOffers,
  matchdayIncome,
  monthlyUpdate,
  prizeTransaction,
  shouldFireMidSeason,
  updateBoardAfterMatch,
  type ClubContext,
  type JobOffer,
  type StadiumWork,
} from '../club';
import {
  aiTransferActivity,
  defaultWindows,
  dueLoans,
  evaluateOffer,
  executeLoan,
  executeTransfer,
  isWindowOpen,
  marketAfterTransfer,
  playerAcceptsContract,
  playerValue,
  fairWage,
  returnLoan,
  withInitialContracts,
  estimateTransferBudget,
  type LoanRecord,
} from '../market';
import {
  createSeasonCalendar,
  isSeasonOver,
  leastConceded,
  nextUserMatch,
  playDay,
  topScorers,
  type SeasonCalendar,
} from '../calendar/calendar';
import type { DetailedMatchReport } from '../matchday';
import { overall as overallOf } from '../squad';
import { createRng, type Rng } from '../rng';
import { applyMatchToSquad, dailyRecovery, simulateUserMatchDetailed } from './matchday-bridge';
import { DEFAULT_TRAINING, weeklyTraining, type TrainingPlan, type TrainingReport } from './training';
import { achievementPoints, type Achievement, type AchievementKind } from './achievements';
import { addDays, weekday } from '../calendar/dates';
import { developPlayers, expireContracts, promoteYouth as promoteYouthPlayer, retirePlayers, youthIntake } from './season-end';
import { finishSeason, type SeasonSummary } from '../season';
import type { Club, Division, World } from '../types';
import type { ClubState, Contract, MarketState, MatchReport, ScheduledMatch, Tactics, TransferOffer, Lineup } from '../game-types';

export type NewsKind = 'partido' | 'mercado' | 'directiva' | 'lesion' | 'club' | 'temporada';

export interface NewsItem {
  id: string;
  date: string;
  kind: NewsKind;
  title: string;
  body: string;
}

/** Mánager: pick any club, no sackings. Pro Mánager: start at a small club, build a reputation, get job offers. */
export type GameMode = 'manager' | 'promanager';
export type MatchMode = 'vivo' | 'simulado';

export interface GameSettings {
  /** How the user's matches are played by default ("Jugar partido"). */
  matchMode: MatchMode;
  /** Which "¡Campeón!" screens to show: every title in the world, only important ones, or only the user's competitions. */
  champions?: 'todos' | 'importantes' | 'mios';
}

/**
 * Something to show full-screen, like the original game: a champion anywhere in the world, or
 * a competition the user plays (or an important one) starting with its draw.
 */
export interface GameEvent {
  id: string;
  kind: 'campeon' | 'inicio';
  date: string;
  /** Run id in the calendar (division, cup, friendly tournament). */
  competitionId: string;
  clubId?: string;
  runnerUpId?: string;
  /** The user's club plays this competition. */
  mine: boolean;
  /** Set when the user won it: the achievement to celebrate and share. */
  achievementId?: string;
  /** Top flights, continental cups and the user's country's cup. */
  important: boolean;
}

/** 'completo': the manager also runs transfers, contracts and finances. 'entrenador': coaching only. */
export type GameScope = 'completo' | 'entrenador';

export interface GameState {
  version: 2;
  mode: GameMode;
  scope: GameScope;
  training: TrainingPlan;
  lastTraining?: TrainingReport;
  /** Full-screen events not shown yet (oldest first). */
  events: GameEvent[];
  /** Titles and promotions of this career, with their ranking points. */
  achievements: Achievement[];
  managerName: string;
  settings: GameSettings;
  /** Pro Mánager: offers from other clubs at the end of a season (accept with takeJob). */
  seasonOffers?: JobOffer[];
  world: World;
  calendar: SeasonCalendar;
  userClubId: string;
  club: ClubState;
  works: StadiumWork[];
  market: MarketState;
  loans: LoanRecord[];
  /** Transfer money of AI clubs this season. */
  budgets: Record<string, number>;
  news: NewsItem[];
  lastSummary: SeasonSummary | null;
  managerReputation: number;
  /** Set when the board sacks the manager; the UI offers `jobOffers`. */
  fired?: { date: string; message: string; offers: JobOffer[] };
  newsSeq: number;
}

/** Optional hook to play the user's match with the detailed engine (set by the matchday module). */
export type UserMatchSimulator = (game: GameState, match: ScheduledMatch) => MatchReport | undefined;

// ------------------------------------------------------------------ helpers

const rngFor = (g: GameState, key: string): Rng => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return createRng((g.world.seed ^ h ^ g.calendar.season) >>> 0);
};

export function clubOf(world: World, id: string): Club {
  const c = world.clubs.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown club ${id}`);
  return c;
}

export function divisionOf(world: World, clubId: string): Division {
  const d = world.divisions.find((x) => x.clubIds.includes(clubId));
  if (!d) throw new Error(`Club ${clubId} has no division`);
  return d;
}

const contextOf = (g: GameState): ClubContext => ({ club: clubOf(g.world, g.userClubId), division: divisionOf(g.world, g.userClubId) });

function pushNews(g: GameState, date: string, kind: NewsKind, title: string, body: string): void {
  g.news = [{ id: `n${++g.newsSeq}`, date, kind, title, body }, ...g.news].slice(0, 200);
}

const money = (n: number) =>
  n >= 1e6 ? `US$ ${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `US$ ${Math.round(n / 1e3)} mil` : `US$ ${Math.round(n)}`;

function initialBudgets(world: World, userClubId: string): Record<string, number> {
  return Object.fromEntries(world.clubs.filter((c) => c.id !== userClubId).map((c) => [c.id, estimateTransferBudget(c)]));
}

// ------------------------------------------------------------------ new game / season

export interface NewGameOptions {
  mode?: GameMode;
  scope?: GameScope;
  managerName?: string;
  matchMode?: MatchMode;
}

/** Reputation of a newcomer manager in Pro Mánager: only small clubs will call. */
export const PRO_START_REPUTATION = 24;

/**
 * Pro Mánager: the first offers for an unknown manager. In Argentina they come from the best
 * clubs of the Primera B Metropolitana and the weakest of the Primera Nacional; elsewhere from
 * the bottom of the second division (or of the top flight when there is no second one).
 */
export function proManagerOffers(world: World, seed: number, country = 'ARG'): JobOffer[] {
  const rng = createRng((world.seed ^ seed ^ 0x9e3779b9) >>> 0);
  const rep = new Map(world.clubs.map((c) => [c.id, c.reputation]));
  const byRep = (ids: string[]) => [...ids].sort((a, b) => (rep.get(b) ?? 0) - (rep.get(a) ?? 0));
  const divs = world.divisions.filter((d) => d.country === country);
  let pool: string[] = [];
  if (country === 'ARG') {
    const metro = divs.find((d) => d.id === 'b-metro');
    const nacional = divs.find((d) => d.id === 'nacional');
    pool = [...(metro ? byRep(metro.clubIds).slice(0, 6) : []), ...(nacional ? byRep(nacional.clubIds).slice(-8) : [])];
  } else {
    const second = divs.find((d) => d.level === 2);
    const first = divs.find((d) => d.level === 1);
    pool = second ? byRep(second.clubIds).slice(-8) : first ? byRep(first.clubIds).slice(-6) : [];
  }
  return rng
    .shuffle(pool)
    .slice(0, 4)
    .map((id) => {
      const club = clubOf(world, id);
      const division = divisionOf(world, id);
      return {
        clubId: id,
        clubName: club.name,
        divisionId: division.id,
        divisionName: division.name,
        objective: objectiveFor(club, division, world),
        wage: Math.round((averagePlayerWage(club, division.level) * 1.5) / 100) * 100,
      };
    });
}

export function newGame(baseWorld: World, userClubId: string, opts: NewGameOptions = {}): GameState {
  const world = withInitialContracts(baseWorld, createRng(baseWorld.seed ^ 0xc0ffee));
  const club = clubOf(world, userClubId);
  const division = divisionOf(world, userClubId);
  const state: ClubState = initialClubState(club, division, world, world.season, createRng(world.seed ^ 0x51ad));
  const mode = opts.mode ?? 'manager';
  const g: GameState = {
    version: 2,
    mode,
    scope: opts.scope ?? 'completo',
    training: DEFAULT_TRAINING,
    events: [],
    achievements: [],
    managerName: opts.managerName?.trim() || 'El DT',
    settings: { matchMode: opts.matchMode ?? 'vivo' },
    world,
    calendar: createSeasonCalendar(world, userClubId),
    userClubId,
    club: state,
    works: [],
    market: { transferList: [], loanList: [], offers: [], windows: defaultWindows(world.season) },
    loans: [],
    budgets: initialBudgets(world, userClubId),
    news: [],
    lastSummary: null,
    managerReputation: mode === 'promanager' ? PRO_START_REPUTATION : Math.max(20, club.reputation - 15),
    newsSeq: 0,
  };
  pushNews(g, g.calendar.date, 'club', `Nuevo DT en ${club.shortName}`, `La comisión directiva te presentó como nuevo entrenador. El objetivo: ${objectiveText(state.board.objective)}.`);
  return g;
}

export function objectiveText(o: ClubState['board']['objective']): string {
  return { campeon: 'salir campeón', 'clasificar-copa': 'clasificar a una copa', 'mitad-tabla': 'terminar en la mitad de la tabla', 'no-descender': 'no descender', ascender: 'ascender' }[o];
}

/** Closes the season (evaluation, promotions) and starts the next one. */
export function endSeason(g: GameState): GameState {
  const { summary, next } = finishSeason(g.world, g.calendar);
  const div = summary.divisions.find((d) => d.ranking.includes(g.userClubId))!;
  const position = div.ranking.indexOf(g.userClubId) + 1;
  const titles = [...summary.divisions, ...summary.competitions].filter((c) => c.result?.champion === g.userClubId).length;
  const evaluation = endOfSeasonEvaluation(
    g.club.board,
    position,
    div.ranking.length,
    div.promoted.includes(g.userClubId),
    div.relegated.includes(g.userClubId),
    titles,
    0,
  );
  const date = g.calendar.date;
  const out: GameState = { ...g, world: next, lastSummary: summary };
  pushNews(out, date, 'temporada', `Fin de la temporada ${summary.season}`, `${clubOf(next, g.userClubId).shortName} terminó ${position}.º en ${g.calendar.names[div.divisionId]}. ${evaluation.message}`);

  // Awards of the user's division.
  const scorer = topScorers(g.calendar, div.divisionId, 1)[0];
  if (scorer) {
    const p = g.world.players.find((x) => x.id === scorer.playerId);
    pushNews(out, date, 'temporada', `Goleador: ${p?.name ?? '—'}`, `${scorer.goals} goles para ${clubOf(g.world, scorer.clubId).shortName} en ${g.calendar.names[div.divisionId]}.`);
  }
  const wall = leastConceded(g.calendar, div.divisionId)[0];
  if (wall) pushNews(out, date, 'temporada', `Valla menos vencida: ${clubOf(g.world, wall.clubId).shortName}`, `${wall.conceded} goles recibidos en ${wall.played} partidos.`);

  // Between seasons: development, retirements, contracts and the academy.
  const rng = rngFor(out, `between:${next.season}`);
  out.world = developPlayers(out.world, next.season, rng);
  const retired = retirePlayers(out.world, next.season, rng);
  out.world = retired.world;
  const mine = retired.retired.filter((p) => p.clubId === g.userClubId);
  if (mine.length) pushNews(out, date, 'club', 'Retiros', `Se retiraron: ${mine.map((p) => p.name).join(', ')}.`);
  // In coach-only careers the club renews contracts on its own, like any AI club.
  const expired = expireContracts(out.world, next.season, g.scope === 'entrenador' ? '' : g.userClubId, rng);
  out.world = expired.world;
  if (expired.userLeft.length) pushNews(out, date, 'mercado', 'Contratos vencidos', `Quedaron libres: ${expired.userLeft.map((p) => p.name).join(', ')}.`);
  const intake = youthIntake(out.world, next.season, g.userClubId, g.club.staff, rng);
  out.world = intake.world;
  if (intake.userYouth.length) pushNews(out, date, 'club', 'Llegan juveniles', `Subieron de las inferiores: ${intake.userYouth.map((p) => `${p.name} (${p.position})`).join(', ')}. Podés promoverlos al plantel.`);

  // Loans end with the season.
  for (const loan of out.loans) out.world = returnLoan(out.world, loan);
  out.loans = [];

  const club = clubOf(out.world, g.userClubId);
  const division = divisionOf(out.world, g.userClubId);
  out.club = { ...g.club, board: evaluation.board };
  out.calendar = createSeasonCalendar(out.world, g.userClubId);
  out.market = { transferList: [], loanList: [], offers: [], windows: defaultWindows(out.world.season) };
  out.budgets = initialBudgets(out.world, g.userClubId);
  out.club = { ...out.club, finances: { ...out.club.finances, transferBudget: Math.max(out.club.finances.transferBudget, estimateTransferBudget(club)) } };
  if (div.promoted.includes(g.userClubId)) {
    out.achievements = [...(g.achievements ?? [])];
    const a = recordAchievement({ ...out, world: g.world, calendar: g.calendar }, 'ascenso', div.divisionId, date);
    if (a) {
      out.achievements = [...out.achievements.filter((x) => x.id !== a.id), a];
      out.events = [...(out.events ?? []), { id: `ascenso:${div.divisionId}:${g.calendar.season}`, kind: 'campeon', date, competitionId: div.divisionId, clubId: g.userClubId, mine: true, important: true, achievementId: a.id }];
    }
  }

  // Manager reputation: titles and promotions, and finishing above or below what the club was expected to.
  const expected = expectedPosition(clubOf(g.world, g.userClubId), divisionOf(g.world, g.userClubId), g.world);
  const beat = Math.max(-5, Math.min(5, Math.round(((expected - position) / Math.max(1, div.ranking.length)) * 12)));
  const delta = titles * 4 + (div.promoted.includes(g.userClubId) ? 5 : 0) - (div.relegated.includes(g.userClubId) ? 6 : 0) + beat;
  out.managerReputation = Math.max(10, Math.min(99, out.managerReputation + delta));

  if (evaluation.fired && g.mode === 'promanager') {
    out.fired = { date, message: evaluation.message, offers: jobOffers(out.world, out.managerReputation, rngFor(out, 'jobs'), [club.id]) };
  } else {
    pushNews(out, out.calendar.date, 'directiva', `Objetivo ${out.world.season}`, `La directiva de ${club.shortName} (${division.name}) espera ${objectiveText(out.club.board.objective)}.`);
    if (g.mode === 'promanager') {
      // Bigger clubs call a manager who did well.
      out.seasonOffers = jobOffers(out.world, out.managerReputation, rngFor(out, 'offers'), [club.id]).filter(
        (o) => clubOf(out.world, o.clubId).reputation > club.reputation,
      );
      if (out.seasonOffers.length) {
        pushNews(out, date, 'club', 'Te quieren otros clubes', `Recibiste ${out.seasonOffers.length} oferta${out.seasonOffers.length > 1 ? 's' : ''} para dirigir: ${out.seasonOffers.map((o) => o.clubName).join(', ')}.`);
      }
    }
  }
  return out;
}

/** Fills fields added after a save was made (game mode, manager name, settings). */
export function normalizeGame(g: GameState): GameState {
  const saved = g as Partial<GameState> & GameState;
  return {
    ...g,
    mode: saved.mode ?? 'manager',
    scope: saved.scope ?? 'completo',
    training: saved.training ?? DEFAULT_TRAINING,
    events: saved.events ?? [],
    achievements: saved.achievements ?? [],
    managerName: saved.managerName ?? 'El DT',
    settings: { ...saved.settings, matchMode: saved.settings?.matchMode ?? 'vivo' },
  };
}

/** Keeps the current job and discards the season-end offers. */
export function declineOffers(g: GameState): GameState {
  return { ...g, seasonOffers: undefined };
}

/** Removes shown events from the queue. */
export function dismissEvents(g: GameState, ids: string[]): GameState {
  return { ...g, events: g.events.filter((e) => !ids.includes(e.id)) };
}

function isImportant(g: GameState, runId: string): boolean {
  const kind = g.calendar.kinds[runId];
  if (kind === 'division') return g.world.divisions.find((d) => d.id === runId)?.level === 1;
  if (kind !== 'cup') return false;
  const def = g.world.competitions.find((c) => c.id === runId);
  return def?.scope === 'continental' || def?.country === clubOf(g.world, g.userClubId).country;
}

const runClubs = (g: GameState, runId: string) => new Set(g.calendar.runs[runId]?.stages.flatMap((s) => s.clubs) ?? []);

/** Adds a title or promotion of the user's club to the career (friendlies give no points). */
function recordAchievement(g: GameState, kind: AchievementKind, competitionId: string, date: string): Achievement | undefined {
  const club = clubOf(g.world, g.userClubId);
  const points = achievementPoints(g.world, competitionId, kind, club.reputation, g.mode);
  if (points === 0) return undefined;
  const a: Achievement = {
    id: `${kind}:${competitionId}:${g.calendar.season}`,
    kind,
    competitionId,
    competitionName: g.calendar.names[competitionId] ?? competitionId,
    clubId: club.id,
    clubName: club.name,
    country: club.country,
    season: g.calendar.season,
    date,
    managerName: g.managerName,
    mode: g.mode,
    scope: g.scope,
    clubReputation: club.reputation,
    points,
  };
  if (!g.achievements.some((x) => x.id === a.id)) g.achievements = [...g.achievements, a];
  return a;
}

/** Champions crowned today and competitions whose first match is tomorrow. */
function collectEvents(g: GameState, championsBefore: Record<string, string | undefined>, date: string): void {
  const add = (e: Omit<GameEvent, 'id'>) => g.events.push({ ...e, id: `${e.kind}:${e.competitionId}:${g.calendar.season}` });
  for (const [id, run] of Object.entries(g.calendar.runs)) {
    if (!run.champion || championsBefore[id]) continue;
    const finalStage = run.stages[run.stages.length - 1];
    const lastTie = finalStage.rounds[finalStage.rounds.length - 1];
    const runnerUp = lastTie?.length === 1 ? [lastTie[0].a, lastTie[0].b].find((c) => c !== run.champion) : undefined;
    const achievement = run.champion === g.userClubId ? recordAchievement(g, 'titulo', id, date) : undefined;
    add({ kind: 'campeon', date, competitionId: id, clubId: run.champion, runnerUpId: runnerUp, mine: runClubs(g, id).has(g.userClubId), important: isImportant(g, id), achievementId: achievement?.id });
  }
  const tomorrow = addDays(date, 1);
  const tomorrowRuns = new Set(g.calendar.matches.filter((m) => m.date === tomorrow && m.status === 'scheduled').map((m) => m.competitionId));
  for (const [id, run] of Object.entries(g.calendar.runs)) {
    if (!tomorrowRuns.has(id) || run.stages.length !== 1) continue;
    // Tomorrow is this competition's first match day if nothing of it has been played yet.
    const firstStage = new Set(run.stages[0].matchIds);
    if (g.calendar.matches.some((m) => firstStage.has(m.id) && m.status === 'played')) continue;
    add({ kind: 'inicio', date, competitionId: id, mine: runClubs(g, id).has(g.userClubId), important: isImportant(g, id) });
  }
}

export function setTraining(g: GameState, training: TrainingPlan): GameState {
  return { ...g, training };
}

export function setMatchMode(g: GameState, matchMode: MatchMode): GameState {
  return { ...g, settings: { ...g.settings, matchMode } };
}

/** Takes a job offer after being sacked (or a new club at season end). */
export function takeJob(g: GameState, clubId: string): GameState {
  const club = clubOf(g.world, clubId);
  const division = divisionOf(g.world, clubId);
  // Before the first match of a season, rebuild the calendar so the pre-season is for the new club.
  const fresh = g.calendar.matches.every((m) => m.status === 'scheduled');
  const out: GameState = {
    ...g,
    userClubId: clubId,
    club: initialClubState(club, division, g.world, g.world.season, rngFor(g, `job:${clubId}`)),
    calendar: fresh ? createSeasonCalendar(g.world, clubId) : { ...g.calendar, userClubId: clubId },
    market: { ...g.market, transferList: [], loanList: [], offers: g.market.offers.filter((o) => o.toClubId !== g.userClubId) },
    fired: undefined,
    seasonOffers: undefined,
    budgets: { ...g.budgets, [g.userClubId]: estimateTransferBudget(clubOf(g.world, g.userClubId)) },
    news: [...g.news],
  };
  delete out.budgets[clubId];
  pushNews(out, g.calendar.date, 'club', `Asumís en ${club.shortName}`, `Firmaste como nuevo entrenador de ${club.name}.`);
  return out;
}

// ------------------------------------------------------------------ the day loop

function importanceOf(g: GameState, m: ScheduledMatch): number {
  const kind = g.calendar.kinds[m.competitionId];
  if (m.competitionId === 'amistoso' || kind === 'friendly') return 0.1;
  if (kind === 'cup') return m.tieId ? 0.8 : 0.6;
  return 0.5;
}

function afterUserMatch(g: GameState, m: ScheduledMatch): void {
  const home = m.homeId === g.userClubId;
  const us = home ? m.result!.homeGoals : m.result!.awayGoals;
  const them = home ? m.result!.awayGoals : m.result!.homeGoals;
  const outcome = us > them ? 'W' : us < them ? 'L' : 'D';
  const imp = importanceOf(g, m);
  if (imp > 0.1) g.club = { ...g.club, board: updateBoardAfterMatch(g.club.board, outcome, imp) };

  const rival = clubOf(g.world, home ? m.awayId : m.homeId);
  const me = clubOf(g.world, g.userClubId);
  if (home || m.neutral) {
    const income = matchdayIncome(g.club, m, rival.reputation, me.reputation, imp, rngFor(g, `gate:${m.id}`), { context: contextOf(g) });
    g.club = income.clubState;
    if (m.report) m.report.attendance = income.attendance;
  }
  if (outcome === 'W' && g.calendar.kinds[m.competitionId] !== 'friendly' && m.competitionId !== 'amistoso') {
    try {
      g.club = addTransactions(g.club, [prizeTransaction(g.world, m.competitionId, { kind: 'win' }, m.date)]);
    } catch {
      // competitions without prize money
    }
  }
  const comp = m.competitionId === 'amistoso' ? 'Amistoso' : g.calendar.names[m.competitionId] ?? m.competitionId;
  const score = `${clubOf(g.world, m.homeId).shortName} ${m.result!.homeGoals}-${m.result!.awayGoals} ${clubOf(g.world, m.awayId).shortName}`;
  const pens = m.result!.penalties ? ` (penales ${m.result!.penalties.home}-${m.result!.penalties.away})` : '';
  const title = outcome === 'W' ? `Triunfo: ${score}${pens}` : outcome === 'L' ? `Derrota: ${score}${pens}` : `Empate: ${score}${pens}`;
  pushNews(g, m.date, 'partido', title, `${comp}. ${outcome === 'W' ? 'La hinchada se fue feliz.' : outcome === 'L' ? 'Hay que levantar cabeza.' : 'Reparto de puntos.'}`);
}

/** Injuries and sendings-off of the user's players make the news. */
function newsFromReport(g: GameState, report: DetailedMatchReport | undefined, m: ScheduledMatch): void {
  if (!report) return;
  const name = (id: string) => g.world.players.find((p) => p.id === id)?.name ?? 'Un jugador';
  for (const inj of report.injuries.filter((i) => i.clubId === g.userClubId)) {
    pushNews(g, m.date, 'lesion', `Lesión de ${name(inj.playerId)}`, `${inj.description}: estará ${inj.days} días afuera.`);
  }
  for (const id of report.sentOff) {
    if (g.world.players.find((p) => p.id === id)?.clubId === g.userClubId) {
      pushNews(g, m.date, 'partido', `Expulsado ${name(id)}`, 'Se pierde el próximo partido oficial.');
    }
  }
}

/** AI clubs with short squads sign free agents of a fitting level from their country. */
function aiSignFreeAgents(g: GameState, date: string): void {
  const free = g.world.players.filter((p) => !p.clubId);
  if (!free.length) return;
  const rng = rngFor(g, `free:${date}`);
  const squadSize = new Map<string, number>();
  for (const p of g.world.players) if (p.clubId && !p.youth) squadSize.set(p.clubId, (squadSize.get(p.clubId) ?? 0) + 1);
  const needy = g.world.clubs.filter((c) => c.id !== g.userClubId && (squadSize.get(c.id) ?? 0) < 22);
  let players = g.world.players;
  const picked = new Set<string>();
  for (const club of rng.shuffle(needy).slice(0, 3)) {
    const nationality = club.country === 'ENG' || club.country === 'SCO' ? 'GBR' : club.country;
    const candidate = rng
      .shuffle(free.filter((p) => !picked.has(p.id) && p.nationality === nationality))
      .find((p) => Math.abs(overallOf(p) - club.reputation) <= 15);
    if (!candidate) continue;
    picked.add(candidate.id);
    const contract = { wage: fairWage(candidate, club, g.world.season), untilSeason: g.world.season + rng.int(0, 1) };
    players = players.map((p) => (p.id === candidate.id ? { ...p, clubId: club.id, contract } : p));
  }
  if (players !== g.world.players) g.world = { ...g.world, players };
}

function marketDay(g: GameState, date: string): void {
  aiSignFreeAgents(g, date);
  if (!isWindowOpen(g.market.windows, date)) return;
  const rng = rngFor(g, `market:${date}`);
  // Coach-only careers: the club's sporting director handles the market like any AI club.
  const coachOnly = g.scope === 'entrenador';
  const budgets = coachOnly ? { ...g.budgets, [g.userClubId]: g.club.finances.transferBudget } : g.budgets;
  const offers = aiTransferActivity(g.world, g.market, date, rng, { budgets, userClubId: coachOnly ? undefined : g.userClubId, maxOffers: coachOnly ? 4 : 3 });
  for (const offer of offers) {
    if (!coachOnly && offer.toClubId === g.userClubId) {
      g.market = { ...g.market, offers: [...g.market.offers, offer] };
      const p = g.world.players.find((x) => x.id === offer.playerId);
      pushNews(g, date, 'mercado', `Oferta por ${p?.name}`, `${clubOf(g.world, offer.fromClubId).shortName} ofrece ${money(offer.fee)} por ${offer.kind === 'cesion' ? 'la cesión de' : ''} ${p?.name}.`);
      continue;
    }
    const answer = evaluateOffer(offer, g.world, g.world.season, rng);
    if (answer.status !== 'aceptada') continue;
    const player = g.world.players.find((x) => x.id === offer.playerId);
    const seller = g.world.clubs.find((c) => c.id === offer.toClubId);
    if (!player || !seller || !playerAcceptsContract(player, player.contract, offer.contract, clubOf(g.world, offer.fromClubId), seller, g.world.season, rng)) continue;
    if (offer.kind === 'cesion') {
      const r = executeLoan(g.world, offer);
      g.world = r.world;
      g.loans = [...g.loans, r.loan];
    } else {
      g.world = executeTransfer(g.world, offer);
      g.budgets[offer.fromClubId] = (g.budgets[offer.fromClubId] ?? 0) - offer.fee;
      if (offer.toClubId in g.budgets) g.budgets[offer.toClubId] += offer.fee * 0.5;
      if (offer.fee >= 5e6) pushNews(g, date, 'mercado', `Bombazo: ${player.name} a ${clubOf(g.world, offer.fromClubId).shortName}`, `Se pagaron ${money(offer.fee)} a ${seller.shortName}.`);
    }
    // Deals the sporting director closed for the user's club move the club's money.
    if (coachOnly && (offer.fromClubId === g.userClubId || offer.toClubId === g.userClubId)) {
      delete g.budgets[g.userClubId];
      const buying = offer.fromClubId === g.userClubId;
      if (offer.fee > 0) {
        g.club = addTransactions(g.club, [{ date, kind: 'traspaso', amount: buying ? -offer.fee : offer.fee, description: `${buying ? 'Compra' : 'Venta'} de ${player.name}` }]);
        g.club = { ...g.club, finances: { ...g.club.finances, transferBudget: g.club.finances.transferBudget + (buying ? -offer.fee : offer.fee * 0.5) } };
      }
      pushNews(g, date, 'mercado', buying ? `La secretaría técnica trajo a ${player.name}` : `La secretaría técnica vendió a ${player.name}`, `${offer.kind === 'cesion' ? 'Cesión' : 'Traspaso'} por ${money(offer.fee)}.`);
    }
  }
  if (coachOnly) delete g.budgets[g.userClubId];
  for (const loan of dueLoans(g.loans, date)) g.world = returnLoan(g.world, loan);
  g.loans = g.loans.filter((l) => l.returnDate > date);
}

/** Plays one day. `userReport` is the detailed report of the user's match if it was watched. */
export function advanceDay(
  game: GameState,
  opts: { userReport?: MatchReport; simulateUserMatch?: UserMatchSimulator } = {},
): GameState {
  if (game.fired) return game;
  const g: GameState = { ...game, news: [...game.news], budgets: { ...game.budgets } };
  const date = g.calendar.date;
  const userMatch = nextUserMatch(g.calendar);
  const reports: Record<string, MatchReport> = {};
  if (userMatch && userMatch.date === date) {
    // The user's matches always use the detailed engine (watched live or simulated).
    const report = opts.userReport ?? (opts.simulateUserMatch ?? simulateUserMatchDetailed)(g, userMatch);
    if (report) reports[userMatch.id] = report;
  }
  const championsBefore = Object.fromEntries(Object.entries(g.calendar.runs).map(([id, r]) => [id, r.champion]));
  g.events = [...(g.events ?? [])];
  g.achievements = [...(g.achievements ?? [])];
  const { played } = playDay(g.world, g.calendar, reports);
  collectEvents(g, championsBefore, date);
  for (const m of played) {
    if (m.homeId !== g.userClubId && m.awayId !== g.userClubId) continue;
    g.world = applyMatchToSquad(g.world, reports[m.id] as DetailedMatchReport | undefined, m, g.userClubId);
    afterUserMatch(g, m);
    newsFromReport(g, reports[m.id] as DetailedMatchReport | undefined, m);
  }
  g.world = dailyRecovery(g);

  // Weekly training session on Mondays.
  if (weekday(date) === 1) {
    const t = weeklyTraining(g.world, g.userClubId, g.training ?? DEFAULT_TRAINING, g.club.staff, date, g.world.seed);
    g.world = t.world;
    g.lastTraining = t.report;
    for (const inj of t.report.injured) {
      const p = g.world.players.find((x) => x.id === inj.playerId);
      pushNews(g, date, 'lesion', `Lesión en el entrenamiento: ${p?.name}`, `Estará ${inj.days} días afuera. Una intensidad más baja reduce el riesgo.`);
    }
  }

  marketDay(g, date);

  const works = completeWorks(g.club, g.works, date);
  g.club = works.clubState;
  g.works = works.pending;

  // Monthly accounts on the first day of each month.
  if (date.endsWith('-01')) g.club = monthlyUpdate(g.club, g.world.players.filter((p) => p.clubId === g.userClubId), date, rngFor(g, `month:${date}`), contextOf(g));

  // Only Pro Mánager careers can end in a sacking.
  if (g.mode === 'promanager' && shouldFireMidSeason(g.club.board)) {
    const club = clubOf(g.world, g.userClubId);
    g.fired = {
      date,
      message: `La comisión directiva de ${club.shortName} decidió rescindir tu contrato por los malos resultados.`,
      offers: jobOffers(g.world, g.managerReputation, rngFor(g, `fired:${date}`), [club.id]),
    };
    pushNews(g, date, 'directiva', 'Te echaron', g.fired.message);
  }
  g.calendar = { ...g.calendar };
  return g;
}

/** Plays days until the user's next match day (that day is not played) or the season ends. */
export function advanceToNextMatch(game: GameState, opts: { simulateUserMatch?: UserMatchSimulator } = {}): GameState {
  let g = game;
  for (let guard = 0; guard < 400 && !g.fired && !isSeasonOver(g.calendar); guard++) {
    const next = nextUserMatch(g.calendar);
    if (next && next.date === g.calendar.date) return g;
    g = advanceDay(g, opts);
  }
  return g;
}

/** Plays through the user's next match too (quick or with the detailed hook). */
export function playNextMatch(game: GameState, opts: { simulateUserMatch?: UserMatchSimulator; userReport?: MatchReport } = {}): GameState {
  const g = advanceToNextMatch(game, opts);
  return g.fired || isSeasonOver(g.calendar) ? g : advanceDay(g, opts);
}

/** Simulates the rest of the season day by day. */
export function simulateRestOfSeason(game: GameState, opts: { simulateUserMatch?: UserMatchSimulator } = {}): GameState {
  let g = game;
  for (let guard = 0; guard < 400 && !g.fired && !isSeasonOver(g.calendar); guard++) g = advanceDay(g, opts);
  return g;
}

// ------------------------------------------------------------------ user commands

export function setTactics(g: GameState, tactics: Tactics): GameState {
  return { ...g, club: { ...g.club, tactics } };
}

export function setLineup(g: GameState, lineup: Lineup): GameState {
  return { ...g, club: { ...g.club, lineup } };
}

export function toggleTransferList(g: GameState, playerId: string, list: 'transferList' | 'loanList' = 'transferList'): GameState {
  const current = g.market[list];
  const next = current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId];
  return { ...g, market: { ...g.market, [list]: next } };
}

export function toggleShortlist(g: GameState, playerId: string): GameState {
  const s = g.club.shortlist;
  return { ...g, club: { ...g.club, shortlist: s.includes(playerId) ? s.filter((x) => x !== playerId) : [...s, playerId] } };
}

export interface OfferOutcome {
  game: GameState;
  status: TransferOffer['status'];
  counterFee?: number;
  message: string;
}

/** The user bids for a player. The selling club and the player answer immediately. */
export function makeOffer(g: GameState, playerId: string, fee: number, contract: Contract, kind: 'traspaso' | 'cesion' = 'traspaso'): OfferOutcome {
  const date = g.calendar.date;
  const player = g.world.players.find((p) => p.id === playerId);
  if (!player) return { game: g, status: 'rechazada', message: 'Jugador no disponible.' };
  if (!player.clubId) return signFreeAgent(g, player.id, contract);
  if (!isWindowOpen(g.market.windows, date)) return { game: g, status: 'rechazada', message: 'El mercado de pases está cerrado.' };
  if (kind === 'traspaso' && fee > g.club.finances.transferBudget) return { game: g, status: 'rechazada', message: 'No te alcanza el presupuesto de fichajes.' };
  const offer: TransferOffer = {
    id: `u${date}:${playerId}`, date, playerId, fromClubId: g.userClubId, toClubId: player.clubId, kind, fee, contract, status: 'pendiente',
  };
  const rng = rngFor(g, `offer:${offer.id}`);
  const answer = evaluateOffer(offer, g.world, g.world.season, rng);
  if (answer.status !== 'aceptada') {
    return {
      game: g,
      status: answer.status,
      counterFee: answer.counterFee,
      message: answer.status === 'contraoferta' ? `Piden ${money(answer.counterFee ?? fee)}.` : 'El club rechazó la oferta.',
    };
  }
  const buyer = clubOf(g.world, g.userClubId);
  const seller = clubOf(g.world, player.clubId);
  if (!playerAcceptsContract(player, player.contract, contract, buyer, seller, g.world.season, rng)) {
    return { game: g, status: 'rechazada', message: `${player.name} no aceptó las condiciones del contrato.` };
  }
  return { game: completeTransfer(g, { ...offer, status: 'aceptada' }), status: 'aceptada', message: `¡${player.name} es nuevo jugador de ${buyer.shortName}!` };
}

/** Free agents sign at any time of the season, with no transfer fee: only the player decides. */
export function signFreeAgent(g: GameState, playerId: string, contract: Contract): OfferOutcome {
  const player = g.world.players.find((p) => p.id === playerId && !p.clubId);
  if (!player) return { game: g, status: 'rechazada', message: 'El jugador ya no está libre.' };
  const buyer = clubOf(g.world, g.userClubId);
  const rng = rngFor(g, `free:${playerId}:${g.calendar.date}`);
  if (!playerAcceptsContract(player, undefined, contract, buyer, null, g.world.season, rng)) {
    return { game: g, status: 'rechazada', message: `${player.name} pretende un contrato mejor.` };
  }
  const world = { ...g.world, players: g.world.players.map((p) => (p.id === playerId ? { ...p, clubId: g.userClubId, contract } : p)) };
  const out: GameState = { ...g, world, news: [...g.news] };
  pushNews(out, g.calendar.date, 'mercado', `Llegó ${player.name}`, 'Firmó como jugador libre, sin costo de traspaso.');
  return { game: out, status: 'aceptada', message: `¡${player.name} firmó como jugador libre!` };
}

function completeTransfer(game: GameState, offer: TransferOffer): GameState {
  const g: GameState = { ...game, news: [...game.news], budgets: { ...game.budgets } };
  const date = g.calendar.date;
  const player = g.world.players.find((p) => p.id === offer.playerId)!;
  if (offer.kind === 'cesion') {
    const r = executeLoan(g.world, offer);
    g.world = r.world;
    g.loans = [...g.loans, r.loan];
  } else {
    g.world = executeTransfer(g.world, offer);
  }
  g.market = marketAfterTransfer(g.market, offer);
  const buying = offer.fromClubId === g.userClubId;
  if (offer.fee > 0) {
    const amount = buying ? -offer.fee : offer.fee;
    g.club = addTransactions(g.club, [{ date, kind: 'traspaso', amount, description: `${buying ? 'Compra' : 'Venta'} de ${player.name}` }]);
    g.club = { ...g.club, finances: { ...g.club.finances, transferBudget: g.club.finances.transferBudget + (buying ? -offer.fee : offer.fee * 0.5) } };
    const other = buying ? offer.toClubId : offer.fromClubId;
    if (other in g.budgets) g.budgets[other] += buying ? offer.fee * 0.5 : -offer.fee;
  }
  pushNews(g, date, 'mercado', buying ? `Llegó ${player.name}` : `Se fue ${player.name}`, `${offer.kind === 'cesion' ? 'Cesión' : 'Traspaso'} por ${money(offer.fee)}.`);
  return g;
}

/** Accepts or rejects an AI offer for one of the user's players. */
export function respondToOffer(g: GameState, offerId: string, accept: boolean): GameState {
  const offer = g.market.offers.find((o) => o.id === offerId);
  if (!offer || offer.status !== 'pendiente') return g;
  if (!accept) return { ...g, market: { ...g.market, offers: g.market.offers.map((o) => (o.id === offerId ? { ...o, status: 'rechazada' } : o)) } };
  return completeTransfer(g, { ...offer, status: 'aceptada' });
}

/** Offers a new contract to one of the user's players. */
export function renewContract(g: GameState, playerId: string, contract: Contract): { game: GameState; accepted: boolean } {
  const player = g.world.players.find((p) => p.id === playerId && p.clubId === g.userClubId);
  if (!player) return { game: g, accepted: false };
  const club = clubOf(g.world, g.userClubId);
  const accepted = playerAcceptsContract(player, player.contract, contract, club, club, g.world.season, rngFor(g, `renew:${playerId}:${g.calendar.date}`));
  if (!accepted) return { game: g, accepted };
  const world = { ...g.world, players: g.world.players.map((p) => (p.id === playerId ? { ...p, contract } : p)) };
  return { game: { ...g, world }, accepted };
}

/** Academy players of the user's club. */
export function academy(g: GameState) {
  return g.world.players.filter((p) => p.clubId === g.userClubId && p.youth);
}

/** Moves an academy player into the first-team squad. */
export function promoteYouth(g: GameState, playerId: string): GameState {
  const p = g.world.players.find((x) => x.id === playerId && x.clubId === g.userClubId && x.youth);
  if (!p) return g;
  const out: GameState = { ...g, world: promoteYouthPlayer(g.world, playerId), news: [...g.news] };
  pushNews(out, g.calendar.date, 'club', `Debut en Primera: ${p.name}`, `${p.name} fue promovido al plantel profesional.`);
  return out;
}

/** Market value and fair wage, for the UI. */
export function playerMarket(g: GameState, playerId: string): { value: number; wage: number } {
  const p = g.world.players.find((x) => x.id === playerId)!;
  const club = p.clubId ? clubOf(g.world, p.clubId) : null;
  return { value: playerValue(p, club, g.world.season), wage: fairWage(p, club, g.world.season) };
}
