import { useId } from 'react';
import { identityOf, mix, type Palette, type TrophyStyle } from './identity';

// Original trophy illustrations (no real trophy is traced). Every style shares a 100x120
// canvas, a metal gradient (gold or silver) and a plinth banded with the competition colours.

const METALS = {
  gold: ['#fff6c8', '#f0cf5a', '#c99a1e', '#7a5a0c'],
  silver: ['#ffffff', '#dfe4ec', '#a8b0bd', '#5e6674'],
} as const;

interface TrophyProps {
  kind: TrophyStyle;
  palette: Palette;
  metal?: 'gold' | 'silver';
  size?: number;
  title?: string;
  className?: string;
}

export function Trophy({ kind, palette, metal = 'gold', size = 64, title, className = '' }: TrophyProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const m = METALS[metal];
  const metalFill = `url(#${uid}-m)`;
  const shade = `url(#${uid}-s)`;
  const line = m[3];
  const common = { stroke: line, strokeWidth: 1.1, strokeLinejoin: 'round' as const };

  return (
    <svg
      className={`trophy ${className}`}
      width={size}
      height={size * 1.2}
      viewBox="0 0 100 120"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={`${uid}-m`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={m[2]} />
          <stop offset="0.28" stopColor={m[0]} />
          <stop offset="0.55" stopColor={m[1]} />
          <stop offset="1" stopColor={m[3]} />
        </linearGradient>
        <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m[1]} />
          <stop offset="1" stopColor={m[3]} />
        </linearGradient>
        <linearGradient id={`${uid}-p`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(palette.primary, '#ffffff', 0.12)} />
          <stop offset="1" stopColor={mix(palette.primary, '#000000', 0.35)} />
        </linearGradient>
        <radialGradient id={`${uid}-g`} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor={palette.accent} stopOpacity="0.45" />
          <stop offset="1" stopColor={palette.accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* glow behind the piece */}
      <ellipse cx="50" cy="54" rx="46" ry="50" fill={`url(#${uid}-g)`} />

      {kind === 'handles' && (
        <g>
          <path d="M31 27 C14 25 14 50 35 52" fill="none" stroke={metalFill} strokeWidth="5" strokeLinecap="round" />
          <path d="M69 27 C86 25 86 50 65 52" fill="none" stroke={metalFill} strokeWidth="5" strokeLinecap="round" />
          <path d="M27 20 H73 C73 46 64 60 50 63 C36 60 27 46 27 20 Z" fill={metalFill} {...common} />
          <rect x="27" y="18" width="46" height="5" rx="2" fill={shade} {...common} />
          <path d="M33 36 H67" stroke={palette.accent} strokeWidth="2.4" />
          <path d="M45 63 H55 L57 78 H43 Z" fill={metalFill} {...common} />
          <ellipse cx="50" cy="80" rx="15" ry="4" fill={shade} {...common} />
          <path d="M35 26 C35 42 40 52 46 57" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}

      {kind === 'big-ear' && (
        <g>
          <path d="M35 24 C4 10 2 66 40 58" fill="none" stroke={metalFill} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M65 24 C96 10 98 66 60 58" fill="none" stroke={metalFill} strokeWidth="6.5" strokeLinecap="round" />
          <path d="M33 16 H67 C69 42 63 64 50 69 C37 64 31 42 33 16 Z" fill={metalFill} {...common} />
          <ellipse cx="50" cy="16" rx="17" ry="3.5" fill={shade} {...common} />
          <path d="M37 22 C37 40 41 56 47 63" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M46 69 H54 L55 80 H45 Z" fill={metalFill} {...common} />
          <path d="M38 80 H62 L58 86 H42 Z" fill={shade} {...common} />
        </g>
      )}

      {kind === 'tall' && (
        <g>
          <circle cx="50" cy="9" r="4.5" fill={metalFill} {...common} />
          <path d="M50 13 V17" stroke={line} strokeWidth="2" />
          <path d="M36 28 C36 16 64 16 64 28 Z" fill={shade} {...common} />
          <path d="M37 30 C26 30 26 44 39 46" fill="none" stroke={metalFill} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M63 30 C74 30 74 44 61 46" fill="none" stroke={metalFill} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M35 28 H65 C65 52 59 66 50 68 C41 66 35 52 35 28 Z" fill={metalFill} {...common} />
          <path d="M38 40 H62" stroke={palette.accent} strokeWidth="2" />
          <path d="M40 34 C40 48 43 58 47 63" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M47 68 H53 V80 H47 Z" fill={metalFill} {...common} />
          <ellipse cx="50" cy="74" rx="6" ry="2.4" fill={shade} {...common} />
          <path d="M40 80 H60 L63 86 H37 Z" fill={shade} {...common} />
        </g>
      )}

      {kind === 'plate' && (
        <g>
          <path d="M44 80 L50 70 L56 80" fill="none" stroke={line} strokeWidth="2.4" />
          <circle cx="50" cy="44" r="36" fill={metalFill} {...common} />
          <circle cx="50" cy="44" r="28" fill="none" stroke={shade} strokeWidth="5" />
          <circle cx="50" cy="44" r="18" fill={shade} {...common} />
          <circle cx="50" cy="44" r="11" fill={palette.secondary} stroke={line} strokeWidth="1" />
          <circle cx="50" cy="44" r="5" fill={palette.accent} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={50 + Math.cos(a) * 28} cy={44 + Math.sin(a) * 28} r="2.2" fill={i % 2 ? palette.accent : palette.secondary} stroke={line} strokeWidth="0.5" />;
          })}
          <path d="M26 26 A30 30 0 0 1 48 12" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      )}

      {kind === 'league' && (
        <g>
          <path d="M30 34 C18 34 18 52 34 54" fill="none" stroke={metalFill} strokeWidth="4" strokeLinecap="round" />
          <path d="M70 34 C82 34 82 52 66 54" fill="none" stroke={metalFill} strokeWidth="4" strokeLinecap="round" />
          <path d="M28 26 L32 12 L39 22 L45 8 L50 20 L55 8 L61 22 L68 12 L72 26 Z" fill={shade} {...common} />
          <circle cx="45" cy="8" r="2" fill={palette.accent} />
          <circle cx="55" cy="8" r="2" fill={palette.accent} />
          <circle cx="32" cy="12" r="1.6" fill={palette.accent} />
          <circle cx="68" cy="12" r="1.6" fill={palette.accent} />
          <path d="M28 26 H72 C72 50 63 63 50 66 C37 63 28 50 28 26 Z" fill={metalFill} {...common} />
          <path d="M29.5 36 H70.5 L69 44 H31 Z" fill={palette.primary} stroke={line} strokeWidth="0.8" />
          <path d="M31 40 H69" stroke={palette.accent} strokeWidth="1.4" />
          <path d="M34 30 C34 46 40 56 46 61" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
          <path d="M45 66 H55 L56 78 H44 Z" fill={metalFill} {...common} />
          <ellipse cx="50" cy="80" rx="14" ry="3.6" fill={shade} {...common} />
        </g>
      )}

      {kind === 'shield' && (
        <g>
          <path d="M26 12 H74 V42 C74 60 62 72 50 78 C38 72 26 60 26 42 Z" fill={metalFill} {...common} />
          <path d="M32 18 H68 V42 C68 56 59 66 50 71 C41 66 32 56 32 42 Z" fill={palette.primary} stroke={line} strokeWidth="0.8" />
          <path d="M44 18 H56 V71 C53 70 51 70 50 71 C49 70 47 70 44 71 Z" fill={palette.accent} opacity="0.9" />
          <path d="M32 18 H44 V68 C38 63 32 54 32 42 Z" fill={palette.secondary} />
          <path d="M50 30 L53 37 L60 37 L54.5 41.5 L56.5 48.5 L50 44 L43.5 48.5 L45.5 41.5 L40 37 L47 37 Z" fill={metalFill} stroke={line} strokeWidth="0.6" />
          <path d="M30 16 V42 C30 52 34 60 40 66" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1.6" />
          <path d="M42 78 H58 L60 86 H40 Z" fill={shade} {...common} />
        </g>
      )}

      {kind === 'ball' && (
        <g>
          <circle cx="50" cy="34" r="24" fill={metalFill} {...common} />
          <path d="M50 24 L59 30.5 L55.5 41 H44.5 L41 30.5 Z" fill={palette.primary} stroke={line} strokeWidth="0.8" />
          <path d="M50 24 V12 M59 30.5 L71 27 M55.5 41 L62 51 M44.5 41 L38 51 M41 30.5 L29 27" stroke={line} strokeWidth="1" />
          <path d="M33 22 A20 20 0 0 1 48 13" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M40 58 C40 66 44 70 46 72 H54 C56 70 60 66 60 58 Z" fill={shade} {...common} />
          <path d="M46 72 H54 V80 H46 Z" fill={metalFill} {...common} />
          <path d="M36 80 H64 L60 86 H40 Z" fill={shade} {...common} />
        </g>
      )}

      {kind === 'pennant' && (
        <g>
          <path d="M28 8 V92" stroke={line} strokeWidth="3" strokeLinecap="round" />
          <circle cx="28" cy="7" r="3" fill={metalFill} {...common} />
          <path d="M30 12 L84 36 L30 62 Z" fill={palette.primary} stroke={palette.accent} strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M30 26 L66 36 L30 46 Z" fill={palette.secondary} />
          <circle cx="44" cy="36" r="6" fill={palette.accent} stroke={line} strokeWidth="0.6" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <path key={i} d={`M${30 + i * 6.6} ${62 - i * 3.05} l1.5 5`} stroke={palette.accent} strokeWidth="1.2" />
          ))}
        </g>
      )}

      {/* plinth (pennant stands on a small foot instead) */}
      {kind === 'pennant' ? (
        <path d="M18 92 H38 L40 98 H16 Z" fill={`url(#${uid}-p)`} stroke={line} strokeWidth="0.8" />
      ) : (
        <g>
          <path d="M30 86 H70 L74 112 H26 Z" fill={`url(#${uid}-p)`} stroke={mix(palette.primary, '#000000', 0.5)} strokeWidth="1" />
          <path d="M28.6 96 H71.4" stroke={palette.accent} strokeWidth="2.2" />
          <path d="M29.4 100 H70.6" stroke={palette.secondary} strokeWidth="1.4" />
          <rect x="40" y="103" width="20" height="5" rx="1" fill={metalFill} stroke={line} strokeWidth="0.5" />
          <path d="M24 112 H76 V115 H24 Z" fill={mix(palette.primary, '#000000', 0.45)} />
        </g>
      )}
    </svg>
  );
}

/** Trophy drawn with a competition's identity. */
export function CompetitionTrophy({ id, size = 64, title }: { id: string; size?: number; title?: string }) {
  const ident = identityOf(id);
  return <Trophy kind={ident.trophy} palette={ident.palette} metal={ident.metal} size={size} title={title} />;
}
