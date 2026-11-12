import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { newGame, simulateRestOfSeason, type GameState } from '../../engine/game/game';
import { EventOverlay } from '../screens/EventOverlay';
import { CompetitionHero } from './CompetitionHero';
import { identityOf } from './identity';
import { TrophyCabinet } from './TrophyCabinet';

const noop = () => {};

it('gives every competition an identity and renders covers and events', () => {
  const world = createWorld(3);
  const club = world.divisions.find((d) => d.id === 'lpf')!.clubIds[0];
  let g: GameState = newGame(world, club);
  const ids = [...Object.keys(g.calendar.runs), ...Object.keys(g.calendar.pending)];
  for (const id of ids) {
    const ident = identityOf(id);
    expect(ident.palette.primary).toMatch(/^#[0-9a-f]{6}$/i);
    expect(renderToString(<CompetitionHero game={g} id={id} />)).toContain('comp-hero');
  }
  expect(identityOf('copa-libertadores').region).toBe('sudamerica');
  expect(identityOf('eng-1').region).toBe('europa');
  expect(identityOf('bra-cup').region).toBe('sudamerica');

  const cup = Object.keys(g.calendar.runs).find((id) => g.calendar.kinds[id] === 'cup')!;
  const start = { ...g, events: [{ id: 'x', kind: 'inicio' as const, date: g.calendar.date, competitionId: cup, mine: true, important: true }] };
  expect(renderToString(<EventOverlay game={start} update={noop} />)).toContain('Comienza');

  g = simulateRestOfSeason(g);
  const lpf = g.calendar.runs.lpf;
  const champ = { ...g, events: [{ id: 'y', kind: 'campeon' as const, date: g.calendar.date, competitionId: 'lpf', clubId: lpf.champion, mine: true, important: true }] };
  expect(renderToString(<EventOverlay game={champ} update={noop} />)).toContain('CAMPEÓN');
  const won = { ...g, userClubId: lpf.champion! };
  expect(renderToString(<TrophyCabinet game={won} />)).toContain('vitrina');
  expect(renderToString(<CompetitionHero game={g} id="lpf" />)).toContain('Campeón');
}, 180_000);
