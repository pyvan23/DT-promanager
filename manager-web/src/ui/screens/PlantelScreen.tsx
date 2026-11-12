import { useMemo, useState } from 'react';
import { academy, playerMarket, promoteYouth, renewContract, toggleTransferList, type GameState } from '../../engine/game/game';
import { conditionOf } from '../../engine/game/matchday-bridge';
import { POSITION_LINE, type Player } from '../../engine/types';
import { Bar, Panel, Rating } from '../components/Panel';
import { ageInSeason, overall, POSITION_LABEL } from '../format';
import { money, type ScreenProps } from './shared';
import { PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';

const LINE_ORDER = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 } as const;

export function seasonStats(p: Player, season: number, clubId: string) {
  const s = p.stats?.find((x) => x.season === season && x.clubId === clubId);
  return {
    pj: s?.appearances ?? 0,
    goals: s?.goals ?? 0,
    assists: s?.assists ?? 0,
    yellow: s?.yellow ?? 0,
    red: s?.red ?? 0,
    avg: s && s.appearances > 0 ? s.ratingSum / s.appearances : null,
    minutes: s?.minutes ?? 0,
  };
}

/** Injury / suspension badge for tables and the pitch. */
export function StatusBadge({ p }: { p: Player }) {
  const c = conditionOf(p);
  if (c.injuryDays > 0)
    return (
      <span className="status status--injury" title={`${c.injury ?? 'Lesionado'} · ${c.injuryDays} días`}>
        ✚ {c.injuryDays}d
      </span>
    );
  if (c.suspensionMatches > 0)
    return (
      <span className="status status--susp" title={`Suspendido ${c.suspensionMatches} partido(s)`}>
        ▮ {c.suspensionMatches}
      </span>
    );
  return null;
}

type SortKey = 'pos' | 'name' | 'age' | 'overall' | 'fitness' | 'morale' | 'form' | 'pj' | 'goals' | 'avg' | 'wage' | 'until' | 'value';

