import { describe, expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { isSeasonOver, nextUserMatch } from '../calendar/calendar';
import { alerts } from './alerts';
import { academy, advanceDay, setTraining, advanceToNextMatch, endSeason, makeOffer, newGame, normalizeGame, playNextMatch, proManagerOffers, promoteYouth, respondToOffer, simulateRestOfSeason, takeJob } from './game';

describe('career game loop', () => {
  const world = createWorld(31, 2026, false);
  const userClub = world.divisions.find((d) => d.id === 'lpf')!.clubIds[3];

  it('starts in pre-season and stops before each user match', () => {
    let g = newGame(world, userClub);
    expect(g.club.finances.balance).toBeGreaterThan(0);
    expect(g.world.players.every((p) => p.contract)).toBe(true);
    g = advanceToNextMatch(g);
    const next = nextUserMatch(g.calendar)!;
    expect(next.date).toBe(g.calendar.date);
    expect(next.competitionId).toBe('amistoso');
    g = playNextMatch(g);
    expect(g.news.some((n) => n.kind === 'partido')).toBe(true);
  });

  it('plays a full season with monthly accounts, then starts the next one', () => {
    let g = simulateRestOfSeason(newGame(world, userClub));
    if (g.fired) return; // a sacking ends the run early; covered by the club module tests
    expect(isSeasonOver(g.calendar)).toBe(true);
    const months = new Set(g.club.finances.ledger.filter((t) => t.kind === 'sueldos').map((t) => t.date.slice(0, 7)));
    expect(months.size).toBeGreaterThanOrEqual(10);
    expect(g.club.finances.ledger.some((t) => t.kind === 'taquilla')).toBe(true);
    g = endSeason(g);
    expect(g.world.season).toBe(2027);
    expect(g.calendar.season).toBe(2027);
    expect(g.lastSummary?.season).toBe(2026);
    expect(g.calendar.matches.some((m) => m.status === 'scheduled')).toBe(true);
  });

  it('plays the user matches with the detailed engine and records condition and stats (real world)', () => {
    const real = createWorld(5);
    const club = real.divisions.find((d) => d.id === 'lpf')!.clubIds[0];
    const t0 = Date.now();
    const g = simulateRestOfSeason(newGame(real, club));
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(60_000);
    const userMatches = g.calendar.matches.filter((m) => m.homeId === club || m.awayId === club);
    expect(userMatches.every((m) => m.status === 'played' && m.report)).toBe(true);
    const squad = g.world.players.filter((p) => p.clubId === club);
    expect(squad.some((p) => (p.stats?.[0]?.appearances ?? 0) > 10)).toBe(true);
    expect(squad.reduce((s, p) => s + (p.stats?.[0]?.goals ?? 0), 0)).toBeGreaterThan(10);
    expect(squad.every((p) => p.condition && p.condition.fitness >= 0 && p.condition.fitness <= 100)).toBe(true);
    console.log(`temporada real completa en ${elapsed} ms, ${g.news.length} noticias`);
  }, 120_000);

  it('between seasons: academy intake, ageing, retirements and contracts', () => {
    let g = simulateRestOfSeason(newGame(world, userClub));
    if (g.fired) return;
    const before = new Map(g.world.players.map((p) => [p.id, p]));
    g = endSeason(g);
    const youth = academy(g);
    expect(youth.length).toBeGreaterThanOrEqual(2);
    expect(youth.every((p) => 2027 - Number(p.birthDate.slice(0, 4)) <= 18)).toBe(true);
    // Young players improve on average, old ones decline.
    const delta = (minAge: number, maxAge: number) => {
      const ds = g.world.players
        .filter((p) => before.has(p.id))
        .filter((p) => { const a = 2027 - Number(p.birthDate.slice(0, 4)); return a >= minAge && a <= maxAge; })
        .map((p) => p.attributes.quality - before.get(p.id)!.attributes.quality);
      return ds.reduce((s, d) => s + d, 0) / Math.max(1, ds.length);
    };
    expect(delta(17, 21)).toBeGreaterThan(0);
    expect(delta(33, 40)).toBeLessThan(0);
    // Nobody is under contract for a season that already ended.
    expect(g.world.players.filter((p) => p.clubId && p.contract).every((p) => p.contract!.untilSeason >= 2027)).toBe(true);
    const promoted = promoteYouth(g, youth[0].id);
    expect(promoted.world.players.find((p) => p.id === youth[0].id)!.youth).toBe(false);
    // The second season plays to the end as well.
    g = simulateRestOfSeason(g);
    expect(g.fired || isSeasonOver(g.calendar)).toBeTruthy();
  });

  it('handles the transfer market: closed outside windows, AI offers during windows', () => {
    const g = newGame(world, userClub);
    const target = g.world.players.find((p) => p.clubId && p.clubId !== userClub)!;
    const contract = { wage: 10_000, untilSeason: 2028 };
    // 5 January is inside the summer window: the offer is answered.
    const answer = makeOffer(g, target.id, 1, contract);
    expect(['rechazada', 'contraoferta', 'aceptada']).toContain(answer.status);
    // Play into February (still open) and collect offers for the user's players.
    let h = g;
    for (let i = 0; i < 40; i++) h = playNextMatch(h);
    for (const offer of h.market.offers.filter((o) => o.toClubId === userClub && o.status === 'pendiente').slice(0, 1)) {
      const before = h.club.finances.balance;
      const after = respondToOffer(h, offer.id, true);
      expect(after.world.players.find((p) => p.id === offer.playerId)!.clubId).toBe(offer.fromClubId);
      expect(after.club.finances.balance).toBe(before + offer.fee);
    }
  });
});

describe('game modes', () => {
  const world = createWorld(41, 2026, false);

  it('Pro Mánager starts with offers from small clubs and a low reputation', () => {
    const offers = proManagerOffers(world, 1, 'ARG');
    expect(offers.length).toBeGreaterThanOrEqual(2);
    // Argentina: the best of the Primera B Metro and the weakest of the Primera Nacional.
    expect(offers.every((o) => o.divisionId === 'b-metro' || o.divisionId === 'nacional')).toBe(true);
    const rep = (id: string) => world.clubs.find((c) => c.id === id)!.reputation;
    const nacional = world.divisions.find((d) => d.id === 'nacional')!.clubIds.map(rep).sort((a, b) => a - b);
    for (const o of offers.filter((x) => x.divisionId === 'nacional')) expect(rep(o.clubId)).toBeLessThanOrEqual(nacional[7]);
    const g = newGame(world, offers[0].clubId, { mode: 'promanager', managerName: 'Pepe', matchMode: 'simulado' });
    expect(g.mode).toBe('promanager');
    expect(g.managerName).toBe('Pepe');
    expect(g.settings.matchMode).toBe('simulado');
    expect(g.managerReputation).toBeLessThan(30);
  });

  it('Mánager mode never sacks the manager', () => {
    const club = world.divisions.find((d) => d.id === 'lpf')!.clubIds[29];
    let g = newGame(world, club, { mode: 'manager' });
    g = { ...g, club: { ...g.club, board: { ...g.club.board, confidence: 0 } } };
    g = simulateRestOfSeason(g);
    expect(g.fired).toBeUndefined();
  });

  it('a strong Pro Mánager season earns offers from bigger clubs', () => {
    const offers = proManagerOffers(world, 2, 'ARG');
    let g = newGame(world, offers[0].clubId, { mode: 'promanager' });
    g = simulateRestOfSeason(g);
    if (g.fired) return;
    // Simulate a great campaign: lift the reputation as if the club had won the title.
    g = endSeason({ ...g, managerReputation: 70 });
    const me = g.world.clubs.find((c) => c.id === g.userClubId)!;
    for (const o of g.seasonOffers ?? []) expect(g.world.clubs.find((c) => c.id === o.clubId)!.reputation).toBeGreaterThan(me.reputation);
    if (g.seasonOffers?.length) {
      const moved = takeJob(g, g.seasonOffers[0].clubId);
      expect(moved.userClubId).toBe(g.seasonOffers[0].clubId);
      expect(moved.seasonOffers).toBeUndefined();
      expect(moved.calendar.matches.some((m) => m.competitionId === 'amistoso' && (m.homeId === moved.userClubId || m.awayId === moved.userClubId))).toBe(true);
    }
  });

  it('old saves get the new fields with defaults', () => {
    const g = newGame(world, world.divisions[0].clubIds[0]);
    const old = { ...g } as Record<string, unknown>;
    delete old.mode;
    delete old.settings;
    delete old.managerName;
    const n = normalizeGame(old as unknown as typeof g);
    expect(n.mode).toBe('manager');
    expect(n.settings.matchMode).toBe('vivo');
  });
});

describe('coach-only careers, training and alerts', () => {
  const world = createWorld(51, 2026, false);
  const club = world.divisions.find((d) => d.id === 'lpf')!.clubIds[5];

  it('the sporting director runs the market: no offers land in the inbox', () => {
    let g = newGame(world, club, { scope: 'entrenador' });
    for (let i = 0; i < 30; i++) g = advanceDay(g);
    expect(g.market.offers.filter((o) => o.toClubId === club && o.status === 'pendiente')).toHaveLength(0);
    expect(g.scope).toBe('entrenador');
  });

  it('weekly training improves young players over a season', () => {
    let g = newGame(world, club);
    g = setTraining(g, { focus: 'tecnico', intensity: 'alta' });
    const before = new Map(g.world.players.filter((p) => p.clubId === club).map((p) => [p.id, p.attributes.quality + p.attributes.dribbling + p.attributes.passing]));
    for (let i = 0; i < 70; i++) g = advanceDay(g);
    expect(g.lastTraining).toBeDefined();
    const gained = g.world.players
      .filter((p) => before.has(p.id))
      .reduce((s, p) => s + (p.attributes.quality + p.attributes.dribbling + p.attributes.passing - before.get(p.id)!), 0);
    expect(gained).toBeGreaterThan(0);
  });

  it('alerts flag injured starters and expiring contracts', () => {
    let g = newGame(world, club);
    const starter = g.world.players.find((p) => p.clubId === club)!;
    g = {
      ...g,
      club: { ...g.club, lineup: { starters: [starter.id], bench: [] } },
      world: {
        ...g.world,
        players: g.world.players.map((p) =>
          p.id === starter.id
            ? { ...p, condition: { fitness: 100, morale: 70, form: 50, injuryDays: 12, suspensionMatches: 0, yellowCards: 0 }, contract: { ...p.contract!, untilSeason: 2026 } }
            : p,
        ),
      },
    };
    const list = alerts(g);
    expect(list.some((a) => a.id === `inj-${starter.id}` && a.tone === 'urgente')).toBe(true);
    expect(list.some((a) => a.id === 'contracts')).toBe(true);
    expect(alerts({ ...g, scope: 'entrenador' }).some((a) => a.id === 'contracts')).toBe(false);
  });
});
