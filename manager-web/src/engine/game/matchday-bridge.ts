// Connects the detailed match engine to the career: builds the team sheets for the user's
// match, and turns the match report into player condition (fitness, form, morale, cards,
// suspensions, injuries) and season statistics. Also the daily recovery of the squad.

import { staffEffects } from '../club';
import { knockoutContext } from '../calendar/calendar';
import { autoLineup, defaultTactics, isAvailable, simulateMatchDetailed, type DetailedMatchReport, type MatchInput } from '../matchday';
import { createRng } from '../rng';
import type { Player, World } from '../types';
import type { Lineup, PlayerCondition, PlayerSeasonStats, ScheduledMatch, TeamSheet } from '../game-types';
import type { GameState } from './game';
import { INTENSITY_RECOVERY } from './training';

export const FRESH: PlayerCondition = { fitness: 100, morale: 70, form: 50, injuryDays: 0, suspensionMatches: 0, yellowCards: 0 };
export const conditionOf = (p: Player): PlayerCondition => p.condition ?? FRESH;

/** Yellow cards that trigger a one-match ban. */
const YELLOW_LIMIT = 5;

function squadOf(world: World, clubId: string): Player[] {
  return world.players.filter((p) => p.clubId === clubId && !p.youth);
}

/** The user's saved lineup if every player is still at the club and available; otherwise an automatic one. */
export function userSheet(g: GameState): TeamSheet {
  const squad = squadOf(g.world, g.userClubId);
  const ids = new Set(squad.filter((p) => isAvailable(p.condition)).map((p) => p.id));
  const saved = g.club.lineup;
  const valid = saved && saved.starters.length === 11 && saved.starters.every((id) => ids.has(id));
  const lineup: Lineup = valid
    ? { ...saved, bench: saved.bench.filter((id) => ids.has(id) && !saved.starters.includes(id)) }
    : autoLineup(squad, g.club.tactics.formation);
  return { clubId: g.userClubId, tactics: g.club.tactics, lineup };
}

export function opponentSheet(world: World, clubId: string): TeamSheet {
  const tactics = defaultTactics();
  return { clubId, tactics, lineup: autoLineup(squadOf(world, clubId), tactics.formation) };
}

/** Everything the match engine needs for one of the user's matches. */
export function buildMatchInput(g: GameState, match: ScheduledMatch, seedKey = match.id): MatchInput {
  const sheet = (id: string) => (id === g.userClubId ? userSheet(g) : opponentSheet(g.world, id));
  const home = sheet(match.homeId);
  const away = sheet(match.awayId);
  const players = new Map<string, Player>();
  for (const p of g.world.players) if (p.clubId === match.homeId || p.clubId === match.awayId) players.set(p.id, p);
  const names = Object.fromEntries(g.world.clubs.filter((c) => c.id === match.homeId || c.id === match.awayId).map((c) => [c.id, c.shortName]));
  let h = 2166136261;
  for (let i = 0; i < seedKey.length; i++) h = Math.imul(h ^ seedKey.charCodeAt(i), 16777619);
  return {
    home,
    away,
    players,
    neutral: match.neutral,
    knockout: knockoutContext(g.calendar, match),
    rng: createRng((g.world.seed ^ h) >>> 0),
    names,
    ai: { home: match.homeId !== g.userClubId, away: match.awayId !== g.userClubId },
  };
}

