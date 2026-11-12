import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { matchLabel } from '../../engine/calendar/calendar';
import { useMemo, useState } from 'react';
import { ClubBadge } from '../components/ClubBadge';
import { Panel } from '../components/Panel';
import { competitionName, longDate, MatchRow, monthName, outcomeFor, OutcomeChip, scoreText, shortDate, useClubs, userMatches, type ScreenProps } from './shared';

export function CalendarioScreen({ game, go }: ScreenProps) {
  const clubs = useClubs(game);
  const cal = game.calendar;
  const mine = useMemo(() => userMatches(game), [game]);
  const months = useMemo(() => [...new Set(mine.map((m) => Number(m.date.slice(5, 7))))].sort((a, b) => a - b), [mine]);
  const currentMonth = Number(cal.date.slice(5, 7));
  const [month, setMonth] = useState(months.includes(currentMonth) ? currentMonth : (months.find((m) => m >= currentMonth) ?? months[0] ?? 1));
  const [tab, setTab] = useState<'mios' | 'dia'>('mios');

  const dates = useMemo(() => [...new Set(cal.matches.map((m) => m.date))].sort(), [cal]);
  const [day, setDay] = useState(cal.date);
  const dayMatches = cal.matches.filter((m) => m.date === day);
  const byComp = new Map<string, typeof dayMatches>();
  for (const m of dayMatches) byComp.set(m.competitionId, [...(byComp.get(m.competitionId) ?? []), m]);
  const prevDate = [...dates].reverse().find((d) => d < day);
  const nextDate = dates.find((d) => d > day);

  const list = mine.filter((m) => Number(m.date.slice(5, 7)) === month);
  const played = mine.filter((m) => m.status === 'played');
  const record = played.reduce(
    (acc, m) => {
      const o = outcomeFor(m, game.userClubId);
      if (o) acc[o]++;
      return acc;
    },
    { W: 0, D: 0, L: 0 },
  );

  return (
    <div className="stack">
      <div className="chips" role="tablist">
        <button role="tab" aria-selected={tab === 'mios'} className={'chip' + (tab === 'mios' ? ' chip--active' : '')} onClick={() => setTab('mios')}>
          Mis partidos
        </button>
        <button role="tab" aria-selected={tab === 'dia'} className={'chip' + (tab === 'dia' ? ' chip--active' : '')} onClick={() => setTab('dia')}>
          Todos los partidos del día
        </button>
      </div>

      {tab === 'mios' && (
        <>
          <div className="strip-stats">
            <div>
              <span>Jugados</span>
              <b>{played.length}</b>
            </div>
            <div>
              <span>Ganados</span>
              <b>{record.W}</b>
            </div>
            <div>
              <span>Empatados</span>
              <b>{record.D}</b>
            </div>
            <div>
              <span>Perdidos</span>
              <b>{record.L}</b>
            </div>
            <div>
              <span>Por jugar</span>
              <b>{mine.length - played.length}</b>
            </div>
          </div>
          <div className="chips month-tabs">
            {months.map((m) => (
              <button key={m} className={'chip' + (m === month ? ' chip--active' : '')} onClick={() => setMonth(m)}>
                {monthName(m)}
              </button>
            ))}
          </div>
          <Panel title={`${monthName(month)} de ${cal.season}`} flush>
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="left">Fecha</th>
                    <th className="left">Competición</th>
                    <th>Cond.</th>
                    <th className="left">Rival</th>
                    <th>Resultado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => {
                    const home = m.homeId === game.userClubId;
                    const rival = clubs.get(home ? m.awayId : m.homeId);
                    const isToday = m.date === cal.date;
                    return (
                      <tr
                        key={m.id}
                        className={(m.status === 'played' ? 'is-clickable ' : '') + (isToday ? 'row--mine' : '')}
                        onClick={m.status === 'played' ? () => go?.('report', m.id) : undefined}
                      >
                        <td className="left">{shortDate(m.date)}</td>
                        <td className="left muted">
                          <span className="comp-inline"><CompetitionLogo id={m.competitionId} size={18} /> {matchLabel(game.calendar, m).full}</span>
                        </td>
                        <td>{m.neutral ? 'N' : home ? 'L' : 'V'}</td>
                        <td className="left">
                          <span className="club-label">
                            <ClubBadge club={rival} size={20} />
                            <span className="club-label__name">{rival?.shortName}</span>
                          </span>
                        </td>
                        <td className="strong">{m.status === 'played' ? scoreText(m) : isToday ? 'Hoy' : '—'}</td>
                        <td>{m.status === 'played' ? <OutcomeChip o={outcomeFor(m, game.userClubId)} /> : null}</td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        Sin partidos este mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {tab === 'dia' && (
        <>
          <div className="day-picker">
            <button className="btn btn--sm" disabled={!prevDate} onClick={() => prevDate && setDay(prevDate)}>
              ← Anterior
            </button>
            <input
              type="date"
              value={day}
              min={`${cal.season}-01-01`}
              max={`${cal.season}-12-31`}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              aria-label="Día"
            />
            <button className="btn btn--sm" disabled={!nextDate} onClick={() => nextDate && setDay(nextDate)}>
              Siguiente →
            </button>
            <button className="btn btn--ghost btn--sm" onClick={() => setDay(cal.date)}>
              Hoy
            </button>
            <b className="day-picker__label">{longDate(day)}</b>
          </div>
          {dayMatches.length === 0 && (
            <Panel>
              <p className="muted">No hay partidos ese día.</p>
            </Panel>
          )}
          {[...byComp.entries()].map(([comp, ms]) => (
            <Panel key={comp} title={competitionName(game, comp)} aside={<span className="muted small">{ms.length} partidos</span>}>
              <div className="match-list">
                {ms.map((m) => (
                  <MatchRow
                    key={m.id}
                    m={m}
                    clubs={clubs}
                    highlight={game.userClubId}
                    onClick={m.status === 'played' && m.report ? () => go?.('report', m.id) : undefined}
                  />
                ))}
              </div>
            </Panel>
          ))}
        </>
      )}
    </div>
  );
}
