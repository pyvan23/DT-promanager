// Display helpers shared by the screens.

import { overall } from '../engine/squad';
import type { Club, Player, PlayerAttributes, Position, World } from '../engine/types';

export { overall };

export const POSITION_LABEL: Record<Position, string> = {
  ARQ: 'Arquero',
  LD: 'Lateral derecho',
  DFC: 'Defensor central',
  LI: 'Lateral izquierdo',
  MCD: 'Volante central',
  MD: 'Volante por derecha',
  MC: 'Volante interno',
  MI: 'Volante por izquierda',
  MCO: 'Enganche',
  ED: 'Extremo derecho',
  EI: 'Extremo izquierdo',
  DC: 'Centrodelantero',
};

/** Pitch coordinates (0-100, own goal at the bottom) for mini-pitches. */
export const POSITION_SPOT: Record<Position, { x: number; y: number }> = {
  ARQ: { x: 50, y: 92 },
  LI: { x: 14, y: 72 },
  DFC: { x: 50, y: 76 },
  LD: { x: 86, y: 72 },
  MCD: { x: 50, y: 60 },
  MI: { x: 14, y: 47 },
  MC: { x: 50, y: 47 },
  MD: { x: 86, y: 47 },
  MCO: { x: 50, y: 33 },
  EI: { x: 15, y: 20 },
  ED: { x: 85, y: 20 },
  DC: { x: 50, y: 13 },
};

export const ATTRIBUTES: { key: keyof PlayerAttributes; label: string; abbr: string }[] = [
  { key: 'speed', label: 'Velocidad', abbr: 'VEL' },
  { key: 'stamina', label: 'Resistencia', abbr: 'RES' },
  { key: 'aggression', label: 'Agresividad', abbr: 'AGR' },
  { key: 'quality', label: 'Calidad', abbr: 'CAL' },
  { key: 'tackling', label: 'Marca', abbr: 'MAR' },
  { key: 'passing', label: 'Pase', abbr: 'PAS' },
  { key: 'dribbling', label: 'Gambeta', abbr: 'GAM' },
  { key: 'shooting', label: 'Tiro', abbr: 'TIR' },
  { key: 'heading', label: 'Remate', abbr: 'REM' },
  { key: 'goalkeeping', label: 'Arquero', abbr: 'ARQ' },
];

const COUNTRIES: Record<string, string> = {
  ARG: 'Argentina',
  URY: 'Uruguay',
  PAR: 'Paraguay',
  PRY: 'Paraguay',
  COL: 'Colombia',
  CHL: 'Chile',
  BOL: 'Bolivia',
  VEN: 'Venezuela',
  BRA: 'Brasil',
  PER: 'Perú',
  ECU: 'Ecuador',
  ESP: 'España',
  ITA: 'Italia',
  USA: 'Estados Unidos',
  MEX: 'México',
};

export function countryName(code: string): string {
  return COUNTRIES[code] ?? code;
}

/** Age on 1 July of the given season, the usual cut-off for a football season. */
export function ageInSeason(player: Player, season: number): number {
  const [y, m, d] = player.birthDate.split('-').map(Number);
  let age = season - y;
  if (m > 7 || (m === 7 && d > 1)) age--;
  return age;
}

/** Surname for tight spaces such as the tactics board ("Juan Pérez" → "Pérez"). */
export function shortPlayerName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

export function clubMap(world: World): Map<string, Club> {
  return new Map(world.clubs.map((c) => [c.id, c]));
}

export function clubName(clubs: Map<string, Club>, id: string): string {
  return clubs.get(id)?.name ?? id;
}

export function divisionOf(world: World, clubId: string) {
  return world.divisions.find((d) => d.clubIds.includes(clubId));
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** In-game date line for the top bar. Seasons start in January in Argentina. */
export function seasonDateLine(season: number, played: boolean): string {
  return played ? `Diciembre de ${season - 1} · fin de temporada` : `${MONTHS[0]} de ${season} · pretemporada`;
}
