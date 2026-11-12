// Visual identity per competition: palette, trophy style, background motif, motto and region.
// Colours are inspired by each competition's real look (e.g. Libertadores gold and black,
// Champions League night blue and silver) but no logos, marks or brand typefaces are used:
// trophies are drawn by Trophy.tsx and the type is the game's own.

export type TrophyStyle =
  /** Classic cup with two loop handles. */
  | 'handles'
  /** Wide body with very large ear-shaped handles. */
  | 'big-ear'
  /** Slender, tall cup with a lid and finial. */
  | 'tall'
  /** Flat round plate with concentric rings. */
  | 'plate'
  /** League cup: banded body with a crown-like rim. */
  | 'league'
  /** Shield-shaped trophy on a plinth. */
  | 'shield'
  /** Ball on a pedestal. */
  | 'ball'
  /** Pennant (banderín), for friendlies. */
  | 'pennant';

export type Motif = 'stars' | 'filete' | 'stripes' | 'rays' | 'tricolor' | 'checks' | 'waves' | 'none';
export type Region = 'argentina' | 'sudamerica' | 'europa' | 'otras';

export const REGION_LABEL: Record<Region, string> = {
  argentina: 'Argentina',
  sudamerica: 'Sudamérica',
  europa: 'Europa',
  otras: 'Otras ligas y amistosos',
};
export const REGION_ORDER: Region[] = ['argentina', 'sudamerica', 'europa', 'otras'];

export interface Palette {
  /** Main background colour (dark enough to carry light text in most cases). */
  primary: string;
  /** Second colour of gradients and bands. */
  secondary: string;
  /** Highlight: stars, rules, numbers. */
  accent: string;
}

export interface CompetitionIdentity {
  id: string;
  palette: Palette;
  trophy: TrophyStyle;
  metal: 'gold' | 'silver';
  motif: Motif;
  /** Short original tagline, in Rioplatense Spanish. */
  motto: string;
  region: Region;
  /** ISO alpha-3 of the owning country, when domestic. */
  country?: string;
}

type Spec = Omit<CompetitionIdentity, 'id' | 'region' | 'country'> & { region?: Region; country?: string };

const ARG_DIVISIONS = new Set(['lpf', 'nacional', 'b-metro', 'federal-a', 'primera-c', 'promocional', 'regional']);
const CONMEBOL = new Set(['ARG', 'BRA', 'URY', 'PRY', 'CHL', 'COL', 'PER', 'ECU', 'BOL', 'VEN']);
const UEFA = new Set(['ENG', 'ESP', 'ITA', 'DEU', 'FRA', 'PRT', 'NLD', 'BEL', 'SCO', 'TUR', 'UEFA']);

