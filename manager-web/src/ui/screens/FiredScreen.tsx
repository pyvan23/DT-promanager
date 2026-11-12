import { clubOf, objectiveText, takeJob } from '../../engine/game/game';
import { ClubBadge } from '../components/ClubBadge';
import { FileteFrame, FileteRule } from '../components/Filete';
import { longDate, money, useClubs, type ScreenProps } from './shared';

/** The board sacked the manager: job offers from other clubs, or a fresh career. */
export function FiredScreen({ game, update, onNewGame }: ScreenProps & { onNewGame: () => void }) {
  const clubs = useClubs(game);
  const fired = game.fired!;
  const old = clubOf(game.world, game.userClubId);
  return (
    <main className="home fired">
      <div className="home__lights" aria-hidden="true" />
      <FileteFrame className="home__panel fired__panel">
        <p className="home__kicker">{longDate(fired.date)}</p>
        <h1 className="home__title fired__title">Te echaron</h1>
        <div className="fired__club">
          <ClubBadge club={old} size={54} />
          <p>{fired.message}</p>
        </div>
        <FileteRule />
        {fired.offers.length > 0 ? (
          <>
            <p className="home__lead">Pero el teléfono suena: estos clubes te quieren como DT.</p>
            <ul className="offer-list">
              {fired.offers.map((o) => (
                <li key={o.clubId}>
                  <ClubBadge club={clubs.get(o.clubId)} size={36} />
                  <div className="offer-list__info">
                    <b>{o.clubName}</b>
                    <span className="muted small">
                      {o.divisionName} · objetivo: {objectiveText(o.objective)} · {money(o.wage)}/mes
                    </span>
                  </div>
                  <button className="btn btn--primary btn--sm" onClick={() => update(takeJob(game, o.clubId))}>
                    Aceptar
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="home__lead">Por ahora nadie llamó. Podés empezar una carrera nueva.</p>
        )}
        <div className="home__actions">
          <button className="btn" onClick={onNewGame}>
            Nueva partida
          </button>
        </div>
      </FileteFrame>
      <div className="home__grass" aria-hidden="true" />
    </main>
  );
}
