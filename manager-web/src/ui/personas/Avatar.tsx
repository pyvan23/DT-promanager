// Original portraits of the club's people, generated from a seed (the name), in a sober,
// adult tone. Two styles draw the SAME figure (realistic bust proportions, same traits and
// the same clothes and props per role) with different paint:
//   · diario  — halftone photo-engraving of the classic sports press, ink on paper, with an
//               optional duotone wash in the club colours and a caption under the photo
//   · silueta — the figure against the stadium floodlights, institutional-poster style
// A small badge with the role icon (cross, whistle, binoculars…) sits in the corner.

import { useId, type CSSProperties, type ReactNode } from 'react';
import { traitsOf, type Persona, type PersonaRole, type Traits } from './personas';
import { photoFor } from './photos';
import { usePersonaStyle, type PersonaStyle } from './personaStyle';
import './personas.css';

export interface AvatarProps {
  persona: Pick<Persona, 'role' | 'name' | 'cargo' | 'color' | 'colors' | 'initials'>;
  /** Height in px (vertical press photo, about 3:4). */
  size?: number;
  /** Forces a style (previews); by default the user's preference. */
  variant?: PersonaStyle;
  /** Newspaper caption under the photo (name in small caps · job). */
  caption?: boolean;
  className?: string;
}

/** Courtesy title used in captions. */
export function honorific(role: PersonaRole, t: Traits): string {
  if (role === 'medico') return t.female ? 'Dra. ' : 'Dr. ';
  if (role === 'preparador-fisico') return 'Prof. ';
  if (role === 'tesorero') return 'Cdor. ';
  return '';
}

