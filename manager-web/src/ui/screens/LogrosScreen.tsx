import { useCallback, useEffect, useMemo, useState } from 'react';
import { careerPoints, competitionWeight, difficulty, type Achievement } from '../../engine/game/achievements';
import { currentPlayerId, fetchLeaderboard, isOnlineConfigured, publishAchievements, type RankingRow } from '../../online/ranking';
import { ClubBadge } from '../components/ClubBadge';
import { Panel } from '../components/Panel';
import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { identityOf, paletteVars } from '../competitions/identity';
import { AchievementShare } from '../share/AchievementShare';
import '../share/share.css';
import { longDate, useClubs, type ScreenProps } from './shared';

// Logros y ranking: the career's titles and promotions with their points, how they are
// computed, the shareable card of each one and the managers' ranking (online when configured).

const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('es-AR');

export function LogrosScreen({ game }: ScreenProps) {
  const clubs = useClubs(game);
  const list = useMemo(() => [...(game.achievements ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [game.achievements]);
  const total = careerPoints(list);
  const [open, setOpen] = useState<Achievement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="stack">
      <Panel title="Tus logros" aside={`${list.length} ${list.length === 1 ? 'logro' : 'logros'}`}>
        <div className="logros-total">
          <b>{total}</b>
          <span>puntos de carrera de {game.managerName}</span>
        </div>
        {list.length === 0 ? (
          <p className="muted small">Todavía no ganaste nada. Cada título o ascenso con tu club suma puntos: cuanto más chico el club, más valen.</p>
        ) : (
          <ul className="logros-list">
            {list.map((a) => {
              const w = competitionWeight(game.world, a.competitionId, a.kind);
              const f = difficulty(a.clubReputation, a.mode);
              return (
                <li key={a.id} className="logros-item" style={paletteVars(identityOf(a.competitionId).palette)}>
                  <ClubBadge club={clubs.get(a.clubId)} size={40} />
                  <div className="logros-item__info">
                    <span className="logros-kind">
                      {a.kind === 'titulo' ? 'Campeón' : 'Ascenso'} · Temporada {a.season}
                    </span>
                    <b>
                      <CompetitionLogo id={a.competitionId} size={20} /> {a.competitionName}
                    </b>
                    <span className="small muted">
                      {a.clubName} · {longDate(a.date)}
                    </span>
                    <span className="small muted">
                      Peso {w} × dificultad {fmt(f)} (reputación del club {a.clubReputation}
                      {a.mode === 'promanager' ? ', con bonus Pro Mánager' : ''})
                    </span>
                  </div>
                  <div className="logros-item__side">
                    <span className="logros-item__pts">+{a.points}</span>
                    <button className="btn btn--sm" onClick={() => setOpen(a)}>
                      Ver tarjeta
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Cómo se calculan los puntos">
        <ul className="logros-rules small">
          <li>
            <b>Peso de la competición:</b> Libertadores o Champions 20, Sudamericana o Europa League 13, Conference o Supercopa 8, liga de Primera 10, segunda división 6, divisiones menores 4, copas nacionales 5. Un ascenso
            vale 8 si es a Primera y 5 en las demás categorías. Los amistosos y torneos de verano no suman.
          </li>
          <li>
            <b>Dificultad por el club:</b> se multiplica por (90 − reputación del club) ÷ 15, entre 0,1 y 4. Salir campeón con un grande (95) casi no suma; con un club de mitad de tabla (60) se duplica; con uno chico (40) se
            multiplica por más de 3.
          </li>
          <li>
            <b>Bonus Pro Mánager:</b> en las carreras Pro Mánager, donde te pueden echar, los puntos valen 50 % más.
          </li>
          <li>Puntos = peso × dificultad, redondeado (mínimo 1).</li>
        </ul>
      </Panel>

      <RankingPanel game={game} list={list} />

      {open && (
        <div className="ach-stage" role="dialog" aria-modal="true" aria-label="Tarjeta del logro" onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="ach-stage__inner">
            <AchievementShare achievement={open} colors={clubs.get(open.clubId)?.colors}>
              <button className="btn btn--primary" onClick={() => setOpen(null)} autoFocus>
                Cerrar
              </button>
            </AchievementShare>
          </div>
        </div>
      )}
    </div>
  );
}

function localRow(game: ScreenProps['game'], list: readonly Achievement[]): RankingRow {
  const best = [...list].sort((a, b) => b.points - a.points)[0];
  return {
    player_id: 'local',
    manager_name: game.managerName,
    points: careerPoints(list),
    titles: list.filter((a) => a.kind === 'titulo').length,
    promotions: list.filter((a) => a.kind === 'ascenso').length,
    best_club: best?.clubName ?? null,
  };
}

function RankingPanel({ game, list }: { game: ScreenProps['game']; list: readonly Achievement[] }) {
  const online = isOnlineConfigured();
  const [rows, setRows] = useState<RankingRow[] | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState<string | null>(() => currentPlayerId());

  const load = useCallback(async () => {
    try {
      setRows(await fetchLeaderboard(100));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'No se pudo cargar el ranking.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    if (online) void load();
  }, [online, load]);

  const publish = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const n = await publishAchievements(game.managerName, list);
      setMe(currentPlayerId());
      setStatus(n ? `¡Listo! Publicaste ${n} ${n === 1 ? 'logro' : 'logros'}.` : 'Quedaste anotado en el ranking; todavía no tenés logros para sumar.');
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'No se pudo publicar.');
    } finally {
      setBusy(false);
    }
  };

  const shown = online ? (rows ?? []) : [localRow(game, list)];
  const mine = online ? me : 'local';

  return (
    <Panel
      title="Ranking de DTs"
      aside={
        online ? (
          <button className="btn btn--primary btn--sm" onClick={publish} disabled={busy}>
            {busy ? 'Publicando…' : 'Publicar mis logros'}
          </button>
        ) : undefined
      }
      flush
    >
      {!online && <p className="small muted" style={{ padding: '10px 12px 0' }}>El ranking online se activa cuando el servidor esté configurado. Mientras tanto, esta es tu carrera actual.</p>}
      {status && (
        <p className="small" role="status" style={{ padding: '10px 12px 0' }}>
          {status}
        </p>
      )}
      {online && rows === null ? (
        <p className="empty">Cargando el ranking…</p>
      ) : shown.length === 0 ? (
        <p className="empty">Todavía no hay DTs en el ranking. ¡Publicá tus logros y sé el primero!</p>
      ) : (
        <div className="table-wrap">
          <table className="grid-table ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>DT</th>
                <th>Puntos</th>
                <th title="Títulos">Tít.</th>
                <th title="Ascensos">Asc.</th>
                <th>Mejor club</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.player_id} className={r.player_id === mine ? 'is-mine' : ''}>
                  <td>{i + 1}</td>
                  <td>{r.manager_name}</td>
                  <td>
                    <b>{r.points}</b>
                  </td>
                  <td>{r.titles}</td>
                  <td>{r.promotions}</td>
                  <td>{r.best_club ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
