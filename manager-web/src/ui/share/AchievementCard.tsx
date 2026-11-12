import { forwardRef, useState } from 'react';
import type { Achievement, AchievementKind, SharedAchievement } from '../../engine/game/achievements';
import { initials } from '../components/ClubBadge';
import { compLogoUrl } from '../competitions/CompetitionLogo';
import { identityOf, inkOn, mix } from '../competitions/identity';
import { GAME_NAME } from '../config';
import { crestUrl } from '../crests';
import { longDate } from '../screens/shared';

// Celebration card for a title or a promotion, drawn as a self-contained SVG (1080×1350,
// the 4:5 social format) so it can be exported to PNG: no CSS variables, no external styles,
// literal colours only. Real crests and logos are <image href>, inlined as data URLs on export.

export const CARD_W = 1080;
export const CARD_H = 1350;

/** What the card needs, from a full career achievement or from a shared link. */
export interface CardData {
  kind: AchievementKind;
  manager: string;
  club: string;
  clubId: string;
  competition: string;
  competitionId: string;
  season: number;
  date: string;
  points: number;
}

export const isShared = (a: Achievement | SharedAchievement): a is SharedAchievement => 'k' in a && 'm' in a;

export function cardData(a: Achievement | SharedAchievement): CardData {
  if (isShared(a)) return { kind: a.k, manager: a.m, club: a.c, clubId: a.cid ?? '', competition: a.n, competitionId: a.nid ?? '', season: a.s, date: a.d, points: a.p };
  return { kind: a.kind, manager: a.managerName, club: a.clubName, clubId: a.clubId, competition: a.competitionName, competitionId: a.competitionId, season: a.season, date: a.date, points: a.points };
}

/** "2026-05-17" → "domingo 17 de mayo de 2026"; anything else is shown as it comes. */
function dateText(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? longDate(iso.slice(0, 10)) : iso;
}

/** Font size so `text` fits in `width` (condensed type is about 0.5 em per character). */
const fit = (text: string, max: number, width: number, em = 0.52) => Math.round(Math.min(max, width / Math.max(1, text.length * em)));

const FONT_DISPLAY = "Oswald, 'Barlow Condensed', 'Arial Narrow', Impact, sans-serif";
const FONT_COND = "'Barlow Condensed', Oswald, 'Arial Narrow', sans-serif";
const FILETE = { red: '#d7263d', green: '#1b9e5a', yellow: '#f2b705', celeste: '#5bc0eb', gold: '#c9a227' };

// Deterministic sky of stars (x, y, size, opacity).
const STARS: [number, number, number, number][] = [
  [120, 230, 14, 0.9], [960, 220, 16, 0.9], [180, 420, 9, 0.6], [905, 395, 10, 0.6], [95, 610, 12, 0.7],
  [990, 640, 12, 0.7], [210, 760, 8, 0.5], [870, 770, 8, 0.5], [140, 905, 10, 0.6], [945, 900, 10, 0.6],
  [300, 340, 6, 0.45], [780, 330, 6, 0.45], [420, 160, 5, 0.4], [665, 160, 5, 0.4], [250, 1010, 6, 0.4],
  [830, 1015, 6, 0.4], [330, 520, 5, 0.35], [750, 520, 5, 0.35],
];

function starPath(cx: number, cy: number, r: number, points = 5, inner = 0.42): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI / points) * i - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }
  return d + 'Z';
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Fileteado corner scroll (same drawing as Filete.tsx, with literal colours for export). */
function Corner({ x, y, flipX, flipY, scale }: { x: number; y: number; flipX?: boolean; flipY?: boolean; scale: number }) {
  const t = `translate(${x} ${y}) scale(${flipX ? -scale : scale} ${flipY ? -scale : scale})`;
  return (
    <g transform={t} fill="none" strokeLinecap="round">
      <path d="M3 45 C3 22 12 7 34 4" stroke={FILETE.red} strokeWidth="2.6" />
      <path d="M6.5 45 C6.5 25 15 11 34 8" stroke={FILETE.gold} strokeWidth="0.9" />
      <path d="M34 4 C43 3 46 12 39 15 C34 17 32 11 36 10.5" stroke={FILETE.red} strokeWidth="2.4" />
      <path d="M9 33 C13 24 20 22 23 14 C24 21 19 27 9 33 Z" fill={FILETE.green} stroke="none" />
      <path d="M10.5 31 C14 26 18 23 21.5 17" stroke={FILETE.yellow} strokeWidth="0.8" />
      <path d="M3 30 C1 25 5 21 8.5 24" stroke={FILETE.celeste} strokeWidth="1.6" />
      <circle cx="38" cy="22" r="2" fill={FILETE.yellow} stroke="none" />
      <circle cx="25" cy="7.5" r="1.2" fill={FILETE.celeste} stroke="none" />
    </g>
  );
}