export function Avatar({ persona, size = 56, variant, caption = false, className = '' }: AvatarProps) {
  const [pref] = usePersonaStyle();
  const style = variant ?? pref;
  const t = traitsOf(persona.name);
  const label = `${persona.name}, ${persona.cargo}`;
  const photo = style === 'fotos' ? photoFor(persona.role, persona.name) : null;
  const mode = style === 'silueta' ? 'silueta' : 'diario';
  const art = photo ? (
    <span className="avatar__photo" style={{ width: Math.round(size * 0.74), height: size }}>
      <img src={photo} alt={label} loading="lazy" />
    </span>
  ) : (
    <Portrait persona={persona} t={t} size={size} mode={mode} label={label} />
  );
  if (!caption) return <span className={`avatar avatar--${mode} ${className}`}>{art}</span>;
  return (
    <figure className={`avatar avatar--${mode} avatar--captioned ${className}`} style={{ width: Math.round(size * 0.74) }}>
      {art}
      <figcaption className="avatar__caption">
        <b>{`${honorific(persona.role, t)}${persona.name}`.replace(/^Don /, '')}</b> · {persona.cargo}
      </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- colour helpers

function mix(hex: string, other: string, f: number): string {
  const p = (h: string) => {
    const x = h.replace('#', '');
    const full = x.length === 3 ? x.split('').map((c) => c + c).join('') : x.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const a = p(hex);
  const b = p(other);
  return `#${a.map((v, i) => Math.round(v * (1 - f) + b[i] * f).toString(16).padStart(2, '0')).join('')}`;
}
const luma = (hex: string) => {
  const x = mix(hex, hex, 0).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

// ---------------------------------------------------------------- shared geometry (100 × 135)

const BODY = 'M-2 135 L-2 101 C2 89 18 82 36 79 Q43 77 44 72 L56 72 Q57 77 64 79 C82 82 98 89 102 101 L102 135 Z';
const NECK = 'M42.4 56 L41.8 73 Q50 77 58.2 73 L57.6 56 Z';
const EAR_L = 'M37.2 40.5 C34.6 40 34 44 35 47.6 C35.6 49.6 36.9 50.2 37.8 49.6 Z';
const EAR_R = 'M62.8 40.5 C65.4 40 66 44 65 47.6 C64.4 49.6 63.1 50.2 62.2 49.6 Z';
const head = (j: number) =>
  `M37 42 C37 30 43 26.5 50 26.5 C57 26.5 63 30 63 42 C63 50 ${62 - j} 55.5 ${59 + j * 0.8} 60 C56 64.5 53 66 50 66 C47 66 44 64.5 ${41 - j * 0.8} 60 C${38 + j} 55.5 37 50 37 42 Z`;

const HAIR_BACK: Partial<Record<Traits['hair'], string>> = {
  largo: 'M35.5 44 C34 28 41 22.5 50 22.5 C59 22.5 66 28 64.5 44 C65 56 66 66 68.5 75 L58 75 L57.5 60 L42.5 60 L42 75 L31.5 75 C34 66 35 56 35.5 44 Z',
  melena: 'M35.8 44 C34.5 28 41 22.8 50 22.8 C59 22.8 65.5 28 64.2 44 C64.5 52 65 58 66 64 L57.5 64 L57.5 56 L42.5 56 L42.5 64 L34 64 C35 58 35.5 52 35.8 44 Z',
};
const HAIR: Record<Traits['hair'], string> = {
  corto: 'M36.6 43 C35.5 30 41.5 24.5 50 24.5 C58.5 24.5 64.5 30 63.4 43 C62.6 37.5 61.2 34 58 32.6 C53 34 46 33.6 42 32.6 C39 34.2 37.4 38 36.6 43 Z',
  raya: 'M36.6 43 C35 30 41 24 50.5 24.3 C59 24.6 64.8 30 63.4 43 C62.8 37 61 33.5 57.5 31.8 C52 31 45 31.5 41 33.8 C38.8 36 37.3 39 36.6 43 Z',
  rapado: 'M36.8 41 C36.4 30 42 25.4 50 25.4 C58 25.4 63.6 30 63.2 41 C62 36 59.5 33.2 50 33 C40.5 33.2 38 36 36.8 41 Z',
  pelado: 'M36.4 47 C36 40 36.8 36.5 38.6 34.4 L39.6 47 Z M63.6 47 C64 40 63.2 36.5 61.4 34.4 L60.4 47 Z',
  rulos: 'M36.2 43 C34.5 29 41 23.4 50 23.4 C59 23.4 65.5 29 63.8 43 C63 37 61.5 33.5 58.5 32.2 C53 33.6 46 33.2 41.6 32.2 C38.6 34 37 38 36.2 43 Z',
  jopo: 'M36.6 41 C36 29 42 23.4 50 23.4 C58 23.4 64 29 63.4 41 C62.4 35 60 30.6 56 29.4 C52 28.4 48 28.4 44 29.4 C40 30.6 37.6 35 36.6 41 Z',
  largo: 'M36.8 42 C36 30 42 25 50 25 C58 25 64 30 63.2 42 C60 34 56 31 50 31.5 C45 31 41 33.5 36.8 42 Z',
  melena: 'M36.8 42 C36 30 42 25 50 25 C58 25 64 30 63.2 42 C61 35.5 57 32.6 50 32.8 C44 32.6 39.6 35 36.8 42 Z',
};
const BEARD = (j: number) => `M37.6 47 C38 55 ${40.6 - j * 0.8} 59.6 ${41 - j * 0.8} 60 C44 64.5 47 66.4 50 66.4 C53 66.4 56 64.5 ${59 + j * 0.8} 60 C${59.4 + j * 0.8} 59.6 62 55 62.4 47 C61 53 58.5 56.6 55 57 C52.6 56 47.4 56 45 57 C41.5 56.6 39 53 37.6 47 Z`;
const MUSTACHE = 'M45.2 56.2 C47 54.6 49 54.8 50 55.4 C51 54.8 53 54.6 54.8 56.2 C53 57.2 51.2 57 50 56.6 C48.8 57 47 57.2 45.2 56.2 Z';
const GOATEE = 'M47 60.6 C47.4 64.6 52.6 64.6 53 60.6 C51.6 61.4 48.4 61.4 47 60.6 Z';

type Mode = 'diario' | 'silueta';

/** Grey ramps of the engraving (light side, dark side), sepia-tinted like newsprint. */
const GRAYS: Record<'white' | 'L' | 'M' | 'D' | 'X' | 'ink', [string, string]> = {
  white: ['#fbf8f1', '#ddd7ca'],
  L: ['#c9c3b6', '#8e887c'],
  M: ['#9d978b', '#5f5a51'],
  D: ['#6c675e', '#36332e'],
  X: ['#44413b', '#1f1d1a'],
  ink: ['#2c2a26', '#121110'],
};
const SKIN_GRAYS: Record<string, [string, string, string]> = {
  L: ['#efe6d6', '#cfc3ae', '#9b8f7b'],
  M: ['#d6c8b0', '#ad9e86', '#76695a'],
  D: ['#ad9c82', '#7d6e5a', '#4c4237'],
  X: ['#8a7b66', '#5c5042', '#352d25'],
};
const HAIR_GRAYS: Record<string, string> = { white: '#e8e4dc', L: '#b9b3a7', M: '#8a847a', D: '#55514a', X: '#34312c', ink: '#22201c' };
/** Tones from lightest to darkest. "white" stays white in Diario (no dots). */
type Tone = 'white' | 'L' | 'M' | 'D' | 'X' | 'ink';
type Base = 'paper' | 'tint' | 'tint2' | 'skin';

interface PortraitProps {
  persona: AvatarProps['persona'];
  t: Traits;
  size: number;
  mode: Mode;
  label: string;
}

function Portrait({ persona, t, size, mode, label }: PortraitProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const diario = mode === 'diario';
  const INK = '#1b1914';
  const PAPER = '#f1ebdc';
  const RIM = '#bcd4ee';
  const { primary, secondary } = persona.colors;
  const role = persona.role;

  // Silhouette solids: navy greys; "white" garments read as a lighter figure with a light outline.
  const SIL: Record<Tone, string> = { white: '#2e3a55', L: '#1d263a', M: '#151c2c', D: '#0e1320', X: '#0a0e18', ink: '#05070c' };
  const tintSil = mix(primary, '#05070c', 0.55);
  const tint2Sil = mix(secondary, '#05070c', 0.55);

  const skinTone: Tone = t.skinIndex <= 1 ? 'L' : t.skinIndex <= 3 ? 'M' : 'D';
  const dark = luma(t.hairColor) < 0.4;
  const hairTone: Tone = dark ? 'ink' : luma(t.hairColor) < 0.65 ? 'D' : 'M';

  /** A shape painted with a tone over a base (Diario) or as a solid (Silueta). */
  const Sh = ({ d, tone, base = 'paper', line = 0.6, rim = true, transform }: { d: string; tone: Tone; base?: Base; line?: number; rim?: boolean; transform?: string }) => {
    if (!diario) {
      const fill = base === 'tint' ? tintSil : base === 'tint2' ? tint2Sil : SIL[tone];
      const lightEdge = tone === 'white';
      return <path d={d} transform={transform} fill={fill} stroke={rim ? RIM : 'none'} strokeOpacity={lightEdge ? 0.95 : 0.45} strokeWidth={lightEdge ? 1.3 : 0.7} strokeLinejoin="round" />;
    }
    // Photo-engraving: a shaded tone (light from the left, like a studio portrait) under a fine screen.
    const fill = base === 'skin' ? `url(#skin${uid})` : base === 'tint' ? `url(#tint${tone}${uid})` : base === 'tint2' ? `url(#tintb${tone}${uid})` : `url(#g${tone}${uid})`;
    return (
      <g transform={transform}>
        <path d={d} fill={fill} />
        {tone !== 'white' && <path d={d} fill={`url(#screen${uid})`} />}
        {line > 0 && <path d={d} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={Math.min(line, 0.35)} strokeLinejoin="round" />}
      </g>
    );
  };
  /** Lines (seams, cords, chalk): ink in Diario, rim light in Silueta. */
  const ln = (o = 1) => (diario ? { stroke: INK, strokeOpacity: o } : { stroke: RIM, strokeOpacity: 0.7 * o });
  const solidInk = diario ? INK : '#05070c';
  const crest = (x: number, y: number, s = 1) => (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -5 L4.4 -3.4 V0.6 C4.4 3.4 2.2 4.8 0 5.6 C-2.2 4.8 -4.4 3.4 -4.4 0.6 V-3.4 Z" fill={diario ? mix(secondary, PAPER, 0.2) : tint2Sil} stroke={diario ? INK : RIM} strokeWidth={0.6} strokeOpacity={diario ? 1 : 0.8} />
      <text y={1.9} fontSize={4.6} fontWeight={700} textAnchor="middle" fill={diario ? INK : RIM} fontFamily="Georgia, 'Times New Roman', serif">
        {(persona.initials ?? 'FC').slice(0, 2)}
      </text>
    </g>
  );

  // ---------------- clothes and props per role
  const tieClub = (
    <g>
      <Sh d="M48.6 74.5 L51.4 74.5 L52.6 91 L50 95 L47.4 91 Z" tone="L" base="tint" line={0.5} />
      <path d="M48.2 79 L52 77.6 M47.9 84 L52.3 82.4 M47.8 89 L52.5 87.3" stroke={diario ? mix(secondary, PAPER, 0.1) : tint2Sil} strokeWidth={1.3} />
    </g>
  );
  const suitLapels = (tone: Tone) => (
    <>
      <Sh d="M43.6 72.6 L50 89 L44.6 85 L37.4 79.2 Z" tone={tone} line={0.6} />
      <Sh d="M56.4 72.6 L50 89 L55.4 85 L62.6 79.2 Z" tone={tone} line={0.6} />
    </>
  );
  const shirtV = (tone: Tone = 'white', deep = 88) => <Sh d={`M43.8 72 L50 ${deep} L56.2 72 Z`} tone={tone} line={0.5} />;
  const trackTop = (base: Base) => (
    <>
      <Sh d={BODY} tone={diario ? 'L' : 'M'} base={base} line={0.7} />
      <path d="M8 104 C16 92 28 86 40 82.6 M92 104 C84 92 72 86 60 82.6" fill="none" stroke={diario ? mix(secondary, PAPER, 0.15) : RIM} strokeOpacity={diario ? 1 : 0.6} strokeWidth={2.4} />
      <path d="M8 104 C16 92 28 86 40 82.6 M92 104 C84 92 72 86 60 82.6" fill="none" {...ln(0.8)} strokeWidth={0.4} />
      <Sh d="M43 69.8 L43 76.6 L50 80 L57 76.6 L57 69.8 L50 73.4 Z" tone="D" base={base} line={0.6} />
      <path d="M50 80 V135" {...ln()} strokeWidth={0.9} />
      <path d="M49 82 h2 M49 86 h2 M49 90 h2" {...ln(0.7)} strokeWidth={0.5} />
    </>
  );

  const clothes: ReactNode = (() => {
    switch (role) {
      case 'presidente':
        return (
          <>
            <Sh d={BODY} tone="X" line={0.7} />
            {shirtV()}
            {tieClub}
            {suitLapels('D')}
            <circle cx={40.6} cy={82.6} r={1.5} fill={diario ? mix(primary, PAPER, 0.1) : RIM} stroke={diario ? INK : 'none'} strokeWidth={0.4} />
            <path d="M68 92 l7 -0.6 l-0.6 2.4 l-6 0.4 Z" fill={diario ? PAPER : SIL.white} />
            <path d="M50 96 V135" {...ln(0.5)} strokeWidth={0.4} />
          </>
        );
      case 'tesorero':
        return (
          <>
            <Sh d={BODY} tone="white" line={0.7} />
            <path d="M14 108 C16 100 20 96 24 94 M86 108 C84 100 80 96 76 94" {...ln(0.5)} strokeWidth={0.5} fill="none" />
            <Sh d="M24 135 C25 104 32 88 43.6 76 L50 90 L50 135 Z" tone="D" line={0.6} />
            <Sh d="M76 135 C75 104 68 88 56.4 76 L50 90 L50 135 Z" tone="D" line={0.6} />
            <Sh d="M48.8 74.5 L51.2 74.5 L52 89 L50 92 L48 89 Z" tone="M" line={0.4} />
            {[97, 104, 111, 118].map((y) => <circle key={y} cx={51.8} cy={y} r={0.9} fill={diario ? PAPER : RIM} stroke={diario ? INK : 'none'} strokeWidth={0.3} />)}
            {/* Ledger and calculator. */}
            <Sh d="M66 99 L90 96 L92 122 L68 135 Z" tone="M" line={0.7} />
            <path d="M70 103 L88 101 M70 107 L88 105" {...ln(0.6)} strokeWidth={0.5} />
            <Sh d="M73 108 L86 106.6 L87.6 121 L74.6 122.6 Z" tone="X" line={0.5} />
            <Sh d="M75 109.6 L84.6 108.6 L85 112 L75.4 113 Z" tone="white" line={0.3} />
            {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={75.6 + c * 3.2 + r * 0.15} y={114.4 + r * 2.6 - c * 0.34} width={2.2} height={1.6} fill={diario ? PAPER : RIM} fillOpacity={diario ? 1 : 0.5} />))}
          </>
        );
      case 'representante':
        return (
          <>
            <Sh d={BODY} tone="white" base={diario ? 'paper' : 'paper'} line={0.8} />
            <path d="M20 135 C22 106 26 96 30 92 M80 135 C78 106 74 96 70 92" {...ln(0.4)} strokeWidth={0.5} fill="none" />
            {shirtV('X', 86)}
            <Sh d="M43.8 72.4 L50 87 L44.8 84 L38 79 Z" tone="L" line={0.7} />
            <Sh d="M56.2 72.4 L50 87 L55.2 84 L62 79 Z" tone="L" line={0.7} />
            <path d="M46.4 74 Q50 82 53.6 74" fill="none" stroke={diario ? '#9a7b22' : RIM} strokeOpacity={diario ? 1 : 0.7} strokeWidth={0.6} strokeDasharray="0.9 0.5" />
            {/* Phone to the ear. */}
            <Sh d="M61.6 36.5 L66.6 35.6 L68.4 47.4 L63.4 48.3 Z" tone="ink" line={0.4} />
            <Sh d="M59.6 50.6 C61 46.6 66.6 45.6 68.8 49.4 C70 53.6 67.4 57.4 63.6 57.8 C61.4 57 59.8 54.4 59.6 50.6 Z" tone={skinTone} base="skin" line={0.4} />
            <path d="M63.6 57.8 C64 66 66 72 68 79" fill="none" {...ln(0.7)} strokeWidth={0.6} />
          </>
        );
      case 'secretario-tecnico':
        return (
          <>
            <Sh d={BODY} tone="white" line={0.7} />
            <path d="M14 108 C16 100 20 96 24 94 M86 108 C84 100 80 96 76 94 M50 86 V135" {...ln(0.5)} strokeWidth={0.5} fill="none" />
            <Sh d="M43.6 72 L47 81 L50 75 Z" tone="white" line={0.6} />
            <Sh d="M56.4 72 L53 81 L50 75 Z" tone="white" line={0.6} />
            {/* Loosened tie. */}
            <Sh d="M49 77 L51.8 76.6 L53.6 92 L51.2 96 L48.6 92.4 Z" tone="D" line={0.4} transform="rotate(-6 51 86)" />
            {/* Folder with contracts. */}
            <g transform="rotate(-7 78 110)">
              <Sh d="M62 96 L92 96 L92 127 L62 127 Z" tone="D" line={0.8} />
              <Sh d="M65 92.5 L89 92.5 L89 124 L65 124 Z" tone="white" line={0.6} />
              <path d="M68 98 h17 M68 101.5 h17 M68 105 h13 M68 108.5 h17 M68 112 h10" {...ln(0.7)} strokeWidth={0.6} />
              <path d="M77 118 q2 -3 4 0 q2 3 4 -1" fill="none" {...ln()} strokeWidth={0.6} />
              <rect x={72} y={90.6} width={10} height={3.4} rx={0.8} fill={solidInk} />
            </g>
          </>
        );
      case 'ojeador':
        return (
          <>
            <Sh d={BODY} tone="D" line={0.7} />
            <path d="M12 112 C18 104 24 100 30 98 M88 112 C82 104 76 100 70 98 M20 114 h14 M66 114 h14" {...ln(0.4)} strokeWidth={0.5} fill="none" />
            <Sh d="M40.4 69.6 L43.6 80.6 L50 76.6 L56.4 80.6 L59.6 69.6 L56 68.4 L50 73.6 L44 68.4 Z" tone="M" line={0.6} />
            <path d="M50 76.6 V135" {...ln()} strokeWidth={0.9} />
            {/* Binoculars on a strap. */}
            <path d="M44.6 74 L41 92 M55.4 74 L59 92" {...ln()} strokeWidth={0.8} />
            <Sh d="M36.5 90 h9.6 v12.6 a2 2 0 0 1 -2 2 h-5.6 a2 2 0 0 1 -2 -2 Z" tone="ink" line={0.4} />
            <Sh d="M53.9 90 h9.6 v12.6 a2 2 0 0 1 -2 2 h-5.6 a2 2 0 0 1 -2 -2 Z" tone="ink" line={0.4} />
            <rect x={46} y={92.6} width={8} height={4} fill={solidInk} />
            <circle cx={41.3} cy={102.4} r={2.6} fill={diario ? '#6f6a5c' : RIM} fillOpacity={diario ? 1 : 0.5} />
            <circle cx={58.7} cy={102.4} r={2.6} fill={diario ? '#6f6a5c' : RIM} fillOpacity={diario ? 1 : 0.5} />
            {/* Notebook and pencil. */}
            <g transform="rotate(10 82 112)">
              <Sh d="M72 100 L92 100 L92 124 L72 124 Z" tone="white" line={0.7} />
              <path d="M72 101 h20" {...ln()} strokeWidth={1.6} strokeDasharray="1 1.2" />
              <path d="M75 106 h14 M75 109.5 h14 M75 113 h10 M75 116.5 h12" {...ln(0.6)} strokeWidth={0.5} />
              <path d="M88 96 L94 120" stroke={diario ? '#8a6a2a' : RIM} strokeOpacity={diario ? 1 : 0.6} strokeWidth={1.4} />
            </g>
          </>
        );
      case 'medico':
        return (
          <>
            {/* White coat: stays white. */}
            <Sh d={BODY} tone="white" line={0.9} />
            <Sh d="M44.4 72 L50 83 L55.6 72 Z" tone="L" line={0.5} />
            <path d="M43.6 72.4 L50 94 L45 135 M56.4 72.4 L50 94 L55 135" fill="none" {...ln()} strokeWidth={0.8} />
            <path d="M43.6 72.4 L37 80 L44 88 L50 94 M56.4 72.4 L63 80 L56 88 L50 94" fill="none" {...ln(0.8)} strokeWidth={0.7} />
            <path d="M65 99 h11 v8 h-11 Z" fill="none" {...ln(0.8)} strokeWidth={0.6} />
            <path d="M68 96.5 V102" {...ln()} strokeWidth={1.1} />
            {/* Stethoscope around the neck, clearly visible. */}
            <path d="M43.4 70 C38 78 37.6 90 42.6 96.6 M56.6 70 C62 78 62.6 86 59.4 92" fill="none" stroke={solidInk} strokeWidth={1.8} strokeLinecap="round" {...(!diario && { stroke: RIM, strokeOpacity: 0.95 })} />
            <path d="M42.6 96.6 C44 101 48 102 50.6 99" fill="none" stroke={diario ? INK : RIM} strokeWidth={1.4} />
            <circle cx={59.4} cy={94} r={3} fill={diario ? '#9aa1a6' : SIL.white} stroke={diario ? INK : RIM} strokeWidth={0.9} />
          </>
        );
      case 'preparador-fisico':
        return (
          <>
            {trackTop('paper')}
            {/* Whistle on a cord and stopwatch. */}
            <path d="M45 73 Q46 86 51.6 90.4 M55 73 Q55.6 82 53.8 89" fill="none" {...ln()} strokeWidth={0.7} />
            <Sh d="M50.2 89 h6.4 a2.6 2.6 0 0 1 0 5.2 h-6.4 Z" tone="M" line={0.6} />
            <g transform="translate(78 108)">
              <circle r={9} fill={diario ? PAPER : SIL.white} stroke={diario ? INK : RIM} strokeWidth={1.4} />
              <circle r={6.6} fill="none" {...ln(0.5)} strokeWidth={0.4} />
              <path d="M0 0 V-5.4 M0 0 L3.6 2.2" {...ln()} strokeWidth={1} />
              <rect x={-1.8} y={-12.6} width={3.6} height={3.2} fill={solidInk} />
              <path d="M-8 -8 L-5.6 -5.6" {...ln()} strokeWidth={1.4} />
            </g>
          </>
        );
      case 'segundo-entrenador':
        return (
          <>
            {trackTop('tint')}
            {crest(64, 90, 1.3)}
            {/* Tactics board in the hand. */}
            <g transform="rotate(-8 22 108)">
              <Sh d="M6 92 L36 92 L36 135 L6 135 Z" tone="M" line={0.8} />
              <path d="M9 95 h24 v27 h-24 Z M9 108.5 h24 M21 95 v27" fill="none" stroke={diario ? PAPER : RIM} strokeOpacity={diario ? 0.95 : 0.6} strokeWidth={0.5} />
              <path d="M12 99 l3 3 M15 99 l-3 3 M27 116 a2.2 2.2 0 1 0 0.1 0 M14 112 Q20 104 28 102" fill="none" stroke={diario ? PAPER : RIM} strokeWidth={0.9} />
              <rect x={16} y={89.6} width={10} height={3.6} rx={0.8} fill={solidInk} />
            </g>
          </>
        );
      case 'entrenador-juveniles':
        return (
          <>
            {trackTop('tint')}
            {crest(64, 90, 1.1)}
            {/* Ball under the arm. */}
            <g transform="translate(82 110)">
              <circle r={11} fill={diario ? PAPER : SIL.white} stroke={diario ? INK : RIM} strokeWidth={1} />
              <path d="M0 -3.6 L3.4 -1.1 L2.1 2.9 L-2.1 2.9 L-3.4 -1.1 Z" fill={solidInk} />
              <path d="M0 -3.6 V-11 M3.4 -1.1 L10.4 -3.4 M2.1 2.9 L6.4 8.9 M-2.1 2.9 L-6.4 8.9 M-3.4 -1.1 L-10.4 -3.4" {...ln(0.8)} strokeWidth={0.6} />
            </g>
            <path d="M70 100 C74 96 82 96 92 102" fill="none" {...ln(0.7)} strokeWidth={0.6} />
          </>
        );
      case 'periodista':
        return (
          <>
            <Sh d={BODY} tone="M" line={0.7} />
            {shirtV('white', 90)}
            {suitLapels('D')}
            {/* Press credential on a lanyard. */}
            <path d="M45 73 L48.4 96 M55 73 L51.6 96" {...ln()} strokeWidth={0.8} />
            <Sh d="M44.6 95.6 L55.4 95.6 L55.4 109 L44.6 109 Z" tone="white" line={0.6} />
            <rect x={44.6} y={95.6} width={10.8} height={3.4} fill={diario ? '#9b2a22' : tintSil} />
            <text x={50} y={104.6} fontSize={2.8} fontWeight={700} textAnchor="middle" fill={diario ? INK : RIM} fontFamily="Arial, sans-serif" letterSpacing={0.1}>PRENSA</text>
            {/* Microphone with the paper's cube, and a notepad. */}
            <g transform="rotate(-12 22 104)">
              <rect x={19.6} y={98} width={4.8} height={28} rx={1.6} fill={solidInk} />
              <Sh d="M14.6 92 h14.8 v9.4 h-14.8 Z" tone="X" line={0.4} />
              <text x={22} y={99.4} fontSize={6.4} fontWeight={700} textAnchor="middle" fill={diario ? PAPER : RIM} fontFamily="Georgia, serif">T</text>
              <circle cx={22} cy={86} r={6.6} fill={diario ? '#55524a' : SIL.M} stroke={diario ? INK : RIM} strokeWidth={0.7} />
              <path d="M16.4 84 h11.2 M16 87.6 h12 M22 79.6 v12.8" {...ln(0.5)} strokeWidth={0.5} />
            </g>
            <g transform="rotate(8 80 112)">
              <Sh d="M70 100 L90 100 L90 124 L70 124 Z" tone="white" line={0.7} />
              <path d="M70 101 h20" {...ln()} strokeWidth={1.6} strokeDasharray="1 1.2" />
              <path d="M73 106 h14 M73 109.5 h14 M73 113 h10" {...ln(0.6)} strokeWidth={0.5} />
            </g>
          </>
        );
      case 'hincha':
        return (
          <>
            <Sh d={BODY} tone="L" base="tint" line={0.7} />
            <g clipPath={`url(#body${uid})`}>
              {[10, 30, 50, 70, 90].map((x) => (
                <rect key={x} x={x - 5} y={70} width={10} height={60} fill={diario ? mix(secondary, PAPER, 0.25) : tint2Sil} />
              ))}
            </g>
            <Sh d="M41.6 70 C45 77.4 55 77.4 58.4 70 L60.6 76.6 C55 83 45 83 39.4 76.6 Z" tone="M" base="tint2" line={0.6} />
            <Sh d="M53 78 L60 78 L61 104 L54 104 Z" tone="M" base="tint" line={0.6} />
            <path d="M54 104 v3 M56.4 104 v3 M58.8 104 v3" {...ln(0.8)} strokeWidth={0.6} />
          </>
        );
    }
  })();

  // ---------------- face
  const cap = role === 'entrenador-juveniles';
  const hairBack = HAIR_BACK[t.hair];
  const features = diario;
  const glasses = t.glasses || role === 'tesorero';
  const facialHair = t.facial;
  const browD = (side: 1 | -1) => {
    const x0 = 50 - side * 8.6;
    const x1 = 50 - side * 2.4;
    return `M${x0} ${42.2 + t.brow * 0.4} Q${(x0 + x1) / 2} ${40.8 - t.brow * 0.3} ${x1} ${41.7}`;
  };

  // Hair strands: thin curves seeded by the name, clipped to the hair shape.
  const strands = (() => {
    const out: string[] = [];
    let h = t.seed;
    const r = () => (h = (Math.imul(h, 1103515245) + 12345) >>> 0) / 4294967296;
    for (let i = 0; i < 16; i++) {
      const x = 37 + r() * 26;
      const y = 22 + r() * 6;
      const dx = (x - 50) * 0.35 + (r() - 0.5) * 4;
      out.push(`M${x.toFixed(1)} ${y.toFixed(1)} q${(dx / 2).toFixed(1)} ${(4 + r() * 4).toFixed(1)} ${dx.toFixed(1)} ${(9 + r() * 10).toFixed(1)}`);
    }
    return out;
  })();

  const faceArt = (
    <g className="avatar__head">
      {hairBack && <Sh d={hairBack} tone={hairTone} line={0.5} />}
      <Sh d={NECK} tone={skinTone} base="skin" line={0.4} />
      {diario && (
        <g filter={`url(#soft${uid})`}>
          {/* Shadow under the jaw and on the trapezius. */}
          <path d="M43.4 58 Q50 70 56.6 58 L56.8 66 Q50 75 43.2 66 Z" fill={INK} opacity={0.38} />
          <path d="M56 73 Q60 76 64 78.6 L60 80 Q57 77 56 75 Z" fill={INK} opacity={0.25} />
        </g>
      )}
      {clothes}
      {/* Head slightly wider than drawn: adult, not stylised. */}
      <g transform="translate(50 0) scale(1.08 1) translate(-50 0)">
      <Sh d={EAR_L} tone={skinTone} base="skin" line={0.4} />
      <Sh d={EAR_R} tone={skinTone} base="skin" line={0.4} />
      {diario && <path d="M63.4 42.6 C64.6 43.4 64.6 46.4 63.6 47.6" fill="none" stroke={INK} strokeOpacity={0.35} strokeWidth={0.5} />}
      <Sh d={head(t.jaw)} tone={skinTone} base="skin" line={0.45} />
      {features && (
        <g>
          {/* Key light from the left: the right half of the face falls into a soft shadow. */}
          <path d={head(t.jaw)} fill={`url(#side${uid})`} />
          <g filter={`url(#soft${uid})`}>
            <ellipse cx={45} cy={44.4} rx={4.4} ry={2.3} fill={INK} opacity={0.22} />
            <ellipse cx={55.2} cy={44.6} rx={4.4} ry={2.4} fill={INK} opacity={0.3} />
            <path d="M57.8 49 Q60.6 53 59.4 58 Q57 55 56.8 51 Z" fill={INK} opacity={0.22} />
            <path d="M51 46 L53.2 52.4 L51 53.4 Z" fill={INK} opacity={0.3} />
            <ellipse cx={50} cy={61.6} rx={3.6} ry={1.3} fill={INK} opacity={0.22} />
            <ellipse cx={44.6} cy={38} rx={5} ry={2.4} fill="#ffffff" opacity={0.22} />
            <ellipse cx={44} cy={50.6} rx={2.6} ry={3} fill="#ffffff" opacity={0.16} />
          </g>
          {/* Expression lines by age. */}
          {t.age >= 1 && <path d="M44.4 35.8 Q50 34.9 55.6 35.8" fill="none" stroke={INK} strokeOpacity={0.22} strokeWidth={0.35} />}
          {t.age >= 1 && <path d="M46.8 52.6 Q45.4 55.4 46.2 58 M53.2 52.6 Q54.6 55.4 53.8 58" fill="none" stroke={INK} strokeOpacity={0.28} strokeWidth={0.4} />}
          {t.age === 2 && (
            <path
              d="M44.6 37.8 Q50 37.1 55.4 37.8 M48.6 40.6 v1.6 M51.4 40.6 v1.6 M40.8 46.2 l1.8 0.9 M41 47.6 l1.6 0.4 M59.2 46.2 l-1.8 0.9 M59 47.6 l-1.6 0.4 M43.6 47.4 Q45 48.4 46.6 47.8 M53.4 47.8 Q55 48.4 56.4 47.4 M45 62 Q46.2 64 48 64.6"
              fill="none"
              stroke={INK}
              strokeOpacity={0.3}
              strokeWidth={0.32}
            />
          )}
        </g>
      )}
      {cap ? (
        <>
          {t.hair !== 'pelado' && <Sh d="M36.8 44 C36.4 40 37 37.4 38.4 36 L39.8 44 Z M63.2 44 C63.6 40 63 37.4 61.6 36 L60.2 44 Z" tone={hairTone} line={0} />}
          <Sh d="M36.2 38.4 C35.8 27 42 22.6 50 22.6 C58 22.6 64.2 27 63.8 38.4 Z" tone="M" base="tint" line={0.5} />
          <path d="M50 22.8 V37 M43 24.6 Q41.4 30 41.6 37.4 M57 24.6 Q58.6 30 58.4 37.4" fill="none" {...ln(0.35)} strokeWidth={0.35} />
          <Sh d="M36.6 37.2 Q50 33.4 63.4 37.2 Q64.6 40.4 63.6 40.8 Q50 37.4 36.4 40.8 Q35.4 40.4 36.6 37.2 Z" tone="X" line={0.4} />
          {diario && <path d="M37 41 Q50 38 63 41 L63 44 Q50 41 37 44 Z" fill={INK} opacity={0.25} filter={`url(#soft${uid})`} />}
          <circle cx={50} cy={29.4} r={2.4} fill={diario ? mix(secondary, PAPER, 0.2) : RIM} fillOpacity={diario ? 1 : 0.6} />
        </>
      ) : (
        <>
          <Sh d={HAIR[t.hair]} tone={hairTone} line={0.35} />
          {diario && (
            <g clipPath={`url(#hairclip${uid})`} fill="none" strokeLinecap="round">
              {strands.map((d, i) => (
                <path key={i} d={d} stroke={i % 3 === 0 ? INK : '#ffffff'} strokeOpacity={i % 3 === 0 ? 0.35 : dark ? 0.16 : 0.32} strokeWidth={i % 2 ? 0.35 : 0.5} />
              ))}
            </g>
          )}
        </>
      )}
      {features && !cap && t.hair === 'pelado' && <ellipse cx={45.6} cy={31} rx={4.6} ry={1.8} fill="#ffffff" opacity={0.3} filter={`url(#soft${uid})`} />}
      {features && (
        <>
          {/* Brows made of short hairs. */}
          <path d={`${browD(1)} ${browD(-1)}`} fill="none" stroke={HAIR_GRAYS[hairTone]} strokeOpacity={0.9} strokeWidth={1.05} strokeLinecap="round" />
          <path d={`${browD(1)} ${browD(-1)}`} fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={0.35} strokeDasharray="0.4 0.35" />
          {/* Almond eyes: sclera, iris, upper lid and crease. */}
          <g className="avatar__eyes">
            <path d="M42.4 45 Q45 43.3 47.8 45 Q45 46.3 42.4 45 Z M52.2 45 Q55 43.3 57.6 45 Q55 46.3 52.2 45 Z" fill="#e7e2d6" />
            <circle cx={45.2} cy={44.95} r={1.05} fill="#4a4134" />
            <circle cx={55} cy={44.95} r={1.05} fill="#4a4134" />
            <circle cx={45.2} cy={44.95} r={0.45} fill={INK} />
            <circle cx={55} cy={44.95} r={0.45} fill={INK} />
            <circle cx={44.8} cy={44.6} r={0.22} fill="#fff" />
            <circle cx={54.6} cy={44.6} r={0.22} fill="#fff" />
            <path d="M42.3 45 Q45 43 47.9 44.9 M52.1 44.9 Q55 43 57.7 45" fill="none" stroke={INK} strokeWidth={0.55} strokeLinecap="round" />
          </g>
          <path d="M42.8 43.5 Q45 42.4 47.4 43.4 M52.6 43.4 Q55 42.4 57.2 43.5 M43 46 Q45 46.7 47.4 45.6 M52.6 45.6 Q55 46.7 57 46" fill="none" stroke={INK} strokeOpacity={0.25} strokeWidth={0.3} />
          {/* Nose: bridge highlight, tip and nostrils. */}
          <path d="M49.4 46 Q49 50 48.4 52.4" fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={0.8} />
          <path d="M47.6 52.4 Q48.4 53.6 50 53.7 Q51.6 53.6 52.6 52.4" fill="none" stroke={INK} strokeOpacity={0.5} strokeWidth={0.4} />
          <ellipse cx={48.6} cy={53.1} rx={0.6} ry={0.35} fill={INK} opacity={0.55} />
          <ellipse cx={51.4} cy={53.1} rx={0.6} ry={0.35} fill={INK} opacity={0.6} />
          {/* Lips. */}
          <path
            d={t.smile ? 'M46.2 58.2 Q48 57.4 50 57.8 Q52 57.3 54.2 57.6 Q52 58.6 50 58.6 Q48 58.7 46.2 58.2 Z' : 'M46.4 58.4 Q48 57.6 50 58 Q52 57.6 53.6 58.4 Q52 58.8 50 58.8 Q48 58.8 46.4 58.4 Z'}
            fill={INK}
            opacity={0.42}
          />
          <path d={t.smile ? 'M46.4 58.4 Q50 59.2 54 57.8' : 'M46.6 58.5 Q50 58.9 53.4 58.5'} fill="none" stroke={INK} strokeOpacity={0.75} strokeWidth={0.4} />
          <path d="M47.4 59.2 Q50 61 52.6 59.2 Q50 60.2 47.4 59.2 Z" fill="#ffffff" opacity={0.18} />
          <path d="M49.2 55 Q50 56.4 50.8 55" fill="none" stroke={INK} strokeOpacity={0.25} strokeWidth={0.3} />
        </>
      )}
      {facialHair === 'barba' && <Sh d={BEARD(t.jaw)} tone={hairTone === 'ink' ? 'X' : hairTone} line={0} rim={false} />}
      {facialHair === 'barba' && features && <path d={BEARD(t.jaw)} fill={`url(#stub${uid})`} />}
      {(facialHair === 'sombra' || (facialHair === 'ninguno' && !t.female && t.age >= 1)) && features && (
        <path d={BEARD(t.jaw)} fill={`url(#stub${uid})`} opacity={facialHair === 'sombra' ? 0.9 : 0.35} />
      )}
      {features && (facialHair === 'bigote' || facialHair === 'barba' || facialHair === 'candado') && (
        <>
          <path d={MUSTACHE} fill={HAIR_GRAYS[hairTone]} opacity={0.92} />
          <path d={MUSTACHE} fill={`url(#stub${uid})`} />
        </>
      )}
      {features && facialHair === 'candado' && <path d={GOATEE} fill={HAIR_GRAYS[hairTone]} opacity={0.9} />}
      {glasses &&
        (features ? (
          <g fill="none" stroke={INK} strokeWidth={0.55}>
            <rect x={41.4} y={42.4} width={7.6} height={5} rx={1.6} fill="#ffffff" fillOpacity={0.08} />
            <rect x={51} y={42.4} width={7.6} height={5} rx={1.6} fill="#ffffff" fillOpacity={0.08} />
            <path d="M49 44 Q50 43.2 51 44 M41.4 44 L37.4 43 M58.6 44 L62.6 43" />
            <path d="M42.6 43.4 l1.6 -0.6" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={0.4} />
          </g>
        ) : (
          <path d="M41.6 45 h7 M51.4 45 h7" stroke={RIM} strokeOpacity={0.7} strokeWidth={0.6} />
        ))}
      </g>
    </g>
  );

  // ---------------- background
  const background = diario ? (
    <>
      <rect width={100} height={135} fill={`url(#back${uid})`} />
      <rect width={100} height={135} fill={primary} opacity={0.12} />
      <rect width={100} height={135} fill={`url(#screen${uid})`} />
    </>
  ) : (
    <>
      <rect width={100} height={135} fill={`url(#night${uid})`} />
      <path d="M8 6 L-10 135 L40 135 Z M92 6 L60 135 L110 135 Z" fill="#dce9ff" opacity={0.05} />
      <circle cx={10} cy={7} r={18} fill={`url(#glow${uid})`} />
      <circle cx={90} cy={7} r={18} fill={`url(#glow${uid})`} />
      {[0, 1, 2].map((c) => [0, 1].map((r) => (
        <g key={`${c}${r}`}>
          <rect x={4 + c * 4} y={3 + r * 3.4} width={3} height={2.4} fill="#f3f7ff" opacity={0.95} />
          <rect x={84 + c * 4} y={3 + r * 3.4} width={3} height={2.4} fill="#f3f7ff" opacity={0.95} />
        </g>
      )))}
      <path d="M0 74 Q50 66 100 74 L100 135 L0 135 Z" fill="#0b1426" opacity={0.85} />
      <path d="M0 74 Q50 66 100 74" fill="none" stroke="#3c5a85" strokeOpacity={0.5} strokeWidth={0.5} />
    </>
  );

  return (
    <svg className="avatar__art" viewBox="0 0 100 135" width={Math.round(size * 0.74)} height={size} role="img" aria-label={label} style={{ '--blink-delay': `${t.blinkDelay}s` } as CSSProperties}>
      <defs>
        <clipPath id={`frame${uid}`}>
          <rect width={100} height={135} />
        </clipPath>
        <clipPath id={`body${uid}`}>
          <path d={BODY} />
        </clipPath>
        <clipPath id={`hairclip${uid}`}>
          <path d={HAIR[t.hair]} />
        </clipPath>
        {diario ? (
          <>
            {(Object.entries(GRAYS) as [Tone, [string, string]][]).map(([k, [a, b]]) => (
              <linearGradient key={k} id={`g${k}${uid}`} x1="0" y1="0" x2="1" y2="0.35">
                <stop offset="0" stopColor={a} />
                <stop offset="1" stopColor={b} />
              </linearGradient>
            ))}
            {(Object.entries(GRAYS) as [Tone, [string, string]][]).map(([k, [a, b]]) => (
              <g key={`t${k}`}>
                <linearGradient id={`tint${k}${uid}`} x1="0" y1="0" x2="1" y2="0.35">
                  <stop offset="0" stopColor={mix(primary, a, 0.55)} />
                  <stop offset="1" stopColor={mix(primary, b, 0.45)} />
                </linearGradient>
                <linearGradient id={`tintb${k}${uid}`} x1="0" y1="0" x2="1" y2="0.35">
                  <stop offset="0" stopColor={mix(secondary, a, 0.55)} />
                  <stop offset="1" stopColor={mix(secondary, b, 0.45)} />
                </linearGradient>
              </g>
            ))}
            <radialGradient id={`skin${uid}`} cx="0.36" cy="0.34" r="0.78">
              <stop offset="0" stopColor={SKIN_GRAYS[skinTone][0]} />
              <stop offset="0.6" stopColor={SKIN_GRAYS[skinTone][1]} />
              <stop offset="1" stopColor={SKIN_GRAYS[skinTone][2]} />
            </radialGradient>
            <linearGradient id={`side${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.45" stopColor={INK} stopOpacity={0} />
              <stop offset="1" stopColor={INK} stopOpacity={0.42} />
            </linearGradient>
            <linearGradient id={`hairg${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={mix(HAIR_GRAYS[hairTone], '#ffffff', 0.18)} />
              <stop offset="1" stopColor={mix(HAIR_GRAYS[hairTone], INK, 0.35)} />
            </linearGradient>
            <pattern id={`screen${uid}`} width={1.3} height={1.3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <circle cx={0.65} cy={0.65} r={0.3} fill={INK} opacity={0.32} />
            </pattern>
            <pattern id={`stub${uid}`} width={1.1} height={1.1} patternUnits="userSpaceOnUse" patternTransform="rotate(17)">
              <circle cx={0.55} cy={0.55} r={0.22} fill={INK} opacity={0.55} />
            </pattern>
            <radialGradient id={`vig${uid}`} cx="0.42" cy="0.38" r="0.8">
              <stop offset="0.5" stopColor={INK} stopOpacity={0} />
              <stop offset="1" stopColor={INK} stopOpacity={0.5} />
            </radialGradient>
            <radialGradient id={`back${uid}`} cx="0.3" cy="0.3" r="0.9">
              <stop offset="0" stopColor="#c9cdd0" />
              <stop offset="1" stopColor="#6c7378" />
            </radialGradient>
            <filter id={`soft${uid}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={1.1} />
            </filter>
          </>
        ) : (
          <>
            <linearGradient id={`night${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#24406b" />
              <stop offset="0.55" stopColor="#0f1d36" />
              <stop offset="1" stopColor="#060a14" />
            </linearGradient>
            <radialGradient id={`glow${uid}`}>
              <stop offset="0" stopColor="#eaf2ff" stopOpacity={0.75} />
              <stop offset="1" stopColor="#eaf2ff" stopOpacity={0} />
            </radialGradient>
          </>
        )}
      </defs>
      <g clipPath={`url(#frame${uid})`}>
        {background}
        {/* Framed like a press photo: the bust fills the picture. */}
        <g transform="translate(50 43) scale(1.2) translate(-50 -46)">{faceArt}</g>
        {diario && <rect width={100} height={135} fill={`url(#vig${uid})`} />}
        {!diario && <rect x={0} y={131.6} width={100} height={3.4} fill={primary} opacity={0.85} />}
      </g>
      <RoleBadge role={role} diario={diario} />
      <rect x={0.5} y={0.5} width={99} height={134} fill="none" stroke={diario ? INK : '#3c5a85'} strokeWidth={0.8} />
      {diario && <rect x={2.4} y={2.4} width={95.2} height={130.2} fill="none" stroke={PAPER} strokeOpacity={0.7} strokeWidth={0.6} />}
    </svg>
  );
}

// ---------------------------------------------------------------- role badge

const ICON: Record<PersonaRole, ReactNode> = {
  medico: <path d="M-1.9 -5.6 h3.8 v3.7 h3.7 v3.8 h-3.7 v3.7 h-3.8 v-3.7 h-3.7 v-3.8 h3.7 Z" />,
  'preparador-fisico': <path d="M-6 -3 h6.4 a3.6 3.6 0 1 1 -0.6 5.8 l-1.2 -1.4 h-4.6 Z M5.2 -5.6 l1.6 -1.6" />,
  'segundo-entrenador': <path d="M-5.6 -4.4 h11.2 v8.8 h-11.2 Z M-3.6 -2.6 l2.2 2.2 M-1.4 -2.6 l-2.2 2.2 M2.6 1.8 a1.3 1.3 0 1 0 0.1 0" fillRule="evenodd" />,
  'entrenador-juveniles': <path d="M0 -5.6 a5.6 5.6 0 1 0 0.1 0 Z M0 -2.2 L2.1 -0.7 L1.3 1.8 L-1.3 1.8 L-2.1 -0.7 Z" fillRule="evenodd" />,
  ojeador: <path d="M-5.6 -3 h4.2 v6.4 a2.1 2.1 0 0 1 -4.2 0 Z M1.4 -3 h4.2 v6.4 a2.1 2.1 0 0 1 -4.2 0 Z M-1.4 -1.6 h2.8 v2 h-2.8 Z" />,
  'secretario-tecnico': <path d="M-4.4 -5.6 h6 l2.8 2.8 v8.4 h-8.8 Z M-2.6 -1 h5.2 M-2.6 1.4 h5.2 M-2.6 3.6 h3.4" />,
  presidente: <path d="M-5.6 -2.4 h11.2 v7.2 h-11.2 Z M-2 -2.4 v-1.8 h4 v1.8" />,
  tesorero: <path d="M-4.4 -5.6 h8.8 v11.2 h-8.8 Z M-3 -4.2 h6 v2.6 h-6 Z M-3 0 h1.6 v1.4 h-1.6 Z M0.7 0 h1.6 v1.4 h-1.6 Z M-3 2.6 h1.6 v1.4 h-1.6 Z M0.7 2.6 h1.6 v1.4 h-1.6 Z" fillRule="evenodd" />,
  representante: <path d="M-2.8 -5.6 h5.6 a0.8 0.8 0 0 1 0.8 0.8 v9.6 a0.8 0.8 0 0 1 -0.8 0.8 h-5.6 a0.8 0.8 0 0 1 -0.8 -0.8 v-9.6 a0.8 0.8 0 0 1 0.8 -0.8 Z M-1.8 -4 h3.6 v6.8 h-3.6 Z" fillRule="evenodd" />,
  periodista: <path d="M0 -6 a2.8 2.8 0 0 1 2.8 2.8 v2.6 a2.8 2.8 0 0 1 -5.6 0 v-2.6 a2.8 2.8 0 0 1 2.8 -2.8 Z M-0.6 2.4 h1.2 v2.4 h2.4 v1.2 h-6 v-1.2 h2.4 Z" />,
  hincha: <path d="M-4.8 -5.6 h1.2 v11.2 h-1.2 Z M-3.6 -5.2 h8.4 l-2.2 2.8 l2.2 2.8 h-8.4 Z" />,
};

function RoleBadge({ role, diario }: { role: PersonaRole; diario: boolean }) {
  return (
    <g className="avatar__badge" transform="translate(86 121) scale(1.2)">
      <circle r={9} fill={diario ? '#1b1914' : '#0a1222'} stroke={diario ? '#f1ebdc' : '#bcd4ee'} strokeWidth={1.1} />
      <g fill={diario ? '#f1ebdc' : '#dce9ff'} stroke={diario ? '#f1ebdc' : '#dce9ff'} strokeWidth={0.5} strokeLinejoin="round">
        {ICON[role]}
      </g>
    </g>
  );
}