/** Default simulator for the user's matches nobody watched: the detailed engine with automatic decisions. */
export function simulateUserMatchDetailed(g: GameState, match: ScheduledMatch): DetailedMatchReport {
  const input = buildMatchInput(g, match);
  return simulateMatchDetailed({ ...input, ai: { home: true, away: true } });
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Applies a played match to the user's squad: condition, cards, injuries and statistics. */
export function applyMatchToSquad(world: World, report: DetailedMatchReport | undefined, match: ScheduledMatch, clubId: string): World {
  const competitive = match.competitionId !== 'amistoso';
  const home = match.homeId === clubId;
  const result = match.result!;
  const us = home ? result.homeGoals : result.awayGoals;
  const them = home ? result.awayGoals : result.homeGoals;
  const moraleDelta = us > them ? 6 : us < them ? -6 : 0;
  const injuries = new Map((report?.injuries ?? []).map((i) => [i.playerId, i]));
  const reds = new Set(report?.sentOff ?? []);
  const straightReds = new Set((report?.events ?? []).filter((e) => e.kind === 'red').map((e) => e.playerId));
  const yellows = new Map<string, number>();
  for (const e of report?.events ?? []) if (e.kind === 'yellow' && e.playerId) yellows.set(e.playerId, (yellows.get(e.playerId) ?? 0) + 1);
  const goals = new Map<string, number>();
  const assists = new Map<string, number>();
  for (const e of report?.events ?? []) {
    if ((e.kind === 'goal' || e.kind === 'penalty-goal') && e.clubId === clubId && e.playerId) {
      goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1);
      if (e.otherPlayerId) assists.set(e.otherPlayerId, (assists.get(e.otherPlayerId) ?? 0) + 1);
    }
  }

  const players = world.players.map((p) => {
    if (p.clubId !== clubId) return p;
    const c = { ...conditionOf(p) };
    const minutes = report?.minutesPlayed[p.id] ?? 0;
    c.morale = clamp(c.morale + moraleDelta);
    if (minutes > 0) {
      c.fitness = clamp(c.fitness - minutes * 0.32);
      const rating = report?.ratings[p.id] ?? 6;
      c.form = clamp(c.form * 0.7 + (rating - 1) * 11.1 * 0.3);
    } else if (competitive && c.suspensionMatches > 0) {
      c.suspensionMatches -= 1; // served one match of the ban
    }
    if (competitive) {
      const y = yellows.get(p.id) ?? 0;
      if (reds.has(p.id)) c.suspensionMatches += straightReds.has(p.id) ? 2 : 1;
      else if (y > 0) {
        c.yellowCards += y;
        if (c.yellowCards >= YELLOW_LIMIT) {
          c.yellowCards = 0;
          c.suspensionMatches += 1;
        }
      }
    }
    const injury = injuries.get(p.id);
    if (injury) {
      c.injuryDays = Math.max(c.injuryDays, injury.days);
      c.injury = injury.description;
    }

    let stats = p.stats;
    if (minutes > 0 && competitive) {
      const season = Number(match.date.slice(0, 4));
      const current: PlayerSeasonStats =
        stats?.find((s) => s.season === season && s.clubId === clubId) ??
        { season, clubId, appearances: 0, goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0, conceded: 0, ratingSum: 0 };
      const next: PlayerSeasonStats = {
        ...current,
        appearances: current.appearances + 1,
        goals: current.goals + (goals.get(p.id) ?? 0),
        assists: current.assists + (assists.get(p.id) ?? 0),
        yellow: current.yellow + (yellows.get(p.id) ?? 0),
        red: current.red + (reds.has(p.id) ? 1 : 0),
        minutes: current.minutes + minutes,
        conceded: current.conceded + (p.position === 'ARQ' ? them : 0),
        ratingSum: current.ratingSum + (report?.ratings[p.id] ?? 6),
      };
      stats = [...(stats ?? []).filter((s) => s !== current), next];
    }
    return { ...p, condition: c, stats };
  });
  return { ...world, players };
}

/** One day of recovery for the user's squad, sped up by the fitness coach and the doctor. */
export function dailyRecovery(g: GameState): World {
  const fx = staffEffects(g.club.staff);
  const players = g.world.players.map((p) => {
    if (p.clubId !== g.userClubId || !p.condition) return p;
    const c = { ...p.condition };
    c.fitness = clamp(c.fitness + 7 * fx.fitnessRecovery * INTENSITY_RECOVERY[g.training?.intensity ?? 'media']);
    if (c.injuryDays > 0) {
      c.injuryDays = Math.max(0, c.injuryDays - Math.max(1, Math.round(1 / fx.injuryDays)));
      if (c.injuryDays === 0) delete c.injury;
    }
    c.morale = c.morale + (70 - c.morale) * 0.02;
    return { ...p, condition: c };
  });
  return { ...g.world, players };
}
