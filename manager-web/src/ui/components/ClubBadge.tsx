import { useId, useState } from 'react';
import type { Club } from '../../engine/types';
import { crestUrl } from '../crests';

// Club crest: the real image when the crest index has one (and SHOW_REAL_CRESTS is on),
// otherwise a generic shield painted with the club's colours. The generic pattern
// (halves, stripes, band, sash, quarters) is picked from the club id so it stays stable.

type Pattern = 'halves' | 'stripes' | 'band' | 'sash' | 'quarters';
const PATTERNS: Pattern[] = ['halves', 'stripes', 'band', 'sash', 'quarters'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** "Estudiantes (LP)" → "ELP", "Boca Juniors" → "BJ", "Ferro" → "FER". */
export function initials(shortName: string): string {
  const [main, extra = ''] = shortName.split('(');
  const skip = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el']);
  const words = main.trim().split(/\s+/).filter((w) => w && !skip.has(w.toLowerCase()));
  let out = words.length === 1 ? words[0].slice(0, 3) : words.map((w) => w[0]).join('');
  out += extra.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  return out.slice(0, 3).toUpperCase();
}

/** Dark text on light primaries, light text on dark ones. */
function textColour(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#111' : '#fff';
}

const SHIELD = 'M4 3 H40 V22 C40 35 31 43 22 47 C13 43 4 35 4 22 Z';

export function ClubBadge({ club, size = 28 }: { club: Club | undefined; size?: number }) {
  const clip = useId();
  const [imageFailed, setImageFailed] = useState(false);
  if (!club) return <span className="crest crest--empty" style={{ width: size, height: size * 1.1 }} />;

  const real = imageFailed ? null : crestUrl(club.id);
  if (real) {
    return (
      <img
        className="crest crest--real"
        src={real}
        alt={club.shortName}
        title={club.name}
        width={size}
        height={Math.round(size * 1.1)}
        loading="lazy"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    );
  }
  const { primary, secondary } = club.colors;
  const pattern = PATTERNS[hash(club.id) % PATTERNS.length];
  const label = initials(club.shortName);
  const showText = size >= 22;

  return (
    <svg className="crest" width={size} height={size * 1.1} viewBox="0 0 44 50" role="img" aria-label={club.name}>
      <title>{club.name}</title>
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="44" height="50" fill={primary} />
        {pattern === 'halves' && <rect x="22" width="22" height="50" fill={secondary} />}
        {pattern === 'stripes' && [8, 20, 32].map((x) => <rect key={x} x={x} width="5.5" height="50" fill={secondary} />)}
        {pattern === 'band' && <rect y="16" width="44" height="12" fill={secondary} />}
        {pattern === 'sash' && <path d="M-6 14 L14 -6 L52 32 L32 52 Z" fill={secondary} />}
        {pattern === 'quarters' && (
          <>
            <rect x="22" width="22" height="22" fill={secondary} />
            <rect y="22" width="22" height="28" fill={secondary} />
          </>
        )}
        {/* top plate for the initials */}
        {showText && <rect y="0" width="44" height="13" fill="rgb(0 0 0 / 0.28)" />}
      </g>
      <path d={SHIELD} fill="none" stroke="rgb(0 0 0 / 0.55)" strokeWidth="1.6" />
      <path d="M7 6 H37 V22 C37 33 29.5 40 22 43.5" fill="none" stroke="rgb(255 255 255 / 0.35)" strokeWidth="0.8" />
      {showText && (
        <text
          x="22"
          y="10.4"
          textAnchor="middle"
          fontFamily="Oswald, 'Arial Narrow', sans-serif"
          fontWeight="700"
          fontSize={label.length > 2 ? 8.6 : 10}
          fill="#fff"
          letterSpacing="0.4"
        >
          {label}
        </text>
      )}
    </svg>
  );
}

export function ClubLabel({ club, short = false }: { club: Club | undefined; short?: boolean }) {
  return (
    <span className="club-label">
      <ClubBadge club={club} size={20} />
      <span className="club-label__name">{(short ? club?.shortName : club?.name) ?? '—'}</span>
    </span>
  );
}

export { textColour };
