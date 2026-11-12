// Detailed match simulation in one call (same engine as the live match).

import { createLiveMatch } from './live';
import type { DetailedMatchReport, MatchInput } from './types';

/** Simulates a whole match minute by minute. Equivalent to createLiveMatch(input).finish(). */
export function simulateMatchDetailed(input: MatchInput): DetailedMatchReport {
  return createLiveMatch(input).finish();
}
