// The Argentine league pyramid as editable data. Sizes and promotion/relegation counts
// approximate recent seasons and are kept balanced so every division keeps its size
// from one season to the next (see the pyramid test).

import type { CompetitionFormat, Division, Region, TieRules } from '../engine/types';
import { LIGA_PROFESIONAL } from './competitions';

const POINTS = { win: 3, draw: 1, loss: 0 };
const SINGLE_HOME: TieRules = { legs: 1, awayGoals: false, neutralVenue: false };
const SINGLE_NEUTRAL: TieRules = { legs: 1, awayGoals: false, neutralVenue: true };
const TWO_LEGS: TieRules = { legs: 2, awayGoals: false, neutralVenue: false };

/** 36 clubs in 2 zones of 18, home and away; top 8 of each zone into a knockout. */
export const PRIMERA_NACIONAL: CompetitionFormat = {
  id: 'primera-nacional',
  name: 'Primera Nacional',
  stages: [
    { kind: 'groups', id: 'zonas', name: 'Fase regular', groupCount: 2, rounds: 2, points: POINTS, advancePerGroup: 8 },
    { kind: 'knockout', id: 'reducido', name: 'Reducido', tie: SINGLE_HOME, finalTie: SINGLE_NEUTRAL },
  ],
};

export const PRIMERA_B_METRO: CompetitionFormat = {
  id: 'primera-b-metro',
  name: 'Primera B Metropolitana',
  stages: [{ kind: 'league', id: 'torneo', name: 'Torneo', rounds: 2, points: POINTS }],
};

/** 36 clubs in 4 zones of 9, top 4 of each zone into two-legged knockouts. */
export const FEDERAL_A: CompetitionFormat = {
  id: 'federal-a',
  name: 'Torneo Federal A',
  stages: [
    { kind: 'groups', id: 'zonas', name: 'Primera fase', groupCount: 4, rounds: 2, points: POINTS, advancePerGroup: 4 },
    { kind: 'knockout', id: 'final', name: 'Fase final', tie: TWO_LEGS, finalTie: SINGLE_NEUTRAL },
  ],
};

/** Two zones, home and away; zone winners meet in a final (the real one adds a reducido for the 2nd spot). */
export const PRIMERA_C: CompetitionFormat = {
  id: 'primera-c',
  name: 'Primera C',
  stages: [
    { kind: 'groups', id: 'zonas', name: 'Fase regular', groupCount: 2, rounds: 2, points: POINTS, advancePerGroup: 1 },
    { kind: 'knockout', id: 'final', name: 'Final', tie: SINGLE_NEUTRAL },
  ],
};

export const PROMOCIONAL_AMATEUR: CompetitionFormat = {
  id: 'promocional-amateur',
  name: 'Primera Promocional Amateur',
  stages: [
    { kind: 'groups', id: 'zonas', name: 'Fase regular', groupCount: 2, rounds: 2, points: POINTS, advancePerGroup: 1 },
    { kind: 'knockout', id: 'final', name: 'Final', tie: TWO_LEGS },
  ],
};

/** Regional tournament (the real one has hundreds of clubs); 32 represent it here. */
export const REGIONAL_AMATEUR: CompetitionFormat = {
  id: 'regional-amateur',
  name: 'Torneo Regional Federal Amateur',
  stages: [
    { kind: 'groups', id: 'zonas', name: 'Fase regional', groupCount: 8, rounds: 2, points: POINTS, advancePerGroup: 2 },
    { kind: 'knockout', id: 'final', name: 'Fase final', tie: TWO_LEGS, finalTie: TWO_LEGS },
  ],
};

export const DIVISION_FORMATS: CompetitionFormat[] = [
  LIGA_PROFESIONAL,
  PRIMERA_NACIONAL,
  PRIMERA_B_METRO,
  FEDERAL_A,
  PRIMERA_C,
  PROMOCIONAL_AMATEUR,
  REGIONAL_AMATEUR,
];

export interface DivisionTemplate extends Omit<Division, 'clubIds'> {
  size: number;
  /** Region of the generated clubs; 'mixed' splits them between metro and interior. */
  clubRegion: Region | 'mixed';
}

export const DIVISION_TEMPLATES: DivisionTemplate[] = [
  {
    id: 'lpf',
    name: 'Liga Profesional',
    country: 'ARG',
    level: 1,
    formatId: 'liga-profesional',
    size: 30,
    clubRegion: 'mixed',
    promotion: null,
    relegation: [{ count: 2, to: 'nacional' }],
    relegationByAverages: true,
    splitSeason: true,
  },
  {
    id: 'nacional',
    name: 'Primera Nacional',
    country: 'ARG',
    level: 2,
    formatId: 'primera-nacional',
    size: 36,
    clubRegion: 'mixed',
    promotion: { count: 2, to: 'lpf' },
    relegation: [
      { count: 2, to: 'b-metro', region: 'metro' },
      { count: 2, to: 'federal-a', region: 'interior' },
    ],
    relegationByAverages: false,
  },
  {
    id: 'b-metro',
    name: 'Primera B Metropolitana',
    country: 'ARG',
    level: 3,
    formatId: 'primera-b-metro',
    size: 20,
    clubRegion: 'metro',
    promotion: { count: 2, to: 'nacional' },
    relegation: [{ count: 2, to: 'primera-c' }],
    relegationByAverages: false,
  },
  {
    id: 'federal-a',
    name: 'Torneo Federal A',
    country: 'ARG',
    level: 3,
    formatId: 'federal-a',
    size: 36,
    clubRegion: 'interior',
    promotion: { count: 2, to: 'nacional' },
    relegation: [{ count: 4, to: 'regional' }],
    relegationByAverages: false,
  },
  {
    id: 'primera-c',
    name: 'Primera C',
    country: 'ARG',
    level: 4,
    formatId: 'primera-c',
    size: 20,
    clubRegion: 'metro',
    promotion: { count: 2, to: 'b-metro' },
    relegation: [{ count: 2, to: 'promocional' }],
    relegationByAverages: false,
  },
  {
    id: 'promocional',
    name: 'Primera Promocional Amateur',
    country: 'ARG',
    level: 5,
    formatId: 'promocional-amateur',
    size: 16,
    clubRegion: 'metro',
    promotion: { count: 2, to: 'primera-c' },
    relegation: [],
    relegationByAverages: false,
  },
  {
    id: 'regional',
    name: 'Torneo Regional Federal Amateur',
    country: 'ARG',
    level: 4,
    formatId: 'regional-amateur',
    size: 32,
    clubRegion: 'interior',
    promotion: { count: 4, to: 'federal-a' },
    relegation: [],
    relegationByAverages: false,
  },
];
