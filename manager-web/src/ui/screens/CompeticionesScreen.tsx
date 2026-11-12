import { FederationLogo } from '../competitions/FederationLogo';
import { useMemo, useState } from 'react';
import { competitionResult, formatOf, leastConceded, topScorers } from '../../engine/calendar/calendar';
import type { StageRun, TieState } from '../../engine/calendar/runner';
import type { ScheduledMatch } from '../../engine/game-types';
import type { Club } from '../../engine/types';
import { ClubBadge, ClubLabel } from '../components/ClubBadge';
import { CompetitionCard } from '../competitions/CompetitionCard';
import { CompetitionHero } from '../competitions/CompetitionHero';
import { identityOf, REGION_LABEL, REGION_ORDER } from '../competitions/identity';
import { Panel } from '../components/Panel';
import { StandingsTable } from '../components/StandingsTable';
import { competitionName, MatchRow, shortDate, useClubs, usePlayers, type ScreenProps } from './shared';


function roundName(ties: number): string {
  return { 1: 'Final', 2: 'Semifinales', 4: 'Cuartos de final', 8: 'Octavos de final', 16: 'Dieciseisavos' }[ties] ?? `Ronda de ${ties * 2}`;
}

function Bracket({ stage, byId, clubs, highlight, onMatch }: { stage: StageRun; byId: Map<string, ScheduledMatch>; clubs: Map<string, Club>; highlight: string; onMatch: (m: ScheduledMatch) => void }) {
  if (stage.rounds.length === 0) return <p className="muted">El cuadro todavía no se sorteó.</p>;
  return (
    <div className="bracket">
      {stage.rounds.map((round: TieState[], r) => (
        <section key={r} className="bracket__round">
          <h4>{roundName(round.length)}</h4>
          {round.map((tie) => {
            const legs = tie.matchIds.map((id) => byId.get(id)).filter((m): m is ScheduledMatch => !!m);
            const ids = legs[0] ? [legs[0].homeId, legs[0].awayId] : [tie.a, tie.b];
            return (
              <div key={tie.id} className={'tie' + (ids.includes(highlight) ? ' tie--mine' : '')}>
                {ids.map((id) => (
                  <div key={id} className={'tie__club' + (tie.winner === id ? ' tie__club--win' : '')}>
                    <ClubBadge club={clubs.get(id)} size={18} />
                    <span className="tie__name">{clubs.get(id)?.shortName ?? id}</span>
                  </div>
                ))}
                <div className="tie__scores">
                  {legs.map((m, k) => (
                    <span key={m.id} className={m.report ? 'is-clickable' : ''} onClick={() => m.report && onMatch(m)}>
                      {legs.length === 2 && <span className="muted">{k === 0 ? 'Ida ' : 'Vuelta '}</span>}
                      {m.status === 'played' && m.result ? (
                        <span className="score">
                          {m.result.homeGoals}-{m.result.awayGoals}
                          {m.result.penalties && <span className="score__pens"> ({m.result.penalties.home}-{m.result.penalties.away} pen.)</span>}
                        </span>
                      ) : (
                        <span className="muted">{shortDate(m.date)}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

export function CompeticionesScreen({ game, go }: ScreenProps) {
  const cal = game.calendar;
  const clubs = useClubs(game);
  const players = usePlayers(game);
  const byId = useMemo(() => new Map(cal.matches.map((m) => [m.id, m])), [cal]);
  const myDivision = game.world.divisions.find((d) => d.clubIds.includes(game.userClubId))?.id;
  const runIds = Object.keys(cal.runs);
  const pendingIds = Object.keys(cal.pending);
  const levelOf = (id: string) => game.world.divisions.find((d) => d.id === id);
  const countryName = (iso?: string) => (iso ? (game.world.countries.find((c) => c.id === iso)?.name ?? iso) : undefined);
  // Picker: every competition (started or pending) grouped by region. Continental cups first,
  // then each country's divisions by level and its cup; friendlies last.
  const rank = (id: string) => {
    const ident = identityOf(id);
    const kind = cal.kinds[id];
    const div = levelOf(id);
    const country = div?.country ?? ident.country;
    const order = !country ? 0 : kind === 'friendly' || id === 'amistoso' ? 3 : 1;
    return [order, countryName(country) ?? '', kind === 'division' ? (div?.level ?? 9) : kind === 'cup' ? 50 : 90, competitionName(game, id)] as const;
  };
  const allIds = [...new Set([...runIds, ...pendingIds])];
  const regions = REGION_ORDER.map((region) => ({
    region,
    ids: allIds
      .filter((id) => identityOf(id).region === region)
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        return ra[0] - rb[0] || ra[1].localeCompare(rb[1]) || ra[2] - rb[2] || ra[3].localeCompare(rb[3]);
      }),
  })).filter((r) => r.ids.length > 0);
  const subtitle = (id: string) => {
    const div = levelOf(id);
    const where = countryName(div?.country ?? identityOf(id).country);
    const what = cal.kinds[id] === 'division' ? `Liga${div ? ` · nivel ${div.level}` : ''}` : cal.kinds[id] === 'friendly' ? 'Pretemporada' : 'Copa';
    const base = where ? `${where} · ${what}` : what;
    return cal.runs[id] ? (cal.runs[id].champion ? `${base} · terminada` : base) : `${base} · pendiente`;
  };
  // Competitions the user's club plays first.
  const playing = runIds.filter((id) => cal.matches.some((m) => m.competitionId === id && (m.homeId === game.userClubId || m.awayId === game.userClubId)));
  const [sel, setSel] = useState<string>(myDivision && cal.runs[myDivision] ? myDivision : (runIds[0] ?? pendingIds[0] ?? ''));
  const [stageIdx, setStageIdx] = useState<number | null>(null);
  const [roundSel, setRoundSel] = useState<number | null>(null);
  const selRegion = identityOf(sel).region;
  const [tab, setTab] = useState<'tabla' | 'goleadores' | 'valla'>('tabla');

  const run = cal.runs[sel];
  const format = run ? formatOf(run.formatId) : null;
  const result = useMemo(() => (run ? competitionResult(cal, sel) : null), [cal, sel, run]);
  const stageI = run ? Math.min(stageIdx ?? run.stages.length - 1, run.stages.length - 1) : 0;
  const stage = run?.stages[stageI];
  const fstage = format?.stages[stageI];
  const stageResult = result?.stages[stageI];
  const stageMatches = (stage?.matchIds ?? []).map((id) => byId.get(id)).filter((m): m is ScheduledMatch => !!m);
  const rounds = [...new Set(stageMatches.map((m) => m.round))].sort((a, b) => a - b);
  const defaultRound = (() => {
    const pending = stageMatches.filter((m) => m.status !== 'played').sort((a, b) => a.date.localeCompare(b.date))[0];
    const lastPlayed = [...stageMatches].filter((m) => m.status === 'played').sort((a, b) => b.date.localeCompare(a.date))[0];
    return lastPlayed?.round ?? pending?.round ?? rounds[0];
  })();
  const round = roundSel !== null && rounds.includes(roundSel) ? roundSel : defaultRound;
  const roundMatches = stageMatches.filter((m) => m.round === round).sort((a, b) => a.date.localeCompare(b.date) || (a.group ?? 0) - (b.group ?? 0));
  const scorers = useMemo(() => (run ? topScorers(cal, sel, 25) : []), [cal, sel, run]);
  const conceded = useMemo(() => (run ? leastConceded(cal, sel).filter((r) => r.played > 0).slice(0, 20) : []), [cal, sel, run]);
  const openMatch = (m: ScheduledMatch) => m.report && go?.('report', m.id);
  const choose = (id: string) => {
    setSel(id);
    setStageIdx(null);
    setRoundSel(null);
  };

  return (
    <div className="stack">
      <CompetitionHero game={game} id={sel} />

      <div className="comp-picker">
        {playing.length > 0 && (
          <div className="chips" aria-label="Donde juega tu club">
            {playing.map((id) => (
              <button key={id} className={'chip' + (id === sel ? ' chip--active' : '')} onClick={() => choose(id)}>
                {competitionName(game, id)}
              </button>
            ))}
          </div>
        )}
        <div className="comp-regions">
          {regions.map((r) => (
            <details key={r.region} className="comp-region" open={r.region === selRegion || undefined}>
              <summary>
                <FederationLogo id={({ argentina: 'ARG', sudamerica: 'CONMEBOL', europa: 'UEFA', otras: 'FIFA' } as const)[r.region]} size={22} />
                {REGION_LABEL[r.region]}
                <span className="comp-region__count">{r.ids.length}</span>
              </summary>
              <div className="comp-cards">
                {r.ids.map((id) => (
                  <CompetitionCard
                    key={id}
                    id={id}
                    name={competitionName(game, id)}
                    sub={subtitle(id)}
                    active={id === sel}
                    mine={playing.includes(id)}
                    pending={!cal.runs[id]}
                    onClick={() => choose(id)}
                  />
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>

      {run && format && (
        <>
          <div className="chips" role="tablist">
            {(
              [
                ['tabla', 'Tablas y resultados'],
                ['goleadores', 'Goleadores'],
                ['valla', 'Valla menos vencida'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={'chip' + (tab === k ? ' chip--active' : '')} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
            {tab === 'tabla' && run.stages.length > 1 && <span className="chips__sep" />}
            {tab === 'tabla' &&
              run.stages.length > 1 &&
              run.stages.map((s, i) => (
                <button key={s.stageId} className={'chip chip--ghost' + (i === stageI ? ' chip--active' : '')} onClick={() => (setStageIdx(i), setRoundSel(null))}>
                  {format.stages[i]?.name ?? s.stageId}
                </button>
              ))}
          </div>

          {tab === 'tabla' && stage && fstage && (
            <div className="comp-grid">
              <div className="stack">
                {fstage.kind === 'knockout' ? (
                  <Panel title={fstage.name}>
                    <Bracket stage={stage} byId={byId} clubs={clubs} highlight={game.userClubId} onMatch={openMatch} />
                  </Panel>
                ) : (
                  stageResult?.tables.map((rows, g) => (
                    <StandingsTable
                      key={g}
                      title={stageResult.tables.length > 1 ? `${fstage.name} · Zona ${String.fromCharCode(65 + g)}` : fstage.name}
                      rows={rows}
                      clubs={clubs}
                      promoted={new Set(stage.advanced ?? [])}
                      highlight={game.userClubId}
                    />
                  ))
                )}
                {upcomingPending(run.stages.length, format.stages.length) && (
                  <p className="muted small">Fases siguientes: {format.stages.slice(run.stages.length).map((s) => s.name).join(', ')}.</p>
                )}
              </div>
              {fstage.kind !== 'knockout' && (
                <Panel
                  title={fstage.kind === 'league' || fstage.kind === 'groups' ? `Fecha ${round ?? '—'}` : `Jornada ${round ?? '—'}`}
                  aside={
                    rounds.length > 1 && (
                      <span className="row-actions">
                        <button className="btn btn--xs" disabled={rounds.indexOf(round) <= 0} onClick={() => setRoundSel(rounds[rounds.indexOf(round) - 1])}>
                          ←
                        </button>
                        <select value={round} onChange={(e) => setRoundSel(Number(e.target.value))} aria-label="Fecha">
                          {rounds.map((r) => (
                            <option key={r} value={r}>
                              Fecha {r}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn--xs" disabled={rounds.indexOf(round) >= rounds.length - 1} onClick={() => setRoundSel(rounds[rounds.indexOf(round) + 1])}>
                          →
                        </button>
                      </span>
                    )
                  }
                >
                  <div className="match-list">
                    {roundMatches.map((m) => (
                      <div key={m.id} className="match-list__item">
                        <span className="muted tiny">{shortDate(m.date)}</span>
                        <MatchRow m={m} clubs={clubs} highlight={game.userClubId} onClick={m.report ? () => openMatch(m) : undefined} />
                      </div>
                    ))}
                    {roundMatches.length === 0 && <p className="muted">Sin partidos.</p>}
                  </div>
                </Panel>
              )}
            </div>
          )}

          {tab === 'goleadores' && (
            <Panel title="Tabla de goleadores" flush>
              {scorers.length === 0 ? (
                <p className="empty">Todavía no hubo goles.</p>
              ) : (
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="left">Jugador</th>
                      <th className="left">Club</th>
                      <th>Goles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scorers.map((s, i) => (
                      <tr key={s.playerId} className={s.clubId === game.userClubId ? 'row--mine' : ''}>
                        <td className="pos-cell">{i + 1}</td>
                        <td className="left">{players.get(s.playerId)?.name ?? '—'}</td>
                        <td className="left">
                          <ClubLabel club={clubs.get(s.clubId)} short />
                        </td>
                        <td className="pts">{s.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          )}

          {tab === 'valla' && (
            <Panel title="Valla menos vencida" flush>
              {conceded.length === 0 ? (
                <p className="empty">Todavía no se jugó.</p>
              ) : (
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th className="left">Club</th>
                      <th>PJ</th>
                      <th>GC</th>
                      <th>Promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conceded.map((r, i) => (
                      <tr key={r.clubId} className={r.clubId === game.userClubId ? 'row--mine' : ''}>
                        <td className="pos-cell">{i + 1}</td>
                        <td className="left">
                          <ClubLabel club={clubs.get(r.clubId)} />
                        </td>
                        <td>{r.played}</td>
                        <td>{r.conceded}</td>
                        <td className="pts">{(r.conceded / r.played).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          )}
        </>
      )}

      {pendingIds.length > 0 && (
        <Panel title="Competiciones pendientes">
          <ul className="pending-list">
            {pendingIds.map((id) => (
              <li key={id}>
                <b>{competitionName(game, id)}</b> <span className="muted small">{cal.pending[id]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

const upcomingPending = (started: number, total: number) => started < total;
