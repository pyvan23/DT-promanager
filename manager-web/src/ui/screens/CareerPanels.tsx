import { declineOffers, objectiveText, setMatchMode, takeJob, type GameSettings, type MatchMode } from '../../engine/game/game';
import { ClubBadge } from '../components/ClubBadge';
import { Bar, Panel } from '../components/Panel';
import { useClubs, type ScreenProps } from './shared';
import { Avatar } from '../personas/Avatar';
import { personaFor, type PersonaRole } from '../personas/personas';
import { hasPhotos } from '../personas/photos';
import { availableStyles, usePersonaStyle } from '../personas/personaStyle';

const PREVIEW_ROLES: PersonaRole[] = ['presidente', 'medico', 'segundo-entrenador', 'ojeador'];

/** Picker of the drawing style of the club's people, with the same faces in each style. */
export function PersonaStylePicker({ game }: { game: ScreenProps['game'] }) {
  const [style, setStyle] = usePersonaStyle();
  return (
    <div className="persona-styles" role="radiogroup" aria-label="Estilo de los personajes">
      {availableStyles(hasPhotos).map((s) => (
        <button key={s.id} type="button" role="radio" aria-checked={style === s.id} className={'persona-style' + (style === s.id ? ' is-on' : '')} onClick={() => setStyle(s.id)}>
          <span className="persona-style__name">{s.label}</span>
          <span className="persona-style__faces">
            {PREVIEW_ROLES.map((r) => (
              <Avatar key={r} persona={personaFor(game, r)} size={64} variant={s.id} />
            ))}
          </span>
          <span className="tiny muted">{s.text}</span>
        </button>
      ))}
    </div>
  );
}

const money = (n: number) => (n >= 1e6 ? `US$ ${(n / 1e6).toFixed(1)} M` : `US$ ${Math.round(n / 1e3)} mil`);

/** Despacho: career mode, manager reputation and the default way to play matches. */
export function OpcionesPanel({ game, update }: ScreenProps) {
  const modes: { id: MatchMode; label: string }[] = [
    { id: 'vivo', label: 'En vivo' },
    { id: 'simulado', label: 'Simulado' },
  ];
  return (
    <Panel title="Opciones de la partida">
      <p className="small">
        <b>{game.managerName}</b> · {game.mode === 'promanager' ? 'Pro Mánager' : 'Mánager'}
      </p>
      <div className="small">
        Prestigio del DT: <b>{game.managerReputation}</b>
        <Bar value={game.managerReputation} max={99} />
      </div>
      <p className="small muted">{game.mode === 'promanager' ? 'Con más prestigio te llaman clubes más grandes al final de cada temporada.' : 'En modo Mánager no te pueden echar.'}</p>
      <div className="small">Tus partidos, por defecto:</div>
      <div className="row-actions" role="group" aria-label="Modo de partido por defecto">
        {modes.map((m) => (
          <button
            key={m.id}
            className={'btn btn--sm' + (game.settings.matchMode === m.id ? ' btn--on btn--primary' : '')}
            onClick={() => update(setMatchMode(game, m.id))}
          >
            {m.label}
          </button>
        ))}
      </div>
      <label className="small" htmlFor="opt-champions">
        Pantallas de campeón e inicio de torneo:
      </label>
      <select
        id="opt-champions"
        value={game.settings.champions ?? 'importantes'}
        onChange={(e) => update({ ...game, settings: { ...game.settings, champions: e.target.value as ChampionsSetting } })}
      >
        <option value="todos">Todas las competiciones del mundo</option>
        <option value="importantes">Solo las importantes y las mías</option>
        <option value="mios">Solo donde juega mi club</option>
      </select>
      <div className="small">Estilo de los personajes:</div>
      <PersonaStylePicker game={game} />
    </Panel>
  );
}

type ChampionsSetting = NonNullable<GameSettings['champions']>;

/** Fin de temporada (Pro Mánager): offers from bigger clubs, or stay. */
export function OfertasPanel({ game, update, go }: ScreenProps) {
  const clubs = useClubs(game);
  const offers = game.seasonOffers ?? [];
  if (game.mode !== 'promanager' || offers.length === 0) return null;
  const current = clubs.get(game.userClubId);
  return (
    <Panel title="Te quieren otros clubes">
      <p className="small">Tu campaña no pasó desapercibida. Podés aceptar una oferta o seguir en {current?.shortName}.</p>
      <ul className="offer-list">
        {offers.map((o) => (
          <li key={o.clubId} className="offer-list__item">
            <ClubBadge club={clubs.get(o.clubId)} size={40} />
            <div className="offer-list__info">
              <b>{o.clubName}</b>
              <span className="small muted">
                {o.divisionName} · objetivo: {objectiveText(o.objective)} · sueldo {money(o.wage)} por mes
              </span>
            </div>
            <button
              className="btn btn--primary btn--sm"
              onClick={() => {
                update(takeJob(game, o.clubId));
                go?.('despacho');
              }}
            >
              Aceptar
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn--sm" onClick={() => update(declineOffers(game))}>
        Seguir en {current?.shortName}
      </button>
    </Panel>
  );
}
