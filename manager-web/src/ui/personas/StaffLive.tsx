// "Empleados animados": every employee with a face and what they are doing today; the
// highlight moves from one to the next every few seconds.

import { useEffect, useState } from 'react';
import type { GameState } from '../../engine/game/game';
import { Avatar } from './Avatar';
import { prefersReducedMotion } from './PersonaMessage';
import { personaFor } from './personas';
import { staffActivity } from './voices';

export function StaffLive({ game }: { game: GameState }) {
  const items = staffActivity(game);
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % items.length), 3200);
    return () => window.clearInterval(id);
  }, [items.length]);
  return (
    <ul className="staff-live">
      {items.map((v, i) => {
        const p = personaFor(game, v.role);
        return (
          <li key={v.role} className={i === active ? 'is-active' : ''}>
            <Avatar persona={p} size={56} />
            <span className="staff-live__text">
              <b>
                {p.cargo}: {p.name}
              </b>
              <span className="muted">
                {p.interim ? 'Cubre el puesto mientras no contrates a nadie' : v.text}
                <span className="staff-live__dots" />
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
