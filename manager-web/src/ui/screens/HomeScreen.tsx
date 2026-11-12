import { GAME_NAME } from '../config';
import { FileteFrame, FileteRule } from '../components/Filete';
import { InstallButton } from '../../pwa/InstallButton';

interface Props {
  hasSave: boolean;
  saveLabel: string | null;
  /** Message about the save slot (e.g. a save from an older version). */
  notice?: string | null;
  onNewGame: () => void;
  onContinue: () => void;
}

export function HomeScreen({ hasSave, saveLabel, notice, onNewGame, onContinue }: Props) {
  return (
    <main className="home">
      <div className="home__lights" aria-hidden="true" />
      <FileteFrame className="home__panel">
        <p className="home__kicker">Fútbol argentino · de la Promocional a la Liga Profesional</p>
        <h1 className="home__title">{GAME_NAME}</h1>
        <FileteRule />
        <p className="home__lead">
          Agarrá un club de cualquier categoría, armá el plantel, aguantá los promedios y llevalo a lo más alto.
        </p>
        <div className="home__actions">
          <button className="btn btn--primary btn--lg" onClick={onNewGame}>
            Nueva partida
          </button>
          <button className="btn btn--lg" onClick={onContinue} disabled={!hasSave}>
            Continuar
          </button>
        </div>
        {saveLabel && <p className="home__save">Partida guardada · {saveLabel}</p>}
        {notice && <p className="notice home__notice">{notice}</p>}
        <InstallButton />
      </FileteFrame>
      <div className="home__grass" aria-hidden="true" />
    </main>
  );
}
