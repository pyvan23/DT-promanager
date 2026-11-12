import { managerFirst } from '../../personas/voices';
import { FIRING_THRESHOLD, OBJECTIVE_NAMES, shouldFireMidSeason, WARNING_THRESHOLD } from '../../../engine/club';
import { clubOf, divisionOf, objectiveText } from '../../../engine/game/game';
import { ClubBadge } from '../../components/ClubBadge';
import { Panel } from '../../components/Panel';
import { CountUp, PersonaMessage } from '../../personas/PersonaMessage';
import { personaFor } from '../../personas/personas';
import './shared';
import { fmtDate, money, type ScreenProps } from './util';

/** Mid-season dismissal happens below this (see shouldFireMidSeason). */
const MIDSEASON_LINE = FIRING_THRESHOLD - 10;

function mood(confidence: number): { text: string; tone: 'up' | 'mid' | 'down' } {
  if (confidence >= 75) return { text: 'La directiva está chocha con vos.', tone: 'up' };
  if (confidence >= 55) return { text: 'La directiva está conforme con tu trabajo.', tone: 'up' };
  if (confidence >= WARNING_THRESHOLD) return { text: 'Hay dudas en la comisión directiva. Conviene enderezar el rumbo.', tone: 'mid' };
  if (confidence >= FIRING_THRESHOLD) return { text: 'Estás en la cuerda floja: la paciencia se está terminando.', tone: 'down' };
  return { text: 'Si no ganás ya, te echan. Al cierre de la temporada no seguís con esta confianza.', tone: 'down' };
}

