import { useEffect } from 'react';
import type { Club, Player } from '../../engine/types';
import { ageInSeason, ATTRIBUTES, countryName, overall, POSITION_LABEL, POSITION_SPOT } from '../format';
import { ClubBadge } from './ClubBadge';
import { Bar, Rating } from './Panel';

/** Player file: attributes as bars, positions on a mini-pitch, personal data. */
export function PlayerCard({ player, club, season, onClose }: { player: Player; club: Club | undefined; season: number; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const main = POSITION_SPOT[player.position];
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <article className="ficha" role="dialog" aria-modal="true" aria-label={`Ficha de ${player.name}`} onClick={(e) => e.stopPropagation()}>
        <header className="ficha__head" style={{ ['--club' as string]: club?.colors.primary ?? 'var(--accent)' }}>
          <ClubBadge club={club} size={46} />
          <div className="ficha__id">
            <span className="ficha__kicker">Ficha del jugador · {club?.shortName ?? 'Libre'}</span>
            <h2 className="ficha__name">{player.name}</h2>
            <span className="ficha__pos">{POSITION_LABEL[player.position]}</span>
          </div>
          <div className="ficha__overall">
            <span>Media</span>
            <Rating value={overall(player)} />
          </div>
          <button className="ficha__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </header>

        <div className="ficha__body">
          <dl className="ficha__data">
            <div>
              <dt>Edad</dt>
              <dd>{ageInSeason(player, season)} años</dd>
            </div>
            <div>
              <dt>Nacimiento</dt>
              <dd>{player.birthDate.split('-').reverse().join('/')}</dd>
            </div>
            <div>
              <dt>Nacionalidad</dt>
              <dd>{countryName(player.nationality)}</dd>
            </div>
            <div>
              <dt>Posiciones</dt>
              <dd>{[player.position, ...player.altPositions].join(' · ')}</dd>
            </div>
          </dl>

          <div className="ficha__grid">
            <ul className="attr-list">
              {ATTRIBUTES.map((a) => (
                <li key={a.key}>
                  <span className="attr-list__label">{a.label}</span>
                  <Bar value={player.attributes[a.key]} />
                  <span className="attr-list__value">{player.attributes[a.key]}</span>
                </li>
              ))}
            </ul>

            <svg className="mini-pitch" viewBox="0 0 100 100" role="img" aria-label="Posiciones en la cancha">
              <rect x="2" y="2" width="96" height="96" rx="2" className="mini-pitch__grass" />
              <g fill="none" stroke="rgb(255 255 255 / 0.55)" strokeWidth="0.8">
                <rect x="6" y="6" width="88" height="88" />
                <line x1="6" y1="50" x2="94" y2="50" />
                <circle cx="50" cy="50" r="9" />
                <rect x="30" y="6" width="40" height="13" />
                <rect x="30" y="81" width="40" height="13" />
              </g>
              {player.altPositions.map((p) => (
                <circle key={p} cx={POSITION_SPOT[p].x} cy={POSITION_SPOT[p].y} r="4.2" className="mini-pitch__alt" />
              ))}
              <circle cx={main.x} cy={main.y} r="6" className="mini-pitch__main" />
              <text x={main.x} y={main.y + 2.2} textAnchor="middle" className="mini-pitch__label">
                {player.position}
              </text>
            </svg>
          </div>
        </div>
      </article>
    </div>
  );
}
