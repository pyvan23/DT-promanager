import { useState } from 'react';
import { SHOW_REAL_COMP_LOGOS } from '../config';
import { CompetitionTrophy } from './Trophy';

// Real competition logo when the index has one (and SHOW_REAL_COMP_LOGOS is on), otherwise
// the original trophy drawn with the competition's identity. The index is loaded through a
// glob so the build works whether comp-logos.json exists or not.

export interface CompLogoEntry {
  file: string; // path under public/, e.g. "competiciones/lpf.png"
  source: string;
  license: string;
}

const modules = import.meta.glob<Record<string, CompLogoEntry>>('../../data/real/comp-logos*.json', { eager: true, import: 'default' });
const LOGOS: Record<string, CompLogoEntry> = Object.assign({}, ...Object.values(modules));

export function compLogoUrl(id: string): string | null {
  if (!SHOW_REAL_COMP_LOGOS) return null;
  const entry = LOGOS[id] ?? LOGOS[id.replace(/-clausura$/, '')];
  return entry?.file ? import.meta.env.BASE_URL + entry.file.replace(/^\//, '') : null;
}

export function CompetitionLogo({ id, name, size = 64 }: { id: string; name?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = failed ? null : compLogoUrl(id);
  if (url) {
    return (
      // Small logos (chips, lists) drop the plaque so the image keeps its size.
      <span className={'comp-logo' + (size <= 32 ? ' comp-logo--sm' : '')} style={{ width: size, height: size <= 32 ? size : size * 1.2, padding: size <= 32 ? 1 : Math.round(size * 0.09) }}>
        <img src={url} alt={name ?? id} title={name} decoding="async" onError={() => setFailed(true)} />
      </span>
    );
  }
  return <CompetitionTrophy id={id} size={size} title={name} />;
}
