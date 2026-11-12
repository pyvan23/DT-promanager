// Optional real photos: list files of public/personas/ per role in photos.json, e.g.
// { "medico": ["medico-1.jpg", "medico-2.jpg"] }. When the "Fotos" style is chosen and a
// role has photos, the portrait uses one (picked by the name) inside the same press frame.

import { hash, type PersonaRole } from './personas';

const found = import.meta.glob('./photos.json', { eager: true, import: 'default' });
const INDEX = (Object.values(found)[0] ?? {}) as Partial<Record<PersonaRole, string[]>>;

export const hasPhotos = Object.values(INDEX).some((list) => Array.isArray(list) && list.length > 0);

export function photoFor(role: PersonaRole, name: string): string | null {
  const list = INDEX[role];
  if (!list || list.length === 0) return null;
  return `${import.meta.env.BASE_URL}personas/${list[hash(name) % list.length]}`;
}
