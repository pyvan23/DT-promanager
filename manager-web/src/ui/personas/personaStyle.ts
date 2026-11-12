// Interface preference: how the club's people are drawn. Kept in localStorage (not in the
// career save) and shared by every Avatar through `usePersonaStyle()`.

import { useSyncExternalStore } from 'react';

export type PersonaStyle = 'diario' | 'silueta' | 'fotos';

export const PERSONA_STYLES: { id: PersonaStyle; label: string; text: string }[] = [
  { id: 'diario', label: 'Diario', text: 'Retrato en fotograbado de prensa deportiva, tramado en tinta sobre papel, con epígrafe.' },
  { id: 'silueta', label: 'Silueta', text: 'Figura a contraluz de los reflectores del estadio, como en la cartelería institucional.' },
  { id: 'fotos', label: 'Fotos', text: 'Fotos reales cargadas en public/personas (las que falten se dibujan en estilo Diario).' },
];

/** Styles offered in the options ("Fotos" only when there are photos). */
export const availableStyles = (withPhotos: boolean) => PERSONA_STYLES.filter((s) => s.id !== 'fotos' || withPhotos);

const KEY = 'manager-web:persona-style';
const isStyle = (v: unknown): v is PersonaStyle => v === 'diario' || v === 'silueta' || v === 'fotos';

function read(): PersonaStyle {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return isStyle(v) ? v : 'diario';
  } catch {
    return 'diario';
  }
}

let current: PersonaStyle | null = null;
const listeners = new Set<() => void>();

export function getPersonaStyle(): PersonaStyle {
  if (current === null) current = read();
  return current;
}

export function setPersonaStyle(style: PersonaStyle): void {
  current = style;
  try {
    localStorage.setItem(KEY, style);
  } catch {
    /* private mode or blocked storage: keep it for this session only */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function usePersonaStyle(): [PersonaStyle, (s: PersonaStyle) => void] {
  const style = useSyncExternalStore(subscribe, getPersonaStyle, () => 'diario' as PersonaStyle);
  return [style, setPersonaStyle];
}
