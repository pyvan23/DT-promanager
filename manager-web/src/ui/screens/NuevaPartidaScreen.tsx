import { useMemo, useState } from 'react';
import { objectiveText, proManagerOffers, type GameMode, type GameScope, type MatchMode, type NewGameOptions } from '../../engine/game/game';
import type { World } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { FileteFrame, FileteRule } from '../components/Filete';
import { clubMap } from '../format';
import { GAME_NAME } from '../config';

export interface SetupChoice extends NewGameOptions {
  mode: GameMode;
  scope: GameScope;
  matchMode: MatchMode;
  managerName: string;
  /** Pro Mánager: country of the first offers ('' = any). */
  country: string;
}

const MODES: { id: GameMode; title: string; text: string }[] = [
  {
    id: 'manager',
    title: 'Mánager',
    text: 'Elegís cualquier club de cualquier división y lo dirigís sin miedo a que te echen. Ideal para agarrar a tu equipo del alma.',
  },
  {
    id: 'promanager',
    title: 'Pro Mánager',
    text: 'Arrancás como un DT desconocido: solo te llaman clubes chicos del ascenso. Ascendé, ganá títulos y ganate el prestigio para que te llamen los grandes. Si te va mal, te echan.',
  },
];

const SCOPES: { id: GameScope; title: string; text: string }[] = [
  { id: 'completo', title: 'Mánager completo', text: 'Manejás todo: alineación, táctica y entrenamiento, y también fichajes, ventas, contratos, finanzas, estadio y empleados.' },
  { id: 'entrenador', title: 'Solo entrenador', text: 'Te ocupás de la cancha: alineación, táctica y entrenamiento. Los fichajes, los contratos y la plata los maneja la secretaría técnica del club.' },
];

const MATCH_MODES: { id: MatchMode; title: string; text: string }[] = [
  { id: 'vivo', title: 'En vivo', text: 'Seguís el partido minuto a minuto con relato, estadísticas y cambios en cualquier momento.' },
  { id: 'simulado', title: 'Simulado', text: 'Ves el resultado del primer tiempo, hacés cambios en el descanso y después el resultado final.' },
];

/** First step of a new game: manager name, game mode and default match mode. */
export function NuevaPartidaScreen({ world, onBack, onNext }: { world: World; onBack: () => void; onNext: (choice: SetupChoice) => void }) {
  const [choice, setChoice] = useState<SetupChoice>({ mode: 'manager', scope: 'completo', matchMode: 'vivo', managerName: '', country: 'ARG' });
  const countries = useMemo(() => [...new Set(world.clubs.map((c) => c.country))], [world]);
  const set = (patch: Partial<SetupChoice>) => setChoice((c) => ({ ...c, ...patch }));

  return (
    <main className="home setup">
      <div className="home__lights" aria-hidden="true" />
      <FileteFrame className="home__panel setup__panel">
        <p className="home__kicker">Nueva partida</p>
        <h1 className="home__title">{GAME_NAME}</h1>
        <FileteRule />

        <label className="setup__field">
          <span>Tu nombre de DT</span>
          <input value={choice.managerName} maxLength={40} placeholder="Por ejemplo: Carlos Bianchi" onChange={(e) => set({ managerName: e.target.value })} />
        </label>

        <h2 className="setup__title">Modo de juego</h2>
        <div className="setup__cards">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={'setup__card' + (choice.mode === m.id ? ' is-on' : '')} onClick={() => set({ mode: m.id })}>
              <b>{m.title}</b>
              <span>{m.text}</span>
            </button>
          ))}
        </div>

        <h2 className="setup__title">Qué manejás</h2>
        <div className="setup__cards">
          {SCOPES.map((m) => (
            <button key={m.id} type="button" className={'setup__card' + (choice.scope === m.id ? ' is-on' : '')} onClick={() => set({ scope: m.id })}>
              <b>{m.title}</b>
              <span>{m.text}</span>
            </button>
          ))}
        </div>

        {choice.mode === 'promanager' && (
          <label className="setup__field">
            <span>¿En qué país querés empezar?</span>
            <select value={choice.country} onChange={(e) => set({ country: e.target.value })}>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        )}

        <h2 className="setup__title">Tus partidos, por defecto</h2>
        <div className="setup__cards">
          {MATCH_MODES.map((m) => (
            <button key={m.id} type="button" className={'setup__card' + (choice.matchMode === m.id ? ' is-on' : '')} onClick={() => set({ matchMode: m.id })}>
              <b>{m.title}</b>
              <span>{m.text}</span>
            </button>
          ))}
        </div>
        <p className="muted small">Lo podés cambiar cuando quieras desde el Despacho, y en cada previa elegís igual.</p>

        <div className="row-actions setup__actions">
          <button className="btn btn--lg" onClick={onBack}>
            Volver
          </button>
          <button className="btn btn--primary btn--lg" onClick={() => onNext(choice)}>
            {choice.mode === 'manager' ? 'Elegir club' : 'Ver ofertas'}
          </button>
        </div>
      </FileteFrame>
    </main>
  );
}

/** Pro Mánager: the first job offers, from small clubs. */
export function ProOfertasScreen({ world, choice, onBack, onAccept }: { world: World; choice: SetupChoice; onBack: () => void; onAccept: (clubId: string) => void }) {
  const [round, setRound] = useState(1);
  const clubs = useMemo(() => clubMap(world), [world]);
  const offers = useMemo(() => proManagerOffers(world, round, choice.country || 'ARG'), [world, round, choice.country]);
  const money = (n: number) => (n >= 1e6 ? `US$ ${(n / 1e6).toFixed(1)} M` : `US$ ${Math.round(n / 1e3)} mil`);

  return (
    <main className="home setup">
      <div className="home__lights" aria-hidden="true" />
      <FileteFrame className="home__panel setup__panel">
        <p className="home__kicker">Pro Mánager · {choice.managerName || 'DT sin nombre'}</p>
        <h1 className="home__title">Te llamaron</h1>
        <FileteRule />
        <p className="home__lead">Nadie te conoce todavía. Estos clubes del ascenso te ofrecen dirigir su primer equipo{choice.country === 'ARG' ? ' (los mejores de la B Metropolitana y los más flojos de la Primera Nacional)' : ''}:</p>
        <ul className="offer-list">
          {offers.map((o) => {
            const club = clubs.get(o.clubId);
            return (
              <li key={o.clubId} className="offer-list__item">
                <ClubBadge club={club} size={44} />
                <div className="offer-list__info">
                  <b>{o.clubName}</b>
                  <span className="small muted">
                    {o.divisionName} · objetivo: {objectiveText(o.objective)} · sueldo {money(o.wage)} por mes
                  </span>
                </div>
                <button className="btn btn--primary btn--sm" onClick={() => onAccept(o.clubId)}>
                  Aceptar
                </button>
              </li>
            );
          })}
          {offers.length === 0 && <li className="empty">No hay ofertas en ese país. Probá con otro.</li>}
        </ul>
        <div className="row-actions setup__actions">
          <button className="btn btn--lg" onClick={onBack}>
            Volver
          </button>
          <button className="btn btn--lg" onClick={() => setRound((r) => r + 1)}>
            Esperar otras ofertas
          </button>
        </div>
      </FileteFrame>
    </main>
  );
}
