import { describe, expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { achievementPoints } from './achievements';

describe('achievement points', () => {
  const world = createWorld(3);
  const rep = (id: string) => world.clubs.find((c) => c.id === id)!.reputation;

  it('a giant winning its league earns about one point; a small club promoting earns many more', () => {
    const madrid = achievementPoints(world, 'esp-1', 'titulo', rep('esp-real-madrid'), 'manager');
    const chicago = achievementPoints(world, 'nacional', 'ascenso', rep('ar-nueva-chicago'), 'manager');
    expect(madrid).toBeLessThanOrEqual(2);
    expect(chicago).toBeGreaterThan(madrid * 5);
  });

  it('Pro Mánager earns more than Mánager for the same feat, and friendlies earn nothing', () => {
    const r = rep('ar-nueva-chicago');
    expect(achievementPoints(world, 'nacional', 'ascenso', r, 'promanager')).toBeGreaterThan(achievementPoints(world, 'nacional', 'ascenso', r, 'manager'));
    expect(achievementPoints(world, 'torneo-verano', 'titulo', r, 'manager')).toBe(0);
  });

  it('continental titles weigh more than domestic leagues', () => {
    const r = rep('ar-san-lorenzo');
    expect(achievementPoints(world, 'copa-libertadores', 'titulo', r, 'manager')).toBeGreaterThan(achievementPoints(world, 'lpf', 'titulo', r, 'manager'));
  });
});
