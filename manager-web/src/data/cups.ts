// Cups as data: format plus where the entrants come from. Each country adds its own
// entry rules to the continental cups when its pyramid is added.

import type { CompetitionDef } from '../engine/types';
import { LIBERTADORES_ENTRIES, SUDAMERICANA_ENTRIES } from './conmebol';

/** 64 clubs from every level: the whole top flight plus the best of each lower division. */
export const COPA_ARGENTINA_DEF: CompetitionDef = {
  id: 'copa-argentina',
  name: 'Copa Argentina',
  formatId: 'copa-argentina',
  scope: 'domestic',
  country: 'ARG',
  size: 64,
  entries: [
    { kind: 'division', divisionId: 'lpf', from: 1, to: 30 },
    { kind: 'division', divisionId: 'nacional', from: 1, to: 18 },
    { kind: 'division', divisionId: 'b-metro', from: 1, to: 6 },
    { kind: 'division', divisionId: 'federal-a', from: 1, to: 6 },
    { kind: 'division', divisionId: 'primera-c', from: 1, to: 2 },
    { kind: 'division', divisionId: 'regional', from: 1, to: 2 },
  ],
};

/**
 * Group stage of 32. Argentina's share: top 4 of the top flight plus the Copa Argentina
 * champion. The other CONMEBOL countries add their rules here as they are added;
 * until the field reaches 32 the cup is reported as pending.
 */
export const COPA_LIBERTADORES_DEF: CompetitionDef = {
  id: 'copa-libertadores',
  name: 'Copa Libertadores',
  formatId: 'copa-libertadores',
  scope: 'continental',
  confederation: 'CONMEBOL',
  size: 32,
  entries: [
    { kind: 'division', divisionId: 'lpf', from: 1, to: 4 },
    { kind: 'champion', competitionId: 'copa-argentina', fallbackDivisionId: 'lpf' },
    ...LIBERTADORES_ENTRIES,
  ],
};

/** Group stage of 32; Libertadores third-placed clubs join at the knockout play-offs. */
export const COPA_SUDAMERICANA_DEF: CompetitionDef = {
  id: 'copa-sudamericana',
  name: 'Copa Sudamericana',
  formatId: 'copa-sudamericana',
  scope: 'continental',
  confederation: 'CONMEBOL',
  size: 32,
  after: ['copa-libertadores'],
  entries: [
    { kind: 'division', divisionId: 'lpf', from: 5, to: 10 },
    ...SUDAMERICANA_ENTRIES,
    { kind: 'group-place', competitionId: 'copa-libertadores', stageId: 'grupos', place: 3, joinStageId: 'playoffs' },
  ],
};

export const COMPETITION_DEFS: CompetitionDef[] = [COPA_ARGENTINA_DEF, COPA_LIBERTADORES_DEF, COPA_SUDAMERICANA_DEF];
