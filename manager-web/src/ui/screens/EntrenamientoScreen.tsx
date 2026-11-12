import { setTraining } from '../../engine/game/game';
import { DEFAULT_TRAINING, FOCUS_ATTRIBUTES, FOCUS_LABEL, type TrainingFocus, type TrainingIntensity } from '../../engine/game/training';
import { Panel } from '../components/Panel';
import { PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';
import { longDate, usePlayers, type ScreenProps } from './shared';

const ATTR_LABEL: Record<string, string> = {
  speed: 'velocidad', stamina: 'resistencia', aggression: 'agresividad', quality: 'calidad', goalkeeping: 'atajadas',
  tackling: 'quite', passing: 'pase', dribbling: 'gambeta', shooting: 'tiro', heading: 'remate de cabeza',
};

const INTENSITY: { id: TrainingIntensity; label: string; text: string }[] = [
  { id: 'baja', label: 'Suave', text: 'Recuperan más energía y casi no hay lesiones, pero mejoran poco.' },
  { id: 'media', label: 'Normal', text: 'Equilibrio entre mejora, desgaste y riesgo.' },
  { id: 'alta', label: 'Intensa', text: 'Mejoran más rápido, llegan más cansados al partido y hay más riesgo de lesión.' },
];

/** Weekly training plan: focus and intensity, applied every Monday. */
export function EntrenamientoScreen({ game, update }: ScreenProps) {
  const plan = game.training ?? DEFAULT_TRAINING;
  const players = usePlayers(game);
  const last = game.lastTraining;
  const pf = personaFor(game, 'preparador-fisico');
  const planText = {
    baja: 'Esta semana aflojamos: los muchachos recuperan y casi no hay riesgo de lesión, aunque van a mejorar poco.',
    media: 'Vamos con carga normal: un equilibrio sano entre mejorar, cansarse y cuidarse.',
    alta: 'Semana de doble turno: van a mejorar rápido, pero ojo que llegan cansados al partido y puede caer alguno lesionado.',
  }[plan.intensity];
  const lastText = !last
    ? 'Todavía no hicimos ninguna sesión esta temporada; el lunes arrancamos.'
    : `En la última sesión ${last.improved.length === 0 ? 'nadie subió un punto' : `${last.improved.length} ${last.improved.length === 1 ? 'jugador mejoró' : 'mejoraron'} algo`}${last.injured.length ? ` y ${last.injured.length === 1 ? `se me lesionó ${players.get(last.injured[0].playerId)?.name ?? 'uno'}` : `se me lesionaron ${last.injured.length}`}` : ' y no hubo lesionados'}.`;

  return (
    <div className="stack">
      <div className="persona-panel">
        <PersonaMessage persona={pf} text={`Foco ${FOCUS_LABEL[plan.focus].toLowerCase()}. ${planText} ${lastText}`} />
      </div>
      <Panel title="Foco de la semana">
        <div className="setup__cards">
          {(Object.keys(FOCUS_LABEL) as TrainingFocus[]).map((f) => (
            <button key={f} type="button" className={'setup__card' + (plan.focus === f ? ' is-on' : '')} onClick={() => update(setTraining(game, { ...plan, focus: f }))}>
              <b>{FOCUS_LABEL[f]}</b>
              <span>Trabaja: {FOCUS_ATTRIBUTES[f].map((a) => ATTR_LABEL[a]).join(', ')}.</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Intensidad">
        <div className="setup__cards">
          {INTENSITY.map((i) => (
            <button key={i.id} type="button" className={'setup__card' + (plan.intensity === i.id ? ' is-on' : '')} onClick={() => update(setTraining(game, { ...plan, intensity: i.id }))}>
              <b>{i.label}</b>
              <span>{i.text}</span>
            </button>
          ))}
        </div>
        <p className="small muted">
          El entrenamiento se hace todos los lunes. Los jóvenes mejoran mucho más que los veteranos, y un buen segundo entrenador acelera el progreso.
        </p>
      </Panel>

      <Panel title={last ? `Último entrenamiento · ${longDate(last.date)}` : 'Último entrenamiento'}>
        {!last && <p className="muted">Todavía no hubo ninguna sesión esta temporada.</p>}
        {last && (
          <>
            {last.improved.length === 0 && <p className="muted small">Nadie subió un punto esta semana.</p>}
            <ul className="news-mini">
              {last.improved.map((i) => (
                <li key={i.playerId + i.attribute}>
                  <b>{players.get(i.playerId)?.name ?? i.playerId}</b> <span className="pos-up">+1 {ATTR_LABEL[i.attribute]}</span>
                </li>
              ))}
              {last.injured.map((i) => (
                <li key={'inj' + i.playerId}>
                  <b className="neg">{players.get(i.playerId)?.name ?? i.playerId}</b> se lesionó ({i.days} días)
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
