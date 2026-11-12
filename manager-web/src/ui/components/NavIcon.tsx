import type { Section } from '../sections';

// Small line icons for the side menu, drawn for this game.

const PATHS: Record<Section | 'cambiar', React.ReactNode> = {
  tablas: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 9 H21 M3 14 H21 M9 4 V20" />
    </>
  ),
  inicio: (
    <>
      <path d="M3 11 L12 4 L21 11" />
      <path d="M5 10 V20 H19 V10" />
      <path d="M10 20 V14 H14 V20" />
    </>
  ),
  entrenamiento: (
    <>
      <path d="M4 18 L9 13 L13 16 L20 8" />
      <path d="M15 8 H20 V13" />
      <circle cx="6" cy="6" r="2" />
    </>
  ),
  despacho: (
    <>
      <path d="M3 10 H21 V19 H3 Z" />
      <path d="M8 10 V7 H16 V10" />
      <path d="M3 14 H21" />
    </>
  ),
  plantel: (
    <>
      <path d="M8 3 L4 6 L6 10 L8 9 V21 H16 V9 L18 10 L20 6 L16 3 C15 5 9 5 8 3 Z" />
    </>
  ),
  tactica: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <circle cx="8" cy="9" r="1.6" />
      <circle cx="15" cy="14" r="1.6" />
      <path d="M9.5 10.5 L13.5 12.5" strokeDasharray="1.5 1.5" />
      <path d="M17 7 L19 9 M19 7 L17 9" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10 H21 M8 3 V7 M16 3 V7" />
      <path d="M7 14 H9 M11 14 H13 M15 14 H17 M7 17 H9 M11 17 H13" />
    </>
  ),
  partido: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 L15.5 10 L14.2 14 H9.8 L8.5 10 Z" />
      <path d="M12 3.5 V7.5 M15.5 10 L20 8.5 M14.2 14 L17 18.5 M9.8 14 L7 18.5 M8.5 10 L4 8.5" />
    </>
  ),
  mercado: (
    <>
      <path d="M4 8 H17 L14 5 M20 16 H7 L10 19" />
      <circle cx="19" cy="8" r="1.4" />
      <circle cx="5" cy="16" r="1.4" />
    </>
  ),
  finanzas: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 9 V9.01 M18 15 V15.01" />
    </>
  ),
  estadio: (
    <>
      <ellipse cx="12" cy="13" rx="9" ry="5" />
      <ellipse cx="12" cy="13" rx="5" ry="2.4" />
      <path d="M5 9 V4 M19 9 V4 M4 4 H6 M18 4 H20" />
    </>
  ),
  empleados: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20 C3 15 6 13 9 13 C12 13 15 15 15 20" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M16 13.2 C19 13 21 15 21 19" />
    </>
  ),
  directiva: (
    <>
      <path d="M4 20 H20 M6 20 V11 M10 20 V11 M14 20 V11 M18 20 V11" />
      <path d="M3 11 H21 L12 4 Z" />
    </>
  ),
  competiciones: (
    <>
      <path d="M7 4 H17 V8 C17 11 15 13 12 13 C9 13 7 11 7 8 Z" />
      <path d="M7 6 H4 C4 9 5 10 7 10 M17 6 H20 C20 9 19 10 17 10" />
      <path d="M12 13 V17 M8 20 H16 M9 17 H15 V20" />
    </>
  ),
  noticias: (
    <>
      <path d="M4 5 H18 V19 H6 C5 19 4 18 4 17 Z" />
      <path d="M18 9 H20 V17 C20 18 19 19 18 19" />
      <path d="M7 8 H15 M7 11 H15 M7 14 H12" />
    </>
  ),
  clubes: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6 V18 C5 19.4 8 20.5 12 20.5 C16 20.5 19 19.4 19 18 V6" />
      <path d="M5 12 C5 13.4 8 14.5 12 14.5 C16 14.5 19 13.4 19 12" />
    </>
  ),
  logros: (
    <>
      <path d="M8 3 L10.5 9 M16 3 L13.5 9" />
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12 L12.9 13.9 L15 14.2 L13.5 15.6 L13.9 17.7 L12 16.7 L10.1 17.7 L10.5 15.6 L9 14.2 L11.1 13.9 Z" />
    </>
  ),
  cambiar: (
    <>
      <path d="M4 8 H17 L14 5 M20 16 H7 L10 19" />
    </>
  ),
};

export function NavIcon({ section }: { section: Section | 'cambiar' }) {
  return (
    <svg className="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[section]}
    </svg>
  );
}