const SPECS: Record<string, Spec> = {
  // ---------------------------------------------------------------- Argentina
  lpf: {
    palette: { primary: '#0b2545', secondary: '#4a90c8', accent: '#f2b705' },
    trophy: 'league', metal: 'silver', motif: 'filete',
    motto: 'Treinta clubes, un solo campeón',
  },
  nacional: {
    palette: { primary: '#14324a', secondary: '#2d7a8c', accent: '#f5c84c' },
    trophy: 'tall', metal: 'silver', motif: 'filete',
    motto: 'La larga ruta de vuelta a Primera',
  },
  'b-metro': {
    palette: { primary: '#3a1420', secondary: '#8c2a3c', accent: '#f2b705' },
    trophy: 'handles', metal: 'silver', motif: 'filete',
    motto: 'Barrio, tablón y ascenso',
  },
  'federal-a': {
    palette: { primary: '#2c2410', secondary: '#7a6421', accent: '#5bc0eb' },
    trophy: 'handles', metal: 'gold', motif: 'filete',
    motto: 'El país futbolero en una sola tabla',
  },
  'primera-c': {
    palette: { primary: '#1f2b1c', secondary: '#4f6b3a', accent: '#f2b705' },
    trophy: 'handles', metal: 'silver', motif: 'filete',
    motto: 'Donde el fútbol todavía huele a potrero',
  },
  promocional: {
    palette: { primary: '#2a1f33', secondary: '#5e4a7a', accent: '#f2b705' },
    trophy: 'pennant', metal: 'silver', motif: 'filete',
    motto: 'El primer escalón del sueño',
  },
  regional: {
    palette: { primary: '#2b2016', secondary: '#7a5a34', accent: '#5bc0eb' },
    trophy: 'pennant', metal: 'gold', motif: 'filete',
    motto: 'De todas las provincias, un camino',
  },
  'copa-argentina': {
    palette: { primary: '#0e3a66', secondary: '#74acdf', accent: '#f6b40e' },
    trophy: 'handles', metal: 'gold', motif: 'filete',
    motto: 'De la C a la Primera, todos contra todos',
  },
  'torneo-verano': {
    palette: { primary: '#0f4c5c', secondary: '#e36414', accent: '#fcd581' },
    trophy: 'ball', metal: 'gold', motif: 'waves', region: 'argentina', country: 'ARG',
    motto: 'Pretemporada, sol y costa',
  },
  amistoso: {
    palette: { primary: '#2f3640', secondary: '#57606f', accent: '#dfe4ea' },
    trophy: 'pennant', metal: 'silver', motif: 'none', region: 'otras',
    motto: 'Para probar, rodar y conocerse',
  },

  // ---------------------------------------------------------------- CONMEBOL
  'copa-libertadores': {
    palette: { primary: '#0d0b08', secondary: '#3a2e12', accent: '#d4af37' },
    trophy: 'tall', metal: 'gold', motif: 'rays', region: 'sudamerica',
    motto: 'Noches de copa y mística continental',
  },
  'copa-sudamericana': {
    palette: { primary: '#0a2a6b', secondary: '#1f57b8', accent: '#f6c400' },
    trophy: 'handles', metal: 'gold', motif: 'rays', region: 'sudamerica',
    motto: 'El otro sueño de América',
  },
  'bra-1': {
    palette: { primary: '#00592a', secondary: '#009c3b', accent: '#ffdf00' },
    trophy: 'league', metal: 'gold', motif: 'stripes',
    motto: 'Samba, gambeta y treinta y ocho fechas',
  },
  'bra-2': {
    palette: { primary: '#0b2e5c', secondary: '#1a6b3a', accent: '#ffdf00' },
    trophy: 'tall', metal: 'silver', motif: 'stripes',
    motto: 'La pelea más larga por subir',
  },
  'bra-cup': {
    palette: { primary: '#002776', secondary: '#009c3b', accent: '#ffdf00' },
    trophy: 'handles', metal: 'gold', motif: 'rays',
    motto: 'Todo Brasil en un mata-mata',
  },

  // ---------------------------------------------------------------- UEFA
  'champions-league': {
    palette: { primary: '#060b2e', secondary: '#1b2a6b', accent: '#d9e1f2' },
    trophy: 'big-ear', metal: 'silver', motif: 'stars', region: 'europa',
    motto: 'Bajo las estrellas de Europa',
  },
  'europa-league': {
    palette: { primary: '#141414', secondary: '#3a2210', accent: '#ff6a13' },
    trophy: 'tall', metal: 'silver', motif: 'rays', region: 'europa',
    motto: 'Los jueves también se sueña',
  },
  'conference-league': {
    palette: { primary: '#06281f', secondary: '#0e5a40', accent: '#2fd27a' },
    trophy: 'tall', metal: 'silver', motif: 'rays', region: 'europa',
    motto: 'La tercera puerta al continente',
  },
  'uefa-supercup': {
    palette: { primary: '#0a1a3a', secondary: '#24477a', accent: '#e6c36a' },
    trophy: 'shield', metal: 'silver', motif: 'stars', region: 'europa',
    motto: 'Campeón contra campeón',
  },
  'eng-1': {
    palette: { primary: '#2a0030', secondary: '#5c0f6b', accent: '#00e676' },
    trophy: 'league', metal: 'gold', motif: 'checks',
    motto: 'La liga que mira medio planeta',
  },
  'eng-2': {
    palette: { primary: '#101a33', secondary: '#2a3f6e', accent: '#e8b64a' },
    trophy: 'handles', metal: 'silver', motif: 'checks',
    motto: '46 fechas de barro y lluvia',
  },
  'eng-cup': {
    palette: { primary: '#0d1b3d', secondary: '#8a1c2b', accent: '#e8e8e8' },
    trophy: 'handles', metal: 'silver', motif: 'rays',
    motto: 'La copa más vieja del mundo',
  },
  'esp-1': {
    palette: { primary: '#1c1023', secondary: '#b3122a', accent: '#ffb400' },
    trophy: 'league', metal: 'silver', motif: 'rays',
    motto: 'El toque, la pausa y el gol',
  },
  'esp-2': {
    palette: { primary: '#10233b', secondary: '#1e6a8c', accent: '#7fe0c9' },
    trophy: 'tall', metal: 'silver', motif: 'rays',
    motto: 'La segunda que parece primera',
  },
  'esp-cup': {
    palette: { primary: '#5a0d16', secondary: '#aa151b', accent: '#f1bf00' },
    trophy: 'tall', metal: 'gold', motif: 'rays',
    motto: 'Noches de copa a partido único',
  },
  'ita-1': {
    palette: { primary: '#0a1f44', secondary: '#13459a', accent: '#5fd4ff' },
    trophy: 'shield', metal: 'silver', motif: 'tricolor',
    motto: 'Táctica, catenaccio y fantasía',
  },
  'ita-2': {
    palette: { primary: '#14262d', secondary: '#2a5a4a', accent: '#c8e65a' },
    trophy: 'handles', metal: 'silver', motif: 'tricolor',
    motto: 'Provincia, campanario y ascenso',
  },
  'ita-cup': {
    palette: { primary: '#0b3d24', secondary: '#008c45', accent: '#f4f5f0' },
    trophy: 'tall', metal: 'silver', motif: 'tricolor',
    motto: 'La coccarda se gana en primavera',
  },
  'deu-1': {
    palette: { primary: '#141414', secondary: '#9e0a14', accent: '#ffce00' },
    trophy: 'plate', metal: 'silver', motif: 'stripes',
    motto: 'Estadios llenos y pressing alto',
  },
  'deu-cup': {
    palette: { primary: '#1a1a1a', secondary: '#6b0f14', accent: '#e8e8e8' },
    trophy: 'handles', metal: 'gold', motif: 'rays',
    motto: 'Camino a la gran final de Berlín',
  },
  'fra-1': {
    palette: { primary: '#08173a', secondary: '#1b3f8b', accent: '#dae025' },
    trophy: 'tall', metal: 'silver', motif: 'tricolor',
    motto: 'La fábrica de cracks del mundo',
  },
  'fra-2': {
    palette: { primary: '#122038', secondary: '#3b5a8a', accent: '#f0a830' },
    trophy: 'handles', metal: 'silver', motif: 'tricolor',
    motto: 'Talento joven con hambre de subir',
  },
  'fra-cup': {
    palette: { primary: '#002654', secondary: '#9e1a2e', accent: '#f4f4f4' },
    trophy: 'handles', metal: 'silver', motif: 'tricolor',
    motto: 'El pueblo chico contra el grande',
  },
  'prt-1': {
    palette: { primary: '#06331f', secondary: '#8a1020', accent: '#f6c400' },
    trophy: 'league', metal: 'silver', motif: 'waves',
    motto: 'Tres grandes y un mar de talento',
  },
  'nld-1': {
    palette: { primary: '#1d1b3a', secondary: '#c0461b', accent: '#ff8c1a' },
    trophy: 'plate', metal: 'silver', motif: 'checks',
    motto: 'Fútbol total, cancha ancha',
  },
  'bel-1': {
    palette: { primary: '#1a1a1a', secondary: '#9e1a1a', accent: '#fdda24' },
    trophy: 'league', metal: 'gold', motif: 'stripes',
    motto: 'Vidriera chica, futbolistas grandes',
  },
  'sco-1': {
    palette: { primary: '#0b1f4a', secondary: '#4b2a6b', accent: '#e6e6f2' },
    trophy: 'handles', metal: 'silver', motif: 'checks',
    motto: 'Viento, gaitas y clásicos a muerte',
  },
  'tur-1': {
    palette: { primary: '#4a0710', secondary: '#c8102e', accent: '#f4f4f4' },
    trophy: 'league', metal: 'gold', motif: 'stars',
    motto: 'Bengalas, tribunas y pasión total',
  },
};

