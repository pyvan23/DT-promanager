import { useState } from 'react';
import type { NewsKind } from '../../engine/game/game';
import { FileteRule } from '../components/Filete';
import { GAME_NAME } from '../config';
import { Avatar } from '../personas/Avatar';
import { PersonaMessage } from '../personas/PersonaMessage';
import { personaFor } from '../personas/personas';
import { longDate, shortDate, type ScreenProps } from './shared';

const KINDS: { id: NewsKind | 'todas'; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'partido', label: 'Partidos' },
  { id: 'mercado', label: 'Mercado' },
  { id: 'directiva', label: 'Directiva' },
  { id: 'lesion', label: 'Enfermería' },
  { id: 'club', label: 'Club' },
  { id: 'temporada', label: 'Temporada' },
];
const LABEL = Object.fromEntries(KINDS.map((k) => [k.id, k.label])) as Record<string, string>;

const tone = (title: string, kind: NewsKind) =>
  kind === 'lesion' || /^(Derrota|Te echaron|Expulsado)/.test(title) ? 'down' : /^(Triunfo|Llegó|Bombazo)/.test(title) ? 'up' : 'neutral';

/** Sports paper with the career news, newest first. */
export function NoticiasScreen({ game }: ScreenProps) {
  const [kind, setKind] = useState<NewsKind | 'todas'>('todas');
  const [limit, setLimit] = useState(30);
  const news = game.news.filter((n) => kind === 'todas' || n.kind === kind);
  const [lead, ...rest] = news;
  const writer = personaFor(game, 'periodista');

  return (
    <article className="diario">
      <header className="diario__masthead">
        <span className="diario__edition">{longDate(game.calendar.date)}</span>
        <h1 className="diario__name">El Tablón</h1>
        <span className="diario__tag">Diario deportivo de {GAME_NAME}</span>
      </header>
      <FileteRule />
      {lead && (
        <PersonaMessage
          persona={writer}
          variant="inline"
          typing={false}
          text={`«${lead.title}»: así abrimos la edición de hoy. Lo demás, en las columnas de abajo.`}
        />
      )}
      <div className="chips diario__filters">
        {KINDS.map((k) => (
          <button key={k.id} className={'chip' + (k.id === kind ? ' chip--active' : '')} onClick={() => setKind(k.id)}>
            {k.label} {k.id !== 'todas' && <span className="muted tiny">({game.news.filter((n) => n.kind === k.id).length})</span>}
          </button>
        ))}
      </div>

      {!lead && <p className="muted diario__empty">No hay noticias en esta sección.</p>}
      {lead && (
        <section className={`diario__lead diario__lead--${tone(lead.title, lead.kind)}`}>
          <span className="diario__section">
            {LABEL[lead.kind]} · {shortDate(lead.date)}
          </span>
          <h2 className="diario__headline">{lead.title}</h2>
          <p className="diario__deck">{lead.body}</p>
          <div className="diario__byline">
            <Avatar persona={writer} size={40} />
            <span>
              Por <b>{writer.name}</b> · enviado especial de El Tablón
            </span>
          </div>
        </section>
      )}

      <div className="diario__columns">
        {rest.slice(0, limit).map((n) => (
          <section key={n.id} className={`diario__item diario__item--${tone(n.title, n.kind)}`}>
            <span className="diario__section">
              {LABEL[n.kind]} · {shortDate(n.date)}
            </span>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
          </section>
        ))}
      </div>
      {rest.length > limit && (
        <div className="diario__footer">
          <button className="btn" onClick={() => setLimit((l) => l + 30)}>
            Ver más noticias
          </button>
        </div>
      )}
    </article>
  );
}
