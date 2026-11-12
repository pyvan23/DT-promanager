import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { matchLabel } from '../../engine/calendar/calendar';
import type { DetailedMatchReport, LiveEvent } from '../../engine/matchday';
import type { MatchEvent, MatchReport, MatchStats, ScheduledMatch } from '../../engine/game-types';
import type { Player } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { Panel } from '../components/Panel';
import { longDate, outcomeFor, OutcomeChip, shortDate, useClubs, usePlayers, userMatches, type ScreenProps } from './shared';

export const minuteText = (e: MatchEvent) => {
  const added = (e as LiveEvent).added;
  return added ? `${e.minute}+${added}'` : `${e.minute}'`;
};

const surname = (players: Map<string, Player>, id?: string) => {
  const n = id ? players.get(id)?.name : undefined;
  return n ? n.split(' ').slice(-1)[0] : '—';
};

export const STAT_ROWS: { key: keyof MatchStats; label: string; pct?: boolean }[] = [
  { key: 'possession', label: 'Posesión', pct: true },
  { key: 'shots', label: 'Remates' },
  { key: 'shotsOnTarget', label: 'Remates al arco' },
  { key: 'corners', label: 'Córners' },
  { key: 'fouls', label: 'Faltas' },
  { key: 'yellow', label: 'Amarillas' },
  { key: 'red', label: 'Rojas' },
];

