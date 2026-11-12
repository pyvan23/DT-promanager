import { useRegisterSW } from 'virtual:pwa-register/react';

/** Registers the service worker and offers new versions with a small toast. */
export function PwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="pwa-toast" role="status" aria-live="polite">
      <span>Hay una versión nueva</span>
      <button className="btn btn--primary btn--sm" onClick={() => void updateServiceWorker(true)}>
        Actualizar
      </button>
      <button className="btn btn--ghost btn--sm" onClick={() => setNeedRefresh(false)} aria-label="Más tarde">
        ✕
      </button>
    </div>
  );
}
