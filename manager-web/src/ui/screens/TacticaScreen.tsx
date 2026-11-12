import { useMemo, useState } from 'react';
import { setLineup, setTactics } from '../../engine/game/game';
import { conditionOf, userSheet } from '../../engine/game/matchday-bridge';
import { autoLineup, FORMATION_SLOTS, FORMATIONS, isAvailable, slotRating } from '../../engine/matchday';
import type { Formation, Lineup, Tactics } from '../../engine/game-types';
import { POSITION_LINE, type Player } from '../../engine/types';
import { Panel, Rating } from '../components/Panel';
import { overall, shortPlayerName } from '../format';
import { StatusBadge } from './PlantelScreen';
import { MARKING_LABEL, MENTALITY_LABEL, PRESSING_LABEL, TEMPO_LABEL, type ScreenProps } from './shared';

type Loc = { area: 'xi'; i: number } | { area: 'bench'; i: number } | { area: 'res'; id: string };

/** Tactics selectors, shared with the live match. */
export function TacticsForm({ tactics, onChange, compact = false }: { tactics: Tactics; onChange: (t: Tactics) => void; compact?: boolean }) {
  const sel = <K extends keyof Tactics>(key: K, label: string, options: Record<string, string>) => (
    <label className="field">
      <span>{label}</span>
      <select value={tactics[key]} onChange={(e) => onChange({ ...tactics, [key]: e.target.value as Tactics[K] })}>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className={'tactics-form' + (compact ? ' tactics-form--compact' : '')}>
      {sel('formation', 'Formación', Object.fromEntries(FORMATIONS.map((f) => [f, f])))}
      {sel('mentality', 'Mentalidad', MENTALITY_LABEL)}
      {sel('pressing', 'Presión', PRESSING_LABEL)}
      {sel('tempo', 'Ritmo', TEMPO_LABEL)}
      {sel('marking', 'Marca', MARKING_LABEL)}
    </div>
  );
}

