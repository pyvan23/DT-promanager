import { describe, expect, it } from 'vitest';
import { roundRobin } from './fixtures';
import { createRng } from './rng';
import { runCompetition, playTie, type StrengthOf } from './competition';
import { simulateScore } from './match';
import {
  COPA_ARGENTINA,
  COPA_LIBERTADORES,
  COPA_SUDAMERICANA,
  LIGA_PROFESIONAL,
} from '../data/competitions';
import { PRIMERA_NACIONAL } from '../data/divisions';

const clubs = (n: number, prefix = 'c') => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
const flat: StrengthOf = () => ({ attack: 60, defence: 60 });

describe('roundRobin', () => {
  it.each([4, 15, 30])('pairs every club with every other once per round (%i clubs)', (n) => {
    const ids = clubs(n);
    const fixtures = roundRobin(ids, 2);
    expect(fixtures).toHaveLength(n * (n - 1));
    const seen = new Set(fixtures.map((f) => `${f.homeId}-${f.awayId}`));
    expect(seen.size).toBe(n * (n - 1)); // each ordered pair exactly once
    // nobody plays twice on the same matchday
    const byDay = new Map<number, string[]>();
    for (const f of fixtures) byDay.set(f.matchday, [...(byDay.get(f.matchday) ?? []), f.homeId, f.awayId]);
    for (const ids of byDay.values()) expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('simulation', () => {
  it('stronger sides win more often and scores look like football', () => {
    const rng = createRng(1);
    const strong = { attack: 80, defence: 80 };
    const weak = { attack: 45, defence: 45 };
    let strongWins = 0;
    let weakWins = 0;
    let goals = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const s = simulateScore(strong, weak, rng);
      goals += s.homeGoals + s.awayGoals;
      if (s.homeGoals > s.awayGoals) strongWins++;
      if (s.homeGoals < s.awayGoals) weakWins++;
    }
    expect(strongWins).toBeGreaterThan(weakWins * 3);
    const evenGoals = Array.from({ length: N }, () => simulateScore(flat('a'), flat('b'), rng)).reduce(
      (t, s) => t + s.homeGoals + s.awayGoals,
      0,
    );
    expect(evenGoals / N).toBeGreaterThan(2);
    expect(evenGoals / N).toBeLessThan(3.2);
    expect(goals / N).toBeLessThan(6);
  });

  it('is reproducible for the same seed', () => {
    const run = () => runCompetition(COPA_ARGENTINA, clubs(64), flat, createRng(42)).champion;
    expect(run()).toBe(run());
  });

  it('two-legged ties always produce a winner from the pair', () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const { winner, matches } = playTie('a', 'b', { legs: 2, awayGoals: false, neutralVenue: false }, flat, rng);
      expect(['a', 'b']).toContain(winner);
      expect(matches).toHaveLength(2);
    }
  });
});

describe('competition formats', () => {
  it('splits clubs into uneven groups when they do not divide exactly', () => {
    const r = runCompetition(PRIMERA_NACIONAL, clubs(37), flat, createRng(8));
    expect(r.stages[0].tables.map((t) => t.length).sort()).toEqual([18, 19]);
    expect(r.stages[0].advanced).toHaveLength(16);
  });

  it('Copa Argentina: 64 clubs, 6 rounds, 63 matches', () => {
    const r = runCompetition(COPA_ARGENTINA, clubs(64), flat, createRng(3));
    expect(r.stages[0].rounds.map((x) => x.length)).toEqual([32, 16, 8, 4, 2, 1]);
    expect(r.stages[0].matches).toHaveLength(63);
    expect(clubs(64)).toContain(r.champion);
  });

  it('Liga Profesional: 2 zones of 15, 16 to the knockout, crossed by zone', () => {
    const r = runCompetition(LIGA_PROFESIONAL, clubs(30), flat, createRng(4));
    const [zones, playoffs] = r.stages;
    expect(zones.tables.map((t) => t.length)).toEqual([15, 15]);
    expect(zones.matches).toHaveLength(2 * (15 * 14) / 2);
    expect(zones.advanced).toHaveLength(16);
    const zoneOf = (id: string) => (zones.tables[0].some((row) => row.clubId === id) ? 0 : 1);
    for (let i = 0; i < 8; i++) {
      const m = playoffs.matches[i];
      expect(zoneOf(m.homeId)).not.toBe(zoneOf(m.awayId));
    }
    expect(playoffs.rounds.map((x) => x.length)).toEqual([8, 4, 2, 1]);
  });

  it('Libertadores: 8 groups of 4, 16 to two-legged knockouts, single final', () => {
    const r = runCompetition(COPA_LIBERTADORES, clubs(32), flat, createRng(5));
    const [groups, knockout] = r.stages;
    expect(groups.tables).toHaveLength(8);
    expect(groups.matches).toHaveLength(8 * 12);
    // 8 + 4 + 2 two-legged ties, plus a one-off final
    expect(knockout.matches).toHaveLength((8 + 4 + 2) * 2 + 1);
  });

  it('Sudamericana: group winners get a bye, runners-up meet Libertadores thirds', () => {
    const libThirds = clubs(8, 'lib');
    const r = runCompetition(COPA_SUDAMERICANA, clubs(32), flat, createRng(6), { playoffs: libThirds });
    const [groups, playoffs, final] = r.stages;
    const winners = groups.tables.map((t) => t[0].clubId);
    const runnersUp = groups.tables.map((t) => t[1].clubId);
    expect(playoffs.matches).toHaveLength(16);
    for (const m of playoffs.matches) {
      const pair = [m.homeId, m.awayId];
      expect(pair.some((id) => runnersUp.includes(id))).toBe(true);
      expect(pair.some((id) => libThirds.includes(id))).toBe(true);
    }
    expect(playoffs.advanced.slice(0, 8)).toEqual(winners);
    expect(playoffs.advanced).toHaveLength(16);
    expect(final.rounds.map((x) => x.length)).toEqual([8, 4, 2, 1]);
    expect([...clubs(32), ...libThirds]).toContain(r.champion);
  });
});
