// Fixture generation: round robin (circle method) and knockout pairings.

export interface Fixture {
  matchday: number;
  homeId: string;
  awayId: string;
}

const BYE = '__bye__';

/** Every club meets every other `rounds` times; the second round swaps home and away. */
export function roundRobin(clubIds: readonly string[], rounds: 1 | 2): Fixture[] {
  const ids = clubIds.length % 2 === 0 ? [...clubIds] : [...clubIds, BYE];
  const n = ids.length;
  const perRound = n - 1;
  const fixtures: Fixture[] = [];
  const rotating = ids.slice(1);

  for (let day = 0; day < perRound; day++) {
    const order = [ids[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      let home = order[i];
      let away = order[n - 1 - i];
      // Alternate the fixed club's venue so nobody plays many home games in a row.
      if (i === 0 && day % 2 === 1) [home, away] = [away, home];
      if (home !== BYE && away !== BYE) fixtures.push({ matchday: day + 1, homeId: home, awayId: away });
    }
    rotating.unshift(rotating.pop()!);
  }

  if (rounds === 2) {
    const second = fixtures.map((f) => ({ matchday: f.matchday + perRound, homeId: f.awayId, awayId: f.homeId }));
    fixtures.push(...second);
  }
  return fixtures;
}

/** Pairs clubs in order: [0 vs 1], [2 vs 3], ... The caller decides the order (draw or seeding). */
export function knockoutPairs(clubIds: readonly string[]): [string, string][] {
  if (clubIds.length < 2 || (clubIds.length & (clubIds.length - 1)) !== 0) {
    throw new Error(`Knockout round needs a power-of-two number of clubs, got ${clubIds.length}`);
  }
  const pairs: [string, string][] = [];
  for (let i = 0; i < clubIds.length; i += 2) pairs.push([clubIds[i], clubIds[i + 1]]);
  return pairs;
}
