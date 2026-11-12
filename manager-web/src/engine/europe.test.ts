import { describe, expect, it } from 'vitest';
import { UCL_FORMAT } from '../data/europe';
import { REAL_COUNTRY_DIVISIONS, REAL_QUALIFICATIONS } from '../data/real';
import { createSeasonCalendar } from './calendar/calendar';
import { createWorld } from '../data/world';
import { runCompetition } from './competition';
import { createRng } from './rng';
import { playSeason } from './season';

const clubs = (n: number) => Array.from({ length: n }, (_, i) => `c${i + 1}`);

describe('UEFA league phase', () => {
  it('gives each of 36 clubs 8 different opponents, then play-offs and a single final', () => {
    const r = runCompetition(UCL_FORMAT, clubs(36), () => ({ attack: 60, defence: 60 }), createRng(1));
    const [league, playoffs, final] = r.stages;
    expect(league.matches).toHaveLength((36 * 8) / 2);
    for (const id of clubs(36)) {
      const opponents = league.matches.filter((m) => m.homeId === id || m.awayId === id).map((m) => (m.homeId === id ? m.awayId : m.homeId));
      expect(opponents).toHaveLength(8);
      expect(new Set(opponents).size).toBe(8);
    }
    expect(league.advanced).toHaveLength(24);
    expect(playoffs.matches).toHaveLength(16); // 8 two-legged ties between 9th-24th
    expect(playoffs.advanced.slice(0, 8)).toEqual(league.advanced.slice(0, 8));
    expect(final.rounds.map((x) => x.length)).toEqual([8, 4, 2, 1]);
  });
});

describe('CONMEBOL cups', () => {
  const all = ['BRA', 'URY', 'PRY', 'CHL', 'COL', 'PER', 'ECU', 'BOL', 'VEN'];
  it.runIf(all.every((c) => REAL_COUNTRY_DIVISIONS[c]))('plays the Libertadores and the Sudamericana with every South American country', () => {
    const { summary } = playSeason(createWorld(3));
    const lib = summary.competitions.find((c) => c.competitionId === 'copa-libertadores')!;
    const sud = summary.competitions.find((c) => c.competitionId === 'copa-sudamericana')!;
    expect(lib.result?.champion, lib.pending).toBeTruthy();
    expect(sud.result?.champion, sud.pending).toBeTruthy();
    expect(lib.entrants).toHaveLength(32);
    expect(sud.entrants).toHaveLength(32);
    expect(lib.entrants.filter((id) => sud.entrants.includes(id))).toEqual([]);
    // Libertadores thirds dropped into the Sudamericana play-offs.
    const thirds = lib.result!.stages[0].tables.map((t) => t[2].clubId);
    const playoffClubs = new Set(sud.result!.stages[1].matches.flatMap((m) => [m.homeId, m.awayId]));
    for (const id of thirds) expect(playoffClubs.has(id)).toBe(true);
  });
});

describe('European countries from data files', () => {
  const countries = Object.keys(REAL_COUNTRY_DIVISIONS);

  it.runIf(countries.length > 0)('adds their divisions, a domestic cup and the UEFA cups', () => {
    const world = createWorld(2);
    for (const iso of countries) {
      for (const [level, file] of Object.entries(REAL_COUNTRY_DIVISIONS[iso])) {
        const d = world.divisions.find((x) => x.id === `${iso.toLowerCase()}-${level}`);
        expect(d?.clubIds, `${iso}-${level}`).toHaveLength(file.clubs.length);
      }
      expect(world.competitions.some((c) => c.id === `${iso.toLowerCase()}-cup`)).toBe(true);
    }
    expect(world.competitions.some((c) => c.id === 'champions-league')).toBe(true);

    const { summary, next } = playSeason(world);
    for (const iso of countries) {
      const cup = summary.competitions.find((c) => c.competitionId === `${iso.toLowerCase()}-cup`)!;
      expect(cup.result?.champion, `${iso} cup`).toBeDefined();
    }
    // With all ten leagues present, the UEFA league phases fill to 36 with no club in two cups.
    if (['ENG', 'ESP', 'ITA', 'DEU', 'FRA', 'PRT', 'NLD', 'BEL', 'SCO', 'TUR'].every((c) => countries.includes(c))) {
      const uefa = ['champions-league', 'europa-league', 'conference-league'].map((id) => summary.competitions.find((c) => c.competitionId === id)!);
      for (const cup of uefa) expect(cup.result?.champion, `${cup.competitionId}: ${cup.pending}`).toBeDefined();
      const all = uefa.flatMap((c) => c.entrants);
      expect(new Set(all).size).toBe(all.length);
    }
    // Division sizes stay stable after promotion and relegation.
    for (const d of next.divisions) expect(d.clubIds).toHaveLength(world.divisions.find((x) => x.id === d.id)!.clubIds.length);
  });
});

describe('real starting qualification', () => {
  it.runIf(REAL_QUALIFICATIONS.some((f) => f.season === 2026))('the 2026 Libertadores and Sudamericana start with the real clubs', () => {
    const world = createWorld(9);
    const file = REAL_QUALIFICATIONS.find((f) => f.season === 2026)!;
    const cal = createSeasonCalendar(world, null);
    for (const cup of ['copa-libertadores', 'copa-sudamericana']) {
      const fixed = world.fixedEntrants?.entrants[cup];
      if (!fixed) continue; // some club of the real list is missing from our data
      expect(fixed).toHaveLength(file.entrants[cup].length);
      expect(new Set(cal.runs[cup].stages[0].clubs)).toEqual(new Set(fixed));
    }
    expect(Object.keys(world.qualification?.champions ?? {}).length).toBeGreaterThan(10);
  });
});
