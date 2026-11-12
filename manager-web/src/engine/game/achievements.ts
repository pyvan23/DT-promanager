// Career achievements (titles and promotions) and their points for the players' ranking.
// Points reward difficulty: winning with a giant is worth little, doing it with a small club a lot.

import type { World } from '../types';

export type AchievementKind = 'titulo' | 'ascenso';

export interface Achievement {
  id: string;
  kind: AchievementKind;
  competitionId: string;
  competitionName: string;
  clubId: string;
  clubName: string;
  country: string;
  season: number;
  date: string;
  managerName: string;
  /** Career settings when it happened (Pro Mánager, coach-only…). */
  mode: 'manager' | 'promanager';
  scope: 'completo' | 'entrenador';
  clubReputation: number;
  points: number;
}

/** How big a title is, before the difficulty factor. */
export function competitionWeight(world: World, competitionId: string, kind: AchievementKind): number {
  const base = competitionId.replace(/-clausura$/, '');
  if (kind === 'ascenso') {
    const division = world.divisions.find((d) => d.id === base);
    const target = division?.promotion ? world.divisions.find((d) => d.id === division.promotion!.to) : undefined;
    return target?.level === 1 ? 8 : 5;
  }
  if (['copa-libertadores', 'champions-league'].includes(competitionId)) return 20;
  if (['copa-sudamericana', 'europa-league'].includes(competitionId)) return 13;
  if (['conference-league', 'uefa-supercup'].includes(competitionId)) return 8;
  const division = world.divisions.find((d) => d.id === base);
  if (division) return division.level === 1 ? 10 : division.level === 2 ? 6 : 4;
  if (competitionId === 'torneo-verano' || competitionId === 'amistoso') return 0;
  return 5; // domestic cups
}

/**
 * Difficulty from the club's reputation: giants (85+) multiply by 0.1 (a league title is worth
 * one point), a mid club (60) by ~2.2, a small one (45) by ~3.4. Pro Mánager careers earn 50 % more.
 */
export function difficulty(clubReputation: number, mode: Achievement['mode']): number {
  const f = Math.max(0.1, Math.min(5, (86 - clubReputation) / 12));
  return mode === 'promanager' ? f * 1.5 : f;
}

export function achievementPoints(world: World, competitionId: string, kind: AchievementKind, clubReputation: number, mode: Achievement['mode']): number {
  const weight = competitionWeight(world, competitionId, kind);
  if (weight === 0) return 0;
  return Math.max(1, Math.round(weight * difficulty(clubReputation, mode)));
}

/** Total points of a career. */
export const careerPoints = (list: readonly Achievement[]) => list.reduce((s, a) => s + a.points, 0);

// ---------------------------------------------------------------- sharing

/** Compact form of an achievement for a share link (?logro=...). */
export interface SharedAchievement {
  k: AchievementKind;
  m: string; // manager
  c: string; // club name
  cid: string; // club id (crest)
  n: string; // competition name
  nid: string; // competition id (logo)
  s: number; // season
  d: string; // date
  p: number; // points
}

export function encodeAchievement(a: Achievement): string {
  const data: SharedAchievement = { k: a.kind, m: a.managerName, c: a.clubName, cid: a.clubId, n: a.competitionName, nid: a.competitionId, s: a.season, d: a.date, p: a.points };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeAchievement(code: string): SharedAchievement | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const d = JSON.parse(json) as SharedAchievement;
    return d && typeof d.m === 'string' && typeof d.c === 'string' && typeof d.s === 'number' ? d : null;
  } catch {
    return null;
  }
}
