import { COMPETITION_DEFS } from '../../data/cups';
import { objectiveText } from '../../engine/game/game';
import { ClubBadge, ClubLabel } from '../components/ClubBadge';
import { FileteFrame, FileteRule } from '../components/Filete';
import { Bar, Panel } from '../components/Panel';
import { OfertasPanel } from './CareerPanels';
import { useClubs, type ScreenProps } from './shared';

/** Closing ceremony of a season: champions, promotions, relegations and the board's verdict. */
export function FinTemporadaScreen({ game, update, go }: ScreenProps) {
  const clubs = useClubs(game);
  const s = game.lastSummary;
  if (!s) {
    return (
      <Panel title="Fin de temporada">
        <p className="muted">Todavía no terminó ninguna temporada.</p>
      </Panel>
    );
  }
  const divName = (id: string) => game.world.divisions.find((d) => d.id === id)?.name ?? id;
  const divLevel = (id: string) => game.world.divisions.find((d) => d.id === id)?.level ?? 9;
  const divCountry = (id: string) => game.world.divisions.find((d) => d.id === id)?.country ?? '';
  const cupName = (id: string) => (game.world.competitions ?? COMPETITION_DEFS).find((c) => c.id === id)?.name ?? id;
  const divisions = [...s.divisions].sort((a, b) => divCountry(a.divisionId).localeCompare(divCountry(b.divisionId)) || divLevel(a.divisionId) - divLevel(b.divisionId));
  const mine = s.divisions.find((d) => d.ranking.includes(game.userClubId));
  const position = mine ? mine.ranking.indexOf(game.userClubId) + 1 : null;
  const verdict = game.news.find((n) => n.kind === 'temporada' && n.title === `Fin de la temporada ${s.season}`);
  const closing = verdict ? game.news.filter((n) => n.date === verdict.date && n.id !== verdict.id) : [];
  const titles = [...s.divisions.map((d) => ({ id: d.divisionId, name: divName(d.divisionId), champ: d.result.champion })), ...s.competitions.filter((c) => c.result?.champion).map((c) => ({ id: c.competitionId, name: cupName(c.competitionId), champ: c.result!.champion }))].filter(
    (t) => t.champ === game.userClubId,
  );
  const me = clubs.get(game.userClubId);

  return (
    <div className="stack">
      <OfertasPanel game={game} update={update} go={go} />
      <FileteFrame className="season-end">
        <span className="kicker">Temporada {s.season} · balance final</span>
        <div className="season-end__club">
          <ClubBadge club={me} size={72} />
          <div>
            <h2 className="season-end__title">{me?.name}</h2>
            {mine && position && (
              <p className="season-end__pos">
                {position}.º en {divName(mine.divisionId)}
                {mine.promoted.includes(game.userClubId) && <b className="up-text"> · ¡Ascenso!</b>}
                {mine.relegated.includes(game.userClubId) && <b className="neg"> · Descenso</b>}
              </p>
            )}
            {titles.length > 0 && <p className="season-end__titles">🏆 Campeón: {titles.map((t) => t.name).join(', ')}</p>}
          </div>
        </div>
        <FileteRule />
        {verdict && <p className="season-end__verdict">{verdict.body}</p>}
        <div className="board-box__conf">
          <span>Confianza de la directiva</span>
          <Bar value={game.club.board.confidence} max={100} />
          <b>{Math.round(game.club.board.confidence)}%</b>
        </div>
        <p className="muted small">Nuevo objetivo para {game.world.season}: {objectiveText(game.club.board.objective)}.</p>
        <div className="season-end__actions">
          <button className="btn btn--primary btn--lg" onClick={() => go?.('despacho')}>
            Empezar la temporada {game.world.season}
          </button>
        </div>
      </FileteFrame>

      {closing.length > 0 && (
        <Panel title="Lo que dejó el cierre">
          <ul className="news-list">
            {closing.map((n) => (
              <li key={n.id} className="news-list__item">
                <strong className="news-list__headline">{n.title}</strong>
                <span className="news-list__deck">{n.body}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <section className="diario__box">
        <h3 className="diario__box-title">Así terminó la temporada {s.season}</h3>
        <div className="diario__table">
          {divisions.map((d) => (
            <div key={d.divisionId} className={'diario__row' + (d.ranking.includes(game.userClubId) ? ' diario__row--mine' : '')}>
              <span className="diario__row-div">{divName(d.divisionId)}</span>
              <span className="diario__row-champ">
                <ClubLabel club={clubs.get(d.result.champion)} short />
              </span>
              <span className="diario__row-up">
                {d.promoted.map((id) => (
                  <ClubLabel key={id} club={clubs.get(id)} short />
                ))}
              </span>
              <span className="diario__row-down">
                {d.relegated.map((id) => (
                  <ClubLabel key={id} club={clubs.get(id)} short />
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="diario__legend">
          <span>Campeón</span>
          <span className="up">Ascienden</span>
          <span className="down">Descienden</span>
        </div>
      </section>

      <Panel title="Campeones de copa" flush>
        <ul className="figure-list">
          {s.competitions.map((c) => (
            <li key={c.competitionId} className="cup-line">
              <span className="cup-line__name">{cupName(c.competitionId)}</span>
              {c.result?.champion ? <ClubLabel club={clubs.get(c.result.champion)} /> : <span className="muted small">{c.pending ?? 'No se jugó'}</span>}
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
