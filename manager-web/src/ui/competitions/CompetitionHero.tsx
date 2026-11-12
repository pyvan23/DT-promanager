import { FederationLogo } from './FederationLogo';
import { TrophyPhoto, hasTrophyPhoto } from './TrophyPhoto';
import { useMemo } from 'react';
import { competitionResult, formatOf, topScorers } from '../../engine/calendar/calendar';
import type { GameState } from '../../engine/game/game';
import { ClubBadge } from '../components/ClubBadge';
import { FileteCorner } from '../components/Filete';
import { CompetitionLogo } from './CompetitionLogo';
import { identityOf, paletteVars, REGION_LABEL, type Motif } from './identity';
import './competitions.css';

const roundName = (ties: number) =>
  ({ 1: 'Final', 2: 'Semifinales', 4: 'Cuartos de final', 8: 'Octavos de final', 16: 'Dieciseisavos' })[ties] ?? `Ronda de ${ties * 2}`;

/** Deterministic star field for the "stars" motif. */
const STARS = Array.from({ length: 34 }, (_, i) => {
  const x = (i * 73.13) % 100;
  const y = (i * 41.77 + (i % 3) * 13) % 100;
  return { x, y, r: 0.35 + ((i * 7) % 5) * 0.16, o: 0.35 + ((i * 11) % 6) * 0.1 };
});

export function MotifLayer({ motif, small = false }: { motif: Motif; small?: boolean }) {
  if (motif === 'none') return null;
  if (motif === 'stars') {
    return (
      <svg className="ci-motif ci-motif--stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {STARS.slice(0, small ? 14 : STARS.length).map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="var(--ci-accent)" opacity={s.o} />
        ))}
      </svg>
    );
  }
  if (motif === 'filete') {
    return (
      <span className="ci-motif ci-motif--filete" aria-hidden="true">
        {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
          <FileteCorner key={c} corner={c} size={small ? 26 : 52} />
        ))}
      </span>
    );
  }
  return <span className={`ci-motif ci-motif--${motif}`} aria-hidden="true" />;
}

/** Big cover for the head of a competition screen. */
export function CompetitionHero({ game, id }: { game: GameState; id: string }) {
  const cal = game.calendar;
  const ident = identityOf(id);
  const name = id === 'amistoso' ? 'Amistoso' : (cal.names[id] ?? id);
  const run = cal.runs[id];
  const pending = cal.pending[id];

  const info = useMemo(() => {
    if (!run) return null;
    const format = formatOf(run.formatId);
    const matches = cal.matches.filter((m) => m.competitionId === id);
    const played = matches.filter((m) => m.status === 'played').length;
    // Current stage: the first started one that still has matches to play, else the last.
    let si = run.stages.findIndex((s) => s.matchIds.some((mid) => matches.find((m) => m.id === mid)?.status !== 'played'));
    if (si < 0) si = run.stages.length - 1;
    const stage = run.stages[si];
    const fstage = format.stages[si];
    let phase = fstage?.name ?? '—';
    let progress: string | null = null;
    if (run.champion) phase = 'Terminada';
    else if (stage && fstage) {
      const sm = matches.filter((m) => m.stageId === stage.stageId);
      if (fstage.kind === 'knockout') {
        const r = stage.rounds.findIndex((round) => round.some((t) => !t.winner));
        const round = stage.rounds[r >= 0 ? r : stage.rounds.length - 1];
        if (round) progress = roundName(round.length);
      } else if (sm.length) {
        const total = Math.max(...sm.map((m) => m.round));
        const done = sm.filter((m) => m.status === 'played').map((m) => m.round);
        const cur = done.length ? Math.max(...done) : 0;
        progress = cur ? `Fecha ${cur} de ${total}` : `${total} fechas por delante`;
      }
    }
    const teams = new Set(run.stages.flatMap((s) => s.clubs)).size;
    const scorer = topScorers(cal, id, 1)[0];
    let leader: string | undefined;
    if (!run.champion && fstage && fstage.kind !== 'knockout') {
      const t = competitionResult(cal, id)?.stages[si]?.tables;
      if (t && t.length === 1 && t[0][0]?.played) leader = t[0][0].clubId;
    }
    return { phase, progress, teams, played, total: matches.length, scorer, leader };
  }, [cal, id, run]);

  const club = (cid?: string) => (cid ? game.world.clubs.find((c) => c.id === cid) : undefined);
  const player = (pid?: string) => (pid ? game.world.players.find((p) => p.id === pid) : undefined);
  const champion = club(run?.champion);
  const previous = !champion ? club(game.world.qualification?.champions[id]) : undefined;
  const countryName = ident.country ? game.world.countries.find((c) => c.id === ident.country)?.name : undefined;
  const userPlays = cal.matches.some((m) => m.competitionId === id && (m.homeId === game.userClubId || m.awayId === game.userClubId));

  return (
    <section className={`comp-hero comp-hero--${ident.motif}`} style={paletteVars(ident.palette)} aria-label={name}>
      <MotifLayer motif={ident.motif} />
      <div className="comp-hero__art">
        <CompetitionLogo id={id} name={name} size={112} />
      </div>
      <div className="comp-hero__body">
        <span className="comp-hero__kicker">
          <FederationLogo id={ident.country ?? ({ argentina: 'ARG', sudamerica: 'CONMEBOL', europa: 'UEFA', otras: 'FIFA' } as const)[ident.region]} size={22} />
          {countryName ?? REGION_LABEL[ident.region]} · Temporada {cal.season}
          {userPlays && <span className="comp-hero__mine">Tu club juega</span>}
        </span>
        <h2 className="comp-hero__name">{name}</h2>
        <p className="comp-hero__motto">“{ident.motto}”</p>

        {info ? (
          <dl className="comp-hero__facts">
            <div>
              <dt>Fase</dt>
              <dd>{info.phase}</dd>
            </div>
            {info.progress && (
              <div>
                <dt>Momento</dt>
                <dd>{info.progress}</dd>
              </div>
            )}
            <div>
              <dt>Equipos</dt>
              <dd>{info.teams}</dd>
            </div>
            <div>
              <dt>Partidos</dt>
              <dd>
                {info.played}/{info.total}
              </dd>
            </div>
            {info.leader && (
              <div>
                <dt>Puntero</dt>
                <dd className="comp-hero__club">
                  <ClubBadge club={club(info.leader)} size={18} />
                  {club(info.leader)?.shortName}
                </dd>
              </div>
            )}
            {info.scorer && (
              <div>
                <dt>Goleador</dt>
                <dd className="comp-hero__club">
                  <ClubBadge club={club(info.scorer.clubId)} size={18} />
                  {player(info.scorer.playerId)?.name ?? '—'} <b>{info.scorer.goals}</b>
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="comp-hero__pending">{pending ?? 'Sin datos para esta temporada.'}</p>
        )}
      </div>

      {(champion || previous) && (
        <div className="comp-hero__champ">
          <span className="comp-hero__champ-label">{champion ? `Campeón ${cal.season}` : 'Último campeón'}</span>
          <ClubBadge club={champion ?? previous} size={champion ? 58 : 40} />
          <b>{(champion ?? previous)!.shortName}</b>
        </div>
      )}
      {hasTrophyPhoto(id) && (
        <div className="comp-hero__trophy">
          <TrophyPhoto id={id} name={name} />
        </div>
      )}
    </section>
  );
}
