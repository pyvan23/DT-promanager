import { managerFirst } from '../personas/voices';
import { useMemo } from 'react';
import { OpcionesPanel } from './CareerPanels';
import { competitionResult, nextUserMatch } from '../../engine/calendar/calendar';
import { clubOf, divisionOf, objectiveText } from '../../engine/game/game';
import { conditionOf } from '../../engine/game/matchday-bridge';
import { ClubBadge } from '../components/ClubBadge';
import { TrophyCabinet, userTitles } from '../competitions/TrophyCabinet';
import { Ticket } from '../components/Hinchada';
import { Bar, Panel, Rating, Stars } from '../components/Panel';
import { ageInSeason, overall, POSITION_LABEL } from '../format';
import { CountUp, PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';
import { competitionName, MatchRow, money, outcomeFor, OutcomeChip, shortDate, useClubs, userMatches, type ScreenProps } from './shared';

const NEWS_KIND: Record<string, string> = {
  partido: 'Partido',
  mercado: 'Mercado',
  directiva: 'Directiva',
  lesion: 'Enfermería',
  club: 'Club',
  temporada: 'Temporada',
};

export function DespachoScreen({ game, update, go, pickPlayer }: ScreenProps) {
  const clubs = useClubs(game);
  const club = clubOf(game.world, game.userClubId);
  const division = divisionOf(game.world, game.userClubId);
  const squad = useMemo(() => game.world.players.filter((p) => p.clubId === game.userClubId && !p.youth), [game.world.players, game.userClubId]);
  const figures = [...squad].sort((a, b) => overall(b) - overall(a)).slice(0, 6);
  const next = nextUserMatch(game.calendar);
  const today = next?.date === game.calendar.date;
  const mine = userMatches(game);
  const last = mine.filter((m) => m.status === 'played').slice(-5).reverse();
  const board = game.club.board;
  const fin = game.club.finances;

  // Position in the league table (first table stage that holds the club).
  const standing = useMemo(() => {
    const r = competitionResult(game.calendar, division.id);
    for (const s of r?.stages ?? []) {
      for (const t of s.tables) {
        const i = t.findIndex((row) => row.clubId === game.userClubId);
        if (i >= 0) return { pos: i + 1, of: t.length, row: t[i] };
      }
    }
    return null;
  }, [game.calendar, division.id, game.userClubId]);

  const injured = squad.filter((p) => conditionOf(p).injuryDays > 0).length;
  const suspended = squad.filter((p) => conditionOf(p).suspensionMatches > 0).length;
  const rivalId = next ? (next.homeId === game.userClubId ? next.awayId : next.homeId) : null;
  const rival = rivalId ? clubs.get(rivalId) : undefined;

  const greeting = (() => {
    const first = managerFirst(game);
    const pos = standing ? ` Vamos ${standing.pos}.º y` : '';
    if (board.confidence >= 70) return `¡Adelante, ${first}! Pase, siéntese.${pos} la gente está contenta: siga así y en ${club.shortName} le hacemos un monumento.`;
    if (board.confidence >= 45) return `Buen día, ${first}. Bienvenido al despacho.${pos} lo que la comisión espera es ${objectiveText(board.objective)}. Cuento con usted.`;
    return `${first}, cierre la puerta que tenemos que hablar.${pos} así como vamos no llegamos a ${objectiveText(board.objective)}. Necesito resultados ya.`;
  })();

  return (
    <div className="despacho">
      <div className="despacho__col">
        <div className="persona-panel">
          <PersonaMessage persona={personaFor(game, 'presidente')} text={greeting} />
        </div>
        <Panel className="despacho__club" title="Despacho del DT" aside={<span className="muted">Temporada {game.calendar.season}</span>}>
          <div className="club-sheet">
            <ClubBadge club={club} size={86} />
            <div className="club-sheet__info">
              <h2 className="club-sheet__name">{club.name}</h2>
              <p className="club-sheet__meta">
                {division.name} · {game.club.stadium.name} · {game.club.stadium.capacity.toLocaleString('es-AR')} lugares
              </p>
              <Stars reputation={club.reputation} />
            </div>
          </div>
          <dl className="kv-grid">
            <div>
              <dt>Posición</dt>
              <dd>{standing ? `${standing.pos}.º de ${standing.of} · ${standing.row.points} pts` : 'Sin jugar'}</dd>
            </div>
            <div>
              <dt>Saldo</dt>
              <dd className={fin.balance < 0 ? 'neg' : ''}><CountUp value={fin.balance} format={money} /></dd>
            </div>
            <div>
              <dt>Presupuesto de pases</dt>
              <dd>{money(fin.transferBudget)}</dd>
            </div>
            <div>
              <dt>Plantel</dt>
              <dd>
                {squad.length} jugadores
                {(injured > 0 || suspended > 0) && (
                  <span className="muted small">
                    {' '}
                    · {injured} les. · {suspended} susp.
                  </span>
                )}
              </dd>
            </div>
          </dl>
        </Panel>

        {userTitles(game).length > 0 && (
          <Panel title="Vitrina de trofeos" aside={<button className="link" onClick={() => go?.('competiciones')}>Competiciones →</button>} flush>
            <TrophyCabinet game={game} />
          </Panel>
        )}

        <Panel title="La directiva" aside={<button className="link" onClick={() => go?.('directiva')}>Ver directiva →</button>}>
          <div className="board-box">
            <span className="kicker">Objetivo de la temporada</span>
            <b className="board-box__goal">{objectiveText(board.objective)}</b>
            <div className="board-box__conf">
              <span>Confianza</span>
              <Bar value={board.confidence} max={100} tone={board.confidence < 35 ? 'down' : board.confidence >= 60 ? 'up' : undefined} />
              <b><CountUp value={board.confidence} format={(n) => `${Math.round(n)}%`} /></b>
            </div>
            {board.warnings > 0 && <p className="notice">La comisión directiva ya te hizo {board.warnings} advertencia{board.warnings > 1 ? 's' : ''}.</p>}
          </div>
        </Panel>

        <Panel className="despacho__figures" title="Figuras del plantel" aside={<button className="link" onClick={() => go?.('plantel')}>Plantel completo →</button>} flush>
          <ul className="figure-list">
            {figures.map((p) => (
              <li key={p.id}>
                <button onClick={() => pickPlayer?.(p)}>
                  <Rating value={overall(p)} />
                  <span className="figure-list__name">{p.name}</span>
                  <span className="figure-list__pos muted">{POSITION_LABEL[p.position]}</span>
                  <span className="figure-list__age muted">{ageInSeason(p, game.world.season)} años</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="despacho__col">
        <OpcionesPanel game={game} update={update} />
        {next && rival ? (
          <Ticket
            club={rival}
            kicker={today ? 'Hoy hay partido' : `Próximo partido · ${competitionName(game, next.competitionId)}`}
            title={`${next.homeId === game.userClubId ? 'vs' : 'en cancha de'} ${rival.shortName}`}
            fields={[
              { label: 'Fecha', value: shortDate(next.date) },
              { label: 'Competición', value: competitionName(game, next.competitionId) },
              { label: 'Condición', value: next.neutral ? 'Neutral' : next.homeId === game.userClubId ? 'Local' : 'Visitante' },
            ]}
            stub={{ label: 'Entrada', value: next.homeId === game.userClubId ? 'Local' : 'Visita' }}
            action={
              <button className="btn btn--primary" onClick={() => go?.('partido')}>
                {today ? 'Ir a la previa' : 'Ver la previa'}
              </button>
            }
          />
        ) : (
          <Panel title="Próximo partido">
            <p className="muted">No quedan partidos en el calendario. Cerrá la temporada desde la barra superior.</p>
          </Panel>
        )}

        <Panel title="Últimos resultados" aside={<button className="link" onClick={() => go?.('calendario')}>Calendario →</button>} flush>
          {last.length === 0 && <p className="empty">Todavía no jugaste partidos.</p>}
          {last.map((m) => (
            <div key={m.id} className="result-line">
              <OutcomeChip o={outcomeFor(m, game.userClubId)} />
              <span className="result-line__comp muted small">
                {shortDate(m.date)} · {competitionName(game, m.competitionId)}
              </span>
              <MatchRow m={m} clubs={clubs} onClick={() => go?.('report', m.id)} />
            </div>
          ))}
        </Panel>

        <Panel className="despacho__news" title="Últimas noticias" aside={<button className="link" onClick={() => go?.('noticias')}>Ver diario →</button>}>
          <ul className="news-list">
            {game.news.slice(0, 6).map((n) => (
              <li key={n.id} className={`news-list__item news-list__item--${n.kind === 'lesion' || n.title.startsWith('Derrota') ? 'down' : n.title.startsWith('Triunfo') ? 'up' : 'mine'}`}>
                <span className="news-list__section">
                  {NEWS_KIND[n.kind] ?? n.kind} · {shortDate(n.date)}
                </span>
                <strong className="news-list__headline">{n.title}</strong>
                <span className="news-list__deck">{n.body}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
