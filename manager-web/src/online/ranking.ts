// Online players' ranking on Supabase (free tier), through its REST API (no SDK needed).
// Turned on by setting VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see docs/ranking-online.md).
// Each device signs in anonymously; row-level security only lets a player write their own rows.

import type { Achievement } from '../engine/game/achievements';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const SESSION_KEY = 'manager-web:ranking-session';

export const isOnlineConfigured = () => !!URL_ && !!KEY;

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // seconds
  user: { id: string };
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(s: Session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    // the session just lasts for this visit
  }
}

async function auth(path: string, body: unknown): Promise<Session> {
  const r = await fetch(`${URL_}/auth/v1/${path}`, {
    method: 'POST',
    headers: { apikey: KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión en el ranking (${r.status}).`);
  const s = (await r.json()) as Session;
  s.expires_at ??= Math.floor(Date.now() / 1000) + 3600;
  saveSession(s);
  return s;
}

/** Anonymous session of this device, created or refreshed as needed. */
async function session(): Promise<Session> {
  const s = loadSession();
  if (s && s.expires_at - 60 > Date.now() / 1000) return s;
  if (s?.refresh_token) {
    try {
      return await auth('token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    } catch {
      // fall through to a new anonymous user
    }
  }
  return auth('signup', { data: {} }); // anonymous sign-in (must be enabled in Supabase)
}

async function rest(path: string, init: RequestInit & { auth?: boolean } = {}) {
  const headers: Record<string, string> = { apikey: KEY!, 'Content-Type': 'application/json', ...(init.headers as Record<string, string>) };
  if (init.auth) headers.Authorization = `Bearer ${(await session()).access_token}`;
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers });
  if (!r.ok) throw new Error(`Error del ranking (${r.status}): ${(await r.text()).slice(0, 160)}`);
  return r.status === 204 ? null : r.json();
}

export interface RankingRow {
  player_id: string;
  manager_name: string;
  points: number;
  titles: number;
  promotions: number;
  best_club: string | null;
}

/** Publishes this career's achievements (idempotent: the same achievement is stored once). */
export async function publishAchievements(managerName: string, list: readonly Achievement[]): Promise<number> {
  if (!isOnlineConfigured()) throw new Error('El ranking online todavía no está configurado.');
  const { user } = await session();
  await rest('players?on_conflict=id', {
    method: 'POST',
    auth: true,
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: user.id, manager_name: managerName.slice(0, 40) }),
  });
  if (!list.length) return 0;
  const rows = list.map((a) => ({
    player_id: user.id,
    achievement_key: a.id,
    kind: a.kind,
    competition_id: a.competitionId,
    competition_name: a.competitionName,
    club_id: a.clubId,
    club_name: a.clubName,
    season: a.season,
    achieved_on: a.date,
    club_reputation: a.clubReputation,
    mode: a.mode,
    points: a.points,
  }));
  await rest('achievements?on_conflict=player_id,achievement_key', {
    method: 'POST',
    auth: true,
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(rows),
  });
  return rows.length;
}

/** Top of the general table (view `leaderboard`). */
export async function fetchLeaderboard(limit = 100): Promise<RankingRow[]> {
  if (!isOnlineConfigured()) return [];
  return (await rest(`leaderboard?select=*&order=points.desc&limit=${limit}`)) as RankingRow[];
}

/** This device's player id, if it already has an online session. */
export const currentPlayerId = () => loadSession()?.user.id ?? null;
