import { useMemo, useState } from 'react';
import { clubStrength } from '../../engine/season';
import { ClubBadge } from '../components/ClubBadge';
import { Panel, Rating, Stars } from '../components/Panel';
import { SquadTable } from '../components/SquadTable';
import { overall } from '../format';
import type { ScreenProps } from './shared';

type SortKey = 'name' | 'level' | 'reputation' | 'strength';

/** Database of every club in the country, with a squad preview. */
export function ClubesScreen({ game, pickPlayer }: ScreenProps) {
  const world = game.world;
  const clubId = game.userClubId;
  const onPickPlayer = (p: Parameters<NonNullable<ScreenProps['pickPlayer']>>[0]) => pickPlayer?.(p);
  const [query, setQuery] = useState('');
  const [divisionId, setDivisionId] = useState('all');
  const [region, setRegion] = useState<'all' | 'metro' | 'interior'>('all');
  const [sort, setSort] = useState<SortKey>('level');
  const [selected, setSelected] = useState<string>(clubId);

  const rows = useMemo(() => {
    const divisionOf = new Map(world.divisions.flatMap((d) => d.clubIds.map((id) => [id, d] as const)));
    const avg = new Map<string, number[]>();
    for (const p of world.players) if (p.clubId) avg.set(p.clubId, [...(avg.get(p.clubId) ?? []), overall(p)]);
    return world.clubs.map((club) => {
      const s = clubStrength(world, club.id);
      const ratings = avg.get(club.id) ?? [];
      return {
        club,
        division: divisionOf.get(club.id),
        strength: Math.round((s.attack + s.defence) / 2),
        avg: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0,
        players: ratings.length,
      };
    });
  }, [world]);

  const q = query.trim().toLowerCase();
  const filtered = rows
    .filter((r) => divisionId === 'all' || r.division?.id === divisionId)
    .filter((r) => region === 'all' || r.club.region === region)
    .filter((r) => !q || r.club.name.toLowerCase().includes(q) || r.club.stadium.toLowerCase().includes(q))
    .sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.club.name.localeCompare(b.club.name);
        case 'reputation':
          return b.club.reputation - a.club.reputation;
        case 'strength':
          return b.strength - a.strength;
        default:
          return (a.division?.level ?? 9) - (b.division?.level ?? 9) || b.club.reputation - a.club.reputation;
      }
    });

  const current = rows.find((r) => r.club.id === selected);
  const squad = useMemo(() => world.players.filter((p) => p.clubId === selected && !p.youth), [world, selected]);
  const divisions = [...world.divisions].sort((a, b) => a.level - b.level);

  return (
    <div className="db">
      <Panel
        title="Base de datos de clubes"
        aside={<span className="muted small">{filtered.length} de {rows.length}</span>}
        flush
        className="db__list"
      >
        <div className="filters">
          <input className="search" type="search" placeholder="Club o estadio…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar" />
          <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} aria-label="Categoría">
            <option value="all">Todas las categorías</option>
            {divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value as typeof region)} aria-label="Región">
            <option value="all">Metro e interior</option>
            <option value="metro">Área metropolitana</option>
            <option value="interior">Interior</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Ordenar">
            <option value="level">Ordenar por categoría</option>
            <option value="reputation">Por reputación</option>
            <option value="strength">Por fuerza</option>
            <option value="name">Por nombre</option>
          </select>
        </div>
        <div className="table-wrap db__scroll">
          <table className="grid-table grid-table--clubs">
            <thead>
              <tr>
                <th className="left">Club</th>
                <th className="left hide-sm">Categoría</th>
                <th className="hide-sm">Nivel</th>
                <th>Fuerza</th>
                <th className="hide-sm">Media</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.club.id}
                  className={'is-clickable' + (r.club.id === selected ? ' is-selected' : '') + (r.club.id === clubId ? ' row--mine' : '')}
                  onClick={() => setSelected(r.club.id)}
                >
                  <td className="left">
                    <span className="club-cell">
                      <ClubBadge club={r.club} size={24} />
                      <span className="club-cell__name">{r.club.name}</span>
                    </span>
                  </td>
                  <td className="left hide-sm muted">{r.division?.name}</td>
                  <td className="hide-sm">
                    <Stars reputation={r.club.reputation} />
                  </td>
                  <td>
                    <Rating value={r.strength} />
                  </td>
                  <td className="hide-sm">{r.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {current && (
        <Panel
          className="db__detail"
          title={
            <span className="club-cell">
              <ClubBadge club={current.club} size={28} />
              {current.club.shortName}
            </span>
          }
          aside={<span className="muted small">{current.division?.name}</span>}
          flush
        >
          <dl className="kv-inline">
            <div>
              <dt>Nombre</dt>
              <dd>{current.club.name}</dd>
            </div>
            <div>
              <dt>Estadio</dt>
              <dd>{current.club.stadium}</dd>
            </div>
            <div>
              <dt>Región</dt>
              <dd>{current.club.region === 'metro' ? 'Área metropolitana' : 'Interior'}</dd>
            </div>
            <div>
              <dt>Jugadores</dt>
              <dd>{current.players}</dd>
            </div>
          </dl>
          <SquadTable squad={squad} season={world.season} onPick={onPickPlayer} compact />
        </Panel>
      )}
    </div>
  );
}
