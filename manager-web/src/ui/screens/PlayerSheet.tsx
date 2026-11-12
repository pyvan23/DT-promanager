import { useEffect, useState } from 'react';
import { PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';
import { playerMarket, toggleShortlist, toggleTransferList } from '../../engine/game/game';
import { conditionOf } from '../../engine/game/matchday-bridge';
import type { Player } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { Bar, Rating } from '../components/Panel';
import { ageInSeason, ATTRIBUTES, countryName, overall, POSITION_LABEL, POSITION_SPOT } from '../format';
import { RenewDialog, StatusBadge } from './PlantelScreen';
import { money, type ScreenProps } from './shared';

/** Player file with condition, contract, value and season statistics. */
export function PlayerSheet({ game, update, player: initial, onClose }: ScreenProps & { player: Player; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const [renew, setRenew] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Always show the current version of the player (contract changes, transfers).
  const player = game.world.players.find((p) => p.id === initial.id) ?? initial;
  const club = game.world.clubs.find((c) => c.id === player.clubId);
  const season = game.world.season;
  const mine = player.clubId === game.userClubId;
  const c = conditionOf(player);
  const market = playerMarket(game, player.id);
  const main = POSITION_SPOT[player.position];
  const stats = [...(player.stats ?? [])].sort((a, b) => b.season - a.season);
  const shortlisted = game.club.shortlist.includes(player.id);

  return (
    <>
    <div className="overlay" onClick={onClose} role="presentation">
      <article className="ficha" role="dialog" aria-modal="true" aria-label={`Ficha de ${player.name}`} onClick={(e) => e.stopPropagation()}>
        <header className="ficha__head" style={{ ['--club' as string]: club?.colors.primary ?? 'var(--accent)' }}>
          <ClubBadge club={club} size={46} />
          <div className="ficha__id">
            <span className="ficha__kicker">
              Ficha del jugador · {club?.shortName ?? 'Libre'}
              {player.youth ? ' · Cantera' : ''}
            </span>
            <h2 className="ficha__name">{player.name}</h2>
            <span className="ficha__pos">
              {POSITION_LABEL[player.position]} <StatusBadge p={player} />
            </span>
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
          {msg && <p className="notice">{msg}</p>}
          <dl className="ficha__data">
            <div>
              <dt>Edad</dt>
              <dd>{ageInSeason(player, season)} años</dd>
            </div>
            <div>
              <dt>Nacionalidad</dt>
              <dd>{countryName(player.nationality)}</dd>
            </div>
            <div>
              <dt>Posiciones</dt>
              <dd>{[player.position, ...player.altPositions].join(' · ')}</dd>
            </div>
            <div>
              <dt>Valor</dt>
              <dd>{money(market.value)}</dd>
            </div>
            <div>
              <dt>Contrato</dt>
              <dd>{player.contract ? `${money(player.contract.wage)}/mes · hasta ${player.contract.untilSeason}` : '—'}</dd>
            </div>
            <div>
              <dt>Cláusula</dt>
              <dd>{player.contract?.releaseClause ? money(player.contract.releaseClause) : '—'}</dd>
            </div>
            <div>
              <dt>Físico / Moral / Forma</dt>
              <dd>
                {Math.round(c.fitness)} / {Math.round(c.morale)} / {Math.round(c.form)}
              </dd>
            </div>
            <div>
              <dt>Amarillas acumuladas</dt>
              <dd>{c.yellowCards}</dd>
            </div>
          </dl>
          {c.injuryDays > 0 &&
            (mine ? (
              <PersonaMessage
                persona={personaFor(game, 'medico')}
                variant="compact"
                tone="atencion"
                text={`${c.injury ?? 'Está lesionado'}: le quedan ${c.injuryDays} días de recuperación. ${c.injuryDays > 20 ? 'Es para largo, no lo apures.' : 'En poco tiempo lo tenés de vuelta.'}`}
              />
            ) : (
              <p className="notice">
                {c.injury ?? 'Lesionado'}: {c.injuryDays} días de recuperación.
              </p>
            ))}
          {mine && !player.youth && game.scope !== 'entrenador' && player.contract && player.contract.untilSeason <= season && (
            <PersonaMessage
              persona={personaFor(game, 'secretario-tecnico')}
              variant="compact"
              text={`El contrato de ${player.name.split(' ')[0]} vence a fin de temporada. Si querés que siga, hay que sentarse a renovar ahora.`}
            />
          )}

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

          {stats.length > 0 && (
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="left">Temporada</th>
                    <th className="left">Club</th>
                    <th>PJ</th>
                    <th>Min</th>
                    <th>G</th>
                    <th>A</th>
                    <th>TA</th>
                    <th>TR</th>
                    <th>Prom</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.season + s.clubId}>
                      <td className="left">{s.season}</td>
                      <td className="left">{game.world.clubs.find((x) => x.id === s.clubId)?.shortName ?? s.clubId}</td>
                      <td>{s.appearances}</td>
                      <td>{s.minutes}</td>
                      <td>{s.goals}</td>
                      <td>{s.assists}</td>
                      <td>{s.yellow}</td>
                      <td>{s.red}</td>
                      <td>{s.appearances ? (s.ratingSum / s.appearances).toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="ficha__actions">
            {mine && !player.youth && game.scope !== 'entrenador' && (
              <>
                <button className="btn btn--sm" onClick={() => update(toggleTransferList(game, player.id, 'transferList'))}>
                  {game.market.transferList.includes(player.id) ? 'Sacar de la venta' : 'Poner en venta'}
                </button>
                <button className="btn btn--sm" onClick={() => update(toggleTransferList(game, player.id, 'loanList'))}>
                  {game.market.loanList.includes(player.id) ? 'Sacar de cesión' : 'Ofrecer a préstamo'}
                </button>
                <button className="btn btn--primary btn--sm" onClick={() => setRenew(true)}>
                  Renovar contrato
                </button>
              </>
            )}
            {!mine && player.clubId && (
              <button className="btn btn--sm" onClick={() => update(toggleShortlist(game, player.id))}>
                {shortlisted ? 'Quitar de la cartera' : 'Seguir (cartera)'}
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
      {renew && (
        <RenewDialog
          game={game}
          player={player}
          onClose={() => setRenew(false)}
          onResult={(g, ok) => {
            if (ok) update(g);
            setMsg(ok ? `${player.name} firmó la renovación.` : `${player.name} rechazó la propuesta.`);
            setRenew(false);
          }}
        />
      )}
    </>
  );
}
