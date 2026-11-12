// Player search for the transfer market screen: filters, sorting and pagination.

import { POSITION_LINE, type Club, type Line, type Player, type Position, type World } from '../types';
import { overall } from '../squad';
import { ageInSeason, playerValue } from './valuation';

export interface SearchFilters {
  /** Main position (any of the list). */
  position?: Position | Position[];
  line?: Line;
  minAge?: number;
  maxAge?: number;
  minOverall?: number;
  maxValue?: number;
  /** Country of the player's club. */
  country?: string;
  nationality?: string;
  divisionId?: string;
  /** Only players on the transfer list (pass the list, e.g. MarketState.transferList). */
  transferListedOnly?: boolean;
  transferList?: readonly string[];
  /** Only free agents (no club). */
  freeAgentsOnly?: boolean;
  /** Leave out one club's players (usually the user's own). */
  excludeClubId?: string;
  /** Include academy youngsters (default false). */
  includeYouth?: boolean;
  name?: string;
  sortBy?: 'overall' | 'value' | 'age' | 'name';
  sortDir?: 'asc' | 'desc';
  page?: number; // 0-based
  pageSize?: number; // default 25
  /** Season for ages and values (default world.season). */
  season?: number;
}

export interface SearchResult {
  player: Player;
  club: Club | null;
  overall: number;
  age: number;
  value: number;
}

export interface SearchPage {
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  results: SearchResult[];
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function searchPlayers(world: World, filters: SearchFilters = {}): SearchPage {
  const season = filters.season ?? world.season;
  const clubs = new Map(world.clubs.map((c) => [c.id, c]));
  const positions = filters.position === undefined ? null : new Set([filters.position].flat());
  const division = filters.divisionId ? world.divisions.find((d) => d.id === filters.divisionId) : undefined;
  const divisionClubs = filters.divisionId ? new Set(division?.clubIds ?? []) : null;
  const listed = filters.transferListedOnly ? new Set(filters.transferList ?? []) : null;
  const name = filters.name ? normalize(filters.name) : null;

  const matches: SearchResult[] = [];
  for (const p of world.players) {
    if (p.youth && !filters.includeYouth) continue;
    if (filters.freeAgentsOnly && p.clubId !== null) continue;
    if (filters.excludeClubId && p.clubId === filters.excludeClubId) continue;
    if (positions && !positions.has(p.position)) continue;
    if (filters.line && POSITION_LINE[p.position] !== filters.line) continue;
    if (filters.nationality && p.nationality !== filters.nationality) continue;
    if (divisionClubs && (!p.clubId || !divisionClubs.has(p.clubId))) continue;
    if (listed && !listed.has(p.id)) continue;
    if (name && !normalize(p.name).includes(name)) continue;
    const club = p.clubId ? clubs.get(p.clubId) ?? null : null;
    if (filters.country && club?.country !== filters.country) continue;
    const age = ageInSeason(p, season);
    if (filters.minAge !== undefined && age < filters.minAge) continue;
    if (filters.maxAge !== undefined && age > filters.maxAge) continue;
    const ov = overall(p);
    if (filters.minOverall !== undefined && ov < filters.minOverall) continue;
    const value = playerValue(p, club, season);
    if (filters.maxValue !== undefined && value > filters.maxValue) continue;
    matches.push({ player: p, club, overall: ov, age, value });
  }

  const sortBy = filters.sortBy ?? 'overall';
  const dir = (filters.sortDir ?? (sortBy === 'name' || sortBy === 'age' ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
  const key = (r: SearchResult) => (sortBy === 'overall' ? r.overall : sortBy === 'value' ? r.value : r.age);
  matches.sort((a, b) => {
    const d = sortBy === 'name' ? a.player.name.localeCompare(b.player.name) : key(a) - key(b);
    return d !== 0 ? dir * d : a.player.id.localeCompare(b.player.id);
  });

  const pageSize = Math.max(1, filters.pageSize ?? 25);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(0, filters.page ?? 0), pages - 1);
  return { total: matches.length, page, pageSize, pages, results: matches.slice(page * pageSize, (page + 1) * pageSize) };
}
