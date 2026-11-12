// Install-to-home-screen helpers: Chrome/Edge/Android fire `beforeinstallprompt`;
// iOS Safari has no prompt, only Compartir → Agregar a inicio.
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac with touch.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallState = { kind: 'hidden' } | { kind: 'prompt'; install: () => Promise<void> } | { kind: 'ios' };

export function useInstall(): InstallState {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (isStandalone()) return { kind: 'hidden' };
  if (deferred) {
    const ev = deferred;
    return {
      kind: 'prompt',
      install: async () => {
        await ev.prompt();
        await ev.userChoice.catch(() => null);
        deferred = null;
        notify();
      },
    };
  }
  return isIos() ? { kind: 'ios' } : { kind: 'hidden' };
}

/** Ask the browser not to evict the IndexedDB save under storage pressure. */
export function requestPersistentStorage(): void {
  try {
    const s = navigator.storage;
    if (!s?.persist || !s.persisted) return;
    s.persisted()
      .then((already) => (already ? true : s.persist()))
      .catch(() => undefined);
  } catch {
    // Storage API unavailable: the save still works, just without the guarantee.
  }
}
