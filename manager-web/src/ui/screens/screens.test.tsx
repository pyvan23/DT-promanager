import { renderToString } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createWorld } from '../../data/world';
import { nextUserMatch } from '../../engine/calendar/calendar';
import { advanceDay, advanceToNextMatch, endSeason, newGame, simulateRestOfSeason, type GameState } from '../../engine/game/game';
import { buildMatchInput } from '../../engine/game/matchday-bridge';
import { createLiveMatch } from '../../engine/matchday';
import { CalendarioScreen } from './CalendarioScreen';
import { ClubesScreen } from './ClubesScreen';
import { CompeticionesScreen } from './CompeticionesScreen';
import { DespachoScreen } from './DespachoScreen';
import { EntrenamientoScreen } from './EntrenamientoScreen';
import { InicioScreen } from './InicioScreen';
import { TablasScreen } from './TablasScreen';
import { FinTemporadaScreen } from './FinTemporadaScreen';
import { LiveMatchScreen } from './LiveMatchScreen';
import { SimulacionScreen } from './SimulacionScreen';
import { NoticiasScreen } from './NoticiasScreen';
import { PlantelScreen } from './PlantelScreen';
import { PlayerSheet } from './PlayerSheet';
import { PostPartidoScreen } from './PostPartidoScreen';
import { PreviaScreen } from './PreviaScreen';
import { TacticaScreen } from './TacticaScreen';

const noop = () => {};

function all(g: GameState) {
  const p = { game: g, update: noop, go: noop };
  const out = [
    renderToString(<InicioScreen {...p} />),
    renderToString(<TablasScreen {...p} />),
    renderToString(<EntrenamientoScreen {...p} />),
    renderToString(<DespachoScreen {...p} />),
    renderToString(<CalendarioScreen {...p} />),
    renderToString(<PlantelScreen {...p} />),
    renderToString(<TacticaScreen {...p} />),
    renderToString(<PreviaScreen {...p} onWatch={noop} onSimulate={noop} />),
    renderToString(<CompeticionesScreen {...p} />),
    renderToString(<NoticiasScreen {...p} />),
    renderToString(<ClubesScreen {...p} />),
    renderToString(<PostPartidoScreen {...p} matchId={null} />),
    renderToString(<PlayerSheet {...p} player={g.world.players.find((x) => x.clubId === g.userClubId)!} onClose={noop} />),
  ];
  return out.join('').length;
}

it('renders every screen through a season', () => {
  const world = createWorld(7);
  const club = world.divisions.find((d) => d.id === 'lpf')!.clubIds[2];
  let g = newGame(world, club);
  expect(all(g)).toBeGreaterThan(1000);
  g = advanceToNextMatch(g);
  const m = nextUserMatch(g.calendar)!;
  expect(m.date).toBe(g.calendar.date);
  const live = createLiveMatch(buildMatchInput(g, m));
  live.step(20);
  const p = { game: g, update: noop, go: noop };
  expect(renderToString(<LiveMatchScreen {...p} live={{ matchId: m.id, match: live }} onDone={noop} />)).toContain('Relato');
  // "Simular": stops at half-time with the partial score, then shows the final.
  const sim = createLiveMatch(buildMatchInput(g, m, `${m.id}:sim`));
  const simHtml = renderToString(<SimulacionScreen {...p} live={{ matchId: m.id, match: sim, mode: 'sim' }} onDone={noop} />);
  expect(simHtml).toContain('Descanso');
  expect(simHtml).toContain('Continuar con el partido');
  expect(sim.state().phase).toBe('half-time');
  sim.finish();
  expect(renderToString(<SimulacionScreen {...p} live={{ matchId: m.id, match: sim, mode: 'sim' }} onDone={noop} />)).toContain('Final');
  const report = live.finish();
  expect(renderToString(<LiveMatchScreen {...p} live={{ matchId: m.id, match: live }} onDone={noop} />)).toContain('Continuar');
  g = advanceDay(g, { userReport: report });
  expect(renderToString(<PostPartidoScreen game={g} update={noop} go={noop} matchId={m.id} />)).toContain('Puntajes');
  all(g);
  g = simulateRestOfSeason(g);
  all(g);
  if (!g.fired) {
    g = endSeason(g);
    expect(renderToString(<FinTemporadaScreen game={g} update={noop} go={noop} />)).toContain('Empezar la temporada');
    all(g);
  }
}, 180_000);
