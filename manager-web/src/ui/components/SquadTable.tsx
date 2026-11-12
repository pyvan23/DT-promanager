import { useState } from 'react';
import { POSITION_LINE, type Player } from '../../engine/types';
import { ageInSeason, ATTRIBUTES, overall, POSITION_LABEL } from '../format';
import { Rating } from './Panel';

type SortKey = 'name' | 'age' | 'position' | 'overall' | (typeof ATTRIBUTES)[number]['key'];

const LINE_ORDER = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 } as const;
const LINE_NAME = { ARQ: 'Arqueros', DEF: 'Defensores', MED: 'Mediocampistas', DEL: 'Delanteros' } as const;

function sortValue(p: Player, key: SortKey, season: number): number | string {
  switch (key) {
    case 'name':
      return p.name;
    case 'age':
      return ageInSeason(p, season);
    case 'position':
      return LINE_ORDER[POSITION_LINE[p.position]];
    case 'overall':
      return overall(p);
    default:
      return p.attributes[key];
  }
}

/** Dense squad sheet with every attribute; grouped by line when sorted by position. */
export function SquadTable({
  squad,
  season,
  onPick,
  compact = false,
}: {
  squad: Player[];
  season: number;
  onPick?: (p: Player) => void;
  /** Fewer columns, for side panels. */
  compact?: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'position', desc: false });
  const sorted = [...squad].sort((a, b) => {
    const va = sortValue(a, sort.key, season);
    const vb = sortValue(b, sort.key, season);
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return (sort.desc ? -cmp : cmp) || overall(b) - overall(a);
  });
  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'position' }));

  const th = (key: SortKey, label: string, title?: string, className = '') => (
    <th key={key} className={className} aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button className="th-btn" title={title} onClick={() => toggle(key)}>
        {label}
        {sort.key === key && <span className="th-btn__dir">{sort.desc ? '▼' : '▲'}</span>}
      </button>
    </th>
  );

  const attrs = compact ? ATTRIBUTES.filter((a) => ['quality', 'speed', 'passing', 'shooting'].includes(a.key)) : ATTRIBUTES;
  const grouped = sort.key === 'position' && !sort.desc;
  const cols = 4 + attrs.length;
  let lastLine: string | null = null;

  return (
    <div className="table-wrap">
      <table className="grid-table grid-table--squad">
        <thead>
          <tr>
            {th('position', 'Pos', 'Posición', 'left')}
            {th('name', 'Jugador', undefined, 'left')}
            {th('age', 'Edad')}
            {attrs.map((a) => th(a.key, a.abbr, a.label, compact ? '' : 'hide-sm'))}
            {th('overall', 'Media')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const line = POSITION_LINE[p.position];
            const header =
              grouped && line !== lastLine ? (
                <tr key={`h-${line}`} className="grid-table__group">
                  <td colSpan={cols}>{LINE_NAME[line]}</td>
                </tr>
              ) : null;
            lastLine = line;
            return [
              header,
              <tr key={p.id} className={onPick ? 'is-clickable' : ''} onClick={() => onPick?.(p)}>
                <td className="left">
                  <span className={`pos pos--${line.toLowerCase()}`} title={POSITION_LABEL[p.position]}>
                    {p.position}
                  </span>
                </td>
                <td className="left">
                  <span className="player-name">{p.name}</span>
                  {!compact && p.altPositions.length > 0 && <span className="muted tiny"> {p.altPositions.join(' ')}</span>}
                </td>
                <td>{ageInSeason(p, season)}</td>
                {attrs.map((a) => (
                  <td key={a.key} className={(compact ? '' : 'hide-sm ') + 'attr' + (p.attributes[a.key] >= 75 ? ' attr--hi' : '')}>
                    {p.attributes[a.key]}
                  </td>
                ))}
                <td>
                  <Rating value={overall(p)} />
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