/** National colours (primary, secondary, accent) for countries without a specific identity. */
const NATIONAL: Record<string, Palette> = {
  ARG: { primary: '#0e3a66', secondary: '#74acdf', accent: '#f6b40e' },
  BRA: { primary: '#00592a', secondary: '#009c3b', accent: '#ffdf00' },
  URY: { primary: '#0b2a5c', secondary: '#3e86c6', accent: '#fcd116' },
  PRY: { primary: '#3a0b10', secondary: '#0038a8', accent: '#e8e8e8' },
  CHL: { primary: '#0a1f5c', secondary: '#c8102e', accent: '#f4f4f4' },
  COL: { primary: '#0b2a6b', secondary: '#c8102e', accent: '#fcd116' },
  PER: { primary: '#4a0a10', secondary: '#c8102e', accent: '#f4f4f4' },
  ECU: { primary: '#0b2a6b', secondary: '#c8102e', accent: '#ffdd00' },
  BOL: { primary: '#1f3d1a', secondary: '#007934', accent: '#f9e300' },
  VEN: { primary: '#0b1f5c', secondary: '#cf142b', accent: '#ffcc00' },
  ENG: { primary: '#101a33', secondary: '#8a1c2b', accent: '#e8e8e8' },
  ESP: { primary: '#5a0d16', secondary: '#aa151b', accent: '#f1bf00' },
  ITA: { primary: '#0a2a5c', secondary: '#008c45', accent: '#f4f5f0' },
  DEU: { primary: '#141414', secondary: '#9e0a14', accent: '#ffce00' },
  FRA: { primary: '#002654', secondary: '#9e1a2e', accent: '#f4f4f4' },
  PRT: { primary: '#06331f', secondary: '#8a1020', accent: '#f6c400' },
  NLD: { primary: '#1d1b3a', secondary: '#c0461b', accent: '#ff8c1a' },
  BEL: { primary: '#1a1a1a', secondary: '#9e1a1a', accent: '#fdda24' },
  SCO: { primary: '#0b1f4a', secondary: '#005eb8', accent: '#f4f4f4' },
  TUR: { primary: '#4a0710', secondary: '#c8102e', accent: '#f4f4f4' },
};

