# Hoja de ruta

## Hecho
- Motor de competiciones por datos (ligas, zonas, eliminatorias, exentos, entrantes a mitad de torneo).
- Pirámide argentina completa con ascensos, descensos por región y promedios.
- Clubes reales de las 7 divisiones; planteles reales de LPF y Primera Nacional (+ algunos del ascenso).
- Arquitectura multi-país: `Country`/`Confederation`, `Division.country`, copas como datos (`CompetitionDef`)
  con reglas de clasificación (`EntryRule`: puestos de una división, campeón de otra copa, puestos de grupo
  de otra copa, lista fija), estado de clasificación entre temporadas y orden de copas con dependencias.
- Copa Argentina jugable (64 clubes de todas las categorías).
- Rediseño visual con identidad argentina (fileteado, diario "El Tablón", pizarra, banderines).

- Escudos reales: 424 de 486 clubes (capa desactivable con `SHOW_REAL_CRESTS`).
- Juego día a día (equivalente a los comandos CMODA de PC Fútbol 2001):
  - Calendario con fechas reales, pretemporada (amistosos + Torneo de Verano), eliminatorias ronda por ronda.
  - Motor de partido minuto a minuto (relato, tarjetas, lesiones, cambios, prórroga y penales, en vivo).
  - Condición de jugadores (fitness, moral, forma, lesiones, sanciones por amarillas/rojas) y estadísticas.
  - Mercado: valor, sueldos, contratos con cláusula, ofertas/contraofertas, cesiones, IA que compra y vende,
    buscador, ventanas de pases, cartera, transferibles.
  - Club: estadio (capacidad, entradas, césped, ampliaciones), taquilla, sueldos, TV, sponsor, empleados,
    premios, directiva (objetivo, confianza, despido y ofertas de otros clubes).
  - Entre temporadas: evolución por edad, retiros, contratos vencidos/libres, cantera y promoción.
  - Goleadores y valla menos vencida.

- Estilo visual "Clásico 2000" (por defecto, `src/retro.css`, botón *Estilo 2000 / Moderno*): ventanas en relieve,
  menú de botones, tablas densas, marcador electrónico y pizarra de césped. Diseño propio que evoca los mánager
  de PC de fines de los 90; no copia pantallas, arte ni paleta de ningún juego.
- Selector de estilos en la barra superior: Clásico 2000, Oficina 98 (menú de íconos grandes de colores,
  `src/oficina.css`), Consola (estilo de juego de consola actual: vidrio oscuro, neón, cortes en diagonal,
  `src/consola.css`) y Moderno. Todos son diseños propios: no imitan íconos ni pantallas de PC Fútbol ni de EA FC.

## Próximo
- Pantallas del juego día a día (en curso): calendario, previa, partido en vivo, mercado, finanzas, estadio,
  empleados, directiva, cantera, competiciones con goleadores.
- Pendiente de motor: entrenamiento semanal, convocatorias a selecciones, filiales, seguros en la UI,
  temporada europea agosto–mayo (hoy todos los países juegan enero–diciembre).

## Más competiciones y países (pedido del usuario)
- Sumar Brasil, Uruguay y el resto de CONMEBOL, y las ligas de Europa (UEFA).
- Con esos países, completar la Libertadores y la Sudamericana con sus clubes (hoy quedan "pendientes"
  porque solo hay clubes argentinos). Copas europeas (Champions, Europa League) con el mismo mecanismo.
- Cómo se agrega un país: entrada en `src/data/countries.ts`, plantillas de divisiones con `country`,
  datos reales en `src/data/real/<país>/` y reglas de clasificación en `src/data/cups.ts`.
- Pendiente de diseño: carpeta de datos reales por país (hoy `src/data/real/` es Argentina) y formatos
  con fases previas (Libertadores fase 1-3, Sudamericana primera fase).

## Ideas en pausa
- Cartas de jugador estilo "figurita" en la alineación (consultado el 2026-11-10; el usuario lo dejó afuera
  por ahora). Si se retoma: diseño propio, sin copiar EA FC/Ultimate Team; sin fotos reales; sin sobres pagos.

## Control por voz (para después)
- El usuario quiere manejar las formaciones y la táctica por audio, además de mouse y teclado.
- Idea: Web Speech API (SpeechRecognition) en el navegador con comandos en español rioplatense
  ("poné 4-3-3", "sacá al 9 y entra Pérez", "presión alta"); un intérprete de comandos que llame a las
  mismas acciones del motor que usan los botones, para que voz, mouse y teclado sean equivalentes.
- Requisitos: permiso de micrófono, funcionar sin conexión cuando sea posible, confirmación visual de cada
  comando entendido.
