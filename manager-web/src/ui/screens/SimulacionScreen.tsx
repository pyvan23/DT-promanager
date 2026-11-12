import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { matchLabel } from '../../engine/calendar/calendar';
import { useReducer, useState } from 'react';
import type { DetailedMatchReport, LiveEvent, LiveMatch } from '../../engine/matchday';
import type { MatchReport } from '../../engine/game-types';
import { POSITION_LINE } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { Bar, Panel } from '../components/Panel';
import { minuteText, ReportView } from './PostPartidoScreen';
import { TacticsForm } from './TacticaScreen';
import { EVENT_ICON, useClubs, usePlayers, type LiveSession, type ScreenProps } from './shared';

/** Events worth showing in a results-only view: goals, cards, injuries and substitutions. */
const KEY_EVENTS = new Set(['goal', 'penalty-goal', 'own-goal', 'penalty-miss', 'yellow', 'second-yellow', 'red', 'injury', 'substitution']);

/** Plays until half-time (or the end, if the match is already past it). */
function playFirstHalf(match: LiveMatch) {
  for (let i = 0; i < 80; i++) {
    const phase = match.state().phase;
    if (phase !== 'not-started' && phase !== 'first-half') return;
    match.step(1);
  }
}

function EventList({ events, userClubId, names }: { events: readonly LiveEvent[]; userClubId: string; names: (id: string) => string }) {
  const key = events.filter((e) => KEY_EVENTS.has(e.kind));
  if (!key.length) return <p className="muted small">Sin goles ni incidencias.</p>;
  return (
    <ol className="feed feed--compact">
      {key.map((e, i) => (
        <li key={i} className={`feed__item feed__item--${e.kind}` + (e.clubId === userClubId ? ' feed__item--mine' : '')}>
          <span className="feed__min">{minuteText(e)}</span>
          <span className="feed__icon" aria-hidden="true">
            {EVENT_ICON[e.kind] ?? '·'}
          </span>
          <span className="feed__text">
            {e.playerId ? names(e.playerId) : e.text}
            {e.kind === 'substitution' && e.otherPlayerId ? ` ↔ ${names(e.otherPlayerId)}` : ''}
            {(e.kind === 'goal' || e.kind === 'penalty-goal' || e.kind === 'own-goal') && (
              <b className="feed__score">
                {' '}
                {e.score[0]}-{e.score[1]}
              </b>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "Simular": the results-only mode. Shows the half-time score (with a pause for changes and
 * tactics) and then the final result, without minute-by-minute commentary.
 */
export function SimulacionScreen({ game, live, onDone }: ScreenProps & { live: LiveSession; onDone: (r: MatchReport) => void }) {
  const clubs = useClubs(game);
  const players = usePlayers(game);
  const match = live.match;
  const [, force] = useReducer((x: number) => x + 1, 0);
  // The first half is played as soon as the screen opens (idempotent: it stops at half-time).
  const [report, setReport] = useState<DetailedMatchReport | null>(() => {
    if (match.state().finished) return match.finish();
    playFirstHalf(match);
    return null;
  });
  const [showFull, setShowFull] = useState(false);
  const [outId, setOutId] = useState('');
  const [inId, setInId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const st = match.state();
  const scheduled = game.calendar.matches.find((m) => m.id === live.matchId)!;
  const home = clubs.get(st.home.clubId);
  const away = clubs.get(st.away.clubId);
  const mine = st.home.clubId === game.userClubId ? st.home : st.away;
  const name = (id: string) => players.get(id)?.name ?? id;
  const atHalfTime = !report && st.phase === 'half-time';

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

  const playSecondHalf = () => {
    setReport(match.finish());
    force();
  };

  const halfEvents = match.events.filter((e) => e.minute <= 45);
  const secondEvents = match.events.filter((e) => e.minute > 45);
  const goalsAtHalf = (() => {
    const last = [...halfEvents].reverse().find((e) => e.kind === 'goal' || e.kind === 'penalty-goal' || e.kind === 'own-goal');
    return last ? last.score : [0, 0];
  })();

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
            {report ? report.homeGoals : st.homeGoals} <span className="muted">-</span> {report ? report.awayGoals : st.awayGoals}
          </span>
          {report?.penalties && (
            <span className="small">
              Penales {report.penalties.home}-{report.penalties.away}
            </span>
          )}
          <span className="scoreboard__clock">
            <b>{report ? 'Final' : atHalfTime ? 'Descanso' : 'Jugando…'}</b>
            {report && (
              <>
                {' '}
                · Primer tiempo {goalsAtHalf[0]}-{goalsAtHalf[1]}
                {report.extraTime ? ' · con alargue' : ''}
              </>
            )}
          </span>
        </div>
        <div className="scoreboard__club">
          <ClubBadge club={away} size={60} />
          <b>{away?.shortName}</b>
        </div>
      </section>

      <div className="sim-next">
        {atHalfTime && (
          <button className="btn btn--primary btn--lg" onClick={playSecondHalf}>
            Continuar con el partido
          </button>
        )}
        {report && (
          <button className="btn btn--primary btn--lg" onClick={() => onDone(report)}>
            Continuar
          </button>
        )}
        {atHalfTime && <span className="small muted">Si querés, antes hacé cambios o ajustá la táctica acá abajo.</span>}
      </div>

      <div className="live-grid">
        <Panel title={report ? 'Primer tiempo' : 'Lo que pasó en el primer tiempo'}>
          <EventList events={halfEvents} userClubId={game.userClubId} names={name} />
        </Panel>

        {report ? (
          <Panel title="Segundo tiempo">
            <EventList events={secondEvents} userClubId={game.userClubId} names={name} />
          </Panel>
        ) : (
          <Panel title="Táctica para el segundo tiempo">
            <TacticsForm tactics={mine.tactics} onChange={(t) => (match.setTactics(game.userClubId, t), force())} compact />
          </Panel>
        )}

        {atHalfTime && (
          <Panel title={`Cambios en el descanso · quedan ${mine.subsLeft}`} flush>
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
        )}
      </div>

      <div className="row-actions">
        {atHalfTime && (
          <button className="btn btn--primary btn--lg" onClick={playSecondHalf}>
            Continuar con el partido
          </button>
        )}
        {report && (
          <>
            <button className="btn btn--lg" onClick={() => setShowFull((v) => !v)}>
              {showFull ? 'Ocultar el informe' : 'Ver el informe completo'}
            </button>
          </>
        )}
      </div>

      {report && showFull && <ReportView game={game} report={report} match={scheduled} />}
    </div>
  );
}
