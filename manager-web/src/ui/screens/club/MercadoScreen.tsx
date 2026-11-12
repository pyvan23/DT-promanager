import { useMemo, useState } from 'react';
import { clubOf, makeOffer, playerMarket, respondToOffer, toggleShortlist, toggleTransferList, type GameState } from '../../../engine/game/game';
import { isWindowOpen, searchPlayers, type SearchFilters } from '../../../engine/market';
import { POSITION_LINE, type Line, type Player, type Position } from '../../../engine/types';
import { ClubBadge, ClubLabel } from '../../components/ClubBadge';
import { Bar, Panel, Rating } from '../../components/Panel';
import { ageInSeason, ATTRIBUTES, countryName, overall, POSITION_LABEL } from '../../format';
import { alerts } from '../../../engine/game/alerts';
import { PersonaMessage } from '../../personas/PersonaMessage';
import { personaFor } from '../../personas/personas';
import { PosTag, StatStrip } from './shared';
import { fmtDate, money, type ScreenProps } from './util';

const LINES: { id: Line; label: string }[] = [
  { id: 'ARQ', label: 'Arqueros' },
  { id: 'DEF', label: 'Defensores' },
  { id: 'MED', label: 'Mediocampistas' },
  { id: 'DEL', label: 'Delanteros' },
];
const POSITIONS = Object.keys(POSITION_LABEL) as Position[];
const MAX_VALUES = [100e3, 250e3, 500e3, 1e6, 2e6, 5e6, 10e6, 25e6, 50e6];
const LINE_ORDER: Record<Line, number> = { ARQ: 0, DEF: 1, MED: 2, DEL: 3 };
const PAGE_SIZE = 20;

interface Filters {
  pos: string; // '' | 'line:DEF' | 'pos:DFC'
  minAge: string;
  maxAge: string;
  minOverall: string;
  maxValue: string;
  country: string;
  divisionId: string;
  listed: boolean;
  free: boolean;
  name: string;
  sortBy: NonNullable<SearchFilters['sortBy']>;
}

const EMPTY: Filters = { pos: '', minAge: '', maxAge: '', minOverall: '', maxValue: '', country: '', divisionId: '', listed: false, free: false, name: '', sortBy: 'overall' };

const optNum = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s));

function windowStatus(game: GameState): { open: boolean; text: string } {
  const date = game.calendar.date;
  const windows = [...game.market.windows].sort((a, b) => a.from.localeCompare(b.from));
  const current = windows.find((w) => w.from <= date && date <= w.to);
  if (current && isWindowOpen(windows, date)) return { open: true, text: `Abierto del ${fmtDate(current.from)} al ${fmtDate(current.to)}` };
  const next = windows.find((w) => w.from > date);
  return { open: false, text: next ? `Cerrado · abre el ${fmtDate(next.from)} (hasta el ${fmtDate(next.to)})` : 'Cerrado hasta la próxima temporada' };
}

