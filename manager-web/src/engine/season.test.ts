import { describe, expect, it } from 'vitest';
import { createWorld } from '../data/world';
import { DIVISION_TEMPLATES } from '../data/divisions';
import { REAL_SQUADS } from '../data/real';
import { playSeason } from './season';
import { bestEleven, overall } from './squad';
import { POSITION_LINE } from './types';

describe('world generation (fictional)', () => {
  const world = createWorld(123, 2026, false);

  it('fills every division with its configured number of clubs, each with a squad', () => {
    for (const t of DIVISION_TEMPLATES) {
      expect(world.divisions.find((d) => d.id === t.id)?.clubIds).toHaveLength(t.size);
    }
    const names = new Set(world.clubs.map((c) => c.name));
    expect(names.size).toBe(world.clubs.length);
    for (const club of world.clubs.slice(0, 20)) {
      const squad = world.players.filter((p) => p.clubId === club.id);
      expect(squad.length).toBeGreaterThanOrEqual(22);
      const eleven = bestEleven(squad);
      expect(eleven).toHaveLength(11);
      expect(eleven.filter((p) => POSITION_LINE[p.position] === 'ARQ')).toHaveLength(1);
    }
  });

  it('top-flight players are better on average than fifth-tier players', () => {
    const mean = (divisionId: string) => {
      const ids = new Set(world.divisions.find((d) => d.id === divisionId)!.clubIds);
      const ps = world.players.filter((p) => p.clubId && ids.has(p.clubId));
      return ps.reduce((s, p) => s + overall(p), 0) / ps.length;
    };
    expect(mean('lpf')).toBeGreaterThan(mean('promocional') + 15);
  });

  it('is deterministic for a seed', () => {
    expect(createWorld(5).clubs.map((c) => c.name)).toEqual(createWorld(5).clubs.map((c) => c.name));
  });
});

describe('world generation (real data)', () => {
  const world = createWorld(1);
  const real = world.clubs.filter((c) => c.id.startsWith('ar-'));

  it('uses the real club lists and gives every club a playable squad', () => {
    for (const club of real) {
      const squad = world.players.filter((p) => p.clubId === club.id);
      expect(squad.length, club.shortName).toBeGreaterThanOrEqual(22);
      expect(bestEleven(squad), club.shortName).toHaveLength(11);
    }
  });

  it('never places the same real player in two clubs', () => {
    // Only clubs with a real squad file: other clubs have generated players, whose names can repeat.
    const realClubs = new Set(Object.keys(REAL_SQUADS).map((s) => `ar-${s}`));
    const seen = new Map<string, string>();
    for (const p of world.players.filter((pl) => pl.clubId && realClubs.has(pl.clubId) && !pl.id.startsWith('y'))) {
      const key = `${p.name}|${p.birthDate}`;
      expect(seen.get(key), `${p.name} in ${seen.get(key)} and ${p.clubId}`).toBeUndefined();
      seen.set(key, p.clubId!);
    }
  });
});

describe('season', () => {
  it.each([false, true])('keeps every division size stable over several seasons (real data: %s)', (real) => {
    let world = createWorld(99, 2026, real);
    const sizes = new Map(world.divisions.map((d) => [d.id, d.clubIds.length]));
    for (let i = 0; i < 3; i++) {
      const { next } = playSeason(world);
      for (const d of next.divisions) {
        expect(d.clubIds, `${d.id} after season ${world.season}`).toHaveLength(sizes.get(d.id)!);
      }
      const all = next.divisions.flatMap((d) => d.clubIds);
      expect(new Set(all).size).toBe(world.clubs.length);
      world = next;
    }
    expect(world.season).toBe(2029);
  });

  it('moves promoted and relegated clubs to the right divisions', () => {
    const world = createWorld(7, 2026, false);
    const { summary, next } = playSeason(world);
    const divisionOf = (id: string) => next.divisions.find((d) => d.clubIds.includes(id))!.id;
    const nacional = summary.divisions.find((d) => d.divisionId === 'nacional')!;
    for (const id of nacional.promoted) expect(divisionOf(id)).toBe('lpf');
    const lpf = summary.divisions.find((d) => d.divisionId === 'lpf')!;
    expect(lpf.relegated).toHaveLength(2);
    for (const id of lpf.relegated) expect(divisionOf(id)).toBe('nacional');
    // Relegation from the top flight follows the averages table.
    expect(lpf.averages).toHaveLength(30);
    const worst = lpf.averages!.slice(-2).map((a) => a.clubId);
    expect(lpf.relegated.sort()).toEqual(worst.sort());
    // Nacional sends metro clubs to B Metro and interior clubs to Federal A.
    const region = (id: string) => world.clubs.find((c) => c.id === id)!.region;
    for (const id of nacional.relegated) {
      expect(divisionOf(id)).toBe(region(id) === 'metro' ? 'b-metro' : 'federal-a');
    }
  });

  it('ranks the champion first and promotes semi-finalists from the Regional', () => {
    const { summary } = playSeason(createWorld(11, 2026, false));
    const regional = summary.divisions.find((d) => d.divisionId === 'regional')!;
    expect(regional.ranking[0]).toBe(regional.result.champion);
    expect(regional.promoted).toHaveLength(4);
    const knockout = regional.result.stages[1];
    const semifinalists = new Set(knockout.rounds[knockout.rounds.length - 3]);
    for (const id of regional.promoted) expect(semifinalists.has(id)).toBe(true);
  });
});