/** Laurel branch up one side of the medallion (side 1 = left, -1 = right). */
function Laurel({ cx, cy, r, side, color }: { cx: number; cy: number; r: number; side: 1 | -1; color: string }) {
  const a0 = Math.PI / 2 + side * 0.75;
  const a1 = Math.PI / 2 + side * 2.75;
  const pt = (a: number, rr = r) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
  const leaves = [];
  for (let i = 0; i < 10; i++) {
    const a = a0 + (a1 - a0) * (i / 9.4);
    for (const out of [1, -1]) {
      const rr = r + out * 13;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      // along the stem (tangent), tilted outwards or inwards, pointing up
      const deg = (a * 180) / Math.PI + (side === 1 ? 0 : 180) + out * side * 32;
      leaves.push(<ellipse key={`${i}${out}`} cx={x.toFixed(1)} cy={y.toFixed(1)} rx="9" ry="24" transform={`rotate(${deg.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})`} fill={color} opacity={0.98 - i * 0.035} />);
    }
  }
  return (
    <g>
      <path d={`M${pt(a0)} A${r} ${r} 0 0 ${side === 1 ? 1 : 0} ${pt(a1)}`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {leaves}
    </g>
  );
}

const SHIELD = 'M4 3 H40 V22 C40 35 31 43 22 47 C13 43 4 35 4 22 Z';

export interface AchievementCardProps {
  achievement: Achievement | SharedAchievement;
  /** Club colours for the generic shield when there is no real crest (from the world, if at hand). */
  colors?: { primary: string; secondary: string };
  className?: string;
  /** Leave the real images out (tests, or a build without crests). */
  noImages?: boolean;
}

export const AchievementCard = forwardRef<SVGSVGElement, AchievementCardProps>(function AchievementCard({ achievement, colors, className, noImages }, ref) {
  const d = cardData(achievement);
  const ident = identityOf(d.competitionId || 'amistoso');
  const { primary, secondary, accent } = ident.palette;
  const ink = inkOn(primary);
  const onAccent = inkOn(accent);
  const deep = mix(primary, '#000000', 0.45);
  const [crestFailed, setCrestFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const crest = noImages || crestFailed || !d.clubId ? null : crestUrl(d.clubId);
  const logo = noImages || logoFailed || !d.competitionId ? null : compLogoUrl(d.competitionId);
  const uid = `ac-${hash(`${d.clubId}:${d.competitionId}:${d.season}:${d.kind}`).toString(36)}`;

  const shout = d.kind === 'titulo' ? '¡CAMPEÓN!' : '¡ASCENSO!';
  const subtitle = d.kind === 'titulo' ? 'Campeón de' : 'Ascenso en';
  const shieldA = colors?.primary ?? secondary;
  const shieldB = colors?.secondary ?? accent;
  const pattern = hash(d.clubId || d.club) % 4;
  const MX = 540;
  const MY = 610;
  const MR = 205;

  // Starburst seal with the points.
  const seal = { x: 862, y: 432, r: 104 };
  let sealPath = '';
  for (let i = 0; i < 48; i++) {
    const rr = i % 2 === 0 ? seal.r : seal.r * 0.88;
    const a = (Math.PI / 24) * i;
    sealPath += `${i === 0 ? 'M' : 'L'}${(seal.x + rr * Math.cos(a)).toFixed(1)} ${(seal.y + rr * Math.sin(a)).toFixed(1)}`;
  }

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      className={'achievement-card' + (className ? ` ${className}` : '')}
      viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      width={CARD_W}
      height={CARD_H}
      role="img"
      aria-label={`${shout} ${d.manager} con ${d.club}, ${d.competition} ${d.season}`}
    >
      <title>{`${shout} ${d.manager} · ${d.club} · ${d.competition} ${d.season}`}</title>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={primary} />
          <stop offset="0.55" stopColor={mix(primary, secondary, 0.35)} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx={MX} cy={MY} r="560" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={accent} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={accent} stopOpacity="0.14" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-disc`} cx="0.5" cy="0.38" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.75" stopColor="#f3eee2" />
          <stop offset="1" stopColor="#d9d0bb" />
        </radialGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={mix(accent, '#ffffff', 0.45)} />
          <stop offset="0.5" stopColor={accent} />
          <stop offset="1" stopColor={mix(accent, '#000000', 0.25)} />
        </linearGradient>
        <clipPath id={`${uid}-shield`}>
          <path d={SHIELD} />
        </clipPath>
      </defs>

      {/* background, rays and glow */}
      <rect width={CARD_W} height={CARD_H} fill={`url(#${uid}-bg)`} />
      <g opacity="0.09" fill={accent}>
        {Array.from({ length: 18 }, (_, i) => {
          const a0 = (Math.PI / 9) * i;
          const a1 = a0 + Math.PI / 18;
          const R = 1300;
          return <path key={i} d={`M${MX} ${MY} L${(MX + R * Math.cos(a0)).toFixed(0)} ${(MY + R * Math.sin(a0)).toFixed(0)} L${(MX + R * Math.cos(a1)).toFixed(0)} ${(MY + R * Math.sin(a1)).toFixed(0)} Z`} />;
        })}
      </g>
      <rect width={CARD_W} height={CARD_H} fill={`url(#${uid}-glow)`} />
      {STARS.map(([x, y, r, o], i) => (
        <path key={i} d={starPath(x, y, r)} fill={accent} opacity={o} />
      ))}

      {/* frame */}
      <rect x="34" y="34" width={CARD_W - 68} height={CARD_H - 68} rx="30" fill="none" stroke={accent} strokeWidth="6" />
      <rect x="54" y="54" width={CARD_W - 108} height={CARD_H - 108} rx="20" fill="none" stroke={accent} strokeWidth="2" opacity="0.55" />
      <Corner x={60} y={60} scale={3.3} />
      <Corner x={CARD_W - 60} y={60} scale={3.3} flipX />
      <Corner x={60} y={CARD_H - 60} scale={3.3} flipY />
      <Corner x={CARD_W - 60} y={CARD_H - 60} scale={3.3} flipX flipY />

      {/* season kicker */}
      <g fontFamily={FONT_COND} fontWeight="700" textAnchor="middle">
        <line x1="190" y1="128" x2="275" y2="128" stroke={accent} strokeWidth="3" />
        <line x1="805" y1="128" x2="890" y2="128" stroke={accent} strokeWidth="3" />
        <path d={starPath(292, 128, 9)} fill={accent} />
        <path d={starPath(788, 128, 9)} fill={accent} />
        <text x={MX} y="140" fontSize="36" letterSpacing="7" fill={accent}>
          {`TEMPORADA ${d.season}`}
        </text>
      </g>

      {/* the shout */}
      <g fontFamily={FONT_DISPLAY} fontWeight="700" textAnchor="middle" fontSize="150" letterSpacing="4">
        <text x={MX + 6} y="306" fill="#000000" opacity="0.35">
          {shout}
        </text>
        <text x={MX} y="300" fill={`url(#${uid}-gold)`} stroke={mix(accent, '#000000', 0.5)} strokeWidth="3" paintOrder="stroke">
          {shout}
        </text>
      </g>

      {/* medallion with laurels and the crest */}
      <Laurel cx={MX} cy={MY} r={MR + 44} side={1} color={accent} />
      <Laurel cx={MX} cy={MY} r={MR + 44} side={-1} color={accent} />
      <circle cx={MX} cy={MY + 8} r={MR + 4} fill="#000000" opacity="0.3" />
      <circle cx={MX} cy={MY} r={MR} fill={`url(#${uid}-disc)`} stroke={`url(#${uid}-gold)`} strokeWidth="12" />
      <circle cx={MX} cy={MY} r={MR - 18} fill="none" stroke={accent} strokeWidth="2" strokeDasharray="4 8" opacity="0.8" />
      {crest ? (
        <image href={crest} x={MX - 140} y={MY - 150} width="280" height="300" preserveAspectRatio="xMidYMid meet" onError={() => setCrestFailed(true)} />
      ) : (
        <g transform={`translate(${MX - 132} ${MY - 156}) scale(6)`}>
          <g clipPath={`url(#${uid}-shield)`}>
            <rect width="44" height="50" fill={shieldA} />
            {pattern === 0 && <rect x="22" width="22" height="50" fill={shieldB} />}
            {pattern === 1 && [8, 20, 32].map((x) => <rect key={x} x={x} width="5.5" height="50" fill={shieldB} />)}
            {pattern === 2 && <rect y="18" width="44" height="12" fill={shieldB} />}
            {pattern === 3 && <path d="M-6 14 L14 -6 L52 32 L32 52 Z" fill={shieldB} />}
            <rect width="44" height="14" fill="#000000" opacity="0.3" />
          </g>
          <path d={SHIELD} fill="none" stroke="#000000" strokeOpacity="0.55" strokeWidth="1.4" />
          <path d="M7 6 H37 V22 C37 33 29.5 40 22 43.5" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="0.7" />
          <text x="22" y="10.6" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight="700" fontSize="9" fill="#ffffff" letterSpacing="0.4">
            {initials(d.club)}
          </text>
        </g>
      )}

      {/* points seal */}
      <g transform={`rotate(12 ${seal.x} ${seal.y})`}>
        <path d={sealPath} fill={`url(#${uid}-gold)`} stroke={mix(accent, '#000000', 0.45)} strokeWidth="3" />
        <circle cx={seal.x} cy={seal.y} r={seal.r * 0.7} fill={primary} stroke={accent} strokeWidth="3" />
        <text x={seal.x} y={seal.y + 14} textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight="700" fontSize={fit(`+${d.points}`, 66, 130, 0.55)} fill={accent}>
          {`+${d.points}`}
        </text>
        <text x={seal.x} y={seal.y + 44} textAnchor="middle" fontFamily={FONT_COND} fontWeight="700" fontSize="22" letterSpacing="3" fill={ink}>
          PUNTOS
        </text>
      </g>

      {/* club */}
      <text x={MX} y="915" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight="700" fontSize={fit(d.club.toUpperCase(), 84, 880)} fill={ink} letterSpacing="2">
        {d.club.toUpperCase()}
      </text>

      {/* competition ribbon */}
      <g>
        <path d="M150 950 H220 V1032 H150 L180 991 Z" fill={mix(accent, '#000000', 0.35)} />
        <path d="M930 950 H860 V1032 H930 L900 991 Z" fill={mix(accent, '#000000', 0.35)} />
        <path d="M200 940 H880 V1022 H200 Z" fill={`url(#${uid}-gold)`} />
        <path d="M200 1022 L220 1032 V1022 Z M880 1022 L860 1032 V1022 Z" fill={mix(accent, '#000000', 0.55)} />
        {logo && <image href={logo} x="214" y="946" width="70" height="70" preserveAspectRatio="xMidYMid meet" onError={() => setLogoFailed(true)} />}
        <text x={logo ? 580 : MX} y="996" textAnchor="middle" fontFamily={FONT_COND} fontWeight="700" fill={onAccent} letterSpacing="1.5" fontSize={fit(`${subtitle} ${d.competition}`.toUpperCase(), 44, logo ? 540 : 620, 0.56)}>
          {`${subtitle} ${d.competition}`.toUpperCase()}
        </text>
      </g>

      {/* the manager */}
      <text x={MX} y="1084" textAnchor="middle" fontFamily={FONT_COND} fontWeight="700" fontSize="30" letterSpacing="8" fill={accent}>
        DIRECTOR TÉCNICO
      </text>
      <text x={MX} y="1172" textAnchor="middle" fontFamily={FONT_DISPLAY} fontWeight="700" fontSize={fit(d.manager, 100, 760, 0.5)} fill={ink} letterSpacing="1">
        {d.manager}
      </text>

      {/* date and game */}
      <text x={MX} y="1222" textAnchor="middle" fontFamily={FONT_COND} fontWeight="600" fontSize="30" fill={ink} opacity="0.85">
        {dateText(d.date)}
      </text>
      <g fontFamily={FONT_DISPLAY} fontWeight="700" textAnchor="middle">
        <rect x={MX - 170} y="1242" width="340" height="44" rx="22" fill={deep} stroke={accent} strokeWidth="2" />
        <text x={MX} y="1273" fontSize="26" letterSpacing="5" fill={accent}>
          {GAME_NAME.toUpperCase()}
        </text>
      </g>
    </svg>
  );
});
