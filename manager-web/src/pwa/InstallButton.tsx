import { useState } from 'react';
import { useInstall } from './install';

/** Discreet "Instalar app" control; renders nothing once installed or where it can't help. */
export function InstallButton() {
  const state = useInstall();
  const [hint, setHint] = useState(false);
  if (state.kind === 'hidden') return null;
  if (state.kind === 'prompt') {
    return (
      <button className="btn btn--ghost btn--sm install-btn" onClick={() => void state.install()}>
        Instalar app
      </button>
    );
  }
  return (
    <div className="install-ios">
      <button className="btn btn--ghost btn--sm install-btn" onClick={() => setHint((h) => !h)} aria-expanded={hint}>
        Instalar app
      </button>
      {hint && (
        <p className="install-ios__hint small">
          En Safari tocá <b>Compartir</b> <span aria-hidden="true">(□↑)</span> → <b>Agregar a inicio</b>.
        </p>
      )}
    </div>
  );
}
