// Visual skins. All are original designs; none reproduces another game's look.
//  - retro:   "Clásico 2000" (default) — bevelled PC windows, dense data tables.
//  - oficina: "Oficina 98" — the retro chrome plus a big colourful icon menu.
//  - consola: "Consola" — modern console sports-game feel: dark glass, neon, angled cuts.
//  - moderno: the newsprint / night-stadium design.

export type Skin = 'retro' | 'oficina' | 'consola' | 'moderno';
const SKIN_KEY = 'manager-web:skin';

export const SKINS: { id: Skin; label: string }[] = [
  { id: 'retro', label: 'Clásico 2000' },
  { id: 'oficina', label: 'Oficina 98' },
  { id: 'consola', label: 'Consola' },
  { id: 'moderno', label: 'Moderno' },
];

export function readSkin(): Skin {
  try {
    const s = localStorage.getItem(SKIN_KEY);
    return SKINS.some((k) => k.id === s) ? (s as Skin) : 'retro';
  } catch {
    return 'retro';
  }
}

export function applySkin(skin: Skin) {
  const root = document.documentElement;
  // "Oficina 98" builds on the retro chrome, so it sets both attributes.
  root.setAttribute('data-skin', skin === 'oficina' ? 'retro' : skin);
  if (skin === 'oficina') root.setAttribute('data-skin-variant', 'oficina');
  else root.removeAttribute('data-skin-variant');
  try {
    localStorage.setItem(SKIN_KEY, skin);
  } catch {
    // per-viewer preference only
  }
}