export function DirectivaScreen({ game }: ScreenProps) {
  const { board, finances } = game.club;
  const club = clubOf(game.world, game.userClubId);
  const division = divisionOf(game.world, game.userClubId);
  const m = mood(board.confidence);
  const c = Math.max(0, Math.min(100, board.confidence));

  const recent = game.calendar.matches
    .filter((x) => x.status === 'played' && x.result && (x.homeId === game.userClubId || x.awayId === game.userClubId))
    .filter((x) => x.competitionId !== 'amistoso' && game.calendar.kinds[x.competitionId] !== 'friendly')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const outcome = (x: (typeof recent)[number]) => {
    const home = x.homeId === game.userClubId;
    const us = home ? x.result!.homeGoals : x.result!.awayGoals;
    const them = home ? x.result!.awayGoals : x.result!.homeGoals;
    return us > them ? 'G' : us < them ? 'P' : 'E';
  };

  const first = managerFirst(game);
  const presidentText =
    c >= 75
      ? `${first}, la comisión está chocha con vos. Seguí así y en la próxima asamblea te renovamos con aplausos.`
      : c >= 55
        ? `Estamos conformes, ${first}. El objetivo es ${objectiveText(board.objective)} y vamos por buen camino.`
        : c >= WARNING_THRESHOLD
          ? `Te voy a ser sincero, ${first}: en la comisión hay dudas. Necesitamos ${objectiveText(board.objective)} y así no alcanza.`
          : c >= FIRING_THRESHOLD
            ? `Estás en la cuerda floja, ${first}. Yo te banco, pero la paciencia de los demás se está terminando.`
            : `No te puedo sostener más si no ganás ya, ${first}. Con esta confianza, al cierre de la temporada no seguís.`;

  return (
    <div className="stack cl-screen">
      <div className="persona-panel">
        <PersonaMessage persona={personaFor(game, 'presidente')} text={presidentText} tone={m.tone === 'down' ? 'urgente' : undefined} />
      </div>
      <div className="cl-two">
        <Panel title="Comisión directiva">
          <div className="cl-board">
            <ClubBadge club={club} size={56} />
            <div className="cl-board__text">
              <span className="kicker">Objetivo de la temporada {game.calendar.season}</span>
              <h3 className="cl-board__goal">{OBJECTIVE_NAMES[board.objective]}</h3>
              <p className="muted small">La directiva de {club.shortName} espera {objectiveText(board.objective)} en {division.name}.</p>
            </div>
          </div>
        </Panel>

        <Panel title="Últimos resultados oficiales">
          {recent.length === 0 ? (
            <p className="muted">Todavía no jugaste partidos oficiales.</p>
          ) : (
            <ul className="cl-form-list">
              {recent.map((x) => {
                const o = outcome(x);
                const rival = game.world.clubs.find((cl) => cl.id === (x.homeId === game.userClubId ? x.awayId : x.homeId));
                return (
                  <li key={x.id} title={`${fmtDate(x.date)} · ${game.calendar.names[x.competitionId] ?? x.competitionId}`}>
                    <span className={`cl-result cl-result--${o}`}>{o}</span>
                    <span className="small">{x.homeId === game.userClubId ? 'vs' : 'en'} {rival?.shortName ?? '—'} · {x.result!.homeGoals}-{x.result!.awayGoals}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Confianza en el DT" aside={<b className={`cl-${m.tone}`}><CountUp value={c} format={(n) => `${Math.round(n)}/100`} /></b>}>
        <div className="cl-confidence" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(c)} aria-label="Confianza de la directiva">
          <div className="cl-confidence__zone cl-confidence__zone--fire" style={{ width: `${FIRING_THRESHOLD}%` }} />
          <div className="cl-confidence__zone cl-confidence__zone--warn" style={{ left: `${FIRING_THRESHOLD}%`, width: `${WARNING_THRESHOLD - FIRING_THRESHOLD}%` }} />
          <div className={`cl-confidence__fill cl-confidence__fill--${m.tone}`} style={{ width: `${c}%` }} />
          {[MIDSEASON_LINE, FIRING_THRESHOLD, WARNING_THRESHOLD].map((t) => (
            <span key={t} className="cl-confidence__mark" style={{ left: `${t}%` }} />
          ))}
        </div>
        <div className="cl-confidence__legend tiny muted">
          <span style={{ left: `${MIDSEASON_LINE}%` }}>{MIDSEASON_LINE}: despido inmediato</span>
          <span style={{ left: `${FIRING_THRESHOLD}%` }}>{FIRING_THRESHOLD}: despido a fin de temporada</span>
          <span style={{ left: `${WARNING_THRESHOLD}%` }}>{WARNING_THRESHOLD}: ultimátum</span>
        </div>
        <p className={`cl-mood cl-mood--${m.tone}`}>{m.text}</p>
        {shouldFireMidSeason(board) && <p className="notice">La directiva está a punto de rescindirte el contrato.</p>}
        <dl className="kv-grid cl-board__kv">
          <div><dt>Advertencias</dt><dd className={board.warnings > 0 ? 'cl-down' : undefined}>{board.warnings}</dd></div>
          <div><dt>Saldo del club</dt><dd className={finances.balance < 0 ? 'cl-down' : undefined}>{money(finances.balance)}</dd></div>
        </dl>
      </Panel>

      <Panel title="Cómo te evalúan">
        <ul className="cl-explain">
          <li><b>Cada partido oficial</b> mueve la confianza: los triunfos suman (más si el partido es importante, como una copa), las derrotas restan. Si el objetivo es salir campeón o ascender, los empates y las derrotas pesan más; si es no descender, un empate no está mal visto.</li>
          <li><b>Por debajo de {WARNING_THRESHOLD}</b> recibís un ultimátum (una advertencia). <b>Por debajo de {MIDSEASON_LINE}</b> te echan en plena temporada.</li>
          <li><b>Al terminar la temporada</b> se compara tu posición final con el objetivo: cumplirlo (o superarlo) sube mucho la confianza, quedar lejos la baja. Ascender y ganar títulos suman; descender es casi siempre el final.</li>
          <li><b>Las cuentas</b> también cuentan: cerrar el año ganando plata suma un poco; terminar en rojo, resta. Si al final quedás por debajo de {FIRING_THRESHOLD}, no seguís.</li>
        </ul>
      </Panel>
    </div>
  );
}
