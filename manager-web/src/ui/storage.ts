// Local save slot in IndexedDB (a career state weighs several MB, beyond localStorage).
// Storage can be unavailable (private mode, blocked site data, quota), so every access is
// guarded and the game keeps working in memory.

import type { GameState } from '../engine/game/game';

export interface SavedGame {
  version: 2;
  game: GameState;
}

/** What the slot holds: a playable save, a save from an older version, or nothing. */
export type LoadResult = { status: 'ok'; save: SavedGame } | { status: 'outdated' } | { status: 'empty' };

const DB = 'manager-web';
const STORE = 'saves';
const KEY = 'slot-1';
/** Where version 1 saves lived before IndexedDB. */
const LEGACY_KEY = 'manager-web:save';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = action(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error ?? req.error);
        };
      }),
  );
}

const valid = (s: unknown): s is SavedGame => {
  const x = s as SavedGame | undefined;
  return !!x && x.version === 2 && !!x.game && x.game.version === 2 && !!x.game.world && !!x.game.calendar;
};

function hasLegacy(): boolean {
  try {
    return !!localStorage.getItem(LEGACY_KEY);
  } catch {
    return false;
  }
}

export async function loadGame(): Promise<LoadResult> {
  try {
    const raw = await run<unknown>('readonly', (s) => s.get(KEY));
    if (valid(raw)) return { status: 'ok', save: raw };
    if (raw) return { status: 'outdated' };
  } catch {
    // storage unavailable: treat as empty
  }
  return hasLegacy() ? { status: 'outdated' } : { status: 'empty' };
}

/** Resolves to false when the save could not be written. */
export async function saveGame(game: GameState): Promise<boolean> {
  try {
    const save: SavedGame = { version: 2, game };
    await run('readwrite', (s) => s.put(save, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function clearGame(): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(KEY));
  } catch {
    // nothing to clear
  }
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // nothing to clear
  }
}
