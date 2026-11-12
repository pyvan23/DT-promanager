import { managerFirst } from '../personas/voices';
import { TrophyPhoto, hasTrophyPhoto } from '../competitions/TrophyPhoto';
import { FederationLogo } from '../competitions/FederationLogo';
import { useEffect } from 'react';
import { formatOf } from '../../engine/calendar/calendar';
import { dismissEvents, type GameEvent, type GameState } from '../../engine/game/game';
import type { Club } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { MotifLayer } from '../competitions/CompetitionHero';
import { identityOf, paletteVars } from '../competitions/identity';
import '../competitions/competitions.css';
import { useClubs } from './shared';
import { AchievementShare } from '../share/AchievementShare';
import { PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';

// Full-screen events, as in the classic games: "¡Campeón!" covers and the draw of a
// competition that starts. Shown one at a time; filtered by game.settings.champions.

export function visibleEvents(game: GameState): GameEvent[] {
  const pref = game.settings.champions ?? 'importantes';
  return (game.events ?? []).filter((e) => (pref === 'todos' ? true : pref === 'mios' ? e.mine : e.important || e.mine));
}

export function EventOverlay({ game, update }: { game: GameState; update: (g: GameState) => void }) {
  const clubs = useClubs(game);
  const shown = visibleEvents(game);
  const cur = shown[0];

  const next = () => {
    if (!cur) return;
    // Drop the current event and any hidden ones queued before it.
    const i = game.events.indexOf(cur);
    update(dismissEvents(game, game.events.slice(0, i + 1).map((e) => e.id)));
  };
  const closeAll = () => update(dismissEvents(game, game.events.map((e) => e.id)));

  useEffect(() => {
    if (!cur) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!cur) return null;
  const id = cur.competitionId;
  const ident = identityOf(id);
  const name = id === 'amistoso' ? 'Amistoso' : (game.calendar.names[id] ?? id);
  const left = shown.length - 1;

  // The user won it: the shareable celebration card.
  const achievement = cur.achievementId ? (game.achievements ?? []).find((x) => x.id === cur.achievementId) : undefined;
  if (achievement) {
    return (
      <div className="ach-stage" role="dialog" aria-modal="true" aria-label={achievement.kind === 'titulo' ? `Campeón de ${achievement.competitionName}` : `Ascenso en ${achievement.competitionName}`}>
        <div className="ach-stage__inner">
          <PersonaMessage
            persona={personaFor(game, 'presidente')}
            variant="compact"
            text={
              achievement.kind === 'titulo'
                ? `¡${managerFirst(game)}, somos campeones de ${achievement.competitionName}! Esto queda en la historia del club. ¡Esta noche no duerme nadie!`
                : `¡Ascendimos, ${managerFirst(game)}! Lo prometido es deuda: ya mandé a pintar la cancha para la nueva categoría.`
            }
          />
          <AchievementShare achievement={achievement} colors={clubs.get(achievement.clubId)?.colors}>
            <button className="btn btn--primary" onClick={next} autoFocus>
              Seguir
            </button>
            {left > 0 && (
              <button className="btn btn--ghost" onClick={closeAll}>
                Cerrar todos
              </button>
            )}
          </AchievementShare>
          {left > 0 && <p className="ach-stage__note">Quedan {left} más</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="event-overlay" role="dialog" aria-modal="true" aria-label={cur.kind === 'campeon' ? `Campeón de ${name}` : `Comienza ${name}`}>
      <div className={`event-card event-card--${cur.kind}`} style={paletteVars(ident.palette)}>
        <MotifLayer motif={ident.motif} />
        {cur.kind === 'campeon' ? <ChampionBody game={game} ev={cur} name={name} clubs={clubs} /> : <StartBody game={game} ev={cur} name={name} clubs={clubs} />}
        <div className="event-card__actions">
          <button className="btn btn--primary" onClick={next} autoFocus>
            {left > 0 ? 'Siguiente' : 'Continuar'}
          </button>
          {left > 0 && (
            <button className="btn" onClick={closeAll}>
              Cerrar todos
            </button>
          )}
        </div>
        {left > 0 && <span className="event-card__count">Quedan {left} más</span>}
      </div>
    </div>
  );
}

function ChampionBody({ game, ev, name, clubs }: { game: GameState; ev: GameEvent; name: string; clubs: Map<string, Club> }) {
  const champ = clubs.get(ev.clubId ?? '');
  const runner = ev.runnerUpId ? clubs.get(ev.runnerUpId) : undefined;
  const isUser = ev.clubId === game.userClubId;
  return (
    <>
      <span className="event-card__kicker">
        <FederationLogo id={federationOf(game, ev.competitionId)} size={30} /> Temporada {game.calendar.season}
      </span>
      <span className="event-card__comp">{name}</span>
      <div className="event-card__row">
        {hasTrophyPhoto(ev.competitionId) ? (
          <div className="event-card__trophy">
            <TrophyPhoto id={ev.competitionId} name={name} />
          </div>
        ) : (
          <CompetitionLogo id={ev.competitionId} name={name} size={110} />
        )}
        <div className="event-card__club">
          <ClubBadge club={champ} size={120} />
          <b>{champ?.name ?? '—'}</b>
        </div>
      </div>
      <span className="event-card__shout">¡CAMPEÓN!</span>
      {isUser && <span className="event-card__mine">¡Es tu equipo, DT!</span>}
      <PersonaMessage
        persona={personaFor(game, isUser ? 'presidente' : 'periodista')}
        variant="compact"
        text={isUser ? `¡Campeones! ¡Vamos ${champ?.shortName ?? ''} todavía! Gracias, DT: esto es para toda la gente.` : `${champ?.shortName ?? 'El campeón'} levantó ${name}. Mañana sale en la tapa de El Tablón.`}
      />
      {runner && (
        <span className="event-card__runner">
          Subcampeón: <ClubBadge club={runner} size={22} /> <b>{runner.shortName}</b>
        </span>
      )}
    </>
  );
}

/** Association that organises a competition: the country's, or CONMEBOL / UEFA for continental cups. */
function federationOf(game: GameState, runId: string): string {
  const base = runId.replace(/-clausura$/, '');
  const division = game.world.divisions.find((d) => d.id === base);
  if (division) return division.country;
  const def = game.world.competitions.find((c) => c.id === runId);
  return def?.confederation && def.scope === 'continental' ? def.confederation : (def?.country ?? 'ARG');
}

function StartBody({ game, ev, name, clubs }: { game: GameState; ev: GameEvent; name: string; clubs: Map<string, Club> }) {
  const run = game.calendar.runs[ev.competitionId];
  const stage = run?.stages[0];
  const fstage = run ? formatOf(run.formatId).stages[0] : undefined;
  const me = game.userClubId;
  const groupWord = identityOf(ev.competitionId).country === 'ARG' ? 'Zona' : 'Grupo';
  const Line = ({ id }: { id: string }) => (
    <li className={id === me ? 'is-mine' : ''}>
      <ClubBadge club={clubs.get(id)} size={18} />
      <span>{clubs.get(id)?.shortName ?? id}</span>
    </li>
  );

  let draw: React.ReactNode = null;
  if (stage && fstage?.kind === 'knockout') {
    const ties = stage.rounds[0] ?? [];
    draw = (
      <div className="event-groups event-ties">
        {ties.map((t) => (
          <div key={t.id} className={'event-group event-tie' + (t.a === me || t.b === me ? ' event-group--mine' : '')}>
            <span>
              {clubs.get(t.a)?.shortName ?? t.a} <ClubBadge club={clubs.get(t.a)} size={18} />
            </span>
            <em>vs</em>
            <span>
              <ClubBadge club={clubs.get(t.b)} size={18} /> {clubs.get(t.b)?.shortName ?? t.b}
            </span>
          </div>
        ))}
        {stage.byes.length > 0 && (
          <div className="event-group">
            <h4>Esperan en la ronda siguiente</h4>
            <ul>
              {stage.byes.map((id) => (
                <Line key={id} id={id} />
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  } else if (stage) {
    const groups = stage.groups.length ? stage.groups : [stage.clubs];
    draw = (
      <div className="event-groups">
        {groups.map((g, i) => (
          <div key={i} className={'event-group' + (g.includes(me) ? ' event-group--mine' : '')}>
            <h4>{groups.length > 1 ? `${groupWord} ${String.fromCharCode(65 + i)}` : 'Participantes'}</h4>
            <ul>
              {g.map((id) => (
                <Line key={id} id={id} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <span className="event-card__kicker">
        <FederationLogo id={federationOf(game, ev.competitionId)} size={30} /> Comienza · Temporada {game.calendar.season}
      </span>
      <CompetitionLogo id={ev.competitionId} name={name} size={96} />
      <span className="event-card__comp">{name}</span>
      <span className="event-card__kicker">{fstage?.kind === 'knockout' ? 'Los cruces de la primera ronda' : (fstage?.name ?? 'El sorteo')}</span>
      {ev.mine && <span className="event-card__mine">Tu club está en carrera</span>}
      <PersonaMessage
        persona={personaFor(game, 'periodista')}
        variant="compact"
        text={ev.mine ? `Arranca ${name} y estamos adentro. Desde El Tablón vamos a seguir cada partido de cerca.` : `Arranca ${name}. Ya tenemos las planillas listas para la cobertura.`}
      />
      {draw}
    </>
  );
}
