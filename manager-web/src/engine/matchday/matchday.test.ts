import { describe, expect, it } from 'vitest';
import { POSITION_LINE } from '../types';
import { createRng } from '../rng';
import { autoLineup, defaultTactics, FORMATION_SLOTS, FORMATIONS } from './formations';
import { simulateMatchDetailed } from './engine';
import { createLiveMatch } from './live';
import type { DetailedMatchReport, LiveEvent, MatchInput } from './types';
import { makeSquad, playersMap, sheetFor } from './test-utils';

function setup(levelHome: number, levelAway: number) {
  const h = makeSquad('h', levelHome, 1);
  const a = makeSquad('a', levelAway, 2);
  return { h, a, players: playersMap(h, a), home: sheetFor('h', h), away: sheetFor('a', a) };
}

function many(n: number, input: Omit<MatchInput, 'rng'>, seed = 11): DetailedMatchReport[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => simulateMatchDetailed({ ...input, rng }));
}

const GOAL_KINDS = ['goal', 'own-goal', 'penalty-goal'];

describe('formations and autoLineup', () => {
  it('every formation has 11 slots, goalkeeper first, coordinates on the pitch', () => {
    for (const f of FORMATIONS) {
      const slots = FORMATION_SLOTS[f];
      expect(slots).toHaveLength(11);
      expect(slots[0].position).toBe('ARQ');
      expect(slots.slice(1).every((s) => s.position !== 'ARQ')).toBe(true);
      for (const s of slots) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('never picks injured or suspended players and always puts a keeper in goal', () => {
    const squad = makeSquad('c', 65, 3);
    const keepers = squad.filter((p) => p.position === 'ARQ');
    const injured = new Set([keepers[0].id, squad[5].id]);
    const suspended = new Set([keepers[1].id, squad[8].id]);
    for (const p of squad) {
      if (!injured.has(p.id) && !suspended.has(p.id)) continue;
      p.condition = {
        fitness: 90,
        morale: 70,
        form: 50,
        injuryDays: injured.has(p.id) ? 10 : 0,
        suspensionMatches: suspended.has(p.id) ? 1 : 0,
        yellowCards: 0,
      };
    }
    for (const f of FORMATIONS) {
      const l = autoLineup(squad, f);
      expect(l.starters).toHaveLength(11);
      expect(new Set([...l.starters, ...l.bench]).size).toBe(l.starters.length + l.bench.length);
      expect(l.bench.length).toBeLessThanOrEqual(9);
      for (const id of [...l.starters, ...l.bench]) {
        expect(injured.has(id)).toBe(false);
        expect(suspended.has(id)).toBe(false);
      }
      expect(l.starters[0]).toBe(keepers[2].id);
    }
    // With every keeper available the bench carries the reserve keeper.
    const fresh = makeSquad('d', 65, 4);
    const l = autoLineup(fresh, '4-3-3');
    expect(fresh.find((p) => p.id === l.starters[0])!.position).toBe('ARQ');
    expect(l.bench.some((id) => fresh.find((p) => p.id === id)!.position === 'ARQ')).toBe(true);
    expect(l.bench).toHaveLength(9);
    // A conditionOf override is honoured.
    const out = l.starters[3];
    const l2 = autoLineup(fresh, '4-3-3', (p) =>
      p.id === out ? { fitness: 100, morale: 70, form: 50, injuryDays: 3, suspensionMatches: 0, yellowCards: 0 } : undefined,
    );
    expect(l2.starters).not.toContain(out);
  });

  it('defaultTactics is a balanced setup', () => {
    expect(defaultTactics()).toEqual({
      formation: '4-4-2',
      mentality: 'equilibrada',
      pressing: 'media',
      tempo: 'normal',
      marking: 'zonal',
    });
  });
});

describe('simulateMatchDetailed', () => {
  const t = setup(65, 65);
  const base = { home: t.home, away: t.away, players: t.players };

  it('is deterministic by seed and equal to a live match finished in one go or step by step', () => {
    const a = simulateMatchDetailed({ ...base, rng: createRng(42) });
    expect(simulateMatchDetailed({ ...base, rng: createRng(42) })).toEqual(a);
    expect(createLiveMatch({ ...base, rng: createRng(42) }).finish()).toEqual(a);
    const live = createLiveMatch({ ...base, rng: createRng(42) });
    const streamed: LiveEvent[] = [];
    while (!live.state().finished) streamed.push(...live.step(7));
    expect(streamed).toEqual(a.events);
    expect(live.finish()).toEqual(a);
    expect(simulateMatchDetailed({ ...base, rng: createRng(43) })).not.toEqual(a);
  });

  it('produces football-like scores and card counts over 2000 even matches', () => {
    const N = 2000;
    const reports = many(N, base);
    let goals = 0;
    let home = 0;
    let draw = 0;
    let away = 0;
    let yellow = 0;
    let red = 0;
    let shots = 0;
    for (const r of reports) {
      goals += r.homeGoals + r.awayGoals;
      if (r.homeGoals > r.awayGoals) home++;
      else if (r.homeGoals === r.awayGoals) draw++;
      else away++;
      yellow += r.stats.yellow[0] + r.stats.yellow[1];
      red += r.stats.red[0] + r.stats.red[1];
      shots += r.stats.shots[0] + r.stats.shots[1];
      expect(r.events.filter((e) => GOAL_KINDS.includes(e.kind))).toHaveLength(r.homeGoals + r.awayGoals);
      expect(r.stats.possession[0] + r.stats.possession[1]).toBe(100);
      expect(r.stats.shotsOnTarget[0]).toBeLessThanOrEqual(r.stats.shots[0]);
    }
    expect(goals / N).toBeGreaterThan(2.3);
    expect(goals / N).toBeLessThan(2.9);
    expect(home).toBeGreaterThan(away); // home advantage
    expect(draw / N).toBeGreaterThan(0.18);
    expect(draw / N).toBeLessThan(0.35);
    expect(yellow / N / 2).toBeGreaterThan(2);
    expect(yellow / N / 2).toBeLessThan(4.2);
    expect(red / N).toBeLessThan(0.5);
    expect(shots / N / 2).toBeGreaterThan(9);
    expect(shots / N / 2).toBeLessThan(16);
    const zeroZero = reports.filter((r) => r.homeGoals + r.awayGoals === 0).length / N;
    expect(zeroZero).toBeGreaterThan(0.03);
    expect(zeroZero).toBeLessThan(0.15);
  });

  it('the stronger side wins more, at home or away', () => {
    const strongHome = setup(75, 60);
    const r1 = many(600, { home: strongHome.home, away: strongHome.away, players: strongHome.players });
    expect(r1.filter((r) => r.homeGoals > r.awayGoals).length).toBeGreaterThan(
      3 * r1.filter((r) => r.homeGoals < r.awayGoals).length,
    );
    const strongAway = setup(60, 75);
    const r2 = many(600, { home: strongAway.home, away: strongAway.away, players: strongAway.players });
    expect(r2.filter((r) => r.awayGoals > r.homeGoals).length).toBeGreaterThan(
      2 * r2.filter((r) => r.homeGoals > r.awayGoals).length,
    );
  });

  it('respects substitutions, red cards, ratings and minutes', () => {
    const reports = many(800, base, 5);
    let reds = 0;
    for (const r of reports) {
      for (const club of ['h', 'a']) {
        const subs = r.events.filter((e) => e.kind === 'substitution' && e.clubId === club);
        expect(subs.length).toBeLessThanOrEqual(5);
        const ins = subs.map((e) => e.otherPlayerId!);
        expect(new Set(ins).size).toBe(ins.length);
        // A player who leaves never comes back.
        subs.forEach((e, i) => expect(subs.slice(i + 1).some((x) => x.otherPlayerId === e.playerId)).toBe(false));
      }
      r.events.forEach((e, i) => {
        if (e.kind !== 'red' && e.kind !== 'second-yellow') return;
        reds++;
        expect(r.sentOff).toContain(e.playerId);
        const later = r.events.slice(i + 1);
        expect(later.some((x) => x.playerId === e.playerId || x.otherPlayerId === e.playerId)).toBe(false);
      });
      for (const e of r.events.filter((x) => x.kind === 'second-yellow')) {
        expect(r.events.some((x) => x.kind === 'yellow' && x.playerId === e.playerId)).toBe(true);
      }
      for (const [id, rating] of Object.entries(r.ratings)) {
        expect(rating).toBeGreaterThanOrEqual(1);
        expect(rating).toBeLessThanOrEqual(10);
        expect(r.minutesPlayed[id]).toBeGreaterThan(0);
        expect(r.minutesPlayed[id]).toBeLessThanOrEqual(90);
      }
      expect(Object.keys(r.ratings).length).toBeGreaterThanOrEqual(22);
      expect(r.extraTime).toBe(false);
      expect(r.penalties).toBeUndefined();
      expect(r.events[0].kind).toBe('kickoff');
      expect(r.events[r.events.length - 1].kind).toBe('full-time');
      for (const e of r.events) expect(e.text).not.toMatch(/\{|undefined/);
    }
    expect(reds).toBeGreaterThan(20);
  });

  it('extra time and penalties only when a winner is needed', () => {
    const plain = many(300, base);
    expect(plain.some((r) => r.homeGoals === r.awayGoals)).toBe(true);

    const et = many(300, { ...base, knockout: { needWinner: true, extraTime: true } });
    for (const r of et) {
      const regular = r.events.filter((e) => e.minute <= 90 && GOAL_KINDS.includes(e.kind));
      const drawAt90 = regular.filter((e) => e.clubId === 'h').length === regular.filter((e) => e.clubId === 'a').length;
      expect(r.extraTime).toBe(drawAt90);
      if (r.homeGoals === r.awayGoals) {
        expect(r.penalties).toBeDefined();
        expect(r.penalties!.home).not.toBe(r.penalties!.away);
      } else expect(r.penalties).toBeUndefined();
      if (r.extraTime) {
        for (const v of Object.values(r.minutesPlayed)) expect(v).toBeLessThanOrEqual(120);
        expect(r.events.some((e) => e.kind === 'extra-time')).toBe(true);
      }
    }
    expect(et.some((r) => r.extraTime)).toBe(true);
    expect(et.some((r) => r.penalties)).toBe(true);
    expect(et.some((r) => r.extraTime && !r.penalties)).toBe(true);

    const pens = many(300, { ...base, knockout: { needWinner: true, extraTime: false } });
    for (const r of pens) {
      expect(r.extraTime).toBe(false);
      expect(r.penalties !== undefined).toBe(r.homeGoals === r.awayGoals);
      for (const e of r.events) expect(e.minute).toBeLessThanOrEqual(90);
    }

    // Second leg: the shoot-out happens only when the aggregate is level.
    const agg = many(200, { ...base, knockout: { needWinner: true, extraTime: false, aggregate: { home: 0, away: 1 } } });
    for (const r of agg) expect(r.penalties !== undefined).toBe(r.homeGoals === r.awayGoals + 1);
    expect(agg.some((r) => r.penalties)).toBe(true);
  });

  it('playing a man down concedes more', () => {
    // Drop a centre-back from the starting eleven.
    const starters = t.home.lineup.starters.filter((_, i) => i !== 2);
    const ten = { ...t.home, lineup: { ...t.home.lineup, starters } };
    const full = many(800, base);
    const short = many(800, { ...base, home: ten });
    const conceded = (rs: DetailedMatchReport[]) => rs.reduce((s, r) => s + r.awayGoals, 0);
    const scored = (rs: DetailedMatchReport[]) => rs.reduce((s, r) => s + r.homeGoals, 0);
    expect(conceded(short)).toBeGreaterThan(conceded(full) * 1.15);
    expect(scored(short)).toBeLessThan(scored(full));
  });
});

describe('live match', () => {
  const t = setup(65, 65);

  it('steps, substitutes, changes tactics and finishes', () => {
    const live = createLiveMatch({ home: t.home, away: t.away, players: t.players, rng: createRng(9), ai: { home: false } });
    live.step(30);
    expect(live.state().minute).toBe(30);
    expect(live.state().phase).toBe('first-half');
    while (live.state().phase !== 'half-time') live.step(1);
    let s = live.state();
    expect(s.minute).toBe(45);
    const out = s.home.onPitch.find((p) => POSITION_LINE[p.position] === 'DEL')!.playerId;
    const inId = s.home.bench.find((id) => t.players.get(id)!.position !== 'ARQ')!;
    expect(live.substitute('h', out, inId).kind).toBe('substitution');
    s = live.state();
    expect(s.home.onPitch.some((p) => p.playerId === inId)).toBe(true);
    expect(s.home.windowsLeft).toBe(3); // half-time changes are free
    expect(() => live.substitute('h', out, s.home.bench[0])).toThrow(); // already off
    expect(() => live.substitute('h', inId, out)).toThrow(); // cannot come back

    live.setTactics('h', { ...defaultTactics(), formation: '4-3-3', mentality: 'ofensiva' });
    s = live.state();
    expect(s.home.onPitch.filter((p) => p.position === 'ARQ')).toHaveLength(1);
    expect(s.home.tactics.formation).toBe('4-3-3');

    live.step(20);
    let made = 1;
    for (;;) {
      const st = live.state().home;
      const candidate = st.bench.find((id) => t.players.get(id)!.position !== 'ARQ');
      const outId = st.onPitch.find((p) => p.position !== 'ARQ' && p.playerId !== inId)?.playerId;
      if (!candidate || !outId || live.state().finished) break;
      try {
        live.substitute('h', outId, candidate);
        made++;
      } catch {
        break;
      }
      live.step(3);
    }
    expect(made).toBeGreaterThanOrEqual(3); // one free at half-time + up to three windows
    expect(made).toBeLessThanOrEqual(5);
    const report = live.finish();
    expect(report.events.filter((e) => e.kind === 'substitution' && e.clubId === 'h').length).toBeLessThanOrEqual(5);
    expect(live.state().finished).toBe(true);
    expect(live.step(10)).toEqual([]);
    expect(report.minutesPlayed[out]).toBe(45);
    if (!report.sentOff.includes(inId) && !report.injuries.some((i) => i.playerId === inId)) {
      expect(report.minutesPlayed[inId]).toBe(45);
    }
  });
});
