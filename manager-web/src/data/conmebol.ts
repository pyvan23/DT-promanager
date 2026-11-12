// South American countries besides Argentina. Their divisions come from
// src/data/real/<ISO>/<level>.json (same builder as the European leagues) and they
// fill the Copa Libertadores and Copa Sudamericana together with Argentina.

import type { Country, EntryRule } from '../engine/types';

export const CONMEBOL_COUNTRIES: Country[] = [
  { id: 'BRA', name: 'Brasil', confederation: 'CONMEBOL' },
  { id: 'URY', name: 'Uruguay', confederation: 'CONMEBOL' },
  { id: 'PRY', name: 'Paraguay', confederation: 'CONMEBOL' },
  { id: 'CHL', name: 'Chile', confederation: 'CONMEBOL' },
  { id: 'COL', name: 'Colombia', confederation: 'CONMEBOL' },
  { id: 'PER', name: 'Perú', confederation: 'CONMEBOL' },
  { id: 'ECU', name: 'Ecuador', confederation: 'CONMEBOL' },
  { id: 'BOL', name: 'Bolivia', confederation: 'CONMEBOL' },
  { id: 'VEN', name: 'Venezuela', confederation: 'CONMEBOL' },
];

/** Reputation bonus relative to Argentina (0). */
export const CONMEBOL_STRENGTH: Record<string, number> = {
  BRA: 4, URY: -3, COL: -2, CHL: -4, PRY: -4, ECU: -3, PER: -6, BOL: -8, VEN: -8,
};

/** Clubs exchanged between level 1 and 2 when both exist. */
export const CONMEBOL_EXCHANGE: Record<string, number> = { BRA: 4 };

const places = (country: string, from: number, to: number): EntryRule => ({
  kind: 'division',
  divisionId: `${country.toLowerCase()}-1`,
  from,
  to,
});
const cupWinner = (country: string): EntryRule => ({
  kind: 'champion',
  competitionId: `${country.toLowerCase()}-cup`,
  fallbackDivisionId: `${country.toLowerCase()}-1`,
});

/**
 * Group-stage shares of the other CONMEBOL countries (Argentina's are in cups.ts).
 * Real shares include qualifying rounds; here every spot goes straight to the 32-club group stage.
 * Libertadores: BRA 6, URY/PRY/CHL/COL/PER/ECU 3, BOL 2, VEN 1 (+ ARG 5) = 32.
 */
export const LIBERTADORES_ENTRIES: EntryRule[] = [
  places('BRA', 1, 5), cupWinner('BRA'),
  places('URY', 1, 3), places('PRY', 1, 3), places('CHL', 1, 3), places('COL', 1, 3),
  places('PER', 1, 3), places('ECU', 1, 3), places('BOL', 1, 2), places('VEN', 1, 1),
];

/** Sudamericana: BRA 6, URY/PRY/CHL/COL 3, PER/ECU/BOL/VEN 2 (+ ARG 6) = 32. */
export const SUDAMERICANA_ENTRIES: EntryRule[] = [
  places('BRA', 6, 11),
  places('URY', 4, 6), places('PRY', 4, 6), places('CHL', 4, 6), places('COL', 4, 6),
  places('PER', 4, 5), places('ECU', 4, 5), places('BOL', 3, 4), places('VEN', 2, 3),
];
