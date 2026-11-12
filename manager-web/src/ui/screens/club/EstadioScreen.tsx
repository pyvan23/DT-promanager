import { useState } from 'react';
import {
  applyExpansion,
  expansionOptions,
  improvePitch,
  MAX_CAPACITY,
  pitchImprovementCost,
  priceDemandFactor,
  referenceTicketPrice,
  setTicketPrice,
} from '../../../engine/club';
import { clubOf, divisionOf, type GameState } from '../../../engine/game/game';
import type { Stadium } from '../../../engine/game-types';
import { ClubLabel } from '../../components/ClubBadge';
import { Bar, Panel } from '../../components/Panel';
import { PersonaMessage } from '../../personas/PersonaMessage';
import { personaFor } from '../../personas/personas';
import { StatStrip } from './shared';
import { daysBetween, fmtDate, int, money, pct, type ScreenProps } from './util';

/** Expected crowd for a typical league match (average rival, mid importance, no form effect, no noise). */
function estimateGate(game: GameState, stadium: Stadium, price: number): { attendance: number; revenue: number } {
  const club = clubOf(game.world, game.userClubId);
  const division = divisionOf(game.world, game.userClubId);
  const fair = referenceTicketPrice(club, division.level);
  const reps = division.clubIds.filter((id) => id !== club.id).map((id) => clubOf(game.world, id).reputation);
  const rivalRep = reps.length ? reps.reduce((s, r) => s + r, 0) / reps.length : 50;
  const fill = 0.45 + 0.55 * (Math.min(99, Math.max(1, club.reputation)) / 99);
  const rival = 0.8 + 0.45 * (rivalRep / 99);
  const importance = 0.85 + 0.35 * 0.5;
  const pitch = 0.95 + 0.1 * (stadium.pitchQuality / 100);
  const demand = stadium.capacity * fill * rival * importance * pitch * priceDemandFactor(price / Math.max(0.5, fair));
  const attendance = Math.max(0, Math.min(stadium.capacity, Math.round(demand)));
  return { attendance, revenue: attendance * price };
}

const PITCH_STEPS = [5, 10, 25];

