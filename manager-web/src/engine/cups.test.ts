import { describe, expect, it } from 'vitest';
import { createWorld } from '../data/world';
import { COPA_SUDAMERICANA_DEF } from '../data/cups';
import { cupOrder, resolveEntrants } from './cups';
import { playSeason } from './season';
import type { CompetitionDef, World } from './types';

describe('cups', () => {
  it('plays the Copa Argentina with 64 clubs from every level and marks continental cups pending', () => {
    const { summary } = playSeason(createWorld(3, 2026, false));
    const copa = summary.competitions.find((c) => c.competitionId === 'copa-argentina')!;
    expect(copa.entrants).toHaveLength(64);
    expect(new Set(copa.entrants).size).toBe(64);
    expect(copa.result?.champion).toBeDefined();
    const lib = summary.competitions.find((c) => c.competitionId === 'copa-libertadores')!;
    expect(lib.result).toBeUndefined();
    expect(lib.pending).toMatch(/Faltan clubes/);
  });

  it('feeds next season qualification with this season rankings and cup champions', () => {
    const { summary, next } = playSeason(createWorld(4, 2026, false));
    expect(next.qualification?.season).toBe(2026);
    expect(next.qualification?.rankings.lpf).toEqual(summary.divisions.find((d) => d.divisionId === 'lpf')!.ranking);
    expect(next.qualification?.champions['copa-argentina']).toBe(
      summary.competitions.find((c) => c.competitionId === 'copa-argentina')!.result!.champion,
    );
  });

  it('passes a spot down the table when the cup champion already qualified by league', () => {
    const world: World = { ...createWorld(5, 2026, false) };
    const lpf = world.divisions.find((d) => d.id === 'lpf')!.clubIds;
    world.qualification = { season: 2025, rankings: { lpf }, champions: { 'copa-argentina': lpf[1] } };
    const def: CompetitionDef = {
      id: 'test', name: 'Test', formatId: 'x', scope: 'continental', size: 5,
      entries: [
        { kind: 'division', divisionId: 'lpf', from: 1, to: 4 },
        { kind: 'champion', competitionId: 'copa-argentina' },
      ],
    };
    const { entrants } = resolveEntrants(def, world, new Map(), new Set());
    expect(entrants).toEqual(lpf.slice(0, 5)); // champion was 2nd, so the 5th-placed club takes the spot
  });

  it('keeps clubs out of a second continental cup and orders dependent cups', () => {
    const world = createWorld(6, 2026, false);
    const lpf = world.divisions.find((d) => d.id === 'lpf')!.clubIds;
    world.qualification = { season: 2025, rankings: { lpf }, champions: {} };
    const taken = new Set([lpf[4]]); // already in the Libertadores
    const { entrants } = resolveEntrants(COPA_SUDAMERICANA_DEF, world, new Map(), taken);
    expect(entrants).not.toContain(lpf[4]);
    expect(entrants).toHaveLength(6);
    const order = cupOrder([COPA_SUDAMERICANA_DEF, { ...COPA_SUDAMERICANA_DEF, id: 'copa-libertadores', after: [] }]);
    expect(order.map((d) => d.id)).toEqual(['copa-libertadores', 'copa-sudamericana']);
  });
});
