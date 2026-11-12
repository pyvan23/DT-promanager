// Sections of the manager's side menu.

export type Section =
  | 'inicio'
  | 'despacho'
  | 'entrenamiento'
  | 'calendario'
  | 'plantel'
  | 'tactica'
  | 'partido'
  | 'tablas'
  | 'competiciones'
  | 'mercado'
  | 'finanzas'
  | 'estadio'
  | 'empleados'
  | 'directiva'
  | 'noticias'
  | 'clubes'
  | 'logros';

export const SECTIONS: { id: Section; label: string; hint: string }[] = [
  { id: 'inicio', label: 'Inicio', hint: 'Avisos del día y próximo partido' },
  { id: 'despacho', label: 'Despacho', hint: 'Resumen del club y objetivos' },
  { id: 'calendario', label: 'Calendario', hint: 'Partidos mes por mes' },
  { id: 'plantel', label: 'Plantel', hint: 'Jugadores, condición y contratos' },
  { id: 'tactica', label: 'Formación y táctica', hint: 'El once en la cancha, formación y estilo' },
  { id: 'entrenamiento', label: 'Entrenamiento', hint: 'Foco e intensidad de la semana' },
  { id: 'partido', label: 'Previa / Partido', hint: 'El próximo partido' },
  { id: 'tablas', label: 'Tablas', hint: 'Posiciones de cualquier competición del mundo' },
  { id: 'competiciones', label: 'Competiciones', hint: 'Tablas, cuadros y goleadores' },
  { id: 'mercado', label: 'Mercado', hint: 'Pases, cesiones y ofertas' },
  { id: 'finanzas', label: 'Finanzas', hint: 'Caja, ingresos y gastos' },
  { id: 'estadio', label: 'Estadio', hint: 'Cancha, entradas y obras' },
  { id: 'empleados', label: 'Empleados', hint: 'Cuerpo técnico y personal' },
  { id: 'directiva', label: 'Directiva', hint: 'Objetivo y confianza' },
  { id: 'noticias', label: 'Noticias', hint: 'El Tablón, diario deportivo' },
  { id: 'clubes', label: 'Base de datos', hint: 'Todos los clubes' },
  { id: 'logros', label: 'Logros y ranking', hint: 'Tus títulos, puntos y el ranking de DTs' },
];

/** Sections a coach-only career does not manage (the club's sporting director does). */
export const FULL_MANAGER_SECTIONS: Section[] = ['mercado', 'finanzas', 'estadio', 'empleados'];
