// The people of the club: who talks to the manager in each screen. Staff roles use the real
// employee from game.club.staff; the rest (president, treasurer, agent, journalist, fan) get a
// deterministic name seeded by the club. Faces come from `traitsOf(name)`, shared by every
// avatar style so the same person is recognisable in all of them.

import type { GameState } from '../../engine/game/game';
import type { StaffMember } from '../../engine/game-types';

export type StaffRoleId = StaffMember['role'];
export type PersonaRole = StaffRoleId | 'presidente' | 'tesorero' | 'representante' | 'periodista' | 'hincha';

export interface PersonaDef {
  id: PersonaRole;
  /** Job title shown under the name. */
  cargo: string;
  /** Signature colour (medallion background, bubble accent). */
  color: string;
  /** What they wear or carry, for the drawings. */
  accesorio: string;
}

export const PERSONAS: Record<PersonaRole, PersonaDef> = {
  presidente: { id: 'presidente', cargo: 'Presidente', color: '#c9a227', accesorio: 'traje y corbata' },
  'secretario-tecnico': { id: 'secretario-tecnico', cargo: 'Secretario técnico', color: '#5b7fa6', accesorio: 'camisa y bibliorato' },
  ojeador: { id: 'ojeador', cargo: 'Ojeador', color: '#6b7a3a', accesorio: 'campera y binoculares' },
  medico: { id: 'medico', cargo: 'Médico del plantel', color: '#3a9d8f', accesorio: 'guardapolvo y estetoscopio' },
  'preparador-fisico': { id: 'preparador-fisico', cargo: 'Preparador físico', color: '#2f6fd0', accesorio: 'buzo y silbato' },
  'segundo-entrenador': { id: 'segundo-entrenador', cargo: 'Segundo entrenador', color: '#d7263d', accesorio: 'buzo del club y pizarra' },
  'entrenador-juveniles': { id: 'entrenador-juveniles', cargo: 'Entrenador de juveniles', color: '#1b9e5a', accesorio: 'gorra y buzo' },
  tesorero: { id: 'tesorero', cargo: 'Tesorero', color: '#7a5c3e', accesorio: 'chaleco y calculadora' },
  representante: { id: 'representante', cargo: 'Representante de jugadores', color: '#a0329b', accesorio: 'saco llamativo, celular y cadena' },
  periodista: { id: 'periodista', cargo: 'Periodista de El Tablón', color: '#b3261e', accesorio: 'micrófono' },
  hincha: { id: 'hincha', cargo: 'Delegado de la hinchada', color: '#f2b705', accesorio: 'camiseta y bufanda' },
};

export const PERSONA_ROLES = Object.keys(PERSONAS) as PersonaRole[];

const STAFF_IDS: StaffRoleId[] = ['segundo-entrenador', 'preparador-fisico', 'medico', 'ojeador', 'entrenador-juveniles', 'secretario-tecnico'];
export const isStaffRole = (r: PersonaRole): r is StaffRoleId => (STAFF_IDS as string[]).includes(r);

export interface Persona {
  role: PersonaRole;
  name: string;
  cargo: string;
  color: string;
  /** Club colours for the club tracksuits and shirts. */
  colors: { primary: string; secondary: string };
  /** Club initials for the crest on the club tracksuits. */
  initials?: string;
  /** Staff role with nobody hired: someone covers it for now. */
  interim?: boolean;
}

// ------------------------------------------------------------------ seeded helpers

export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Small deterministic generator (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rnd: () => number, list: readonly T[]): T => list[Math.floor(rnd() * list.length) % list.length];

