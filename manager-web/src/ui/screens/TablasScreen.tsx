import { FederationLogo, federationName } from '../competitions/FederationLogo';
import { useMemo, useState } from 'react';
import { competitionResult, divisionSeasonResult, topScorers } from '../../engine/calendar/calendar';
import { relegationAverages } from '../../engine/season';
import type { SeasonRecord, TableRow } from '../../engine/types';
import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { TrophyPhoto } from '../competitions/TrophyPhoto';
import { ClubLabel } from '../components/ClubBadge';
import { Panel } from '../components/Panel';
import { StandingsTable } from '../components/StandingsTable';
import { useClubs, usePlayers, type ScreenProps } from './shared';

const LETTERS = 'ABCDEFGHIJKLMNOP';
type View = 'torneo' | 'clausura' | 'anual' | 'promedios';

/** Country (or confederation) a calendar run belongs to, for grouping the selector. */
function groupOf(game: ScreenProps['game'], runId: string): string {
  const baseId = runId.replace(/-clausura$/, '');
  const division = game.world.divisions.find((d) => d.id === baseId);
  if (division) return division.country;
  const def = game.world.competitions.find((c) => c.id === runId);
  if (def?.scope === 'continental') return def.confederation ?? 'INT';
  if (def?.country) return def.country;
  return game.world.clubs.find((c) => c.id === game.userClubId)?.country ?? 'ARG';
}

