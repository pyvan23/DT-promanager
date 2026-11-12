// Plays one season across the whole pyramid and applies promotion and relegation.

import { COMPETITION_DEFS } from '../data/cups';
import { divisionSeasonResult, createSeasonCalendar, cupSeasons, playToEnd, type SeasonCalendar } from './calendar/calendar';
import { type CompetitionSeason } from './cups';
import { type CompetitionResult } from './competition';
import { teamStrength, type TeamStrength } from './match';
import { bestEleven } from './squad';
import type { Club, Division, SeasonRecord, TableRow, World } from './types';

export interface DivisionSeason {
  divisionId: string;
  result: CompetitionResult;
  /** Final order: champion first, then by how far each club went, then by table position. */
  ranking: string[];
  promoted: string[];
  relegated: string[];
  /** Relegation averages (points per game over the last seasons), worst last. */
  averages?: { clubId: string; average: number }[];
}

export interface SeasonSummary {
  season: number;
  divisions: DivisionSeason[];
  /** Domestic and continental cups, including ones still pending for lack of entrants. */
  competitions: CompetitionSeason[];
}

/** Seasons counted for the relegation averages. */
export const AVERAGE_SEASONS = 3;

export function clubStrength(world: World, clubId: string): TeamStrength {
  return teamStrength(bestEleven(world.players.filter((p) => p.clubId === clubId)));
}

/**
 * Champion first; then clubs knocked out later rank above clubs knocked out earlier
 * (finalist, semi-finalists, ...); everyone else by position and points in the tables.
 */
export function finalRanking(result: CompetitionResult): string[] {
  const order: string[] = [result.champion];
  const seen = new Set(order);
  const add = (id: string) => {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  };

  for (const stage of [...result.stages].reverse()) {
    if (stage.rounds.length) {
      // Losers of each round, latest round first.
      const entrants = new Set(stage.matches.flatMap((m) => [m.homeId, m.awayId]));
      for (let r = stage.rounds.length - 1; r >= 0; r--) {
        const survivors = new Set(stage.rounds[r]);
        const previous = r === 0 ? entrants : new Set(stage.rounds[r - 1]);
        for (const id of previous) if (!survivors.has(id)) add(id);
      }
      for (const id of stage.advanced) add(id);
    }
    if (stage.tables.length) {
      // Interleave groups by finishing place: all 1st places, then all 2nd places, ...
      const rows: (TableRow & { place: number })[] = stage.tables.flatMap((t) => t.map((row, place) => ({ ...row, place })));
      rows.sort((a, b) => a.place - b.place || b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst));
      for (const row of rows) add(row.clubId);
    }
  }
  return order;
}

/** Points and games of each club across every table and match of the competition. */
function seasonRecords(world: World, division: Division, result: CompetitionResult): SeasonRecord[] {
  const totals = new Map<string, { points: number; played: number }>(division.clubIds.map((id) => [id, { points: 0, played: 0 }]));
  for (const stage of result.stages) {
    for (const table of stage.tables) {
      for (const row of table) {
        const t = totals.get(row.clubId);
        if (t) {
          t.points += row.points;
          t.played += row.played;
        }
      }
    }
  }
  return [...totals].map(([clubId, t]) => ({ season: world.season, clubId, divisionId: division.id, ...t }));
}

export function relegationAverages(history: SeasonRecord[], division: Division, season: number) {
  return division.clubIds
    .map((clubId) => {
      const records = history.filter(
        (r) => r.clubId === clubId && r.divisionId === division.id && r.season > season - AVERAGE_SEASONS,
      );
      const points = records.reduce((s, r) => s + r.points, 0);
      const played = records.reduce((s, r) => s + r.played, 0);
      return { clubId, average: played ? points / played : 0 };
    })
    .sort((a, b) => b.average - a.average);
}

