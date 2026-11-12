import { useState } from 'react';
import { CompetitionLogo } from './CompetitionLogo';

interface TrophyEntry {
  file: string; // under public/, e.g. "trofeos/copa-libertadores.jpg"
  source: string;
  license: string;
  author: string;
}

// Index of trophy photos (Wikimedia Commons). Loaded through a glob so the build works without it.
const modules = import.meta.glob<Record<string, TrophyEntry>>('../../data/real/trophies.json', { eager: true, import: 'default' });
const TROPHIES: Record<string, TrophyEntry> = Object.assign({}, ...Object.values(modules));

/** Split-season tournaments share the trophy photo of their division. */
const photoKey = (id: string) => (TROPHIES[id] ? id : id.replace(/-clausura$/, ''));

export const hasTrophyPhoto = (id: string) => !!TROPHIES[photoKey(id)];

/** Photo of the competition's trophy with its credit, or the logo / drawn trophy when there is none. */
export function TrophyPhoto({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const entry = TROPHIES[photoKey(id)];
  if (!entry || failed) {
    return (
      <figure className="trophy-photo trophy-photo--logo">
        <CompetitionLogo id={id} name={name} size={160} />
        <figcaption className="small muted">{name}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="trophy-photo">
      <img src={import.meta.env.BASE_URL + entry.file} alt={`Trofeo de ${name}`} loading="lazy" onError={() => setFailed(true)} />
      <figcaption className="small muted">
        {name} · Foto: {entry.author} ({entry.license}){' '}
        <a href={entry.source} target="_blank" rel="noreferrer noopener">
          fuente
        </a>
      </figcaption>
    </figure>
  );
}
