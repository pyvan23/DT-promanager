// Countries known to the game. Only Argentina has a pyramid today; adding a country means
// adding it here plus its division templates and (optionally) real data files.

import type { Country } from '../engine/types';

export const COUNTRIES: Country[] = [
  { id: 'ARG', name: 'Argentina', confederation: 'CONMEBOL' },
  // Planned: BRA, URY, PRY, CHL, COL, PER, ECU, BOL, VEN (CONMEBOL) and the main UEFA leagues.
];
