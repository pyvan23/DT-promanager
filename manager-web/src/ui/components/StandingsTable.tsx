import type { Club, TableRow } from '../../engine/types';
import { ClubLabel } from './ClubBadge';
import { Panel } from './Panel';

interface Props {
  rows: TableRow[];
  clubs: Map<string, Club>;
  promoted?: Set<string>;
  relegated?: Set<string>;
  highlight?: string | null;
  title?: string;
}

export function StandingsTable({ rows, clubs, promoted, relegated, highlight, title }: Props) {
  return (
    <Panel title={title} flush>
      <div className="table-wrap">
        <table className="grid-table grid-table--standings">
          <thead>
            <tr>
              <th>#</th>
              <th className="left">Equipo</th>
              <th>Pts</th>
              <th>PJ</th>
              <th>G</th>
              <th>E</th>
              <th>P</th>
              <th className="hide-sm">GF</th>
              <th className="hide-sm">GC</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const cls = [
                promoted?.has(r.clubId) ? 'row--up' : '',
                relegated?.has(r.clubId) ? 'row--down' : '',
                highlight === r.clubId ? 'row--mine' : '',
              ].join(' ');
              const dg = r.goalsFor - r.goalsAgainst;
              return (
                <tr key={r.clubId} className={cls}>
                  <td className="pos-cell">{i + 1}</td>
                  <td className="left">
                    <ClubLabel club={clubs.get(r.clubId)} />
                  </td>
                  <td className="pts">{r.points}</td>
                  <td>{r.played}</td>
                  <td>{r.won}</td>
                  <td>{r.drawn}</td>
                  <td>{r.lost}</td>
                  <td className="hide-sm">{r.goalsFor}</td>
                  <td className="hide-sm">{r.goalsAgainst}</td>
                  <td>{dg > 0 ? `+${dg}` : dg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
