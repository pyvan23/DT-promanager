import { useMemo, useState } from 'react';
import type { World } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { FileteRule } from '../components/Filete';
import { Stars } from '../components/Panel';
import { clubMap } from '../format';

interface Props {
  world: World;
  onChoose: (clubId: string) => void;
  onBack: () => void;
}

export function ChooseClubScreen({ world, onChoose, onBack }: Props) {
  const clubs = useMemo(() => clubMap(world), [world]);
  const divisions = useMemo(() => [...world.divisions].sort((a, b) => a.level - b.level), [world]);
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const division = divisions.find((d) => d.id === divisionId);
  const q = query.trim().toLowerCase();
  const list = (q ? world.clubs.map((c) => c.id) : division?.clubIds ?? [])
    .map((id) => clubs.get(id))
    .filter((c) => c !== undefined)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q))
    .sort((a, b) => b.reputation - a.reputation);
  const divisionName = (clubId: string) => divisions.find((d) => d.clubIds.includes(clubId))?.name ?? '';

  return (
    <main className="choose">
      <header className="choose__head">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>
          ← Volver
        </button>
        <div>
          <p className="kicker">Temporada {world.season} · {world.clubs.length} clubes</p>
          <h1 className="choose__title">Elegí el club que vas a dirigir</h1>
        </div>
        <input
          className="search"
          type="search"
          placeholder="Buscar club…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Buscar club"
        />
      </header>
      <FileteRule />

      <div className="choose__body">
        <nav className="division-list" aria-label="Categorías">
          {divisions.map((d) => (
            <button
              key={d.id}
              className={'division-list__item' + (d.id === divisionId && !q ? ' is-active' : '')}
              onClick={() => {
                setDivisionId(d.id);
                setQuery('');
              }}
            >
              <span className="division-list__level">{d.level}</span>
              <span className="division-list__name">{d.name}</span>
              <span className="division-list__count">{d.clubIds.length}</span>
            </button>
          ))}
        </nav>

        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="grid-table grid-table--clubs">
              <thead>
                <tr>
                  <th className="left">Club</th>
                  <th className="left hide-sm">Estadio</th>
                  {q && <th className="left hide-sm">Categoría</th>}
                  <th className="hide-sm">Región</th>
                  <th>Nivel</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((club) => (
                  <tr key={club.id} className="is-clickable" onClick={() => onChoose(club.id)}>
                    <td className="left">
                      <span className="club-cell">
                        <ClubBadge club={club} size={30} />
                        <span>
                          <span className="club-cell__name">{club.name}</span>
                          <span className="club-cell__short muted">{club.shortName}</span>
                        </span>
                      </span>
                    </td>
                    <td className="left hide-sm muted">{club.stadium}</td>
                    {q && <td className="left hide-sm">{divisionName(club.id)}</td>}
                    <td className="hide-sm">
                      <span className={`chip chip--${club.region}`}>{club.region === 'metro' ? 'Metro' : 'Interior'}</span>
                    </td>
                    <td>
                      <Stars reputation={club.reputation} />
                    </td>
                    <td>
                      <span className="btn btn--primary btn--xs">Dirigir</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