// Name lists of our own (combined at random, they do not refer to real people).
const FIRST = ['Horacio', 'Rubén', 'Osvaldo', 'Néstor', 'Aníbal', 'Teodoro', 'Ernesto', 'Hugo', 'Alcides', 'Fermín', 'Benito', 'Rogelio', 'Eusebio', 'Leandro', 'Gustavo', 'Ricardo', 'Claudio', 'Marta', 'Graciela', 'Susana', 'Mirta', 'Liliana', 'Elvio', 'Ramiro', 'Atilio', 'Ciro', 'Tadeo', 'Ofelia'];
const LAST = ['Arregui', 'Bermúdez', 'Cafiero', 'Dalmasso', 'Echeverry', 'Fontán', 'Garrido', 'Iturralde', 'Lombardi', 'Mangiante', 'Nóbile', 'Olivera', 'Pacheco', 'Quiroga', 'Rapallini', 'Sosa Lagos', 'Tedesco', 'Urquiza', 'Vaccaro', 'Zambrano', 'Bonfiglio', 'Carrizo', 'Ledesma', 'Pernigotti', 'Saravia', 'Trossero'];
const NICK = ['el Tano', 'el Ruso', 'el Flaco', 'el Pelado', 'el Gringo', 'el Turco', 'el Negro', 'el Colo', 'el Chino', 'el Mono'];

function generatedName(seed: string, role: PersonaRole): string {
  const rnd = seeded(hash(`${seed}:${role}`));
  const first = pick(rnd, FIRST);
  const last = pick(rnd, LAST);
  if (role === 'presidente') return `${rnd() < 0.5 ? 'Don ' : ''}${first} ${last}`;
  if (role === 'representante') return `${first} «${pick(rnd, NICK).replace('el ', '')}» ${last}`;
  if (role === 'hincha') {
    const nick = pick(rnd, NICK);
    return `${nick[0].toUpperCase()}${nick.slice(1)} ${last}`;
  }
  return `${first} ${last}`;
}

/** Who plays `role` in the user's club. */
export function personaFor(game: GameState, role: PersonaRole): Persona {
  const def = PERSONAS[role];
  const club = game.world.clubs.find((c) => c.id === game.userClubId);
  const colors = club?.colors ?? { primary: '#1d6fa5', secondary: '#ffffff' };
  const seed = `${game.world.seed}:${game.userClubId}`;
  const initials = clubInitials(club?.shortName ?? '');
  if (isStaffRole(role)) {
    const m = game.club.staff.find((s) => s.role === role);
    if (m) return { role, name: m.name, cargo: def.cargo, color: def.color, colors, initials };
    return { role, name: generatedName(seed, role), cargo: `${def.cargo} (interino)`, color: def.color, colors, initials, interim: true };
  }
  return { role, name: generatedName(seed, role), cargo: def.cargo, color: def.color, colors, initials };
}

/** "River Plate" → "RP", "Boca" → "BO". */
export function clubInitials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 1 && !/^(de|del|la|el|y|los|las)$/i.test(w));
  if (words.length === 0) return 'FC';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** A persona outside a career (previews, tests). */
export function samplePersona(role: PersonaRole, name: string, colors = { primary: '#1d6fa5', secondary: '#f4f1e8' }): Persona {
  const def = PERSONAS[role];
  return { role, name, cargo: def.cargo, color: def.color, colors, initials: 'FC' };
}

// ------------------------------------------------------------------ facial traits

export type HairStyle = 'corto' | 'raya' | 'pelado' | 'rulos' | 'rapado' | 'largo' | 'jopo' | 'melena';
export type FacialHair = 'ninguno' | 'bigote' | 'barba' | 'candado' | 'sombra';

export interface Traits {
  seed: number;
  skin: string;
  skinShade: string;
  hair: HairStyle;
  hairColor: string;
  facial: FacialHair;
  glasses: boolean;
  /** 0 young, 1 middle-aged, 2 veteran. */
  age: 0 | 1 | 2;
  female: boolean;
  /** Eyebrow tilt -1..1. */
  brow: number;
  /** Blink delay in seconds, so a row of faces does not blink in sync. */
  blinkDelay: number;
  /** 0 narrow .. 1 square jaw. */
  jaw: number;
  /** Slight half smile instead of a serious face. */
  smile: boolean;
  /** Index of the skin tone (0 light .. 5 dark). */
  skinIndex: number;
}

export const SKINS = ['#f4d6b8', '#eac29c', '#d9a77a', '#c48a5c', '#9d6a44', '#71492c'];
const SKIN_SHADES = ['#dcb595', '#cfa47c', '#bd8b5f', '#a46f45', '#7f5233', '#553420'];
const HAIR = ['#1f1611', '#3a2617', '#5b3a21', '#8a5a2b', '#b7863b', '#2a2a2e'];
const GRAY = ['#8f8f8f', '#b9b9b9', '#dedede'];
const FEMALE = new Set(['Marta', 'Graciela', 'Susana', 'Mirta', 'Liliana', 'Ofelia']);