const MOTIF_BY_COUNTRY: Record<string, Motif> = {
  ARG: 'filete', BRA: 'stripes', ITA: 'tricolor', FRA: 'tricolor', ENG: 'checks', SCO: 'checks', NLD: 'checks', PRT: 'waves', TUR: 'stars',
};

/** Country (ISO alpha-3) owning a competition id, when it can be told from the id. */
export function countryOfCompetition(id: string): string | undefined {
  if (ARG_DIVISIONS.has(id) || id === 'copa-argentina' || id === 'torneo-verano') return 'ARG';
  const m = /^([a-z]{3})-(\d+|cup)$/.exec(id);
  return m ? m[1].toUpperCase() : undefined;
}

export function regionOfCountry(country: string | undefined): Region {
  if (!country) return 'otras';
  if (country === 'ARG') return 'argentina';
  if (CONMEBOL.has(country)) return 'sudamerica';
  if (UEFA.has(country)) return 'europa';
  return 'otras';
}

const cache = new Map<string, CompetitionIdentity>();

/** Identity of a competition id; unknown ids get a default from their country and kind. */
export function identityOf(id: string): CompetitionIdentity {
  const hit = cache.get(id);
  if (hit) return hit;
  const country = countryOfCompetition(id);
  const spec = SPECS[id];
  let out: CompetitionIdentity;
  if (spec) {
    out = { id, country: spec.country ?? country, region: spec.region ?? regionOfCountry(country), ...spec };
  } else {
    const isCup = /-cup$/.test(id) || id.startsWith('copa-');
    const level = Number(/-(\d+)$/.exec(id)?.[1] ?? 1);
    const base = (country && NATIONAL[country]) || { primary: '#1b2433', secondary: '#3a4a63', accent: '#c9a227' };
    out = {
      id,
      country,
      region: regionOfCountry(country),
      palette: level > 1 ? { primary: base.primary, secondary: mix(base.secondary, '#000000', 0.25), accent: base.accent } : base,
      trophy: isCup ? 'handles' : level > 1 ? 'tall' : 'league',
      metal: isCup || level === 1 ? 'gold' : 'silver',
      motif: (country && MOTIF_BY_COUNTRY[country]) || (isCup ? 'rays' : 'stripes'),
      motto: isCup ? 'Mano a mano, sin revancha' : level > 1 ? 'La pelea por subir' : 'La liga de todo el país',
    };
  }
  cache.set(id, out);
  return out;
}

/** Linear mix of two #rrggbb colours (t = share of `b`). */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** Light or dark ink for text over a colour. */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const l = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return l > 150 ? '#14110c' : '#f7f3ea';
}

/** CSS custom properties that carry the palette into the competition styles. */
export function paletteVars(p: Palette): React.CSSProperties {
  return {
    ['--ci-primary' as string]: p.primary,
    ['--ci-secondary' as string]: p.secondary,
    ['--ci-accent' as string]: p.accent,
    ['--ci-ink' as string]: inkOn(p.primary),
  } as React.CSSProperties;
}
