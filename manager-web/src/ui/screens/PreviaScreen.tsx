import { CompetitionLogo } from '../competitions/CompetitionLogo';
import { useMemo } from 'react';
import { competitionResult, nextUserMatch, matchLabel } from '../../engine/calendar/calendar';
import { buildMatchInput } from '../../engine/game/matchday-bridge';
import { createLiveMatch, FORMATION_SLOTS, slotRating, type LiveMatch } from '../../engine/matchday';
import type { ScheduledMatch, TeamSheet } from '../../engine/game-types';
import { POSITION_LINE, type Player } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import { Panel, Rating } from '../components/Panel';
import { StatusBadge } from './PlantelScreen';
import { PitchBoard } from './TacticaScreen';
import { PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';
import { longDate, MARKING_LABEL, MENTALITY_LABEL, outcomeFor, OutcomeChip, PRESSING_LABEL, scoreText, shortDate, TEMPO_LABEL, useClubs, type ScreenProps } from './shared';

function positionIn(game: ScreenProps['game'], competitionId: string, clubId: string): string | null {
  const r = competitionResult(game.calendar, competitionId);
  for (const s of [...(r?.stages ?? [])].reverse()) {
    for (const [g, t] of s.tables.entries()) {
      const i = t.findIndex((row) => row.clubId === clubId);
      if (i >= 0) return `${i + 1}.º${s.tables.length > 1 ? ` (zona ${String.fromCharCode(65 + g)})` : ''} · ${t[i].points} pts`;
    }
  }
  return null;
}

function lastResults(game: ScreenProps['game'], clubId: string, n = 5): ScheduledMatch[] {
  return game.calendar.matches
    .filter((m) => m.status === 'played' && (m.homeId === clubId || m.awayId === clubId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);
}

function SheetList({ sheet, players }: { sheet: TeamSheet; players: Map<string, Player> }) {
  const slots = FORMATION_SLOTS[sheet.tactics.formation];
  return (
    <ul className="bench-list">
      {sheet.lineup.starters.map((id, i) => {
        const p = players.get(id);
        if (!p) return null;
        return (
          <li key={id}>
            <div className="bench-list__row">
              <span className={`pos pos--${POSITION_LINE[slots[i].position].toLowerCase()}`}>{slots[i].position}</span>
              <span className="bench-list__name">
                {p.name} <StatusBadge p={p} />
              </span>
              <Rating value={Math.round(slotRating(p, slots[i].position))} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function PreviaScreen({ game, go, onWatch, onSimulate }: ScreenProps & { onWatch: (matchId: string, match: LiveMatch) => void; onSimulate: () => void }) {
  const clubs = useClubs(game);
  const next = nextUserMatch(game.calendar);
  const input = useMemo(() => (next ? buildMatchInput(game, next) : null), [game, next]);
  if (!next || !input) {
    return (
      <Panel title="Previa">
        <p className="muted">No hay partidos por jugar esta temporada.</p>
      </Panel>
    );
  }
  const today = next.date === game.calendar.date;
  const home = next.homeId === game.userClubId;
  const rivalId = home ? next.awayId : next.homeId;
  const rival = clubs.get(rivalId);
  const mine = home ? input.home : input.away;
  const theirs = home ? input.away : input.home;
  const t = mine.tactics;
  // Scout's report on the rival: recent form, system and the most dangerous player.
  const scout = personaFor(game, 'ojeador');
  const recent = lastResults(game, rivalId);
  const form = recent.map((m) => outcomeFor(m, rivalId));
  const wins = form.filter((o) => o === 'W').length;
  const draws = form.filter((o) => o === 'D').length;
  const losses = form.filter((o) => o === 'L').length;
  const slotsR = FORMATION_SLOTS[theirs.tactics.formation];
  const danger = theirs.lineup.starters
    .map((id, i) => ({ p: input.players.get(id), r: input.players.get(id) ? slotRating(input.players.get(id)!, slotsR[i].position) : 0 }))
    .filter((x) => x.p)
    .sort((a, b) => b.r - a.r)[0]?.p;
  const scoutText = [
    scout.interim ? 'No tenemos ojeador fijo, así que te cuento lo que pude ver por la tele.' : `Fui a verlos ${Math.max(1, recent.length)} ${recent.length === 1 ? 'vez' : 'veces'}.`,
    `Juegan con ${theirs.tactics.formation} y una mentalidad ${MENTALITY_LABEL[theirs.tactics.mentality].toLowerCase()}.`,
    recent.length ? `De los últimos ${recent.length} ganaron ${wins}, empataron ${draws} y perdieron ${losses}.` : 'Todavía no jugaron en la temporada.',
    danger ? `El peligro es ${danger.name} (${danger.position}): no le den espacio.` : '',
    wins >= 3 ? 'Vienen enchufados, hay que salir con cuidado.' : losses >= 3 ? 'Están golpeados: si los apretamos de entrada, se caen.' : 'Es un partido parejo, se define en los detalles.',
  ].filter(Boolean).join(' ');
  const venue = next.neutral ? 'Cancha neutral' : home ? game.club.stadium.name : (rival?.stadium ?? '');

  return (
    <div className="stack">
      <section className="previa-head panel">
        <div className="previa-head__club">
          <ClubBadge club={clubs.get(next.homeId)} size={72} />
          <b>{clubs.get(next.homeId)?.shortName}</b>
        </div>
        <div className="previa-head__mid">
          <span className="kicker comp-inline"><CompetitionLogo id={next.competitionId} size={24} /> {matchLabel(game.calendar, next).full}</span>
          <span className="previa-head__vs">vs</span>
          <span className="muted small">
            {longDate(next.date)} · {venue}
          </span>
          {input.knockout?.aggregate && (
            <span className="small">
              Ida: {input.knockout.aggregate.home}-{input.knockout.aggregate.away} (global)
            </span>
          )}
          <div className="previa-head__actions">
            {today ? (
              <>
                {/* Plays in the mode chosen in the options; it does not ask again. */}
                <button
                  className="btn btn--primary btn--lg"
                  onClick={() => (game.settings.matchMode === 'simulado' ? onSimulate() : onWatch(next.id, createLiveMatch(buildMatchInput(game, next))))}
                >
                  Jugar partido
                </button>
                <span className="small muted">
                  Modo {game.settings.matchMode === 'simulado' ? 'simulado' : 'en vivo'} · se cambia en Despacho → Opciones
                </span>
              </>
            ) : (
              <p className="muted small">Se juega el {shortDate(next.date)}. Usá «Continuar» para llegar al día del partido.</p>
            )}
          </div>
        </div>
        <div className="previa-head__club">
          <ClubBadge club={clubs.get(next.awayId)} size={72} />
          <b>{clubs.get(next.awayId)?.shortName}</b>
        </div>
      </section>

      <div className="previa">
        <Panel
          title={`Tu equipo · ${t.formation}`}
          aside={
            <button className="link" onClick={() => go?.('tactica')}>
              Cambiar táctica →
            </button>
          }
        >
          <dl className="kv-inline kv-inline--flat">
            <div>
              <dt>Mentalidad</dt>
              <dd>{MENTALITY_LABEL[t.mentality]}</dd>
            </div>
            <div>
              <dt>Presión</dt>
              <dd>{PRESSING_LABEL[t.pressing]}</dd>
            </div>
            <div>
              <dt>Ritmo</dt>
              <dd>{TEMPO_LABEL[t.tempo]}</dd>
            </div>
            <div>
              <dt>Marca</dt>
              <dd>{MARKING_LABEL[t.marking]}</dd>
            </div>
          </dl>
          <PitchBoard formation={t.formation} starters={mine.lineup.starters} players={input.players} onSlot={() => go?.('tactica')} />
          <p className="muted small">Suplentes: {mine.lineup.bench.map((id) => input.players.get(id)?.name.split(' ').slice(-1)[0]).join(', ') || '—'}</p>
        </Panel>

        <div className="stack">
          <Panel title="Informe del ojeador">
            <PersonaMessage persona={scout} text={scoutText} variant="compact" />
          </Panel>
          <Panel title={<span className="club-cell">{rival?.shortName} · el rival</span>}>
            <dl className="kv-inline kv-inline--flat">
              <div>
                <dt>Posición</dt>
                <dd>{positionIn(game, next.competitionId, rivalId) ?? '—'}</dd>
              </div>
              <div>
                <dt>Estadio</dt>
                <dd>{rival?.stadium}</dd>
              </div>
            </dl>
            <h4 className="subhead">Últimos resultados</h4>
            <ul className="mini-results">
              {lastResults(game, rivalId).map((m) => {
                const other = clubs.get(m.homeId === rivalId ? m.awayId : m.homeId);
                return (
                  <li key={m.id}>
                    <OutcomeChip o={outcomeFor(m, rivalId)} />
                    <span className="muted small">{shortDate(m.date)}</span>
                    <span>
                      {m.homeId === rivalId ? 'vs' : 'en'} {other?.shortName}
                    </span>
                    <b>{scoreText(m)}</b>
                  </li>
                );
              })}
              {lastResults(game, rivalId).length === 0 && <li className="muted">Todavía no jugó.</li>}
            </ul>
          </Panel>
          <Panel title={`Once probable del rival · ${theirs.tactics.formation}`} flush>
            <SheetList sheet={theirs} players={input.players} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
