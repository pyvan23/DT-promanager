import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { matchLabel } from '../../engine/calendar/calendar';
import { useEffect, useReducer, useState } from 'react';
import type { DetailedMatchReport, LiveTeamState, MatchPhase } from '../../engine/matchday';
import type { MatchReport } from '../../engine/game-types';
import { POSITION_LINE } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { Bar, Panel } from '../components/Panel';
import { minuteText, ReportView, StatsTable } from './PostPartidoScreen';
import { TacticsForm } from './TacticaScreen';
import { EVENT_ICON, useClubs, usePlayers, type LiveSession, type ScreenProps } from './shared';

const PHASE: Record<MatchPhase, string> = {
  'not-started': 'Por empezar',
  'first-half': 'Primer tiempo',
  'half-time': 'Entretiempo',
  'second-half': 'Segundo tiempo',
  'before-extra-time': 'Antes del alargue',
  'extra-time': 'Tiempo extra',
  penalties: 'Penales',
  finished: 'Final',
};

const SPEEDS = [
  { v: 0, label: 'Pausa' },
  { v: 1, label: '1x' },
  { v: 3, label: '3x' },
  { v: 10, label: '10x' },
];

export function LiveMatchScreen({ game, live, onDone }: ScreenProps & { live: LiveSession; onDone: (r: MatchReport) => void }) {
  const clubs = useClubs(game);
  const players = usePlayers(game);
  const match = live.match;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [speed, setSpeed] = useState(1);
  const [report, setReport] = useState<DetailedMatchReport | null>(() => (match.state().finished ? match.finish() : null));
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const st = match.state();
  const scheduled = game.calendar.matches.find((m) => m.id === live.matchId)!;
  const userSide: 'home' | 'away' = st.home.clubId === game.userClubId ? 'home' : 'away';
  const mine: LiveTeamState = st[userSide];

  useEffect(() => {
    if (st.finished || speed === 0 || report) return;
    const t = setInterval(() => {
      match.step(1);
      if (match.state().finished) {
        setReport(match.finish());
        setSpeed(0);
      }
      force();
    }, 1000 / speed);
    return () => clearInterval(t);
  }, [speed, match, st.finished, report]);

  const finishNow = () => {
    setReport(match.finish());
    setSpeed(0);
    force();
  };

  const doSub = () => {
    setError(null);
    if (!outId || !inId) return setError('Elegí quién sale y quién entra.');
    try {
      match.substitute(game.userClubId, outId, inId);
      setOutId('');
      setInId('');
      force();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo hacer el cambio.');
    }
  };

  const name = (id: string) => players.get(id)?.name ?? id;
  const events = [...match.events].reverse();
  const home = clubs.get(st.home.clubId);
  const away = clubs.get(st.away.clubId);
  const clock = st.phase === 'not-started' ? "0'" : st.added ? `${st.minute}+${st.added}'` : `${st.minute}'`;

  if (report) {
    return (
      <div className="stack">
        <Panel title="Final del partido">
          <div className="live-done">
            <p>
              El árbitro pitó el final. Revisá el informe y seguí con la temporada.
            </p>
            <button className="btn btn--primary btn--lg" onClick={() => onDone(report)}>
              Continuar
            </button>
          </div>
        </Panel>
        <ReportView game={game} report={report} match={scheduled} />
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="scoreboard scoreboard--live panel">
        <div className="scoreboard__club">
          <ClubBadge club={home} size={60} />
          <b>{home?.shortName}</b>
        </div>
        <div className="scoreboard__mid">
          <span className="kicker comp-inline"><CompetitionLogo id={scheduled.competitionId} size={22} /> {matchLabel(game.calendar, scheduled).full}</span>
          <span className="scoreboard__score">
            {st.homeGoals} <span className="muted">-</span> {st.awayGoals}
          </span>
          {st.penalties && (
            <span className="small">
              Penales {st.penalties.home}-{st.penalties.away}
            </span>
          )}
          <span className="scoreboard__clock">
            <b>{clock}</b> · {PHASE[st.phase]}
          </span>
          <div className="speed" role="group" aria-label="Velocidad">
            {SPEEDS.map((s) => (
              <button key={s.v} className={'btn btn--xs' + (speed === s.v ? ' btn--on' : '')} onClick={() => setSpeed(s.v)} disabled={st.finished}>
                {s.label}
              </button>
            ))}
            <button className="btn btn--xs btn--primary" onClick={finishNow}>
              Simular el resto
            </button>
          </div>
        </div>
        <div className="scoreboard__club">
          <ClubBadge club={away} size={60} />
          <b>{away?.shortName}</b>
        </div>
      </section>

      <div className="live-grid">
        <Panel title="Relato" flush className="live-grid__feed">
          <ol className="feed">
            {events.map((e, i) => (
              <li key={events.length - i} className={`feed__item feed__item--${e.kind}` + (e.clubId === game.userClubId ? ' feed__item--mine' : '')}>
                <span className="feed__min">{minuteText(e)}</span>
                <span className="feed__icon" aria-hidden="true">
                  {EVENT_ICON[e.kind] ?? '·'}
                </span>
                <span className="feed__text">
                  {e.text}
                  {(e.kind === 'goal' || e.kind === 'penalty-goal' || e.kind === 'own-goal') && (
                    <b className="feed__score">
                      {' '}
                      {e.score[0]}-{e.score[1]}
                    </b>
                  )}
                </span>
              </li>
            ))}
            {events.length === 0 && <li className="feed__item muted">Los equipos salen a la cancha…</li>}
          </ol>
        </Panel>

        <div className="stack">
          <Panel title="Estadísticas">
            <StatsTable stats={st.stats} />
          </Panel>
          <Panel title="Táctica en vivo">
            <TacticsForm tactics={mine.tactics} onChange={(t) => (match.setTactics(game.userClubId, t), force())} compact />
            <label className="check">
              <input
                type="checkbox"
                checked={mine.ai}
                onChange={(e) => {
                  match.setAi(game.userClubId, e.target.checked);
                  force();
                }}
              />
              Que el ayudante haga los cambios automáticamente
            </label>
          </Panel>
        </div>

        <Panel title={`En cancha · cambios: ${mine.subsLeft} (ventanas: ${mine.windowsLeft})`} flush>
          <ul className="bench-list onpitch">
            {mine.onPitch.map((op) => (
              <li key={op.playerId} className={outId === op.playerId ? 'is-selected' : ''}>
                <button type="button" onClick={() => setOutId(op.playerId === outId ? '' : op.playerId)}>
                  <span className={`pos pos--${POSITION_LINE[op.position].toLowerCase()}`}>{op.position}</span>
                  <span className="bench-list__name">
                    {name(op.playerId)} {op.yellow > 0 && <span className="card card--y" title="Amonestado" />}
                  </span>
                  <span className="cell-bar" title={`Energía ${Math.round(op.energy)}%`}>
                    <Bar value={op.energy} max={100} tone={op.energy < 55 ? 'down' : undefined} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <h4 className="subhead subhead--pad">Banco</h4>
          <ul className="bench-list">
            {mine.bench.map((id) => {
              const p = players.get(id);
              return (
                <li key={id} className={inId === id ? 'is-selected' : ''}>
                  <button type="button" onClick={() => setInId(id === inId ? '' : id)}>
                    <span className={`pos pos--${p ? POSITION_LINE[p.position].toLowerCase() : 'med'}`}>{p?.position}</span>
                    <span className="bench-list__name">{name(id)}</span>
                  </button>
                </li>
              );
            })}
            {mine.bench.length === 0 && <li className="empty">No quedan suplentes.</li>}
          </ul>
          <div className="sub-box">
            <span className="small">
              Sale: <b>{outId ? name(outId) : '—'}</b> · Entra: <b>{inId ? name(inId) : '—'}</b>
            </span>
            <button className="btn btn--primary btn--sm" onClick={doSub} disabled={!outId || !inId}>
              Hacer el cambio
            </button>
            {error && <p className="notice notice--down">{error}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