export function MercadoScreen({ game, update }: ScreenProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { world } = game;
  const season = world.season;
  const fin = game.club.finances;
  const status = windowStatus(game);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const countries = useMemo(() => [...new Set(world.clubs.map((c) => c.country))].sort((a, b) => countryName(a).localeCompare(countryName(b))), [world.clubs]);
  const divisions = useMemo(
    () => world.divisions.filter((d) => !filters.country || d.country === filters.country).sort((a, b) => a.country.localeCompare(b.country) || a.level - b.level),
    [world.divisions, filters.country],
  );

  const result = useMemo(() => {
    const sf: SearchFilters = {
      // With "solo transferibles" the user's own list is what is published, so the own squad is not excluded.
      excludeClubId: filters.listed ? undefined : game.userClubId,
      minAge: optNum(filters.minAge),
      maxAge: optNum(filters.maxAge),
      minOverall: optNum(filters.minOverall),
      maxValue: optNum(filters.maxValue),
      country: filters.free ? undefined : filters.country || undefined,
      divisionId: filters.free ? undefined : filters.divisionId || undefined,
      transferListedOnly: filters.listed || undefined,
      transferList: game.market.transferList,
      freeAgentsOnly: filters.free || undefined,
      name: filters.name.trim() || undefined,
      sortBy: filters.sortBy,
      page,
      pageSize: PAGE_SIZE,
      season,
    };
    if (filters.pos.startsWith('line:')) sf.line = filters.pos.slice(5) as Line;
    else if (filters.pos.startsWith('pos:')) sf.position = filters.pos.slice(4) as Position;
    return searchPlayers(world, sf);
  }, [world, filters, page, season, game.userClubId, game.market.transferList]);

  const selected = selectedId ? world.players.find((p) => p.id === selectedId) ?? null : null;
  const shortlisted = game.club.shortlist.map((id) => world.players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  const incoming = game.market.offers.filter((o) => o.toClubId === game.userClubId && o.status === 'pendiente');
  const squad = world.players
    .filter((p) => p.clubId === game.userClubId && !p.youth)
    .sort((a, b) => LINE_ORDER[POSITION_LINE[a.position]] - LINE_ORDER[POSITION_LINE[b.position]] || overall(b) - overall(a));
  const nameOf = (id: string) => world.players.find((p) => p.id === id)?.name ?? id;
  const clubById = (id: string | null) => (id ? world.clubs.find((c) => c.id === id) : undefined);
  const star = (id: string) => {
    const on = game.club.shortlist.includes(id);
    return (
      <button className={`cl-star${on ? ' is-on' : ''}`} title={on ? 'Sacar de la cartera' : 'Agregar a la cartera'} aria-pressed={on} onClick={(e) => { e.stopPropagation(); update(toggleShortlist(game, id)); }}>
        ★
      </button>
    );
  };

  // The scout recommends the same upgrade the inbox suggests; the agent talks about the offers.
  const tip = useMemo(() => alerts(game).find((a) => a.id === 'market'), [game]);
  const scout = personaFor(game, 'ojeador');
  const scoutText = tip
    ? `Encontré un jugador que te puede servir: ${tip.title.replace(/^.*?: /, '')}. ${tip.body}`
    : status.open
      ? `Sigo recorriendo canchas: por ahora no vi a nadie que mejore el equipo con ${money(fin.transferBudget)}. Usá el buscador y te paso los informes.`
      : 'Con el mercado cerrado sigo mirando partidos; cuando abra el libro de pases te paso nombres.';
  const bestOffer = [...incoming].sort((a, b) => b.fee - a.fee)[0];
  const agentText = bestOffer
    ? `Tengo ${incoming.length === 1 ? 'una oferta' : `${incoming.length} ofertas`} para vos. La más jugosa: ${money(bestOffer.fee)} de ${clubById(bestOffer.fromClubId)?.shortName ?? 'un club'} por ${nameOf(bestOffer.playerId)}. Yo que vos no la dejo pasar, eh.`
    : '';

  return (
    <div className="stack cl-screen">
      <div className="persona-panel">
        <PersonaMessage
          persona={scout}
          text={scoutText}
          variant="compact"
          tone={tip ? 'bueno' : undefined}
          actions={tip?.playerId ? <button className="btn btn--xs btn--primary" onClick={() => setSelectedId(tip.playerId!)}>Ver la ficha</button> : undefined}
        />
      </div>
      <StatStrip
        items={[
          { label: 'Mercado de pases', value: <span className={status.open ? 'cl-up' : 'cl-down'}>{status.open ? 'Abierto' : 'Cerrado'}</span>, hint: status.text },
          { label: 'Presupuesto de fichajes', value: money(fin.transferBudget) },
          { label: 'Saldo', value: <span className={fin.balance < 0 ? 'cl-down' : undefined}>{money(fin.balance)}</span> },
          { label: 'Ofertas recibidas', value: incoming.length },
        ]}
      />

      <div className="cl-two">
        <Panel title="Buscador de jugadores" aside={<span className="muted">{result.total.toLocaleString('es-AR')} resultados</span>} flush>
          <div className="cl-filters">
            <label className="cl-field cl-field--wide">
              <span>Nombre</span>
              <input className="search" value={filters.name} placeholder="Buscar por nombre…" onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="cl-field">
              <span>Posición</span>
              <select value={filters.pos} onChange={(e) => set('pos', e.target.value)}>
                <option value="">Todas</option>
                <optgroup label="Línea">
                  {LINES.map((l) => <option key={l.id} value={`line:${l.id}`}>{l.label}</option>)}
                </optgroup>
                <optgroup label="Puesto">
                  {POSITIONS.map((p) => <option key={p} value={`pos:${p}`}>{POSITION_LABEL[p]}</option>)}
                </optgroup>
              </select>
            </label>
            <label className="cl-field">
              <span>Edad</span>
              <span className="cl-range">
                <input type="number" min={15} max={45} placeholder="mín" value={filters.minAge} onChange={(e) => set('minAge', e.target.value)} />
                <input type="number" min={15} max={45} placeholder="máx" value={filters.maxAge} onChange={(e) => set('maxAge', e.target.value)} />
              </span>
            </label>
            <label className="cl-field">
              <span>Media mínima</span>
              <input type="number" min={1} max={99} placeholder="—" value={filters.minOverall} onChange={(e) => set('minOverall', e.target.value)} />
            </label>
            <label className="cl-field">
              <span>Valor máximo</span>
              <select value={filters.maxValue} onChange={(e) => set('maxValue', e.target.value)}>
                <option value="">Sin tope</option>
                <option value={String(fin.transferBudget)}>Mi presupuesto ({money(fin.transferBudget)})</option>
                {MAX_VALUES.map((v) => <option key={v} value={String(v)}>{money(v)}</option>)}
              </select>
            </label>
            <label className="cl-field">
              <span>País</span>
              <select value={filters.country} disabled={filters.free} onChange={(e) => { setFilters((f) => ({ ...f, country: e.target.value, divisionId: '' })); setPage(0); }}>
                <option value="">Todos</option>
                {countries.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
              </select>
            </label>
            <label className="cl-field">
              <span>División</span>
              <select value={filters.divisionId} disabled={filters.free} onChange={(e) => set('divisionId', e.target.value)}>
                <option value="">Todas</option>
                {divisions.map((d) => <option key={d.id} value={d.id}>{filters.country ? d.name : `${d.name} (${countryName(d.country)})`}</option>)}
              </select>
            </label>
            <label className="cl-field">
              <span>Ordenar por</span>
              <select value={filters.sortBy} onChange={(e) => set('sortBy', e.target.value as Filters['sortBy'])}>
                <option value="overall">Media</option>
                <option value="value">Valor</option>
                <option value="age">Edad</option>
                <option value="name">Nombre</option>
              </select>
            </label>
            <div className="cl-checks">
              <label><input type="checkbox" checked={filters.listed} onChange={(e) => set('listed', e.target.checked)} /> Solo transferibles</label>
              <label><input type="checkbox" checked={filters.free} onChange={(e) => set('free', e.target.checked)} /> Libres</label>
              <button className="link" onClick={() => { setFilters(EMPTY); setPage(0); }}>Limpiar</button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th className="left">Jugador</th>
                  <th>Edad</th>
                  <th className="left hide-sm">Club</th>
                  <th>Media</th>
                  <th>Valor</th>
                  <th aria-label="Cartera" />
                </tr>
              </thead>
              <tbody>
                {result.results.map((r) => (
                  <tr key={r.player.id} className={`is-clickable${r.player.id === selectedId ? ' is-selected' : ''}`} onClick={() => setSelectedId(r.player.id)}>
                    <td><PosTag position={r.player.position} /></td>
                    <td className="left player-name">{r.player.name}</td>
                    <td>{r.age}</td>
                    <td className="left hide-sm">{r.club ? <ClubLabel club={r.club} short /> : <span className="muted">Libre</span>}</td>
                    <td><Rating value={r.overall} /></td>
                    <td>{money(r.value)}</td>
                    <td>{star(r.player.id)}</td>
                  </tr>
                ))}
                {result.results.length === 0 && (
                  <tr><td colSpan={7} className="empty">No hay jugadores con esos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="cl-pager">
            <button className="btn btn--xs" disabled={result.page <= 0} onClick={() => setPage(result.page - 1)}>‹ Anterior</button>
            <span className="small muted">Página {result.page + 1} de {result.pages}</span>
            <button className="btn btn--xs" disabled={result.page >= result.pages - 1} onClick={() => setPage(result.page + 1)}>Siguiente ›</button>
          </div>
        </Panel>

        <div className="stack cl-sticky">
          {selected ? (
            <PlayerFile key={selected.id} game={game} update={update} player={selected} windowOpen={status.open} onClose={() => setSelectedId(null)} star={star(selected.id)} />
          ) : (
            <Panel title="Ficha">
              <p className="muted">Elegí un jugador del buscador o de tu cartera para ver su ficha y hacer una oferta.</p>
            </Panel>
          )}

          <Panel title="Cartera de seguimiento" aside={<span className="muted">{shortlisted.length}</span>} flush>
            {shortlisted.length === 0 ? (
              <p className="empty">Marcá jugadores con ★ para seguirlos.</p>
            ) : (
              <table className="grid-table">
                <tbody>
                  {shortlisted.map((p) => (
                    <tr key={p.id} className={`is-clickable${p.id === selectedId ? ' is-selected' : ''}`} onClick={() => setSelectedId(p.id)}>
                      <td><PosTag position={p.position} /></td>
                      <td className="left player-name">{p.name}</td>
                      <td className="left hide-sm">{p.clubId ? <ClubLabel club={clubById(p.clubId)} short /> : <span className="muted">Libre</span>}</td>
                      <td><Rating value={overall(p)} /></td>
                      <td>{money(playerMarket(game, p.id).value)}</td>
                      <td>{star(p.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>

      <div className="cl-two">
        <Panel title="Ofertas recibidas" aside={<span className="muted">{incoming.length} pendientes</span>} flush>
          {bestOffer && (
            <div className="cl-pad">
              <PersonaMessage persona={personaFor(game, 'representante')} text={agentText} variant="compact" />
            </div>
          )}
          {incoming.length === 0 ? (
            <p className="empty">{status.open ? 'Nadie ofertó por tus jugadores todavía.' : 'Con el mercado cerrado no llegan ofertas.'}</p>
          ) : (
            <div className="table-wrap">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th className="left">Jugador</th>
                    <th className="left">Club</th>
                    <th>Tipo</th>
                    <th>Oferta</th>
                    <th>Valor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {incoming.map((o) => {
                    const value = world.players.some((p) => p.id === o.playerId) ? playerMarket(game, o.playerId).value : 0;
                    return (
                      <tr key={o.id}>
                        <td className="left player-name">{nameOf(o.playerId)}</td>
                        <td className="left"><ClubLabel club={clubById(o.fromClubId)} short /></td>
                        <td>{o.kind === 'cesion' ? 'Cesión' : 'Traspaso'}</td>
                        <td className={o.fee >= value ? 'cl-up strong' : 'strong'}>{money(o.fee)}</td>
                        <td className="muted">{money(value)}</td>
                        <td>
                          <span className="cl-actions">
                            <button className="btn btn--xs btn--primary" onClick={() => update(respondToOffer(game, o.id, true))}>Aceptar</button>
                            <button className="btn btn--xs" onClick={() => update(respondToOffer(game, o.id, false))}>Rechazar</button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Transferibles y cedibles" aside={<span className="muted">{game.market.transferList.length} T · {game.market.loanList.length} C</span>} flush>
          <div className="table-wrap cl-scroll">
            <table className="grid-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th className="left">Jugador</th>
                  <th>Edad</th>
                  <th>Media</th>
                  <th>Valor</th>
                  <th>Lista</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((p) => {
                  const t = game.market.transferList.includes(p.id);
                  const c = game.market.loanList.includes(p.id);
                  return (
                    <tr key={p.id} className={t || c ? 'row--mine' : undefined}>
                      <td><PosTag position={p.position} /></td>
                      <td className="left">{p.name}</td>
                      <td>{ageInSeason(p, season)}</td>
                      <td><Rating value={overall(p)} /></td>
                      <td>{money(playerMarket(game, p.id).value)}</td>
                      <td>
                        <span className="cl-actions">
                          <button className={`chip${t ? ' chip--active' : ''}`} aria-pressed={t} title="Declarar transferible" onClick={() => update(toggleTransferList(game, p.id, 'transferList'))}>Transferible</button>
                          <button className={`chip${c ? ' chip--active' : ''}`} aria-pressed={c} title="Declarar cedible" onClick={() => update(toggleTransferList(game, p.id, 'loanList'))}>Cedible</button>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ player file + offer form

function PlayerFile({ game, update, player, windowOpen, onClose, star }: ScreenProps & { player: Player; windowOpen: boolean; onClose: () => void; star: React.ReactNode }) {
  const season = game.world.season;
  const club = player.clubId ? game.world.clubs.find((c) => c.id === player.clubId) : undefined;
  const { value, wage } = playerMarket(game, player.id);
  const mine = player.clubId === game.userClubId;
  const budget = game.club.finances.transferBudget;

  const [kind, setKind] = useState<'traspaso' | 'cesion'>('traspaso');
  const [fee, setFee] = useState(Math.min(value, Math.max(0, budget)) || value);
  const [offerWage, setOfferWage] = useState(wage);
  const [years, setYears] = useState(3);
  const [answer, setAnswer] = useState<{ status: string; message: string; counterFee?: number } | null>(null);

  const submit = (amount: number) => {
    const contract = { wage: Math.max(0, Math.round(offerWage)), untilSeason: season + (kind === 'cesion' ? 0 : years - 1) };
    const out = makeOffer(game, player.id, Math.max(0, Math.round(amount)), contract, kind);
    setFee(amount);
    setAnswer({ status: out.status, message: out.message, counterFee: out.counterFee });
    if (out.game !== game) update(out.game);
  };

  const blocked = mine
    ? 'Es jugador de tu plantel.'
    : !player.clubId
      ? 'Los jugadores libres no se pueden fichar con una oferta a un club.'
      : !windowOpen
        ? 'El mercado de pases está cerrado.'
        : null;
  const overBudget = kind === 'traspaso' && fee > budget;

  return (
    <Panel title="Ficha" aside={<span className="cl-actions">{star}<button className="link" onClick={onClose}>Cerrar</button></span>}>
      <div className="cl-file">
        <div className="cl-file__head">
          <ClubBadge club={club} size={40} />
          <div className="cl-file__id">
            <span className="kicker">{club ? clubOf(game.world, club.id).shortName : 'Libre'} · {countryName(player.nationality)}</span>
            <h3 className="cl-file__name">{player.name}</h3>
            <span className="muted small">{POSITION_LABEL[player.position]} · {ageInSeason(player, season)} años</span>
          </div>
          <Rating value={overall(player)} />
        </div>
        <dl className="kv-inline cl-file__kv">
          <div><dt>Valor</dt><dd>{money(value)}</dd></div>
          <div><dt>Sueldo justo</dt><dd>{money(wage)}/mes</dd></div>
          <div><dt>Contrato</dt><dd>{player.contract ? `${money(player.contract.wage)}/mes hasta ${player.contract.untilSeason}` : '—'}</dd></div>
          {player.contract?.releaseClause ? <div><dt>Cláusula</dt><dd>{money(player.contract.releaseClause)}</dd></div> : null}
        </dl>
        <ul className="attr-list cl-attrs">
          {ATTRIBUTES.filter((a) => (player.position === 'ARQ' ? true : a.key !== 'goalkeeping')).map((a) => (
            <li key={a.key}>
              <span className="attr-list__label">{a.label}</span>
              <Bar value={player.attributes[a.key]} />
              <span className="attr-list__value">{player.attributes[a.key]}</span>
            </li>
          ))}
        </ul>

        <form className="cl-offer" onSubmit={(e) => { e.preventDefault(); submit(fee); }}>
          <h4 className="cl-subtitle">Hacer una oferta</h4>
          {blocked && <p className="notice">{blocked}</p>}
          <div className="chips">
            <button type="button" className={`chip${kind === 'traspaso' ? ' chip--active' : ''}`} onClick={() => setKind('traspaso')}>Traspaso</button>
            <button type="button" className={`chip${kind === 'cesion' ? ' chip--active' : ''}`} onClick={() => { setKind('cesion'); setFee((f) => Math.min(f, Math.round(value * 0.1))); }}>Cesión</button>
          </div>
          <label className="cl-field">
            <span>{kind === 'cesion' ? 'Monto de la cesión' : 'Monto del traspaso'} · {money(fee)}</span>
            <input type="number" min={0} step={5000} value={fee} onChange={(e) => setFee(Number(e.target.value) || 0)} />
          </label>
          <label className="cl-field">
            <span>Sueldo mensual · {money(offerWage)}</span>
            <input type="number" min={0} step={100} value={offerWage} onChange={(e) => setOfferWage(Number(e.target.value) || 0)} />
          </label>
          {kind === 'traspaso' && (
            <label className="cl-field">
              <span>Años de contrato · hasta {season + years - 1}</span>
              <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
                {[1, 2, 3, 4, 5].map((y) => <option key={y} value={y}>{y} {y === 1 ? 'año' : 'años'}</option>)}
              </select>
            </label>
          )}
          {overBudget && <p className="small cl-down">Supera tu presupuesto de fichajes ({money(budget)}).</p>}
          <button className="btn btn--primary btn--sm" type="submit" disabled={!!blocked || overBudget}>Enviar oferta</button>
          {answer && (
            <div className={`cl-answer cl-answer--${answer.status}`} role="status">
              <b>{answer.status === 'aceptada' ? 'Aceptada' : answer.status === 'contraoferta' ? 'Contraoferta' : 'Rechazada'}</b>
              <span>{answer.message}</span>
              {answer.status === 'contraoferta' && answer.counterFee !== undefined && !blocked && (
                <button type="button" className="btn btn--xs btn--primary" disabled={kind === 'traspaso' && answer.counterFee > budget} onClick={() => submit(answer.counterFee!)}>
                  Ofrecer {money(answer.counterFee)}
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </Panel>
  );
}
