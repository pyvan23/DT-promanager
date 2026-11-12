// Competition formats as data. Real formats change almost every season, so these
// are editable defaults rather than rules baked into the engine.

import type { CompetitionFormat, TieRules } from '../engine/types';

const POINTS = { win: 3, draw: 1, loss: 0 };
const SINGLE_HOME: TieRules = { legs: 1, awayGoals: false, neutralVenue: false };
const SINGLE_NEUTRAL: TieRules = { legs: 1, awayGoals: false, neutralVenue: true };
const TWO_LEGS: TieRules = { legs: 2, awayGoals: false, neutralVenue: false };

/**
 * Liga Profesional (one half-season tournament, Apertura or Clausura): 30 clubs in two
 * zones of 15, single round robin, top 8 of each zone into a cross-zone knockout
 * (1A v 8B, 1B v 8A, ...) hosted by the better seed, final at a neutral venue.
 * Not modelled yet: the interzonal "derby" matchday.
 */
export const LIGA_PROFESIONAL: CompetitionFormat = {
  id: 'liga-profesional',
  name: 'Liga Profesional',
  stages: [
    { kind: 'groups', id: 'zonas', name: 'Fase de zonas', groupCount: 2, rounds: 1, points: POINTS, advancePerGroup: 8 },
    { kind: 'knockout', id: 'playoffs', name: 'Fase final', tie: SINGLE_HOME, finalTie: SINGLE_NEUTRAL },
  ],
};

/** Copa Argentina: 64 clubs from every division, single matches at neutral venues, penalties on a draw. */
export const COPA_ARGENTINA: CompetitionFormat = {
  id: 'copa-argentina',
  name: 'Copa Argentina',
  stages: [{ kind: 'knockout', id: 'eliminatorias', name: 'Eliminatorias', tie: SINGLE_NEUTRAL }],
};

/**
 * Copa Libertadores from the group stage: 32 clubs in 8 groups of 4, home and away.
 * Top 2 advance to two-legged knockouts with a single-match final.
 * Third-placed clubs drop into the Sudamericana knockout play-offs.
 */
export const COPA_LIBERTADORES: CompetitionFormat = {
  id: 'copa-libertadores',
  name: 'Copa Libertadores',
  stages: [
    { kind: 'groups', id: 'grupos', name: 'Fase de grupos', groupCount: 8, rounds: 2, points: POINTS, advancePerGroup: 2 },
    { kind: 'knockout', id: 'final', name: 'Fase final', tie: TWO_LEGS, finalTie: SINGLE_NEUTRAL },
  ],
};

/**
 * Copa Sudamericana from the group stage: 32 clubs in 8 groups of 4.
 * Group winners go straight to the round of 16; runners-up play a two-legged play-off
 * against the 8 Libertadores third-placed clubs (passed as extra entrants for 'playoffs').
 * Not modelled yet: the preliminary first stage between clubs of the same country.
 */
export const COPA_SUDAMERICANA: CompetitionFormat = {
  id: 'copa-sudamericana',
  name: 'Copa Sudamericana',
  stages: [
    { kind: 'groups', id: 'grupos', name: 'Fase de grupos', groupCount: 8, rounds: 2, points: POINTS, advancePerGroup: 2 },
    { kind: 'knockout', id: 'playoffs', name: 'Play-offs de octavos', tie: TWO_LEGS, byes: 8, maxRounds: 1 },
    { kind: 'knockout', id: 'final', name: 'Fase final', tie: TWO_LEGS, finalTie: SINGLE_NEUTRAL },
  ],
};

export const COMPETITIONS = [LIGA_PROFESIONAL, COPA_ARGENTINA, COPA_LIBERTADORES, COPA_SUDAMERICANA];
