// Formatting helpers shared by the club screens.

import type { GameState } from '../../../engine/game/game';
import type { Transaction } from '../../../engine/game-types';

export interface ScreenProps {
  game: GameState;
  update: (g: GameState) => void;
}

const num1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const num0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** "US$ 3,5 M", "US$ 120 mil", "US$ 850". `signed` adds "+" to positive amounts. */
export function money(n: number, signed = false): string {
  const sign = n < 0 ? '−' : signed && n > 0 ? '+' : '';
  const a = Math.abs(n);
  let body: string;
  if (a >= 1e6) body = `${num1.format(Math.round(a / 1e5) / 10)} M`;
  else if (a >= 1e3) body = `${num0.format(Math.round(a / 1e3))} mil`;
  else body = num0.format(Math.round(a));
  return `${sign}US$ ${body}`;
}

export const int = (n: number) => num0.format(Math.round(n));
export const pct = (x: number, digits = 0) => `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits }).format(x * 100)}%`;

/** ISO date → "12/03/2026". */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const monthShort = (month: number) => MONTHS[month - 1] ?? '';

/** Whole days from `from` to `to` (ISO dates). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const TX_LABEL: Record<Transaction['kind'], string> = {
  taquilla: 'Taquilla',
  tv: 'Televisión',
  sponsor: 'Sponsor',
  premios: 'Premios',
  traspaso: 'Traspasos',
  sueldos: 'Sueldos',
  empleados: 'Empleados',
  estadio: 'Estadio',
  seguros: 'Seguros',
  otros: 'Otros',
};