export function EstadioScreen({ game, update }: ScreenProps) {
  const { stadium, finances } = game.club;
  const date = game.calendar.date;
  const club = clubOf(game.world, game.userClubId);
  const division = divisionOf(game.world, game.userClubId);
  const fair = referenceTicketPrice(club, division.level);
  const [price, setPrice] = useState(stadium.ticketPrice);

  const now = estimateGate(game, stadium, stadium.ticketPrice);
  const next = estimateGate(game, stadium, price);
  const options = expansionOptions(stadium);
  const pendingSeats = game.works.reduce((s, w) => s + w.seats, 0);

  const homeMatches = game.calendar.matches
    .filter((m) => m.status === 'played' && m.report?.attendance !== undefined && (m.homeId === game.userClubId || (m.neutral && m.awayId === game.userClubId)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  const avgAttendance = homeMatches.length ? homeMatches.reduce((s, m) => s + (m.report!.attendance ?? 0), 0) / homeMatches.length : 0;
  const competition = (id: string) => (id === 'amistoso' ? 'Amistoso' : game.calendar.names[id] ?? id);

  const ratio = stadium.ticketPrice / Math.max(0.5, fair);
  const occupancy = homeMatches.length ? avgAttendance / stadium.capacity : now.attendance / Math.max(1, stadium.capacity);
  const presidentText =
    ratio > 1.4
      ? `La entrada a ${money(stadium.ticketPrice)} es cara para nuestra gente; los socios me paran en la calle. Pensalo.`
      : occupancy > 0.92
        ? `¡La cancha explota! Con este ${pct(occupancy)} de ocupación, una ampliación del ${stadium.name} sería un orgullo para el club.`
        : occupancy < 0.5
          ? `Hay muchas butacas vacías (${pct(occupancy)} de ocupación). Quizás bajar el precio traiga más gente.`
          : `El ${stadium.name} anda bien: esperamos unos ${int(now.attendance)} hinchas por partido y ${money(now.revenue)} de taquilla.`;

  return (
    <div className="stack cl-screen">
      <div className="persona-panel">
        <PersonaMessage persona={personaFor(game, 'presidente')} text={presidentText} variant="compact" />
      </div>
      <StatStrip
        items={[
          { label: 'Estadio', value: stadium.name },
          { label: 'Capacidad', value: int(stadium.capacity), hint: pendingSeats ? `+${int(pendingSeats)} en obra` : undefined },
          { label: 'Entrada', value: money(stadium.ticketPrice), hint: `Precio de mercado: ${money(fair)}` },
          { label: 'Césped', value: `${stadium.pitchQuality}/100` },
          { label: 'Asistencia media', value: homeMatches.length ? int(avgAttendance) : '—', hint: homeMatches.length ? `${pct(avgAttendance / stadium.capacity)} de ocupación` : 'Sin partidos de local' },
        ]}
      />

      <div className="cl-two">
        <Panel title="Precio de la entrada">
          <div className="cl-form">
            <label className="cl-field">
              <span>Nuevo precio · {money(price)} ({pct(price / fair)} del precio de mercado)</span>
              <input type="range" min={1} max={Math.max(10, Math.ceil(fair * 3))} step={0.5} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </label>
            <div className="cl-actions">
              <input className="cl-num" type="number" min={1} max={1000} step={0.5} value={price} onChange={(e) => setPrice(Number(e.target.value) || 1)} aria-label="Precio en US$" />
              <button className="btn btn--sm" onClick={() => setPrice(fair)}>Precio de mercado</button>
              <button className="btn btn--sm btn--primary" disabled={price === stadium.ticketPrice} onClick={() => update({ ...game, club: setTicketPrice(game.club, price) })}>Aplicar</button>
            </div>
            <table className="grid-table cl-compare">
              <thead>
                <tr><th className="left">Partido típico de local</th><th>Actual</th><th>Con {money(price)}</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td className="left">Público estimado</td>
                  <td>{int(now.attendance)}</td>
                  <td className={next.attendance >= now.attendance ? 'cl-up' : 'cl-down'}>{int(next.attendance)}</td>
                </tr>
                <tr>
                  <td className="left">Ocupación</td>
                  <td>{pct(now.attendance / stadium.capacity)}</td>
                  <td>{pct(next.attendance / stadium.capacity)}</td>
                </tr>
                <tr>
                  <td className="left">Recaudación</td>
                  <td>{money(now.revenue)}</td>
                  <td className={next.revenue >= now.revenue ? 'cl-up strong' : 'cl-down strong'}>{money(next.revenue)}</td>
                </tr>
              </tbody>
            </table>
            <p className="tiny muted">Estimación contra un rival promedio de {division.name}. Por debajo del precio de mercado la gente casi no reacciona; muy por encima, se queda en la casa.</p>
          </div>
        </Panel>

        <Panel title="Césped" aside={<span className="muted">{stadium.pitchQuality}/100</span>}>
          <div className="cl-form">
            <Bar value={stadium.pitchQuality} max={100} />
            <p className="small muted">Un buen césped lleva un poco más de gente a la cancha y reduce las lesiones.</p>
            <div className="cl-actions">
              {PITCH_STEPS.map((pts) => {
                const real = Math.min(pts, 100 - stadium.pitchQuality);
                const cost = pitchImprovementCost(stadium, pts);
                return (
                  <button key={pts} className="btn btn--sm" disabled={real <= 0 || cost > finances.balance} onClick={() => update({ ...game, club: improvePitch(game.club, pts, date) })}>
                    +{real} · {money(cost)}
                  </button>
                );
              })}
            </div>
            {stadium.pitchQuality >= 100 && <p className="small cl-up">El césped está impecable.</p>}
          </div>
        </Panel>
      </div>

      <div className="cl-two">
        <Panel title="Ampliaciones" aside={<span className="muted">Saldo: {money(finances.balance)}</span>} flush>
          {options.length === 0 ? (
            <p className="empty">El estadio llegó al máximo ({int(MAX_CAPACITY)} lugares).</p>
          ) : (
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr><th>Lugares</th><th>Nueva capacidad</th><th>Costo</th><th>Obra</th><th /></tr>
                </thead>
                <tbody>
                  {options.map((o) => (
                    <tr key={o.seats}>
                      <td className="strong">+{int(o.seats)}</td>
                      <td>{int(o.newCapacity + pendingSeats)}</td>
                      <td>{money(o.cost)}</td>
                      <td>{o.days} días</td>
                      <td>
                        <button
                          className="btn btn--xs btn--primary"
                          disabled={o.cost > finances.balance || o.newCapacity + pendingSeats > MAX_CAPACITY}
                          onClick={() => {
                            const r = applyExpansion(game.club, o, date);
                            update({ ...game, club: r.clubState, works: [...game.works, r.work] });
                          }}
                        >
                          Construir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="tiny muted cl-pad">La obra se paga al empezar; los lugares se habilitan cuando termina.</p>
        </Panel>

        <Panel title="Obras en curso" flush>
          {game.works.length === 0 ? (
            <p className="empty">No hay obras en marcha.</p>
          ) : (
            <table className="grid-table">
              <thead>
                <tr><th>Lugares</th><th>Inicio</th><th>Fin</th><th className="left">Avance</th></tr>
              </thead>
              <tbody>
                {game.works.map((w, i) => {
                  const total = Math.max(1, daysBetween(w.startDate, w.readyDate));
                  const left = Math.max(0, daysBetween(date, w.readyDate));
                  return (
                    <tr key={`${w.startDate}-${i}`}>
                      <td className="strong">+{int(w.seats)}</td>
                      <td>{fmtDate(w.startDate)}</td>
                      <td>{fmtDate(w.readyDate)}</td>
                      <td className="left">
                        <span className="cl-progress">
                          <Bar value={total - left} max={total} tone="accent" />
                          <span className="tiny muted">faltan {left} días</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      <Panel title="Asistencia de local" aside={<span className="muted">últimos {homeMatches.length} partidos</span>} flush>
        {homeMatches.length === 0 ? (
          <p className="empty">Todavía no jugaste de local esta temporada.</p>
        ) : (
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr><th className="left">Fecha</th><th className="left hide-sm">Competencia</th><th className="left">Rival</th><th>Resultado</th><th>Público</th><th className="left">Ocupación</th></tr>
              </thead>
              <tbody>
                {homeMatches.map((m) => {
                  const rivalId = m.homeId === game.userClubId ? m.awayId : m.homeId;
                  const att = m.report!.attendance ?? 0;
                  return (
                    <tr key={m.id}>
                      <td className="left">{fmtDate(m.date)}</td>
                      <td className="left hide-sm">{competition(m.competitionId)}</td>
                      <td className="left"><ClubLabel club={game.world.clubs.find((c) => c.id === rivalId)} short /></td>
                      <td className="score">{m.result ? `${m.result.homeGoals}-${m.result.awayGoals}` : '—'}</td>
                      <td>{int(att)}</td>
                      <td className="left"><span className="cl-progress"><Bar value={att} max={stadium.capacity} tone="accent" /><span className="tiny muted">{pct(att / stadium.capacity)}</span></span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
