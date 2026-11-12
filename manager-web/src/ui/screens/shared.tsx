// Helpers shared by the day-by-day screens: props contract, dates, money, names.

import { useMemo } from 'react';
import { weekday } from '../../engine/calendar/dates';
import type { GameState } from '../../engine/game/game';
import type { MatchEventKind, ScheduledMatch } from '../../engine/game-types';
import type { LiveMatch } from '../../engine/matchday';
import type { Club, Player } from '../../engine/types';
import { ClubBadge } from '../components/ClubBadge';
import type { Section } from '../sections';

/** Screens that are not in the side menu. */
export type View = Section | 'live' | 'simulacion' | 'report' | 'fin';

/** A match being watched live (kept by the App so it survives navigating to other screens). */
export interface LiveSession {
  matchId: string;
  match: LiveMatch;
  /** 'live' = minute by minute with commentary; 'sim' = results only (half-time and final). */
  mode?: 'live' | 'sim';
}

export interface ScreenProps {
  game: GameState;
  update: (g: GameState) => void;
  /** Navigation (optional so the club screens can share the plain {game, update} contract). */
  go?: (view: View, matchId?: string) => void;
  pickPlayer?: (p: Player) => void;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const monthName = (m: number) => MONTHS[m - 1];

/** "sábado 7 de febrero de 2026". */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[weekday(iso)]} ${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** "sáb 7/2". */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${DAYS[weekday(iso)].slice(0, 3)} ${d}/${m}`;
}

export function money(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}US$ ${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',')} M`;
  if (a >= 1e3) return `${sign}US$ ${Math.round(a / 1e3)} mil`;
  return `${sign}US$ ${Math.round(a)}`;
}

export function competitionName(game: GameState, id: string): string {
  if (id === 'amistoso') return 'Amistoso';
  return game.calendar.names[id] ?? id;
}

export function useClubs(game: GameState): Map<string, Club> {
  const clubs = game.world.clubs;
  return useMemo(() => new Map(clubs.map((c) => [c.id, c])), [clubs]);
}

export function usePlayers(game: GameState): Map<string, Player> {
  const players = game.world.players;
  return useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
}

export const isUserMatch = (game: GameState, m: ScheduledMatch) => m.homeId === game.userClubId || m.awayId === game.userClubId;

export function userMatches(game: GameState): ScheduledMatch[] {
  return game.calendar.matches.filter((m) => isUserMatch(game, m)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Win/draw/loss from the user's (or `clubId`'s) side. */
export function outcomeFor(m: ScheduledMatch, clubId: string): 'W' | 'D' | 'L' | null {
  if (m.status !== 'played' || !m.result) return null;
  const home = m.homeId === clubId;
  const us = home ? m.result.homeGoals : m.result.awayGoals;
  const them = home ? m.result.awayGoals : m.result.homeGoals;
  if (us === them && m.result.penalties) {
    const pu = home ? m.result.penalties.home : m.result.penalties.away;
    const pt = home ? m.result.penalties.away : m.result.penalties.home;
    return pu > pt ? 'W' : 'L';
  }
  return us > them ? 'W' : us < them ? 'L' : 'D';
}

export function OutcomeChip({ o }: { o: 'W' | 'D' | 'L' | null }) {
  if (!o) return <span className="form-chip form-chip--none">–</span>;
  return <span className={`form-chip form-chip--${o}`}>{o === 'W' ? 'G' : o === 'D' ? 'E' : 'P'}</span>;
}

export function scoreText(m: ScheduledMatch): string {
  if (!m.result) return 'vs';
  const p = m.result.penalties ? ` (${m.result.penalties.home}-${m.result.penalties.away} pen.)` : '';
  return `${m.result.homeGoals} - ${m.result.awayGoals}${p}`;
}

/** One match on a line: home crest+name, score, away name+crest. */
export function MatchRow({ m, clubs, highlight, onClick }: { m: ScheduledMatch; clubs: Map<string, Club>; highlight?: string; onClick?: () => void }) {
  const h = clubs.get(m.homeId);
  const a = clubs.get(m.awayId);
  return (
    <div className={'match-row' + (onClick ? ' is-clickable' : '') + (highlight && (m.homeId === highlight || m.awayId === highlight) ? ' match-row--mine' : '')} onClick={onClick}>
      <span className="match-row__club match-row__club--home">
        <span className="match-row__name">{h?.shortName ?? m.homeId}</span>
        <ClubBadge club={h} size={20} />
      </span>
      <span className={'match-row__score' + (m.status === 'played' ? '' : ' match-row__score--pending')}>{m.status === 'played' ? scoreText(m) : 'vs'}</span>
      <span className="match-row__club">
        <ClubBadge club={a} size={20} />
        <span className="match-row__name">{a?.shortName ?? m.awayId}</span>
      </span>
    </div>
  );
}

export const EVENT_ICON: Partial<Record<MatchEventKind, string>> = {
  kickoff: '▶',
  goal: '⚽',
  'own-goal': '⚽',
  'penalty-goal': '⚽',
  'penalty-miss': '✕',
  chance: '➹',
  save: '🧤',
  yellow: '▮',
  'second-yellow': '▮▮',
  red: '▮',
  injury: '✚',
  substitution: '⇄',
  'half-time': '⏸',
  'full-time': '⏹',
  'extra-time': '⏱',
  shootout: '◎',
};

export const MENTALITY_LABEL = {
  'muy-defensiva': 'Muy defensiva',
  defensiva: 'Defensiva',
  equilibrada: 'Equilibrada',
  ofensiva: 'Ofensiva',
  'muy-ofensiva': 'Muy ofensiva',
} as const;
export const PRESSING_LABEL = { baja: 'Baja', media: 'Media', alta: 'Alta' } as const;
export const TEMPO_LABEL = { lento: 'Lento', normal: 'Normal', rapido: 'Rápido' } as const;
export const MARKING_LABEL = { zonal: 'Zonal', hombre: 'Al hombre' } as const;
