import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { useMemo } from 'react';
import { nextUserMatch, matchLabel } from '../../engine/calendar/calendar';
import { alerts, type AlertTone } from '../../engine/game/alerts';
import { clubOf, divisionOf, objectiveText } from '../../engine/game/game';
import { ClubBadge } from '../components/ClubBadge';
import { Bar, Panel } from '../components/Panel';
import { longDate, usePlayers, type ScreenProps } from './shared';
import { CountUp, PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';
import { StaffLive } from '../personas/StaffLive';
import { alertVoice } from '../personas/voices';

const TONE: Record<AlertTone, { icon: string; label: string }> = {
  urgente: { icon: '⚠', label: 'Urgente' },
  atencion: { icon: '●', label: 'Atención' },
  bueno: { icon: '★', label: 'Oportunidad' },
  info: { icon: 'i', label: 'Info' },
};

/** Main screen: today's alerts (inbox), the next match and the latest news. */
export function InicioScreen({ game, go, pickPlayer }: ScreenProps) {
  const items = useMemo(() => alerts(game), [game]);
  const players = usePlayers(game);
  const club = clubOf(game.world, game.userClubId);
  const division = divisionOf(game.world, game.userClubId);
  const next = nextUserMatch(game.calendar);
  const rival = next ? clubOf(game.world, next.homeId === game.userClubId ? next.awayId : next.homeId) : null;
  const urgent = items.filter((a) => a.tone === 'urgente').length;

  return (
    <div className="inicio">
      <Panel
        title={`Bandeja de entrada · ${longDate(game.calendar.date)}`}
        aside={<span className={urgent ? 'neg strong' : 'muted'}>{urgent ? `${urgent} urgente${urgent > 1 ? 's' : ''}` : 'Todo en orden'}</span>}
        flush
      >
        <ul className="inbox">
          {items.map((a, i) => {
            const v = alertVoice(game, a);
            return (
              <li key={a.id} className={`inbox__item inbox__item--${a.tone}`} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
                <span className="inbox__icon" aria-label={TONE[a.tone].label}>
                  {TONE[a.tone].icon}
                </span>
                <PersonaMessage
                  variant="inline"
                  persona={personaFor(game, v.role)}
                  title={a.title}
                  text={v.text}
                  typing={i < 3}
                  className="inbox__persona"
                />
                <span className="row-actions">
                  {a.playerId && players.get(a.playerId) && pickPlayer && (
                    <button className="btn btn--xs" onClick={() => pickPlayer(players.get(a.playerId!)!)}>
                      Ficha
                    </button>
                  )}
                  {a.view && go && (
                    <button className="btn btn--xs btn--primary" onClick={() => go(a.view!)}>
                      Ir
                    </button>
                  )}
                </span>
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="empty">
              <PersonaMessage variant="compact" persona={personaFor(game, 'secretario-tecnico')} text="No hay novedades en la oficina. ¡A trabajar tranquilo, que está todo en orden!" />
            </li>
          )}
        </ul>
      </Panel>

      <div className="inicio__side">
        {next && rival && (
          <Panel title="Próximo partido">
            <div className="next-match">
              <ClubBadge club={next.homeId === game.userClubId ? club : rival} size={44} />
              <div className="next-match__mid">
                <span className="kicker comp-inline"><CompetitionLogo id={next.competitionId} size={20} /> {matchLabel(game.calendar, next).full}</span>
                <b>
                  {clubOf(game.world, next.homeId).shortName} vs {clubOf(game.world, next.awayId).shortName}
                </b>
                <span className="small muted">{longDate(next.date)}</span>
              </div>
              <ClubBadge club={next.homeId === game.userClubId ? rival : club} size={44} />
            </div>
            {go && (
              <button className="btn btn--primary btn--sm" onClick={() => go('partido')}>
                Ver la previa
              </button>
            )}
          </Panel>
        )}

        <Panel title={club.shortName}>
          <p className="small">
            {division.name} · objetivo: <b>{objectiveText(game.club.board.objective)}</b>
          </p>
          <div className="small">
            Confianza de la directiva: <b><CountUp value={game.club.board.confidence} format={(n) => `${Math.round(n)} %`} /></b>
            <Bar value={game.club.board.confidence} max={100} tone={game.club.board.confidence < 35 ? 'down' : 'up'} />
          </div>
          <p className="small muted">
            {game.managerName} · {game.mode === 'promanager' ? 'Pro Mánager' : 'Mánager'} · {game.scope === 'entrenador' ? 'solo entrenador' : 'mánager completo'} · prestigio {game.managerReputation}
          </p>
        </Panel>

        <Panel title="Los empleados del club" flush>
          <StaffLive game={game} />
        </Panel>

        <Panel title="Últimas noticias" flush>
          <ul className="news-mini">
            {game.news.slice(0, 6).map((n) => (
              <li key={n.id}>
                <span className="kicker">{n.date}</span>
                <b>{n.title}</b>
              </li>
            ))}
          </ul>
          {go && (
            <button className="btn btn--xs news-mini__more" onClick={() => go('noticias')}>
              Ver todas
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}