export function PlantelScreen({ game, update, pickPlayer }: ScreenProps) {
  const [tab, setTab] = useState<'plantel' | 'cantera'>('plantel');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'pos', desc: false });
  const [renew, setRenew] = useState<Player | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const season = game.world.season;
  const squad = useMemo(() => game.world.players.filter((p) => p.clubId === game.userClubId && !p.youth), [game.world.players, game.userClubId]);
  const youth = useMemo(() => academy(game), [game]);
  const values = useMemo(() => new Map(squad.map((p) => [p.id, playerMarket(game, p.id)])), [squad, game]);

  const val = (p: Player): number | string => {
    const c = conditionOf(p);
    const st = seasonStats(p, season, game.userClubId);
    switch (sort.key) {
      case 'pos':
        return LINE_ORDER[POSITION_LINE[p.position]] * 100 - overall(p) / 100;
      case 'name':
        return p.name;
      case 'age':
        return ageInSeason(p, season);
      case 'overall':
        return overall(p);
      case 'fitness':
        return c.fitness;
      case 'morale':
        return c.morale;
      case 'form':
        return c.form;
      case 'pj':
        return st.pj;
      case 'goals':
        return st.goals;
      case 'avg':
        return st.avg ?? 0;
      case 'wage':
        return p.contract?.wage ?? 0;
      case 'until':
        return p.contract?.untilSeason ?? 0;
      case 'value':
        return values.get(p.id)?.value ?? 0;
    }
  };
  const sorted = [...squad].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sort.desc ? -cmp : cmp;
  });
  const th = (key: SortKey, label: string, title?: string, cls = '') => (
    <th className={cls}>
      <button className="th-btn" title={title} onClick={() => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' && key !== 'pos' }))}>
        {label}
        {sort.key === key && <span className="th-btn__dir">{sort.desc ? '▼' : '▲'}</span>}
      </button>
    </th>
  );

  const wages = squad.reduce((s, p) => s + (p.contract?.wage ?? 0), 0);
  const listed = new Set(game.market.transferList);
  const loanable = new Set(game.market.loanList);
  const injuredList = squad.filter((p) => conditionOf(p).injuryDays > 0).sort((a, b) => conditionOf(b).injuryDays - conditionOf(a).injuryDays);
  const medText = injuredList.length
    ? `En la enfermería ${injuredList.length === 1 ? 'tengo a uno' : `tengo ${injuredList.length}`}: ${injuredList
        .slice(0, 4)
        .map((p) => `${p.name} (${conditionOf(p).injuryDays} d)`)
        .join(', ')}${injuredList.length > 4 ? ' y otros' : ''}. Hacemos lo posible para que vuelvan rápido.`
    : 'El plantel está sano, no tengo a nadie en la camilla. Cuidalos, que así da gusto trabajar.';
  const expiring = squad.filter((p) => (p.contract?.untilSeason ?? season + 1) <= season).sort((a, b) => overall(b) - overall(a));
  const secText = expiring.length
    ? `A fin de temporada ${expiring.length === 1 ? 'se te vence el contrato de' : `se vencen ${expiring.length} contratos:`} ${expiring
        .slice(0, 4)
        .map((p) => p.name)
        .join(', ')}${expiring.length > 4 ? ' y otros' : ''}. Usá «Renovar» antes de que los tienten de afuera.`
    : 'No hay contratos por vencer esta temporada. Los papeles están en orden.';
  const unavailable = squad.filter((p) => conditionOf(p).injuryDays > 0 || conditionOf(p).suspensionMatches > 0).length;

  return (
    <div className="stack">
      <div className="chips" role="tablist">
        <button role="tab" aria-selected={tab === 'plantel'} className={'chip' + (tab === 'plantel' ? ' chip--active' : '')} onClick={() => setTab('plantel')}>
          Plantel profesional ({squad.length})
        </button>
        <button role="tab" aria-selected={tab === 'cantera'} className={'chip' + (tab === 'cantera' ? ' chip--active' : '')} onClick={() => setTab('cantera')}>
          Cantera ({youth.length})
        </button>
      </div>
      {message && (
        <p className="notice" onClick={() => setMessage(null)}>
          {message}
        </p>
      )}

      {tab === 'plantel' && (
        <>
          <div className="persona-row">
            <div className="persona-panel">
              <PersonaMessage persona={personaFor(game, 'medico')} text={medText} variant="compact" tone={injuredList.length ? 'atencion' : undefined} />
            </div>
            {game.scope !== 'entrenador' && (
              <div className="persona-panel">
                <PersonaMessage persona={personaFor(game, 'secretario-tecnico')} text={secText} variant="compact" />
              </div>
            )}
          </div>
          <div className="strip-stats">
            <div>
              <span>Jugadores</span>
              <b>{squad.length}</b>
            </div>
            <div>
              <span>Bajas (les./susp.)</span>
              <b>{unavailable}</b>
            </div>
            <div>
              <span>Masa salarial</span>
              <b>{money(wages)}/mes</b>
            </div>
            <div>
              <span>En venta / cesión</span>
              <b>
                {squad.filter((p) => listed.has(p.id)).length} / {squad.filter((p) => loanable.has(p.id)).length}
              </b>
            </div>
            <div>
              <span>Valor del plantel</span>
              <b>{money([...values.values()].reduce((s, v) => s + v.value, 0))}</b>
            </div>
          </div>
          <Panel title="Plantel profesional" aside={<span className="muted small">Tocá un nombre para ver la ficha</span>} flush>
            <div className="table-wrap">
              <table className="grid-table grid-table--plantel">
                <thead>
                  <tr>
                    {th('pos', 'Pos', 'Posición', 'left')}
                    {th('name', 'Jugador', undefined, 'left')}
                    {th('age', 'Edad')}
                    {th('overall', 'Med', 'Media')}
                    {th('fitness', 'Físico', 'Estado físico')}
                    {th('morale', 'Mor', 'Moral', 'hide-sm')}
                    {th('form', 'For', 'Forma', 'hide-sm')}
                    <th>Estado</th>
                    {th('pj', 'PJ', 'Partidos jugados')}
                    {th('goals', 'G', 'Goles')}
                    <th className="hide-sm" title="Asistencias">
                      A
                    </th>
                    <th className="hide-sm" title="Tarjetas amarillas / rojas">
                      TA/TR
                    </th>
                    {th('avg', 'Prom', 'Puntaje promedio')}
                    {th('wage', 'Sueldo', 'Sueldo mensual', 'hide-sm')}
                    {th('until', 'Hasta', 'Contrato hasta', 'hide-sm')}
                    {th('value', 'Valor', 'Valor de mercado', 'hide-sm')}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const c = conditionOf(p);
                    const st = seasonStats(p, season, game.userClubId);
                    const line = POSITION_LINE[p.position];
                    const ending = (p.contract?.untilSeason ?? season) <= season;
                    return (
                      <tr key={p.id} className={listed.has(p.id) || loanable.has(p.id) ? 'row--listed' : ''}>
                        <td className="left">
                          <span className={`pos pos--${line.toLowerCase()}`} title={POSITION_LABEL[p.position]}>
                            {p.position}
                          </span>
                        </td>
                        <td className="left">
                          <button className="link player-name" onClick={() => pickPlayer?.(p)}>
                            {p.name}
                          </button>
                        </td>
                        <td>{ageInSeason(p, season)}</td>
                        <td>
                          <Rating value={overall(p)} />
                        </td>
                        <td className="cell-bar" title={`${Math.round(c.fitness)}%`}>
                          <Bar value={c.fitness} max={100} tone={c.fitness < 60 ? 'down' : c.fitness >= 85 ? 'up' : undefined} />
                        </td>
                        <td className="hide-sm">{Math.round(c.morale)}</td>
                        <td className="hide-sm">{Math.round(c.form)}</td>
                        <td>
                          <StatusBadge p={p} />
                        </td>
                        <td>{st.pj}</td>
                        <td>{st.goals}</td>
                        <td className="hide-sm">{st.assists}</td>
                        <td className="hide-sm">
                          {st.yellow}/{st.red}
                        </td>
                        <td>{st.avg ? st.avg.toFixed(2) : '—'}</td>
                        <td className="hide-sm">{p.contract ? money(p.contract.wage) : '—'}</td>
                        <td className={'hide-sm' + (ending ? ' neg strong' : '')}>{p.contract?.untilSeason ?? '—'}</td>
                        <td className="hide-sm">{money(values.get(p.id)?.value ?? 0)}</td>
                        <td>
                          {/* Coach-only careers: the club handles sales, loans and contracts. */}
                          {game.scope === 'entrenador' ? (
                            <span className="muted small">—</span>
                          ) : (
                          <span className="row-actions">
                            <button
                              className={'btn btn--xs' + (listed.has(p.id) ? ' btn--on' : '')}
                              title="Declarar transferible"
                              onClick={() => update(toggleTransferList(game, p.id, 'transferList'))}
                            >
                              Venta
                            </button>
                            <button
                              className={'btn btn--xs' + (loanable.has(p.id) ? ' btn--on' : '')}
                              title="Ofrecer a préstamo"
                              onClick={() => update(toggleTransferList(game, p.id, 'loanList'))}
                            >
                              Cesión
                            </button>
                            <button className="btn btn--xs" onClick={() => setRenew(p)}>
                              Renovar
                            </button>
                          </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {tab === 'cantera' && (
        <Panel title="Cantera" aside={<span className="muted small">Los juveniles no cuentan para el plantel ni la alineación</span>} flush>
          {youth.length === 0 && <p className="empty">No hay juveniles en la cantera.</p>}
          {youth.length > 0 && (
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="left">Pos</th>
                    <th className="left">Jugador</th>
                    <th>Edad</th>
                    <th>Media</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {[...youth]
                    .sort((a, b) => overall(b) - overall(a))
                    .map((p) => (
                      <tr key={p.id}>
                        <td className="left">
                          <span className={`pos pos--${POSITION_LINE[p.position].toLowerCase()}`} title={POSITION_LABEL[p.position]}>
                            {p.position}
                          </span>
                        </td>
                        <td className="left">
                          <button className="link player-name" onClick={() => pickPlayer?.(p)}>
                            {p.name}
                          </button>
                        </td>
                        <td>{ageInSeason(p, season)}</td>
                        <td>
                          <Rating value={overall(p)} />
                        </td>
                        <td>
                          <button
                            className="btn btn--primary btn--xs"
                            onClick={() => {
                              update(promoteYouth(game, p.id));
                              setMessage(`${p.name} subió al plantel profesional.`);
                            }}
                          >
                            Subir al plantel
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {renew && (
        <RenewDialog
          game={game}
          player={renew}
          onClose={() => setRenew(null)}
          onResult={(g, ok) => {
            if (ok) update(g);
            setMessage(ok ? `${renew.name} firmó la renovación.` : `${renew.name} rechazó la propuesta de renovación.`);
            setRenew(null);
          }}
        />
      )}
    </div>
  );
}

/** Simple contract offer: monthly wage and last season. */
export function RenewDialog({
  game,
  player,
  onClose,
  onResult,
}: {
  game: GameState;
  player: Player;
  onClose: () => void;
  onResult: (g: GameState, accepted: boolean) => void;
}) {
  const fair = playerMarket(game, player.id).wage;
  const season = game.world.season;
  const [wage, setWage] = useState(Math.round(Math.max(fair, player.contract?.wage ?? 0) / 100) * 100);
  const [until, setUntil] = useState(Math.min(season + 5, Math.max(season + 2, (player.contract?.untilSeason ?? season) + 1)));
  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <form
        className="panel dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Renovar a ${player.name}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          const r = renewContract(game, player.id, { ...player.contract, wage, untilSeason: until });
          onResult(r.game, r.accepted);
        }}
      >
        <header className="panel__head">
          <h3 className="panel__title">Renovar a {player.name}</h3>
        </header>
        <div className="panel__body dialog__body">
          <p className="muted small">
            Contrato actual: {player.contract ? `${money(player.contract.wage)}/mes hasta ${player.contract.untilSeason}` : 'sin contrato'}. Sueldo de mercado: {money(fair)}/mes.
          </p>
          <label className="field">
            <span>Sueldo mensual (US$)</span>
            <input type="number" min={0} step={100} value={wage} onChange={(e) => setWage(Math.max(0, Number(e.target.value)))} />
          </label>
          <label className="field">
            <span>Hasta la temporada</span>
            <select value={until} onChange={(e) => setUntil(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={season + n}>
                  {season + n}
                </option>
              ))}
            </select>
          </label>
          <div className="dialog__actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary">
              Ofrecer contrato
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
