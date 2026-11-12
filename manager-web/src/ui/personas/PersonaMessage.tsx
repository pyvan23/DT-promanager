// "Mensaje interno": a memo signed by someone of the club, next to their press photo. The text
// appears with a quick, discreet typing the first time (click to skip).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar } from './Avatar';
import type { Persona } from './personas';

const seen = new Set<string>();

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Characters shown so far; types `text` once per session unless reduced motion is on. */
function useTyping(key: string, text: string, enabled: boolean): [number, () => void] {
  const skip = !enabled || seen.has(key) || prefersReducedMotion();
  const [shown, setShown] = useState(skip ? text.length : 0);
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    // A new message in the same slot: start over (or show it at once if already read).
    setPrevKey(key);
    setShown(skip ? text.length : 0);
  }
  useEffect(() => {
    if (shown >= text.length) {
      seen.add(key);
      return;
    }
    const step = Math.max(2, Math.ceil(text.length / 30));
    const id = window.setTimeout(() => setShown((n) => Math.min(text.length, n + step)), 16);
    return () => window.clearTimeout(id);
  }, [shown, text.length, key]);
  return [
    shown,
    () => {
      seen.add(key);
      setShown(text.length);
    },
  ];
}

export interface PersonaMessageProps {
  persona: Persona;
  text: string;
  /** Headline over the note (e.g. the alert title). */
  title?: ReactNode;
  actions?: ReactNode;
  /** card: large press photo with caption · compact: medium photo · inline: a row (inbox, tables). */
  variant?: 'card' | 'compact' | 'inline';
  tone?: 'urgente' | 'atencion' | 'bueno' | 'info';
  typing?: boolean;
  className?: string;
}

const PHOTO_SIZE = { card: 150, compact: 104, inline: 56 } as const;

/** An internal memo signed by someone of the club, next to their press photo. */
export function PersonaMessage({ persona, text, title, actions, variant = 'card', tone, typing = true, className = '' }: PersonaMessageProps) {
  const [shown, finish] = useTyping(`${persona.name}|${text}`, text, typing);
  const done = shown >= text.length;
  const signature = persona.name.replace(/^Don /, '').replace(/ «[^»]+»/, '');
  return (
    <div className={`persona-msg persona-msg--${variant}${tone ? ` persona-msg--${tone}` : ''} ${className}`}>
      <Avatar persona={persona} size={PHOTO_SIZE[variant]} caption={variant === 'card'} className="persona-msg__avatar" />
      <div className="persona-msg__main">
        <span className="persona-msg__who">
          {variant === 'inline' ? (
            <>
              <b>{persona.name}</b> · {persona.cargo}
            </>
          ) : (
            <>
              Mensaje interno · De: <b>{persona.name}</b> · {persona.cargo}
            </>
          )}
        </span>
        {title && <span className="persona-msg__title">{title}</span>}
        <p className="persona-msg__note" onClick={done ? undefined : finish} title={done ? undefined : 'Clic para ver todo'}>
          <span className="sr-only">{text}</span>
          <span className="persona-msg__ghost" aria-hidden="true">
            {text}
          </span>
          <span className="persona-msg__typed" aria-hidden="true">
            {text.slice(0, shown)}
          </span>
        </p>
        {variant !== 'inline' && <span className="persona-msg__sign">— {signature}</span>}
        {actions && <div className="persona-msg__actions">{actions}</div>}
      </div>
    </div>
  );
}

/** Number that counts up/down to its new value (instant with reduced motion). */
export function CountUp({ value, format = (n) => String(Math.round(n)), duration = 700 }: { value: number; format?: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef<number | null>(null);
  useEffect(() => {
    const start = from.current ?? (prefersReducedMotion() ? value : value * 0.6);
    from.current = value;
    if (start === value || prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = 1 - (1 - p) ** 3;
      setShown(start + (value - start) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <span className="count-up">{format(shown)}</span>;
}
