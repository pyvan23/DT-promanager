import { describe, expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import type { BoardState, ClubState, ScheduledMatch, StaffMember } from '../game-types';
import { createRng } from '../rng';
import type { Club, Division, World } from '../types';
import {
  addTransactions,
  annualTvIncome,
  applyExpansion,
  completeWorks,
  endOfSeasonEvaluation,
  expansionOptions,
  fireStaff,
  hireStaff,
  improvePitch,
  initialClubState,
  jobOffers,
  ledgerTotal,
  matchdayIncome,
  monthlyUpdate,
  prizeAmount,
  prizeTransaction,
  setTicketPrice,
  staffCandidates,
  staffEffects,
  STAFF_ROLES,
  updateBoardAfterMatch,
} from './index';

const world = createWorld(1);
const divisionOf = (w: World, clubId: string) => w.divisions.find((d) => d.clubIds.includes(clubId))!;
const byRep = (w: World, divisionId: string): Club[] => {
  const d = w.divisions.find((x) => x.id === divisionId)!;
  return d.clubIds.map((id) => w.clubs.find((c) => c.id === id)!).sort((a, b) => b.reputation - a.reputation);
};
const strongest = (w: World, divisionId: string) => byRep(w, divisionId)[0];
const weakest = (w: World, divisionId: string) => byRep(w, divisionId).slice(-1)[0];
const init = (club: Club, seed = 3) => initialClubState(club, divisionOf(world, club.id), world, 2026, createRng(seed));
const ctx = (club: Club): { club: Club; division: Division } => ({ club, division: divisionOf(world, club.id) });

const homeMatch = (clubId: string, date = '2026-03-01'): ScheduledMatch => ({
  id: 'm1', date, competitionId: 'lpf', stageId: 'liga', round: 1, homeId: clubId, awayId: 'rival', neutral: false, status: 'scheduled',
});

const bigEnglish = strongest(world, 'eng-1');
const bigArgentine = strongest(world, 'lpf');
const primeraC = strongest(world, 'primera-c');

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

describe('initial club state', () => {
  it('scales stadiums and TV money by orders of magnitude', () => {
    const eng = init(bigEnglish);
    const arg = init(bigArgentine);
    const c = init(primeraC);
    expect(eng.stadium.capacity).toBeGreaterThanOrEqual(60_000);
    expect(eng.stadium.capacity).toBeLessThanOrEqual(85_000);
    expect(arg.stadium.capacity).toBeGreaterThanOrEqual(45_000);
    expect(arg.stadium.capacity).toBeLessThanOrEqual(80_000);
    expect(c.stadium.capacity).toBeGreaterThanOrEqual(3_000);
    expect(c.stadium.capacity).toBeLessThanOrEqual(8_000);

    const tvEng = annualTvIncome(bigEnglish, 1);
    const tvArg = annualTvIncome(bigArgentine, 1);
    const tvC = annualTvIncome(primeraC, 4);
    expect(tvEng).toBeGreaterThan(100e6);
    expect(tvEng / tvArg).toBeGreaterThan(20);
    expect(tvArg / tvC).toBeGreaterThan(100);
    expect(eng.stadium.ticketPrice).toBeGreaterThan(arg.stadium.ticketPrice * 3);
    expect(eng.finances.wageBudget).toBeGreaterThan(c.finances.wageBudget * 300);
  });

  it('has the six staff roles, a sponsor and the starting balance in the ledger', () => {
    const s = init(bigArgentine);
    expect(new Set(s.staff.map((m) => m.role)).size).toBe(6);
    expect(s.finances.sponsor?.perSeason).toBeGreaterThan(0);
    expect(s.board.confidence).toBe(60);
    expect(s.finances.balance).toBe(ledgerTotal(s.finances.ledger));
    expect(s.stadium.name).toBe(bigArgentine.stadium);
  });

  it('sets board objectives from the expected position in the division', () => {
    expect(init(bigEnglish).board.objective).toBe('campeon');
    expect(init(weakest(world, 'lpf')).board.objective).toBe('no-descender');
    expect(init(byRep(world, 'lpf')[15]).board.objective).toBe('mitad-tabla');
    expect(init(primeraC).board.objective).toBe('ascender');
    expect(init(strongest(world, 'nacional')).board.objective).toBe('ascender');
  });

  it('uses contracts for the wage budget when players have them', () => {
    const w = createWorld(2, 2026, false);
    const club = w.clubs[0];
    const players = w.players.map((p) => (p.clubId === club.id ? { ...p, contract: { wage: 10_000, untilSeason: 2028 } } : p));
    const s = initialClubState(club, divisionOf(w, club.id), { ...w, players }, 2026, createRng(1));
    const count = players.filter((p) => p.clubId === club.id).length;
    expect(s.finances.wageBudget).toBe(Math.round((1.2 * count * 10_000) / 1000) * 1000);
  });

  it('works for every club of a fictional world and is deterministic', () => {
    const w = createWorld(7, 2026, false);
    for (const club of w.clubs) {
      const s = initialClubState(club, divisionOf(w, club.id), w, 2026, createRng(11));
      expect(Number.isFinite(s.finances.balance)).toBe(true);
      expect(s.stadium.capacity).toBeGreaterThan(0);
    }
    const club = w.clubs[3];
    const a = initialClubState(club, divisionOf(w, club.id), w, 2026, createRng(4));
    const b = initialClubState(club, divisionOf(w, club.id), w, 2026, createRng(4));
    expect(a).toEqual(b);
  });
});

describe('ledger and monthly accounts', () => {
  it('keeps the balance equal to the sum of the ledger through every operation', () => {
    const club = bigArgentine;
    let s = init(club);
    const rng = createRng(8);
    for (let m = 1; m <= 6; m++) s = monthlyUpdate(s, world.players, `2026-0${m}-28`, rng, ctx(club));
    s = matchdayIncome(s, homeMatch(club.id), 70, club.reputation, 0.5, rng).clubState;
    s = applyExpansion(s, expansionOptions(s.stadium)[0], '2026-07-01').clubState;
    s = improvePitch(s, 5, '2026-07-02');
    s = hireStaff(s, staffCandidates('medico', club, rng, 1)[0], '2026-07-03');
    s = addTransactions(s, [prizeTransaction(world, 'copa-libertadores', { kind: 'participation' }, '2026-07-04')]);
    s = monthlyUpdate(s, world.players, '2026-07-28', rng); // no context: fallback estimates
    expect(s.finances.balance).toBeCloseTo(ledgerTotal(s.finances.ledger), 6);
    const kinds = new Set<string>(s.finances.ledger.map((t) => t.kind));
    for (const k of ['sueldos', 'empleados', 'tv', 'sponsor', 'estadio', 'taquilla', 'premios', 'otros']) expect(kinds.has(k)).toBe(true);
  });

  it('pays the wages of the club players only, plus insurance for insured players', () => {
    const club = bigArgentine;
    const s = init(club);
    const players = world.players.map((p) =>
      p.clubId === club.id ? { ...p, contract: { wage: 1000, untilSeason: 2027, insured: true } } : p,
    );
    const squad = players.filter((p) => p.clubId === club.id).length;
    const after = monthlyUpdate(s, players, '2026-02-28', createRng(1), ctx(club));
    const added = after.finances.ledger.slice(s.finances.ledger.length);
    expect(added.find((t) => t.kind === 'sueldos')!.amount).toBe(-1000 * squad);
    expect(added.filter((t) => t.kind === 'seguros').reduce((x, t) => x + t.amount, 0)).toBe(-40 * squad);
  });

  it('a season of TV money of a big English club dwarfs that of a Primera C club', () => {
    const run = (club: Club) => {
      let s = init(club);
      const rng = createRng(2);
      for (let m = 1; m <= 12; m++) s = monthlyUpdate(s, world.players, `2026-${String(m).padStart(2, '0')}-28`, rng, ctx(club));
      return s.finances.ledger.filter((t) => t.kind === 'tv').reduce((x, t) => x + t.amount, 0);
    };
    expect(run(bigEnglish)).toBeGreaterThan(run(primeraC) * 1000);
  });
});

describe('matchday income', () => {
  it('higher prices mean fewer fans but not necessarily less money', () => {
    const club = bigArgentine;
    const base = init(club);
    const fair = base.stadium.ticketPrice;
    const at = (price: number) =>
      matchdayIncome(setTicketPrice(base, price), homeMatch(club.id), 50, club.reputation, 0.3, createRng(5), { context: ctx(club) });
    const cheap = at(fair * 0.5);
    const normal = at(fair);
    const dear = at(fair * 1.6);
    expect(cheap.attendance).toBeGreaterThanOrEqual(normal.attendance);
    expect(normal.attendance).toBeGreaterThan(dear.attendance);
    // Halving the price of a packed ground just throws money away...
    expect(normal.transaction!.amount).toBeGreaterThan(cheap.transaction!.amount);
    // ...while an absurd price empties it.
    expect(at(fair * 6).transaction!.amount).toBeLessThan(normal.transaction!.amount);
  });

  it('big rivals and important games draw more people', () => {
    const club = primeraC;
    const s = init(club);
    const vs = (opp: number, imp: number) => matchdayIncome(s, homeMatch(club.id), opp, club.reputation, imp, createRng(1)).attendance;
    expect(vs(80, 1)).toBeGreaterThan(vs(20, 0));
    expect(vs(80, 1)).toBeLessThanOrEqual(s.stadium.capacity);
  });

  it('only the home club collects, except at neutral venues', () => {
    const s = init(primeraC);
    const away = { ...homeMatch('rival'), awayId: primeraC.id };
    expect(matchdayIncome(s, away, 40, 30, 0.5, createRng(1)).transaction).toBeNull();
    const neutral = matchdayIncome(s, { ...away, neutral: true }, 40, 30, 0.5, createRng(1));
    expect(neutral.transaction!.amount).toBeGreaterThan(0);
  });
});

describe('stadium', () => {
  it('offers expansions with cost and works that finish later', () => {
    const s = init(primeraC);
    const options = expansionOptions(s.stadium);
    expect(options.length).toBeGreaterThan(1);
    expect(options[1].cost).toBeGreaterThan(options[0].cost);
    const { clubState, work } = applyExpansion(s, options[0], '2026-01-10');
    expect(clubState.stadium.capacity).toBe(s.stadium.capacity);
    expect(clubState.finances.balance).toBe(s.finances.balance - options[0].cost);
    expect(completeWorks(clubState, [work], '2026-01-11').pending).toHaveLength(1);
    const done = completeWorks(clubState, [work], work.readyDate);
    expect(done.clubState.stadium.capacity).toBe(options[0].newCapacity);
    expect(done.pending).toHaveLength(0);
  });

  it('pitch improvements cost money and cap at 100', () => {
    const s = init(primeraC);
    const better = improvePitch(s, 500, '2026-02-01');
    expect(better.stadium.pitchQuality).toBe(100);
    expect(better.finances.balance).toBeLessThan(s.finances.balance);
  });
});

describe('staff', () => {
  it('better staff give better multipliers', () => {
    const mk = (q: number): StaffMember[] => STAFF_ROLES.map((role) => ({ role, name: 'X', quality: q, wage: 1 }));
    const good = staffEffects(mk(90));
    const bad = staffEffects(mk(20));
    expect(good.fitnessRecovery).toBeGreaterThan(bad.fitnessRecovery);
    expect(good.injuryDays).toBeLessThan(bad.injuryDays);
    expect(good.scoutAccuracy).toBeGreaterThan(bad.scoutAccuracy);
    expect(good.youthQuality).toBeGreaterThan(bad.youthQuality);
    expect(good.trainingProgress).toBeGreaterThan(bad.trainingProgress);
    expect(good.negotiationDiscount).toBeGreaterThan(bad.negotiationDiscount);
    expect(staffEffects([]).injuryDays).toBeGreaterThan(1);
  });

  it('candidates are deterministic and better ones cost more; firing pays severance', () => {
    const a = staffCandidates('ojeador', bigEnglish, createRng(3), 1);
    expect(a).toEqual(staffCandidates('ojeador', bigEnglish, createRng(3), 1));
    expect(a[0].quality).toBeGreaterThan(a[a.length - 1].quality);
    expect(a[0].wage).toBeGreaterThan(a[a.length - 1].wage);
    const s = init(bigEnglish);
    const old = s.staff.find((m) => m.role === 'ojeador')!;
    const fired = fireStaff(s, 'ojeador', '2026-03-01');
    expect(fired.staff).toHaveLength(5);
    expect(fired.finances.balance).toBe(s.finances.balance - old.wage * 6);
    const hired = hireStaff(s, a[0], '2026-03-01');
    expect(hired.staff.filter((m) => m.role === 'ojeador')).toEqual([a[0]]);
  });
});

describe('board', () => {
  it('confidence drops with defeats and rises with wins', () => {
    const start: BoardState = { objective: 'campeon', confidence: 60, warnings: 0 };
    let b = start;
    for (let i = 0; i < 6; i++) b = updateBoardAfterMatch(b, 'L', 0.6);
    expect(b.confidence).toBeLessThan(25);
    expect(b.warnings).toBe(1);
    expect(updateBoardAfterMatch(start, 'W', 1).confidence).toBeGreaterThan(60);
    expect(updateBoardAfterMatch(start, 'L', 1).confidence).toBeLessThan(updateBoardAfterMatch(start, 'L', 0).confidence);
  });

  it('fires the manager who badly misses the objective and keeps the one who meets it', () => {
    const board = { objective: 'campeon' as const, confidence: 60, warnings: 0 };
    const bad = endOfSeasonEvaluation(board, 15, 20, false, false, 0, -1_000_000);
    expect(bad.fired).toBe(true);
    expect(bad.message).toMatch(/rescindirte/);
    expect(endOfSeasonEvaluation(board, 3, 20, false, false, 0, 0).fired).toBe(false);
    const champ = endOfSeasonEvaluation(board, 1, 20, false, false, 1, 5);
    expect(champ.fired).toBe(false);
    expect(champ.board.confidence).toBeGreaterThan(70);
    const relegated = endOfSeasonEvaluation({ objective: 'mitad-tabla', confidence: 60, warnings: 0 }, 19, 20, false, true, 0, 0);
    expect(relegated.fired).toBe(true);
    const up = endOfSeasonEvaluation({ objective: 'ascender', confidence: 50, warnings: 0 }, 1, 20, true, false, 1, 0);
    expect(up.fired).toBe(false);
    expect(up.message).toMatch(/Ascendimos/);
  });

  it('job offers come from clubs around the manager level', () => {
    const offers = jobOffers(world, 50, createRng(4), [bigArgentine.id]);
    expect(offers.length).toBeGreaterThanOrEqual(2);
    for (const o of offers) {
      const club = world.clubs.find((c) => c.id === o.clubId)!;
      expect(club.reputation).toBeLessThanOrEqual(56);
      expect(club.reputation).toBeGreaterThanOrEqual(28);
      expect(o.wage).toBeGreaterThan(0);
    }
    expect(jobOffers(world, 50, createRng(4))).toEqual(jobOffers(world, 50, createRng(4)));
  });
});

describe('prizes', () => {
  it('Champions League pays far more than the Copa Argentina', () => {
    const total = (id: string) =>
      prizeAmount(world, id, { kind: 'champion' }) + prizeAmount(world, id, { kind: 'round', roundsFromFinal: 0 });
    expect(total('champions-league')).toBeGreaterThan(total('copa-argentina') * 20);
    expect(total('copa-libertadores')).toBeGreaterThan(total('copa-sudamericana'));
    expect(prizeAmount(world, 'eng-1', { kind: 'champion' })).toBeGreaterThan(prizeAmount(world, 'lpf', { kind: 'champion' }) * 10);
    expect(prizeAmount(world, 'eng-2', { kind: 'promotion' })).toBeGreaterThan(prizeAmount(world, 'primera-c', { kind: 'promotion' }));
    expect(prizeAmount(world, 'eng-cup', { kind: 'champion' })).toBeGreaterThan(0);
    expect(prizeAmount(world, 'champions-league', { kind: 'round', roundsFromFinal: 2 })).toBeLessThan(
      prizeAmount(world, 'champions-league', { kind: 'round', roundsFromFinal: 0 }),
    );
  });
});

describe('purity', () => {
  it('functions do not mutate their inputs', () => {
    const club = bigArgentine;
    const s: ClubState = deepFreeze(init(club));
    const snapshot = JSON.stringify(s);
    const rng = createRng(1);
    monthlyUpdate(s, world.players, '2026-01-31', rng, ctx(club));
    matchdayIncome(s, homeMatch(club.id), 60, 70, 0.5, rng);
    applyExpansion(s, expansionOptions(s.stadium)[0], '2026-01-01');
    setTicketPrice(s, 99);
    improvePitch(s, 3, '2026-01-01');
    hireStaff(s, staffCandidates('medico', club, rng)[0], '2026-01-01');
    fireStaff(s, 'ojeador', '2026-01-01');
    updateBoardAfterMatch(s.board, 'L', 1);
    endOfSeasonEvaluation(s.board, 20, 30, false, true, 0, -5);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
