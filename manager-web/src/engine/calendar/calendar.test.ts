import { describe, expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { finishSeason } from '../season';
import { createSeasonCalendar, divisionSeasonResult, isSeasonOver, matchLabel, nextUserMatch, playDay, playToEnd, playUntilUserMatch } from './calendar';
import { spreadSlots, weekday } from './dates';

describe('dates', () => {
  it('spreads slots over the window on the allowed weekdays without repeats', () => {
    const slots = spreadSlots('2026-02-07', '2026-11-29', 30, [0, 6]);
    expect(slots).toHaveLength(30);
    expect(new Set(slots).size).toBe(30);
    for (const d of slots) expect([0, 6]).toContain(weekday(d));
    expect(slots[0] >= '2026-02-07').toBe(true);
  });
});

describe('season calendar', () => {
  const world = createWorld(21, 2026, false);
  const lpf = world.divisions.find((d) => d.id === 'lpf')!;
  const userClub = lpf.clubIds[0];

  it('schedules a pre-season, the leagues and the Copa Argentina, never two matches a day per club', () => {
    const cal = createSeasonCalendar(world, userClub);
    const userMatches = cal.matches.filter((m) => m.homeId === userClub || m.awayId === userClub);
    expect(userMatches.some((m) => m.competitionId === 'amistoso' && m.date.startsWith('2026-01'))).toBe(true);
    expect(cal.runs['torneo-verano']).toBeDefined();
    expect(cal.runs.lpf).toBeDefined();
    expect(cal.runs['copa-argentina']).toBeDefined();
    const seen = new Set<string>();
    for (const m of cal.matches) {
      for (const c of [m.homeId, m.awayId]) {
        const key = `${c}@${m.date}`;
        expect(seen.has(key), key).toBe(false);
        seen.add(key);
      }
    }
  });

  it('advances day by day and stops on the user match day', () => {
    const cal = createSeasonCalendar(world, userClub);
    const first = playUntilUserMatch(world, cal)!;
    expect(first.date).toBe(cal.date);
    expect(first.status).toBe('scheduled');
    playDay(world, cal);
    expect(first.status).toBe('played');
    expect(nextUserMatch(cal)!.date > first.date).toBe(true);
  });

  it('schedules knockout rounds only after the previous round is decided, and finishes every competition', () => {
    const cal = createSeasonCalendar(world, userClub);
    const copaRounds = () => cal.runs['copa-argentina'].stages[0].rounds.length;
    expect(copaRounds()).toBe(1);
    playToEnd(world, cal);
    expect(isSeasonOver(cal)).toBe(true);
    expect(copaRounds()).toBe(6);
    for (const run of Object.values(cal.runs)) expect(run.champion, run.id).toBeTruthy();
    // Every decisive knockout match has a winner: level single legs carry penalties.
    for (const m of cal.matches.filter((x) => x.tieId && x.leg === 1 && x.competitionId === 'copa-argentina')) {
      if (m.result!.homeGoals === m.result!.awayGoals) expect(m.result!.penalties).toBeDefined();
    }
    const { summary, next } = finishSeason(world, cal);
    expect(summary.divisions).toHaveLength(world.divisions.length);
    expect(next.season).toBe(2027);
  });

  it('every match date falls inside the season', () => {
    const cal = createSeasonCalendar(world, userClub);
    playToEnd(world, cal);
    for (const m of cal.matches) expect(m.date.startsWith('2026-'), `${m.id} ${m.date}`).toBe(true);
  });
});

describe('split season (Apertura and Clausura)', () => {
  const world = createWorld(61, 2026, false);

  it('plays two tournaments with their own champions and ranks the year by the annual table', () => {
    const cal = createSeasonCalendar(world, null);
    expect(cal.runs.lpf).toBeDefined();
    expect(cal.runs['lpf-clausura']).toBeDefined();
    const aperturaDates = cal.matches.filter((m) => m.competitionId === 'lpf').map((m) => m.date);
    const clausuraDates = cal.matches.filter((m) => m.competitionId === 'lpf-clausura').map((m) => m.date);
    // The Apertura is played before the World Cup break and the Clausura after it.
    expect(aperturaDates.every((d) => d < '2026-06-08')).toBe(true);
    expect(clausuraDates.every((d) => d > '2026-07-20')).toBe(true);
    playToEnd(world, cal);
    expect(cal.runs.lpf.champion).toBeTruthy();
    expect(cal.runs['lpf-clausura'].champion).toBeTruthy();
    const annual = divisionSeasonResult(cal, 'lpf')!;
    const table = annual.stages[0].tables[0];
    expect(table).toHaveLength(30);
    expect(table[0].played).toBeGreaterThanOrEqual(30); // both tournaments count
    expect(annual.champion).toBe(table[0].clubId);
  });

  it('labels matches with competition, matchday, zone and round', () => {
    const cal = createSeasonCalendar(world, world.divisions.find((d) => d.id === 'lpf')!.clubIds[0]);
    const friendly = cal.matches.find((m) => m.competitionId === 'amistoso')!;
    expect(matchLabel(cal, friendly).competition).toBe('Amistoso');
    const league = cal.matches.find((m) => m.competitionId === 'lpf')!;
    expect(matchLabel(cal, league).stage).toMatch(/Zona [AB] · Fecha \d+/);
    const cup = cal.matches.find((m) => m.competitionId === 'copa-argentina')!;
    expect(matchLabel(cal, cup).stage).toBe('Treintaidosavos de final');
  });
});