/** Players drawn on the chalkboard at the formation's coordinates (own goal at the bottom). */
export function PitchBoard({
  formation,
  starters,
  players,
  selected,
  onSlot,
  energy,
}: {
  formation: Formation;
  starters: (string | undefined)[];
  players: Map<string, Player>;
  selected?: number | null;
  onSlot?: (i: number) => void;
  /** Live energy per player (live match). */
  energy?: Record<string, number>;
}) {
  const slots = FORMATION_SLOTS[formation];
  return (
    <div className="pizarra">
      <svg className="pizarra__lines" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
        <g fill="none" stroke="var(--chalk)" strokeWidth="0.5" strokeLinecap="round" opacity="0.75">
          <rect x="4" y="4" width="92" height="132" rx="1" />
          <line x1="4" y1="70" x2="96" y2="70" />
          <circle cx="50" cy="70" r="11" />
          <rect x="26" y="4" width="48" height="20" />
          <rect x="38" y="4" width="24" height="8" />
          <rect x="26" y="116" width="48" height="20" />
          <rect x="38" y="128" width="24" height="8" />
          <path d="M40 24 A11 11 0 0 0 60 24" />
          <path d="M40 116 A11 11 0 0 1 60 116" />
        </g>
      </svg>
      <span className="pizarra__title">{formation}</span>
      {slots.map((slot, i) => {
        const id = starters[i];
        const p = id ? players.get(id) : undefined;
        const out = p && !isAvailable(p.condition);
        const rating = p ? Math.round(slotRating(p, slot.position)) : null;
        const misplaced = p && p.position !== slot.position && !p.altPositions.includes(slot.position);
        const fit = p ? (energy?.[p.id] ?? conditionOf(p).fitness) : 0;
        return (
          <button
            key={i}
            className={'pizarra__player' + (selected === i ? ' is-selected' : '') + (out ? ' is-out' : '') + (misplaced ? ' is-misplaced' : '')}
            style={{ left: `${slot.x}%`, top: `${4 + (100 - slot.y) * 0.9}%` }}
            onClick={() => onSlot?.(i)}
            title={p ? `${p.name} · ${p.position} en ${slot.position}` : `Puesto vacío: ${slot.position}`}
            type="button"
          >
            <span className="pizarra__dot">{rating ?? '?'}</span>
            <span className="pizarra__name">{p ? shortPlayerName(p.name) : '—'}</span>
            <span className="pizarra__pos">{slot.position}</span>
            {p && (
              <span className="pizarra__fit" aria-label={`Físico ${Math.round(fit)}`}>
                <span style={{ width: `${fit}%` }} className={fit < 60 ? 'low' : ''} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TacticaScreen({ game, update, pickPlayer }: ScreenProps) {
  const squad = useMemo(() => game.world.players.filter((p) => p.clubId === game.userClubId && !p.youth), [game.world.players, game.userClubId]);
  const players = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);
  const tactics = game.club.tactics;
  const saved = useMemo(() => userSheet(game).lineup, [game]);
  const [draft, setDraft] = useState<Lineup>(saved);
  const [sel, setSel] = useState<Loc | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Drop players that left the club since the draft was made.
  const starters = draft.starters.map((id) => (players.has(id) ? id : undefined));
  const bench = draft.bench.filter((id) => players.has(id));
  const used = new Set([...starters, ...bench].filter(Boolean) as string[]);
  const reserves = squad.filter((p) => !used.has(p.id)).sort((a, b) => POSITION_LINE[a.position].localeCompare(POSITION_LINE[b.position]) || overall(b) - overall(a));
  const dirty = JSON.stringify({ s: draft.starters, b: draft.bench }) !== JSON.stringify({ s: game.club.lineup?.starters, b: game.club.lineup?.bench });

  const idAt = (l: Loc) => (l.area === 'xi' ? starters[l.i] : l.area === 'bench' ? bench[l.i] : l.id);
  const same = (a: Loc, b: Loc) => a.area === b.area && (a.area === 'res' ? a.id === (b as { id: string }).id : a.i === (b as { i: number }).i);

  const click = (l: Loc) => {
    if (!sel) return setSel(l);
    if (same(sel, l)) return setSel(null);
    if (sel.area === 'res' && l.area === 'res') return setSel(l);
    const a = idAt(sel);
    const b = idAt(l);
    const xi = [...starters];
    const bn = [...bench];
    const put = (loc: Loc, id: string | undefined) => {
      if (loc.area === 'xi') xi[loc.i] = id;
      else if (loc.area === 'bench') {
        if (id) bn[loc.i] = id;
        else bn.splice(loc.i, 1);
      }
    };
    put(sel, b);
    put(l, a);
    setDraft({ ...draft, starters: xi.map((x) => x ?? ''), bench: bn.filter(Boolean).slice(0, 9) });
    setSel(null);
    setMsg(null);
  };

  const addToBench = (id: string) => {
    if (bench.length >= 9) return setMsg('El banco admite hasta 9 suplentes.');
    setDraft({ ...draft, bench: [...bench, id] });
    setSel(null);
  };

  const unavailableStarters = starters.filter((id) => id && !isAvailable(players.get(id)?.condition));
  const complete = starters.filter(Boolean).length === 11;
  const save = () => {
    if (!complete) return setMsg('Faltan titulares: completá los 11 puestos.');
    const xi = starters as string[];
    const keep = (id?: string) => (id && xi.includes(id) ? id : undefined);
    update(setLineup(game, { ...draft, starters: xi, bench, captainId: keep(draft.captainId) ?? xi[0], penaltyTakerId: keep(draft.penaltyTakerId), freeKickTakerId: keep(draft.freeKickTakerId) }));
    setMsg(unavailableStarters.length ? 'Alineación guardada, pero hay titulares no disponibles: el día del partido se armará un once automático.' : 'Alineación guardada.');
  };
  const auto = () => {
    const l = autoLineup(squad, tactics.formation);
    setDraft(l);
    update(setLineup(game, l));
    setSel(null);
    setMsg('El cuerpo técnico armó el once y lo guardó.');
  };

  const isSel = (l: Loc) => !!sel && same(sel, l);
  const row = (p: Player, l: Loc, extra?: React.ReactNode) => (
    <li key={p.id} className={isSel(l) ? 'is-selected' : ''}>
      <button type="button" onClick={() => click(l)} className={!isAvailable(p.condition) ? 'is-out' : ''}>
        <span className={`pos pos--${POSITION_LINE[p.position].toLowerCase()}`}>{p.position}</span>
        <span className="bench-list__name">
          {p.name} <StatusBadge p={p} />
        </span>
        <span className="muted small">{Math.round(conditionOf(p).fitness)}%</span>
        <Rating value={overall(p)} />
      </button>
      {extra}
    </li>
  );

  return (
    <div className="tactica">
      <div className="stack">
        <Panel title="Estilo de juego">
          <TacticsForm tactics={tactics} onChange={(t) => update(setTactics(game, t))} />
        </Panel>
        <Panel
          title="Pizarra"
          className="tactica__board"
          aside={
            <span className="row-actions">
              <button className="btn btn--sm" onClick={auto}>
                Alineación automática
              </button>
              <button className="btn btn--primary btn--sm" onClick={save} disabled={!dirty && complete}>
                Guardar alineación
              </button>
            </span>
          }
        >
          <PitchBoard formation={tactics.formation} starters={starters} players={players} selected={sel?.area === 'xi' ? sel.i : null} onSlot={(i) => click({ area: 'xi', i })} />
          <p className="muted small tactica__note">
            Tocá un jugador de la cancha y después otro de la cancha, del banco o del plantel para intercambiarlos. El número es su valoración en ese puesto.
            {dirty && <b className="warn"> Hay cambios sin guardar.</b>}
          </p>
          {msg && <p className="notice">{msg}</p>}
          {unavailableStarters.length > 0 && <p className="notice notice--down">Hay {unavailableStarters.length} titular(es) lesionado(s) o suspendido(s).</p>}
        </Panel>
      </div>
      <div className="stack">
        <Panel title={`Suplentes (${bench.length}/9)`} flush>
          <ul className="bench-list">{bench.map((id, i) => row(players.get(id)!, { area: 'bench', i }))}</ul>
          {bench.length === 0 && <p className="empty">Sin suplentes.</p>}
        </Panel>
        <Panel title="Resto del plantel" flush>
          <ul className="bench-list">
            {reserves.map((p) =>
              row(
                p,
                { area: 'res', id: p.id },
                <span className="bench-list__extra">
                  <button type="button" className="btn btn--xs" onClick={() => addToBench(p.id)} disabled={!isAvailable(p.condition)} title="Agregar al banco">
                    + banco
                  </button>
                  <button type="button" className="btn btn--xs btn--ghost" onClick={() => pickPlayer?.(p)} title="Ver ficha">
                    Ficha
                  </button>
                </span>,
              ),
            )}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
