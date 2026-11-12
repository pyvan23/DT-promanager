import { describe, expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { createRng } from '../rng';
import { bestEleven, overall } from '../squad';
import type { MarketState, TransferOffer } from '../game-types';
import type { Club, Player, World } from '../types';
import {
  aiTransferActivity,
  contractAcceptanceChance,
  defaultWindows,
  evaluateOffer,
  executeLoan,
  executeTransfer,
  expiringPlayers,
  fairWage,
  initialContract,
  isWindowOpen,
  marketAfterTransfer,
  playerValue,
  renewalDemand,
  returnLoan,
  searchPlayers,
  squadRole,
  withInitialContracts,
} from './index';

const SEASON = 2026;
const real = withInitialContracts(createWorld(7), createRng(99));
const small = withInitialContracts(createWorld(3, SEASON, false), createRng(5));

const clubOf = (w: World, p: Player) => w.clubs.find((c) => c.id === p.clubId)!;
const squadOf = (w: World, clubId: string) => w.players.filter((p) => p.clubId === clubId);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function startersValues(w: World, divisionId: string): number[] {
  const div = w.divisions.find((d) => d.id === divisionId)!;
  return div.clubIds.flatMap((id) => {
    const club = w.clubs.find((c) => c.id === id)!;
    return bestEleven(squadOf(w, id)).map((p) => playerValue({ ...p, contract: undefined }, club, SEASON));
  });
}

function withAttrs(p: Player, delta: number): Player {
  const a = Object.fromEntries(Object.entries(p.attributes).map(([k, v]) => [k, Math.min(99, Math.max(1, v + delta))]));
  return { ...p, attributes: a as unknown as Player['attributes'] };
}
const bornIn = (p: Player, year: number): Player => ({ ...p, birthDate: `${year}-03-01` });

describe('valuation', () => {
  const sample = real.players.find((p) => overall(p) > 50 && overall(p) < 70)!;
  const club = clubOf(real, sample);

  it('better overall means more value and wage', () => {
    const base = bornIn({ ...sample, contract: undefined }, SEASON - 26);
    let prev = 0;
    for (const d of [-20, -10, 0, 10, 20]) {
      const v = playerValue(withAttrs(base, d), club, SEASON);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    expect(fairWage(withAttrs(base, 10), club, SEASON)).toBeGreaterThan(fairWage(base, club, SEASON));
  });

  it('value peaks in the prime, youngsters carry potential, veterans fall hard', () => {
    const base = { ...sample, contract: undefined };
    const v = (age: number) => playerValue(bornIn(base, SEASON - age), club, SEASON);
    expect(v(19)).toBeGreaterThan(v(26));
    expect(v(26)).toBe(v(24));
    for (const age of [28, 29, 30, 31, 32, 33, 34]) expect(v(age + 1)).toBeLessThan(v(age));
    expect(v(34)).toBeLessThan(v(26) * 0.2);
  });

  it('fewer seasons left on the contract lower the value', () => {
    const p = { ...sample, contract: { wage: 1000, untilSeason: SEASON + 3 } };
    const short = { ...sample, contract: { wage: 1000, untilSeason: SEASON } };
    expect(playerValue(short, club, SEASON)).toBeLessThan(playerValue(p, club, SEASON));
  });

  it('orders of magnitude by league', () => {
    const lpf = median(startersValues(real, 'lpf'));
    expect(lpf).toBeGreaterThan(1_000_000);
    expect(lpf).toBeLessThan(8_000_000);
    const primeraC = median(startersValues(real, 'primera-c'));
    expect(primeraC).toBeGreaterThan(10_000);
    expect(primeraC).toBeLessThan(50_000);
    const eng = startersValues(real, 'eng-1').sort((a, b) => b - a);
    expect(eng[0]).toBeGreaterThan(60_000_000);
    expect(eng[0]).toBeLessThan(200_000_000);
    expect(median(eng)).toBeGreaterThan(lpf * 4);
  });

  it('wages are coherent with values', () => {
    for (const p of real.players.slice(0, 3000)) {
      const age = SEASON - Number(p.birthDate.slice(0, 4));
      if (age < 22 || age > 29) continue; // veterans legitimately earn above their value
      const club = clubOf(real, p);
      const wage = fairWage(p, club, SEASON);
      expect(wage).toBeGreaterThanOrEqual(500);
      expect(wage * 12).toBeLessThan(Math.max(60_000, playerValue({ ...p, contract: undefined }, club, SEASON) * 1.5));
    }
  });
});

describe('contracts', () => {
  it('initial contracts last 1-5 seasons, Spain always has a clause', () => {
    const rng = createRng(1);
    for (const p of real.players.slice(0, 3000)) {
      const club = clubOf(real, p);
      const c = initialContract(p, club, SEASON, rng);
      expect(c.untilSeason - SEASON + 1).toBeGreaterThanOrEqual(1);
      expect(c.untilSeason - SEASON + 1).toBeLessThanOrEqual(5);
      expect(c.wage).toBeGreaterThan(0);
      if (club.country === 'ESP') expect(c.releaseClause).toBeGreaterThan(0);
    }
    expect(real.players.every((p) => !p.clubId || p.contract)).toBe(true);
  });

  it('players prefer bigger clubs and better wages', () => {
    const p = real.players.find((x) => overall(x) > 60 && clubOf(real, x).country === 'ARG')!;
    const from = clubOf(real, p);
    const big: Club = { ...from, id: 'big', reputation: 90, country: 'ENG' };
    const tiny: Club = { ...from, id: 'tiny', reputation: 20 };
    const offer = { wage: p.contract!.wage * 1.2, untilSeason: SEASON + 3 };
    const toBig = contractAcceptanceChance(p, p.contract, offer, big, from, SEASON);
    const toTiny = contractAcceptanceChance(p, p.contract, offer, tiny, from, SEASON);
    expect(toBig).toBeGreaterThan(toTiny);
    const richer = contractAcceptanceChance(p, p.contract, { ...offer, wage: offer.wage * 2 }, tiny, from, SEASON);
    expect(richer).toBeGreaterThan(toTiny);
    // Renewal: meeting the demand is likely accepted, a pay cut is not.
    const demand = renewalDemand(p, from, SEASON);
    expect(contractAcceptanceChance(p, p.contract, demand, from, from, SEASON)).toBeGreaterThan(0.5);
    expect(contractAcceptanceChance(p, p.contract, { ...demand, wage: demand.wage * 0.5 }, from, from, SEASON)).toBeLessThan(0.2);
  });

  it('expiringPlayers lists contracts ending this season', () => {
    const exp = expiringPlayers(real, SEASON);
    expect(exp.length).toBeGreaterThan(0);
    expect(exp.every((p) => p.contract!.untilSeason <= SEASON && p.clubId)).toBe(true);
  });
});

function offerFor(_w: World, player: Player, buyer: Club, fee: number, kind: 'traspaso' | 'cesion' = 'traspaso'): TransferOffer {
  return {
    id: 'o1',
    date: `${SEASON}-07-10`,
    playerId: player.id,
    fromClubId: buyer.id,
    toClubId: player.clubId!,
    kind,
    fee,
    contract: { wage: fairWage(player, buyer, SEASON), untilSeason: SEASON + 3 },
    status: 'pendiente',
  };
}

describe('offers', () => {
  const key = (() => {
    const club = real.clubs.find((c) => c.country === 'ESP')!;
    const squad = squadOf(real, club.id);
    return squad.find((p) => squadRole(p, squad) === 'clave')!;
  })();
  const buyer = real.clubs.find((c) => c.country === 'ENG')!;

  it('paying the release clause is always accepted', () => {
    const clause = key.contract!.releaseClause!;
    expect(clause).toBeGreaterThan(0);
    for (let s = 0; s < 50; s++)
      expect(evaluateOffer(offerFor(real, key, buyer, clause), real, SEASON, createRng(s)).status).toBe('aceptada');
  });

  it('low offers are rejected, near ones countered, starters cost more than substitutes', () => {
    const seller = clubOf(real, key);
    const value = playerValue(key, seller, SEASON);
    expect(evaluateOffer(offerFor(real, key, buyer, value * 0.3), real, SEASON, createRng(1)).status).toBe('rechazada');
    const near = evaluateOffer(offerFor(real, key, buyer, value * 1.25), real, SEASON, createRng(1));
    expect(near.status).toBe('contraoferta');
    expect(near.counterFee).toBeGreaterThan(value * 1.25);

    const squad = squadOf(real, seller.id);
    const sub = squad.find((p) => squadRole(p, squad) === 'suplente' && !p.contract?.releaseClause) ??
      squad.find((p) => squadRole(p, squad) === 'suplente')!;
    const subValue = playerValue(sub, seller, SEASON);
    const r = evaluateOffer(offerFor(real, sub, buyer, Math.min(subValue * 1.15, sub.contract?.releaseClause ?? Infinity)), real, SEASON, createRng(1));
    expect(r.status).toBe('aceptada');
  });

  it('executeTransfer does not mutate the world and keeps players in one club', () => {
    const before = JSON.stringify(small);
    const player = small.players.find((p) => p.clubId)!;
    const to = small.clubs.find((c) => c.id !== player.clubId)!;
    const offer = offerFor(small, player, to, 1_000_000);
    const next = executeTransfer(small, offer);
    expect(JSON.stringify(small)).toBe(before);
    expect(next.players.filter((p) => p.id === player.id)).toHaveLength(1);
    expect(next.players.length).toBe(small.players.length);
    const moved = next.players.find((p) => p.id === player.id)!;
    expect(moved.clubId).toBe(to.id);
    expect(moved.contract).toEqual(offer.contract);
    expect(() => executeTransfer(next, offer)).toThrow();
  });

  it('loans return at the end of the season', () => {
    const player = small.players.find((p) => p.clubId)!;
    const parent = player.clubId!;
    const to = small.clubs.find((c) => c.id !== parent)!;
    const { world, loan } = executeLoan(small, offerFor(small, player, to, 0, 'cesion'));
    expect(loan.returnDate).toBe(`${small.season}-12-31`);
    expect(world.players.find((p) => p.id === player.id)!.clubId).toBe(to.id);
    const back = returnLoan(world, loan);
    const returned = back.players.find((p) => p.id === player.id)!;
    expect(returned.clubId).toBe(parent);
    expect(returned.contract).toEqual(player.contract);
  });

  it('marketAfterTransfer withdraws the other offers', () => {
    const o1 = offerFor(small, small.players[0], small.clubs[5], 10);
    const o2 = { ...o1, id: 'o2', fromClubId: small.clubs[6].id };
    const m = marketAfterTransfer({ transferList: [o1.playerId], loanList: [], offers: [o1, o2], windows: [] }, o1);
    expect(m.offers.map((o) => o.status)).toEqual(['aceptada', 'retirada']);
    expect(m.transferList).toEqual([]);
  });
});

describe('AI transfer activity', () => {
  const market: MarketState = { transferList: [], loanList: [], offers: [], windows: defaultWindows(SEASON) };
  const userClubId = small.clubs[0].id;

  it('only inside the windows', () => {
    expect(isWindowOpen(market.windows, `${SEASON}-02-28`)).toBe(true);
    expect(isWindowOpen(market.windows, `${SEASON}-03-01`)).toBe(false);
    expect(aiTransferActivity(small, market, `${SEASON}-04-10`, createRng(1), { maxOffers: 10 })).toEqual([]);
  });

  it('never commits more than the budget and offers are well formed', () => {
    const budgets = Object.fromEntries(small.clubs.map((c, i) => [c.id, (i % 4) * 400_000]));
    let offers: TransferOffer[] = [];
    let state = market;
    for (let day = 1; day <= 40; day++) {
      const date = `${SEASON}-07-${String(Math.min(day, 31)).padStart(2, '0')}`;
      const today = aiTransferActivity(small, state, date, createRng(day), { budgets, userClubId, maxOffers: 5 });
      offers = offers.concat(today);
      state = { ...state, offers };
    }
    expect(offers.length).toBeGreaterThan(5);
    const spent = new Map<string, number>();
    for (const o of offers) {
      expect(o.fromClubId).not.toBe(userClubId);
      expect(o.fromClubId).not.toBe(o.toClubId);
      expect(small.players.find((p) => p.id === o.playerId)!.clubId).toBe(o.toClubId);
      spent.set(o.fromClubId, (spent.get(o.fromClubId) ?? 0) + o.fee);
    }
    for (const [club, total] of spent) expect(total).toBeLessThanOrEqual(budgets[club]);
    expect(offers.some((o) => o.toClubId === userClubId)).toBe(true);
  });

  it('is deterministic', () => {
    const a = aiTransferActivity(small, market, `${SEASON}-07-05`, createRng(42), { maxOffers: 5 });
    const b = aiTransferActivity(small, market, `${SEASON}-07-05`, createRng(42), { maxOffers: 5 });
    expect(a).toEqual(b);
  });
});

describe('search', () => {
  it('filters, sorts and paginates', () => {
    const res = searchPlayers(real, { position: 'DC', minAge: 20, maxAge: 25, minOverall: 60, country: 'ARG', pageSize: 10 });
    expect(res.total).toBeGreaterThan(0);
    expect(res.results.length).toBeLessThanOrEqual(10);
    for (const r of res.results) {
      expect(r.player.position).toBe('DC');
      expect(r.age).toBeGreaterThanOrEqual(20);
      expect(r.age).toBeLessThanOrEqual(25);
      expect(r.overall).toBeGreaterThanOrEqual(60);
      expect(r.club?.country).toBe('ARG');
    }
    for (let i = 1; i < res.results.length; i++) expect(res.results[i - 1].overall).toBeGreaterThanOrEqual(res.results[i].overall);
    const p2 = searchPlayers(real, { position: 'DC', minAge: 20, maxAge: 25, minOverall: 60, country: 'ARG', pageSize: 10, page: 1 });
    if (res.total > 10) expect(p2.results[0].player.id).not.toBe(res.results[0].player.id);
  });

  it('value, division, transfer list and free agents', () => {
    const cheap = searchPlayers(real, { maxValue: 100_000, sortBy: 'value', pageSize: 50 });
    expect(cheap.results.every((r) => r.value <= 100_000)).toBe(true);
    const pc = searchPlayers(real, { divisionId: 'primera-c', pageSize: 1000 });
    const pcClubs = new Set(real.divisions.find((d) => d.id === 'primera-c')!.clubIds);
    expect(pc.total).toBeGreaterThan(0);
    expect(pc.results.every((r) => pcClubs.has(r.player.clubId!))).toBe(true);
    const listed = [real.players[3].id, real.players[10].id];
    expect(searchPlayers(real, { transferListedOnly: true, transferList: listed }).total).toBe(2);
    const withFree = { ...real, players: [...real.players, { ...real.players[0], id: 'free1', clubId: null, contract: undefined }] };
    const free = searchPlayers(withFree, { freeAgentsOnly: true });
    expect(free.results.map((r) => r.player.id)).toEqual(['free1']);
  });
});