/** Every table of every competition in the world, chosen by country and competition. */
export function TablasScreen({ game, go }: ScreenProps) {
  const clubs = useClubs(game);
  const players = usePlayers(game);
  const cal = game.calendar;
  const myCountry = clubs.get(game.userClubId)?.country ?? 'ARG';
  const countryName = (iso: string) =>
    iso === 'CONMEBOL' ? 'Copas sudamericanas' : iso === 'UEFA' ? 'Copas europeas' : (game.world.countries.find((c) => c.id === iso)?.name ?? iso);

  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of [...Object.keys(cal.runs), ...Object.keys(cal.pending)]) {
      if (id.endsWith('-clausura')) continue; // shown inside its division
      const g = groupOf(game, id);
      map.set(g, [...(map.get(g) ?? []), id]);
    }
    const level = (id: string) => game.world.divisions.find((d) => d.id === id)?.level ?? 50;
    for (const ids of map.values()) ids.sort((a, b) => level(a) - level(b) || (cal.names[a] ?? a).localeCompare(cal.names[b] ?? b));
    const order = (g: string) => (g === myCountry ? 0 : g === 'CONMEBOL' ? 1 : g === 'UEFA' ? 2 : 3);
    return [...map.entries()].sort((a, b) => order(a[0]) - order(b[0]) || countryName(a[0]).localeCompare(countryName(b[0])));
  }, [game, cal, myCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  const myDivision = game.world.divisions.find((d) => d.clubIds.includes(game.userClubId))?.id ?? groups[0]?.[1][0];
  const [country, setCountry] = useState(groupOf(game, myDivision));
  const [runId, setRunId] = useState(myDivision);
  const [view, setView] = useState<View>('torneo');
  const list = groups.find(([g]) => g === country)?.[1] ?? [];
  const selected = list.includes(runId) ? runId : list[0];
  const split = !!cal.runs[`${selected}-clausura`];
  const division = game.world.divisions.find((d) => d.id === selected);
  const name = cal.names[selected] ?? selected;
  const effective: View = !split && (view === 'clausura' || view === 'anual') ? 'torneo' : !division?.relegationByAverages && view === 'promedios' ? 'torneo' : view;

  const shownRun = effective === 'clausura' ? `${selected}-clausura` : selected;
  const result = effective === 'anual' || effective === 'promedios' ? divisionSeasonResult(cal, selected) : competitionResult(cal, shownRun);
  const zone = /liga-profesional|primera|federal/.test(cal.runs[shownRun]?.formatId ?? '') ? 'Zona' : 'Grupo';

  // Live relegation averages: past seasons plus the current annual table.
  const averages = useMemo(() => {
    if (effective !== 'promedios' || !division) return [];
    const annual = divisionSeasonResult(cal, division.id)?.stages[0].tables[0] ?? [];
    const current: SeasonRecord[] = annual.map((r: TableRow) => ({ season: game.world.season, clubId: r.clubId, divisionId: division.id, points: r.points, played: r.played }));
    return relegationAverages([...game.world.history, ...current], division, game.world.season);
  }, [effective, division, cal, game.world]);

  const scorers = selected ? topScorers(cal, selected, 10) : [];

  return (
    <div className="tablas">
      <div className="tablas__main stack">
        <Panel title="Elegí la competición">
          <div className="chips" role="tablist" aria-label="País o región">
            {groups.map(([g]) => (
              <button key={g} className={'chip chip--comp' + (g === country ? ' chip--active' : '')} onClick={() => setCountry(g)}>
                <FederationLogo id={g} size={20} />
                {countryName(g)}
              </button>
            ))}
          </div>
          <div className="chips chips--comps" role="tablist" aria-label="Competición">
            {list.map((id) => (
              <button key={id} className={'chip chip--comp' + (id === selected ? ' chip--active' : '')} onClick={() => (setRunId(id), setView('torneo'))}>
                <CompetitionLogo id={id} name={cal.names[id]} size={22} />
                {(cal.names[id] ?? id).replace(/^Torneo Apertura \((.*)\)$/, '$1')}
              </button>
            ))}
          </div>
          {(split || division?.relegationByAverages) && (
            <div className="chips" role="tablist" aria-label="Tabla">
              {split && (
                <>
                  <button className={'chip' + (effective === 'torneo' ? ' chip--active' : '')} onClick={() => setView('torneo')}>Apertura</button>
                  <button className={'chip' + (effective === 'clausura' ? ' chip--active' : '')} onClick={() => setView('clausura')}>Clausura</button>
                  <button className={'chip' + (effective === 'anual' ? ' chip--active' : '')} onClick={() => setView('anual')}>Tabla anual</button>
                </>
              )}
              {division?.relegationByAverages && (
                <button className={'chip' + (effective === 'promedios' ? ' chip--active' : '')} onClick={() => setView('promedios')}>Promedios</button>
              )}
            </div>
          )}
        </Panel>

        {cal.pending[selected] && (
          <Panel title={name}>
            <p className="muted">{cal.pending[selected]}</p>
          </Panel>
        )}

        {effective === 'promedios' ? (
          <Panel title={`Promedios · ${division?.name}`} flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th className="left">Club</th>
                    <th>Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {averages.map((a, i) => (
                    <tr key={a.clubId} className={(a.clubId === game.userClubId ? 'is-mine ' : '') + (i >= averages.length - (division?.relegation[0]?.count ?? 0) ? 'zone-down' : '')}>
                      <td>{i + 1}</td>
                      <td className="left">
                        <ClubLabel club={clubs.get(a.clubId)} />
                      </td>
                      <td>{a.average.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          result?.stages.map((stage) =>
            stage.tables.map((rows, gi) => (
              <StandingsTable
                key={`${stage.stageId}-${gi}`}
                rows={rows}
                clubs={clubs}
                highlight={game.userClubId}
                title={
                  effective === 'anual'
                    ? 'Tabla anual (Apertura + Clausura)'
                    : stage.tables.length > 1
                      ? `${zone} ${LETTERS[gi] ?? gi + 1}`
                      : stage.stageId === 'fase-liga'
                        ? 'Fase de liga'
                        : 'Tabla de posiciones'
                }
              />
            )),
          )
        )}
        {result && result.stages.every((s) => s.tables.length === 0) && !cal.pending[selected] && (
          <Panel title={name}>
            <p className="muted">Es una competición de eliminación directa: mirá el cuadro en Competiciones.</p>
            {go && (
              <button className="btn btn--sm" onClick={() => go('competiciones')}>
                Ver el cuadro
              </button>
            )}
          </Panel>
        )}
      </div>

      <aside className="tablas__side stack">
        <Panel title={name.replace(/^Torneo Apertura \((.*)\)$/, '$1')}>
          <TrophyPhoto id={selected} name={name} />
          <p className="tablas__fed small muted">
            <FederationLogo id={country} size={34} />
            {federationName(country) ?? countryName(country)}
          </p>
          {cal.runs[selected]?.champion && (
            <p className="small">
              Campeón: <ClubLabel club={clubs.get(cal.runs[selected].champion!)} />
            </p>
          )}
        </Panel>
        {scorers.length > 0 && (
          <Panel title="Goleadores" flush>
            <ol className="scorers">
              {scorers.map((s) => (
                <li key={s.playerId}>
                  <span className="scorers__name">{players.get(s.playerId)?.name ?? s.playerId}</span>
                  <span className="small muted">{clubs.get(s.clubId)?.shortName}</span>
                  <b>{s.goals}</b>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </aside>
    </div>
  );
}