export function StatsTable({ stats }: { stats: MatchStats }) {
  return (
    <ul className="stat-bars">
      {STAT_ROWS.map(({ key, label, pct }) => {
        const [h, a] = stats[key];
        const total = h + a || 1;
        return (
          <li key={key}>
            <b>{Math.round(h)}{pct ? '%' : ''}</b>
            <span className="stat-bars__label">{label}</span>
            <b>{Math.round(a)}{pct ? '%' : ''}</b>
            <span className="stat-bars__bar">
              <span className="stat-bars__home" style={{ width: `${(h / total) * 100}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Goals, cards, statistics and ratings of a played match. */
export function ReportView({ game, report, match }: { game: ScreenProps['game']; report: MatchReport; match: ScheduledMatch }) {
  const clubs = useClubs(game);
  const players = usePlayers(game);
  const home = clubs.get(report.homeId);
  const away = clubs.get(report.awayId);
  const goals = report.events.filter((e) => e.kind === 'goal' || e.kind === 'penalty-goal' || e.kind === 'own-goal');
  const cards = report.events.filter((e) => e.kind === 'yellow' || e.kind === 'second-yellow' || e.kind === 'red');
  const subs = report.events.filter((e) => e.kind === 'substitution');
  const injuries = (report as DetailedMatchReport).injuries ?? [];
  const side = (clubId: string) => (clubId === report.homeId ? 'home' : 'away');

  const ratingRows = (clubId: string) =>
    Object.entries(report.ratings)
      .filter(([id]) => {
        const p = players.get(id);
        // Players who moved since keep showing on the side whose events mention them.
        return p?.clubId === clubId || report.events.some((e) => e.clubId === clubId && (e.playerId === id || e.otherPlayerId === id));
      })
      .sort((a, b) => b[1] - a[1]);
  const best = Object.entries(report.ratings).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="stack">
      <section className="scoreboard panel">
        <div className="scoreboard__club">
          <ClubBadge club={home} size={64} />
          <b>{home?.shortName}</b>
        </div>
        <div className="scoreboard__mid">
          <span className="kicker">
            <CompetitionLogo id={match.competitionId} size={20} /> {matchLabel(game.calendar, match).full} · {longDate(match.date)}
          </span>
          <span className="scoreboard__score">
            {report.homeGoals} <span className="muted">-</span> {report.awayGoals}
          </span>
          {report.penalties && (
            <span className="small">
              Penales {report.penalties.home}-{report.penalties.away}
            </span>
          )}
          {report.attendance ? <span className="muted small">{report.attendance.toLocaleString('es-AR')} espectadores</span> : null}
        </div>
        <div className="scoreboard__club">
          <ClubBadge club={away} size={64} />
          <b>{away?.shortName}</b>
        </div>
      </section>

      <div className="report-grid">
        <Panel title="Goles">
          {goals.length === 0 && <p className="muted">Sin goles.</p>}
          <ul className="goal-list">
            {goals.map((e, i) => (
              <li key={i} className={`goal-list__item goal-list__item--${side(e.clubId)}`}>
                <span className="goal-list__min">{minuteText(e)}</span>
                <span>
                  ⚽ <b>{surname(players, e.playerId)}</b>
                  {e.kind === 'penalty-goal' && ' (penal)'}
                  {e.kind === 'own-goal' && ' (en contra)'}
                  {e.otherPlayerId && e.kind === 'goal' && <span className="muted small"> · asist. {surname(players, e.otherPlayerId)}</span>}
                </span>
                <span className="muted small">{clubs.get(e.clubId)?.shortName}</span>
              </li>
            ))}
          </ul>
          {cards.length > 0 && (
            <>
              <h4 className="subhead">Tarjetas</h4>
              <ul className="goal-list">
                {cards.map((e, i) => (
                  <li key={i} className={`goal-list__item goal-list__item--${side(e.clubId)}`}>
                    <span className="goal-list__min">{minuteText(e)}</span>
                    <span>
                      <span className={e.kind === 'yellow' ? 'card card--y' : 'card card--r'} /> {surname(players, e.playerId)}
                      {e.kind === 'second-yellow' && ' (doble amarilla)'}
                    </span>
                    <span className="muted small">{clubs.get(e.clubId)?.shortName}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {subs.length > 0 && (
            <>
              <h4 className="subhead">Cambios</h4>
              <ul className="goal-list">
                {subs.map((e, i) => (
                  <li key={i} className={`goal-list__item goal-list__item--${side(e.clubId)}`}>
                    <span className="goal-list__min">{minuteText(e)}</span>
                    <span>
                      ⇄ entra {surname(players, e.otherPlayerId)}, sale {surname(players, e.playerId)}
                    </span>
                    <span className="muted small">{clubs.get(e.clubId)?.shortName}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {injuries.length > 0 && (
            <>
              <h4 className="subhead">Lesiones</h4>
              <ul className="goal-list">
                {injuries.map((inj) => (
                  <li key={inj.playerId} className="goal-list__item">
                    <span className="goal-list__min">{inj.minute}'</span>
                    <span>
                      ✚ {surname(players, inj.playerId)}: {inj.description} ({inj.days} días)
                    </span>
                    <span className="muted small">{clubs.get(inj.clubId)?.shortName}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Estadísticas">
          <StatsTable stats={report.stats} />
          {best && (
            <p className="small best-player">
              Figura: <b>{players.get(best[0])?.name}</b> ({best[1].toFixed(1)})
            </p>
          )}
        </Panel>
      </div>

      <div className="report-grid">
        {[report.homeId, report.awayId].map((clubId) => (
          <Panel key={clubId} title={`Puntajes · ${clubs.get(clubId)?.shortName}`} flush>
            <table className="grid-table">
              <thead>
                <tr>
                  <th className="left">Jugador</th>
                  <th>Min</th>
                  <th>Puntaje</th>
                </tr>
              </thead>
              <tbody>
                {ratingRows(clubId).map(([id, r]) => (
                  <tr key={id}>
                    <td className="left">{players.get(id)?.name ?? id}</td>
                    <td>{report.minutesPlayed[id] ?? 0}</td>
                    <td className={'strong ' + (r >= 7.5 ? 'pos-text' : r < 5.5 ? 'neg' : '')}>{r.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function PostPartidoScreen({ game, go, matchId }: ScreenProps & { matchId: string | null }) {
  const clubs = useClubs(game);
  const played = userMatches(game).filter((m) => m.status === 'played');
  const match = game.calendar.matches.find((m) => m.id === matchId) ?? played[played.length - 1];
  return (
    <div className="stack">
      <div className="chips">
        <button className="chip" onClick={() => go?.('calendario')}>
          ← Calendario
        </button>
        {played
          .slice(-8)
          .reverse()
          .map((m) => (
            <button key={m.id} className={'chip' + (m.id === match?.id ? ' chip--active' : '')} onClick={() => go?.('report', m.id)}>
              <OutcomeChip o={outcomeFor(m, game.userClubId)} /> {shortDate(m.date)} · {clubs.get(m.homeId === game.userClubId ? m.awayId : m.homeId)?.shortName}
            </button>
          ))}
      </div>
      {!match && (
        <Panel>
          <p className="muted">Todavía no jugaste ningún partido.</p>
        </Panel>
      )}
      {match && !match.report && (
        <Panel>
          <p className="muted">{match.status === 'played' ? 'Este partido no tiene informe detallado.' : 'Este partido todavía no se jugó.'}</p>
        </Panel>
      )}
      {match?.report && <ReportView game={game} report={match.report} match={match} />}
    </div>
  );
}