export function traitsOf(name: string): Traits {
  const seed = hash(name);
  const rnd = seeded(seed);
  const first = name.replace(/^(Don|Dr\.|Lic\.)\s+/, '').split(' ')[0];
  const female = FEMALE.has(first) || (/a$/.test(first) && !/^(Luca|Garcia|Borja|Bautista|Battista|Andrea|Nicola|Mattia|Elia)$/.test(first));
  const skinI = Math.floor(rnd() * SKINS.length);
  const age = Math.floor(rnd() * 3) as 0 | 1 | 2;
  const styles: HairStyle[] = female ? ['largo', 'melena', 'rulos'] : age === 2 ? ['pelado', 'raya', 'corto', 'pelado', 'jopo'] : ['corto', 'raya', 'rulos', 'rapado', 'jopo', 'corto'];
  const hair = pick(rnd, styles);
  const gray = age === 2 ? rnd() < 0.75 : age === 1 && rnd() < 0.25;
  const hairColor = gray ? pick(rnd, GRAY) : pick(rnd, HAIR);
  const facial: FacialHair = female ? 'ninguno' : pick(rnd, ['ninguno', 'ninguno', 'bigote', 'barba', 'candado', 'sombra', 'bigote'] as FacialHair[]);
  const glasses = rnd() < (age === 2 ? 0.55 : 0.25);
  return {
    seed,
    skin: SKINS[skinI],
    skinShade: SKIN_SHADES[skinI],
    hair,
    hairColor,
    facial,
    glasses,
    age,
    female,
    brow: rnd() * 2 - 1,
    blinkDelay: Math.round(rnd() * 60) / 10,
    jaw: rnd(),
    smile: rnd() < 0.4,
    skinIndex: skinI,
  };
}

/** Clothes per role: main colour, trim and shirt. */
export function outfitOf(p: Pick<Persona, 'role' | 'colors' | 'name'>): { main: string; trim: string; shirt: string } {
  const rnd = seeded(hash(p.name + ':ropa'));
  const { primary, secondary } = p.colors;
  switch (p.role) {
    case 'presidente':
      return { main: pick(rnd, ['#22273a', '#2f2f35', '#3a2e28']), trim: '#14161f', shirt: '#f2f2ee' };
    case 'secretario-tecnico':
      return { main: pick(rnd, ['#a9c6e3', '#d9d4c3', '#c9d9c4']), trim: '#7f97b0', shirt: '#a9c6e3' };
    case 'ojeador':
      return { main: pick(rnd, ['#5d6b33', '#6e5233', '#3f4b5a']), trim: '#2e3420', shirt: '#d8c9a6' };
    case 'medico':
      return { main: '#f5f5f0', trim: '#c9cfcf', shirt: '#7fb6c9' };
    case 'preparador-fisico':
      return { main: pick(rnd, ['#1f4fa0', '#202833', '#8a1f2b']), trim: '#f4f1e8', shirt: '#f4f1e8' };
    case 'segundo-entrenador':
      return { main: primary, trim: secondary, shirt: secondary };
    case 'entrenador-juveniles':
      return { main: secondary === '#ffffff' || secondary.toLowerCase() === '#fff' ? '#2b3a55' : secondary, trim: primary, shirt: primary };
    case 'tesorero':
      return { main: '#4a3b2f', trim: '#2f251d', shirt: '#eef1f5' };
    case 'representante':
      return { main: pick(rnd, ['#9b2f96', '#c0392b', '#e08a1e', '#16a085']), trim: '#1a1a1a', shirt: '#151515' };
    case 'periodista':
      return { main: pick(rnd, ['#c7d8e8', '#e8dcc7', '#d8c7e8']), trim: '#8899aa', shirt: '#c7d8e8' };
    case 'hincha':
      return { main: primary, trim: secondary, shirt: secondary };
  }
}
