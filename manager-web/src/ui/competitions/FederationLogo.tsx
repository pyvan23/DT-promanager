import { useState } from 'react';
import { SHOW_REAL_COMP_LOGOS } from '../config';

interface FederationEntry {
  file: string; // under public/, e.g. "asociaciones/arg.png"
  source: string;
  license: string;
  name: string;
}

// Logos of the football associations (AFA, CONMEBOL, UEFA, CBF…), keyed by country ISO or
// confederation. Loaded through a glob so the build works without the index.
const modules = import.meta.glob<Record<string, FederationEntry>>('../../data/real/federations.json', { eager: true, import: 'default' });
const FEDERATIONS: Record<string, FederationEntry> = Object.assign({}, ...Object.values(modules));

/** Association of a country (ISO alpha-3) or confederation ('CONMEBOL', 'UEFA'). */
export function federationName(id: string): string | undefined {
  return FEDERATIONS[id]?.name;
}

/** The association's logo, or a small badge with its code when there is no image. */
export function FederationLogo({ id, size = 28, title }: { id: string; size?: number; title?: string }) {
  const [failed, setFailed] = useState(false);
  const entry = SHOW_REAL_COMP_LOGOS ? FEDERATIONS[id] : undefined;
  const label = title ?? entry?.name ?? id;
  if (!entry || failed) {
    return (
      <span className="fed-logo fed-logo--code" style={{ width: size, height: size, fontSize: size * 0.32 }} title={label}>
        {id.slice(0, 3)}
      </span>
    );
  }
  return (
    <img
      className="fed-logo"
      src={import.meta.env.BASE_URL + entry.file}
      alt={label}
      title={label}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