function pickRelegated(division: Division, ranking: string[], clubsById: Map<string, Club>, averages?: { clubId: string }[]) {
  // Worst first. With averages, the averages table decides; otherwise the final ranking.
  const worstFirst = (averages ? averages.map((a) => a.clubId) : ranking).slice().reverse();
  const taken = new Set<string>();
  const moves: { clubId: string; to: string }[] = [];
  for (const rule of division.relegation) {
    let picked = worstFirst.filter((id) => !taken.has(id) && (!rule.region || clubsById.get(id)?.region === rule.region));
    // Not enough clubs from that region: fall back to the worst remaining, so sizes stay stable.
    if (picked.length < rule.count) picked = [...picked, ...worstFirst.filter((id) => !taken.has(id) && !picked.includes(id))];
    for (const id of picked.slice(0, rule.count)) {
      taken.add(id);
      moves.push({ clubId: id, to: rule.to });
    }
  }
  return moves;
}

/**
 * Closes a season from its results: rankings, relegation averages, promotion and
 * relegation, and the qualification state the next season's cups read.
 */
export function concludeSeason(
  world: World,
  divisionResult: (divisionId: string) => CompetitionResult,
  competitions: CompetitionSeason[],
): { summary: SeasonSummary; next: World } {
  const clubsById = new Map(world.clubs.map((c) => [c.id, c]));
  const history = [...world.history];
  const divisions: DivisionSeason[] = [];
  const moves: { clubId: string; from: string; to: string }[] = [];

  for (const division of world.divisions) {
    const result = divisionResult(division.id);
    const ranking = finalRanking(result);
    history.push(...seasonRecords(world, division, result));

    const averages = division.relegationByAverages ? relegationAverages(history, division, world.season) : undefined;
    const promoted = division.promotion ? ranking.slice(0, division.promotion.count) : [];
    const relegated = pickRelegated(division, ranking, clubsById, averages);

    if (division.promotion) for (const id of promoted) moves.push({ clubId: id, from: division.id, to: division.promotion.to });
    for (const m of relegated) moves.push({ clubId: m.clubId, from: division.id, to: m.to });
    divisions.push({ divisionId: division.id, result, ranking, promoted, relegated: relegated.map((m) => m.clubId), averages });
  }

  const nextDivisions = world.divisions.map((d) => ({ ...d, clubIds: d.clubIds.filter((id) => !moves.some((m) => m.clubId === id)) }));
  for (const m of moves) nextDivisions.find((d) => d.id === m.to)?.clubIds.push(m.clubId);

  const qualification = {
    season: world.season,
    rankings: Object.fromEntries(divisions.map((d) => [d.divisionId, d.ranking])),
    champions: Object.fromEntries(
      [...divisions.map((d) => [d.divisionId, d.result.champion]), ...competitions.filter((c) => c.result).map((c) => [c.competitionId, c.result!.champion])],
    ),
  };

  // Keep only the history the averages still need.
  const keptHistory = history.filter((r) => r.season > world.season - AVERAGE_SEASONS);
  return {
    summary: { season: world.season, divisions, competitions },
    next: { ...world, season: world.season + 1, divisions: nextDivisions, history: keptHistory, qualification },
  };
}

/** Closes a season played on a calendar (day by day or simulated to the end). */
export function finishSeason(world: World, cal: SeasonCalendar): { summary: SeasonSummary; next: World } {
  // Saves from before cups existed have no competition list: give them the defaults.
  const w = { ...world, competitions: world.competitions ?? COMPETITION_DEFS };
  return concludeSeason(w, (id) => divisionSeasonResult(cal, id)!, cupSeasons(w, cal));
}

/** Plays a whole season at once: the same calendar as day-by-day play, quick-simulated. */
export function playSeason(world: World): { summary: SeasonSummary; next: World } {
  const w = { ...world, competitions: world.competitions ?? COMPETITION_DEFS };
  const cal = createSeasonCalendar(w, null);
  playToEnd(w, cal);
  return finishSeason(w, cal);
}
