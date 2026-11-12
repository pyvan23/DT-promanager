# Cómo funciona el partido en PC Fútbol 2001 (estudio de mecánicas)

> Propósito: entender el flujo y las reglas del partido (previa → juego → post-partido) para reimplementarlos con **diseño, textos y código propios** en nuestro mánager web. No se copian textos ni gráficos: las citas se limitan a pocas palabras para identificar pantallas.
>
> Convenciones: **[O]** = Observado (con fuente), **[I]** = Inferido. Los offsets `0x7xxxxx` son de archivo en `pcf2001_bin\manager.exe` (VA = offset + 0x400000). Las funciones `FUN_xxxxxxxx` son de `decomp\manager.c`. La ayuda HTML del juego está en `pcf2001_instalado\Root\Ayuda\*.htm`.

## 0. Fuentes principales

| Fuente | Qué aporta |
|---|---|
| `Ayuda\selecciona_tipo_de_partido.htm`, `tipo_de_partido_{interactivo,visionado,resumen,resultado}.htm`, `comienzo_de_partido.htm` | Descripción oficial de los modos de juego, los menús y las teclas |
| `Ayuda\tacticas.htm`, `tacticas_avanzadas.htm`, `alineacion.htm`, `ver_rival.htm`, `tiradores.htm`, `dia_de_partido*.htm`, `estadisticas.htm`, `seguimiento.htm`, `junta_directiva.htm`, `empleados.htm` | Previa, táctica y post-partido |
| Tabla de textos `TX_*(tx_<fuente>_cpp)` en manager.exe | Agrupa las cadenas por archivo fuente original: `tx_ventanaopciones_cpp` (tipo de partido), `tx_pantallapartido_cpp` (pantalla del partido), `tx_pcfwinhighlights_cpp` (simulador 2D), `tx_pcfwintacticas_cpp` y `tx_pcfwintacticasav_cpp` (tácticas), `tx_pcfwinemparejamientos_cpp` (marcajes), `tx_pcfwinalineacion_cpp` (alineación) |
| `FUN_00612870`, `FUN_00612a20`, `FUN_00614d50`, `FUN_00615640`, `FUN_006126d0`, `FUN_00612430`, `FUN_006125d0` | Motor de **resultado rápido**: goles, tarjetas, lesiones, prórroga, penaltis y estadísticas |
| `FUN_004af2b0`, `FUN_004af410`, `FUN_004af520`, `FUN_004af610`, `FUN_004a21b0`, tabla `0xB0D340` | Encaje del jugador en su puesto táctico y línea (DEF/MED/DEL) |
| `Tactics\predef.001…010`, `FUN_0052b170` y `FUN_0052c300` | Formato de las tácticas |

Hallazgo lateral **[O]**: la tabla de textos tiene 5 columnas: alemán, italiano, inglés, **español rioplatense** y español peninsular. La columna rioplatense incluye "Saque de costado", "PELOTAZO", "COMPUTADORA", "TANDA DE PENALES" y "Final del primer tiempo". El original ya se localizaba para Argentina.

---

## 1. Modos de jugar un partido

### 1.1 Selección
- **[O]** La pantalla del selector se titula "SELECCIONA TIPO DE PARTIDO" (`TX_OPCIONES_TIPOPARTIDO`, 0x76f59c) y se abre desde el icono del jugador corriendo en el Menú Mánager (`menu_manager.htm`).
- **[O]** Ofrece **cuatro modos**: `TX_PARTIDO_INTERACTIVO`, `TX_PARTIDO_VISIONADO`, `TX_PARTIDO_RESUMEN` y `TX_PARTIDO_RESULTADO` (0x76f6e0–0x76f940). El modo Resumen se etiqueta "2D" en alemán, y en otras partes se le llama "highlights" o "simulador" (`tx_pcfwinhighlights_cpp`).
- **[O]** Los modos 3D (Interactivo y Visionado) añaden:
  - **duración real** de 4, 8, 12 o 20 minutos (`TX_PARTIDO_4MIN…20MIN`);
  - "CONFIGURACION" (gráficos y sonido);
  - **"TECLAS TÁCTICAS"**: cuatro tácticas asignadas a cuatro teclas para cambiar de sistema sin detener el juego;
  - "Tipo de control" (solo en Interactivo): teclado, joystick o gamepad.
- **[O]** El modo de partido se guarda como un entero en el objeto del partido (`+0x2100`). El valor **4 = Resultado**. Si no hay 3D disponible, se fuerza a 4 (`FUN_00612870`, final). Los valores 1 y 2 inicializan el dispositivo 3D (`FUN_006141e0`). **[I]** El resto de valores (0 y 3) corresponde a los otros modos.
- **[O]** **Los partidos entre dos equipos de la CPU siempre se resuelven con el motor rápido** (`FUN_00612870` llama a `FUN_00612a20(0,0,0)` si ningún equipo es humano, campo `+0x11c`). La excepción son los partidos marcados para verlos.
- **[O] "Ver partidos"** (`ver partidos.htm`, `tx_pantallavisionadopartidos_cpp`): permite marcar con una cámara cualquier partido de la jornada, de cualquier liga. Se reproducirá después del tuyo y podrás elegir en qué modo verlo.

### 1.2 Qué ve el usuario en cada modo

| Modo | Experiencia | Interacción |
|---|---|---|
| **Interactivo** | Partido 3D en el que el usuario controla a un jugador (mover, pase corto/largo, disparo con efectos, regate; en defensa: entrada, robo, cambio de jugador y sprint; además, controles de faltas y córners) (`como_usar_el_simulador.htm`) | Menú con Esc, teclas F, teclas tácticas |
| **Visionado** | El mismo 3D, pero como espectador de "televisión": el equipo juega según la alineación y la táctica fijadas | Menú con Esc, teclas F, teclas tácticas, cámaras |
| **Resumen** (2D) | Se juega en la propia pantalla previa. En un campo 2D, los jugadores son **círculos con dorsal** que se mueven, con la opción de mostrar nombres. Debajo, las **incidencias minuto a minuto**, y más abajo un **selector de velocidad** con flechas | Cambiar táctica, pedir cambio (F1), marcajes, lista de jugadores; al pulsar un jugador de la lista se resaltan sus movimientos |
| **Resultado** | Sin animación: se muestra el **marcador al descanso** y después el **final** | Al descanso: alineación, tácticas y estadísticas. Luego "Seguir" lleva al final del partido |

Fuente: ayuda HTML **[O]**.

### 1.3 "Jugar parte del partido"
- **[O]** `FUN_00612a20(modo, param_2, &golesA, &golesB)` simula por tramos. El valor de `param_2` indica el tramo:

| `param_2` | Tramo |
|---|---|
| 0 | Partido entero |
| 1 | 1ª parte |
| 2 | 2ª parte (admite el marcador inyectado desde fuera) |
| 3 y 4 | Partes de la prórroga |
| 5 | Tanda de penaltis |

- **[O]** El nombre `CMODAJugarPartePartido` forma parte del protocolo de red (junto a `CMODATimeRemaining`, `CMODADateReady` y los mensajes de cliente "ESPERANDO DATOS"). Las opciones online incluyen "TIEMPO PARA JUGAR PARTIDO", "TIEMPO DE PREPARACIÓN DEL PARTIDO" y "PERMITIR JUEGO DE PARTIDOS EN MODO RESUMEN, HIGHLIGHTS O SIMULADOR" (0x7724d4).
- **[I]** En una liga en red, el servidor reparte los tramos del partido y fija ventanas de tiempo para prepararlo y jugarlo. Es un modelo asíncrono muy aprovechable en web.

---

## 2. Pantalla de simulación

### 2.1 Pantalla del partido (previa y Resumen, `tx_pantallapartido_cpp`, 0x745ecc–0x74689c) [O]
- **Cabecera:** escudos y nombres de los dos equipos, competición y jornada o fase. Recursos: `DBDat\MiniEsc\…`, banderas `DBDat\Banderas\BA96%04u.BMP` y etiquetas internas "Equipo 1/2", "Competición" y "Jornada o fase" (0x720f6c–0x720fb8).
- **Estadio y condiciones:** asistencia o espectadores; clima *Despejado / Lluvia / Nieve*; "Terreno de juego:" *seco / normal / embarrado / encharcado / nevado*.
- **Alineación y tácticas** de cada equipo, el **"JUGADOR DEL PARTIDO"** y el acceso a "RES. GLOBALES".
- **Rótulos de tramo:** final de la 1ª parte, de la 2ª, de la prórroga 1ª y 2ª, final del partido, final de los penaltis y "GANA POR … PENALTIS". El gol en propia puerta se marca "(PP)".

### 2.2 Simulador 2D "highlights" (`tx_pcfwinhighlights_cpp`, 0x75cb08–0x75e660) [O]
- **Relato de incidencias** con plantillas del tipo "<acción> de JUGADOR (EQUIPO)". El tipo de evento genera una línea en el relato:
  - jugadas: saque inicial, disparo (con desenlace: fuera, alto, poste, larguero, lejos de la portería), cabezazo, centro, internada, entrada, entrada fallida, robo, despeje, parada;
  - faltas y balón parado: falta, fuera de juego, córner, saque de córner, saque de falta, penalti y penalti lanzado;
  - goles: gol y gol en propia puerta;
  - tarjetas y lesiones: amarilla, segunda amarilla, roja, lesión;
  - rótulos de tramo: comienzo, 1ª y 2ª parte, prórroga 1/2, penaltis y fin.
- **Pestañas o botones:** "ESTADIST.", "AVANZADAS" (tácticas avanzadas) y "MARCAJES". Ayuda en pantalla para F1 (activar cambios).
- **Gráficos** (`graficos\highlights\`): balón con estela, bal01…bal10 (animación del balón), cartel, crunom (rótulos con nombre).
- **Formatos:** reloj `%02u:00` (minuto) y porcentaje `%u %%` (posesión) (0x7094b8–0x7094c0).
- **Control de velocidad** con flechas izquierda/derecha alrededor de un número (`tipo_de_partido_resumen.htm`). **[I]** Ese número es el multiplicador de tiempo del reloj; no se halló la tabla de velocidades.
- **Mostrar nombres** bajo los círculos (activable en cualquier momento, por equipo). En **Lista**, al pulsar un jugador propio o rival se ve su recorrido.

### 2.3 Partido 3D (Interactivo y Visionado) [O]
- **Marcador y mini-campo:** gráficos `Simuldat\menus\marcador.gif` y `vcr.gif`, fuentes `sim_pro8` y `sim_dk10` (0x7207fc–0x72087c).
- **Teclas** (ayuda):

| Tecla | Función |
|---|---|
| F1 | Pedir cambio |
| F3 | Mini-pantalla con marcador, tiempo y colocación de los jugadores |
| F4 | Pausa |
| F5 y F6 | Colocación de la cámara |
| F7 | Ángulo inverso |
| F8 | Zoom |
| F11 | Cámara libre |
| F12 | Cámara cenital |

- **Menú con Esc** (0x7203a4–0x7207e8):
  - Continuar partido;
  - Repeticiones (VCR: rebobinar, avanzar, grabar; guardar goles en `Goles\pcf%.5u.rpl`, "GALERÍA DE GOLES");
  - Cambios y tácticas;
  - Tipo de cámara (tercera persona, lateral, vertical, acción, libre, fijas 1–8, zoom);
  - Opciones gráficas, Resolución, Sonido (comentarios, ambiente, FX), Controles;
  - Repetir goles automáticamente;
  - Control del partido;
  - Finalizar partido.
- **Submenú de cambios por equipo:** "PEDIR SUSTITUCIÓN" y "TÁCTICA 1…4" (0x71ed60–0x71ee68 y `OPCION TACTICA n EQUIPOn`, `OPCION PEDIR CAMBIO EQUIPO n`, 0x720cc0–0x720dfc). Están los dos equipos porque hay modo de dos jugadores.
- **Barra de energía** del jugador ("Barra de Energia", 0x720f58) y nombre del jugador activo.
- **Árbitro y linieres:** modelos con dorsal (`simuldat\texturas\camisetas\arbitro%02d.gif`) y opción "Árbitros y linieres visibles". **[I]** En el 3D son cosméticos; no se halló un uso del árbitro en el motor rápido.
- **Clima y estadio en el 3D:** "Cargando clima…", lluvia, nieve (`CESPEDnieve.pal`), modo noche (`estadio.bsp` nocturno), focos según las instalaciones del estadio (`TX_FOCOS0…3`: sin focos, 500 kW, 1.000 kW o 1.500 kW).

### 2.4 Frecuencia de actualización [I]
- En Resumen, el relato avanza **minuto a minuto** (lo dice la ayuda y lo refleja el formato `%02u:00`).
- En los modos 3D, el reloj se comprime a la duración elegida (4–20 minutos reales para 90 de juego).
- En Resultado solo hay **dos actualizaciones**: el descanso y el final.

---

## 3. Interacción durante el partido

| Situación | Qué se puede hacer | Fuente |
|---|---|---|
| **3D, en cualquier momento** (Esc) | Pedir cambio (**se hace efectivo cuando el árbitro lo autoriza**, es decir, con el balón parado) y cambiar de táctica (**inmediato**, como una orden desde el banquillo) | ayuda [O] |
| **3D, sin pausar** | Teclas tácticas: alternar entre 4 tácticas predefinidas por el usuario | ayuda y `OPCION TACTICA 1–4` [O] |
| **3D, "Control del partido"** | Vuelve a la pantalla previa: **solo se puede cambiar el sistema**, no la alineación ni el puesto de los jugadores | ayuda [O] |
| **Resumen** (en cualquier momento) | Cambiar táctica, pedir cambio (F1), fijar marcajes, ver la lista y los movimientos | ayuda [O] |
| **Resultado** (solo al descanso) | Alineación, tácticas (sistema, alineación, reordenar) y estadísticas | ayuda [O] |

Hay un detalle importante del modo Resultado. **[O]** En `FUN_00612a20` con `param_2 = 0`, la función `FUN_00614d50` calcula **de una vez** los goles de ambos equipos en las dos partes (campos `+0x21f0/0x21f4` para el local y `+0x21f8/0x21fc` para el visitante) **antes** de la pantalla del descanso (`FUN_0060edf0` → `FUN_0060e930`), que no los recalcula. Los cambios al descanso **solo influyen en quién marca**: `FUN_006126d0` elige al goleador entre los que están en el campo. **[I]** Es una "ilusión de control". En nuestro juego conviene que los cambios sí afecten al resto del partido.

**Límites**
- **[O]** Existen las categorías **Titulares / Reservas / No convocados** (`tx_pcfwinalineacion_cpp`: "JUGADORES TITULARES", "RESERVAS", "NO CONVOCADOS"). Los huecos de la alineación son **1–11 titulares y 12–16 suplentes**, es decir, **5 en el banco** (`FUN_004ae2f0`: rangos `<0xC` y `<0x11` del campo `+0x60`).
- **[O]** No pueden jugar los convocados por su selección, los lesionados ni los sancionados (avisos `TEXTO_AVISONOVALIDO*`). Tampoco se puede sustituir a un expulsado ("No puedes cambiar a un jugador expulsado"). Si el once no es válido, aparece un aviso de alineación incorrecta (`TX_TITULARNOVALIDO`).
- **[I]** El máximo de 3 cambios, propio de la normativa de la época, no aparece como cadena. Se asume 3.
- **[O]** Los marcajes **solo se fijan desde la pantalla previa** al partido o desde Resumen (`comienzo_de_partido.htm`).

---

## 4. Previa

### 4.1 Secuencia de pantallas [O, ayuda y menús]
1. **Día de partido** (solo como local): **precio de las entradas**.
   - Sin estadio modular: un precio único en un rango, en pasos fijos.
   - Con estadio modular: hasta 4 calidades de asiento (VIP, palco, media y baja), con precio de entrada y de abono para cada una.
   - La ayuda aconseja tener en cuenta la clasificación y la categoría de ambos equipos.
2. **Rueda de prensa** (`TX_RUEDADEPRENSA`): elegir el tono de la declaración, entre *escandalosas*, *moderadas* o *sin comentarios*. Genera una noticia con titular y cuerpo (`TF_TitRuedaDP_Bocazas/Moderado/NoComment`). **[I]** Afecta a la moral o a la presión; no se localizó el efecto numérico.
3. **Convocatoria y alineación**: plantilla completa con parámetros y con vista de 0–99 o de estrellas (0–5). El primer once que se muestra es el más habitual. La opción "Alineaciones y tácticas automáticas" lo rellena todo y sustituye a lesionados y sancionados por el jugador más parecido (`personalizacion_del_manager.htm`).
4. **Tácticas** (`tacticas.htm`):
   - **10 tácticas predefinidas** (3-4-3, 3-5-2, 4-3-3, 4-4-2, 5-3-2, 5-4-1, 4-2-4, 5-2-3, 4-5-1, 3-3-3-1; tabla de punteros en 0x70c5c8). También se pueden crear formaciones libres.
   - Cada jugador tiene una posición **defensiva** (círculo) y otra **ofensiva** (flecha), y ambas se arrastran con el ratón.
   - Cada titular tiene un **rol entre 18** con su **% de rendimiento** en ese rol.
   - Estilo **"AL TOQUE" / "BALÓN LARGO"** (`TX_ALTOQUE`, `TX_BALONLARGO`).
   - Cargar y grabar tácticas propias (`tactics\TACTIC.%03X`) y la acción "ReAlineación".
5. **Tácticas avanzadas** (`tacticas_avanzadas.htm`, `tx_pcfwintacticasav_cpp`):
   - vistas *General / Ataque / Defensa*;
   - colocación *por posición del balón* o *por posición*: se pulsa una casilla del campo y se ve dónde se coloca cada jugador;
   - **simulación de jugadas** con un menú de jugadas ensayadas (contraataque, triangulaciones, jugada por la banda, cambio de juego, saque de banda, córner al primer palo, jugada ensayada) y archivos `simuldat\jugadas\*.jub`.
6. **Marcajes** (`tx_pcfwinemparejamientos_cpp`): emparejar a un jugador propio con uno rival. Hay "línea de marcajes defensivos" y "de mediocampo", y un modo "personaliza".
7. **Tiradores** (`tiradores.htm`): listas ordenadas de **hasta 5** lanzadores para penaltis, faltas izquierda/derecha y córners izquierda/derecha.
8. **Ver rival** (`ver_rival.htm`): once inicial, parámetros y sistema del rival. **Solo disponible si se ha contratado a un "Observador"**.
9. **Comienzo de partido**: resume lo anterior con estadio, clima, terreno y asistencia. Permite entrar en Alineación (solo con los convocados), Tácticas y Marcajes. Muestra también las teclas tácticas y la lista.

### 4.2 Formato de `Tactics\predef.NNN` [O]
- 1848 bytes = **11 registros de 168 bytes (0xA8)**, uno por hueco de la alineación (1 = portero). Lo lee `FUN_0052b170` 11 veces (código en manager.c, línea ~56788).
- `predef.001…010` siguen el orden de la tabla de formaciones: 001 = 3-4-3, 002 = 3-5-2, 003 = 4-3-3, 004 = 4-4-2, 005 = 5-3-2, 006 = 5-4-1, 007 = 4-2-4, 008 = 5-2-3, 009 = 4-5-1 y 010 = 3-3-3-1.
- Registro (todo `u16` little-endian), leído por `FUN_0052b1f0` y `FUN_0052b2a0`:

| Offset | Contenido | Interpretación |
|---|---|---|
| 0x00 | 20 × `u16` X **con balón** | Posición del jugador según en cuál de las **20 casillas** esté el balón |
| 0x28 | 20 × `u16` Y con balón | íd. |
| 0x50 | 20 × `u16` X **sin balón** | íd. en defensa |
| 0x78 | 20 × `u16` Y sin balón | íd. |
| 0xA0 | `u16` X ofensiva base, `u16` Y ofensiva base | La "flecha" del editor |
| 0xA4 | `u16` X defensiva base, `u16` Y defensiva base | El "círculo" del editor |

- **Coordenadas [O]:** X = largo del campo, de 0 (portería propia) a ~454; Y = ancho, de 0 a ~275 (los rectángulos de rol de la tabla 0xB0D340 cubren 0–454 × 0–275).
  - Ejemplo: el portero de 4-4-2 tiene X ≤ 73 en todas las casillas; el delantero centro tiene X ≈ 330–443 con balón y ≈ 136–370 sin balón.
- **[I]** Las 20 casillas se agrupan en 4 franjas a lo largo del ancho del campo, con 4, 6, 6 y 4 casillas en el sentido del largo. Así lo sugieren las secuencias crecientes de X dentro de cada grupo de 4, 6, 6 y 4 y que Y cambie de grupo a grupo. Encaja con la vista "por posición del balón" de la ayuda.
- **[O]** La táctica en memoria de cada equipo ocupa 0x754 bytes: cabecera de 0x1A (nombre, etc.) más 11 registros. El equipo guarda varias, con el índice de la activa en `equipo+0xF0` y el array en `+0xF4`. **[I]** Son las 4 tácticas de las teclas tácticas.
- **[O]** En `tactics\TACTIC.%03X` (`FUN_0052c300` para grabar y `FUN_0052c1c0` para cargar), el archivo guardado por el usuario contiene:
  - el byte marcador `0xFF`;
  - dos textos codificados (nombre y otro dato);
  - fecha, hora y minuto;
  - los mismos 11 registros de 168 bytes.

### 4.3 Línea y encaje en el puesto [O]
- **Línea del jugador** (`FUN_004a21b0`): si la X defensiva base es menor que 128, es **DEF**; si no, y la X ofensiva base es mayor que 289, es **DEL**; en otro caso, **MED**.
- **Zona del rol** (tabla `0xB0D340`, 18 × {xmin, ymin, xmax, ymax, flag}): cada uno de los 18 roles tiene un rectángulo válido. El flag 1 (roles atacantes) evalúa la posición ofensiva; el 0, la defensiva. Ejemplos:
  - rol 0 (portero): x 0–30, y 91–183;
  - rol 8 (delantero centro): x 332–454, y 61–213.
- **Penalización por salirse de la zona** (`FUN_004af2b0`, solo para equipos humanos):
  - dentro de la zona: 0;
  - a menos de 20 unidades: 1;
  - a menos de 70: 2;
  - más lejos: 3.
- **Rol frente a demarcaciones del jugador** (`FUN_004af610`): resta 0, 24, 40, 70… según la compatibilidad entre el rol asignado y las 6 demarcaciones jugables del jugador. Es el "% de rendimiento" que muestra la ayuda. `FUN_004af410` añade −15 si el jugador está fuera de la zona.

### 4.4 Árbitro, clima y estadio
- **[O]** Hay base de árbitros (`AR022.DBC`, ver referencia_pcf2001.md §1.5). En "Seguimiento → Partidos" se ve "el árbitro del partido" junto a goles, incidencias y declaraciones.
- **[O]** El clima (despejado, lluvia, nieve) y el estado del terreno (seco, normal, embarrado, encharcado, nevado) se muestran en la pantalla del partido. El "Encargado del campo" cuida el césped (`empleados.htm`), y el césped puede estar en mal estado o impracticable y tener calefacción (`TX_CALECESPED`).
- **[O]** Hay asistencia y espectadores. El aforo y las instalaciones (focos, marcadores, vestuarios, enfermería) se ven en `tx_pcfwinestresumen_cpp`.
- **[I/O]** **El motor rápido no lee árbitro, clima, terreno ni público**: `FUN_00614d50` no los referencia. Si influyen, es en el motor 2D/3D (`FUN_006141e0` y siguientes, no analizado).

---

## 5. Post-partido

- **[O] Pantalla "Final de partido"**: resultado final con estadísticas y gráficos de tarjetas (`graficos\finalpartido\amarilla`, `roja`), el "JUGADOR DEL PARTIDO" y el acceso a "RESULTADOS GLOBALES" (`tx_pantallafinaljornada_cpp`).
- **[O] Estadísticas por jugador** que se acumulan (`estadisticas.htm` y `TX_TOOL_*` en `tx_pcf8dlgordenacion_cpp`):
  - partidos y minutos jugados;
  - minutos de posesión;
  - veces jugador del partido;
  - goles, tiros, pases buenos/malos, entradas buenas/malas, paradas (porteros);
  - amarillas, rojas, expulsiones, lesiones.
- **[O]** El historial del jugador añade goles en casa y fuera y máximas victorias y derrotas.
- **[O]** Las estadísticas por jugador se **generan estadísticamente** en `FUN_00615640`, una vez por tramo de 45 minutos:
  - tiros del equipo: aleatorio(0..9) + 1 por parte;
  - acciones (pases, entradas, regates) repartidas entre los 11 con una probabilidad que depende de un atributo de la ficha de partido (`rand(200) < atributo`, la mitad si no se cumple cierta condición);
  - tiros extra para medios y delanteros proporcionales a los goles del equipo;
  - aciertos y fallos ponderados por un valor del jugador (`+0x86`).
  - **[I]** Ese valor es la calidad o la moral.
- **[O] Tarjetas y lesiones** en el motor rápido (`FUN_00612a20`):
  - **lesión**: 10 % por parte, a un jugador al azar, en el minuto 15–44 o 50–89 (`FUN_006125d0`);
  - **tarjetas**: 5 intentos por parte con un 50 % cada uno, a un jugador al azar; al portero solo si supera una tirada contra un atributo (`FUN_00612430`);
  - la segunda amarilla equivale a una roja.
- **[O] Sanciones:** acumulación de tarjetas, doble amarilla, roja directa, amarilla + roja y, en algunas ligas, por **puntos de tarjetas** (0x73d9d4–0x73dd8c). Generan noticia ("sancionado con N de suspensión…").
- **[O] Lesiones post-partido:** noticias con diagnóstico y semanas de baja. La pantalla Lesionados muestra la lesión, las semanas, el coste, el seguro y el tratamiento del médico, que acorta la baja y tiene un cupo de jugadores atendidos a la vez (`lesionados.htm`). Los iconos de zona de lesión son pierna, estómago, cabeza y brazo (`graficos\lesionados\jug_lesio_*`).
- **[O] Crónica y prensa:** plantillas de noticia por tipo de resultado: victoria intensa, victoria por puntería, goleada ("…goleado"), empate, finales. Hay variantes en pretérito y en perfecto y titulares cortos (0x777fd0–0x7790xx, `TF_TXTGOLEADAS`, `TF_TXTPARTCELEBRADOS`). También hay noticias de la rueda de prensa previa.
- **[O] Repercusión:**
  - **Moral** (campo del jugador `+0xFF`, rango 30–99, `FUN_004b1450`). Tras la jornada (`FUN_004ae2f0`) cambia así:
    - titular: **+3**;
    - suplente convocado: **+1**;
    - no convocado: **−1**;
    - lesionado o sancionado: **−2**.
  - Al empezar la temporada la moral vale entre 40 y 50 al azar (`FUN_004ae080`).
  - **[I]** La identificación como moral se basa en el rango y la dinámica; podría tratarse del "estado de forma".
- **[O] Directiva:** valoración del mánager, confianza del público y confianza de la directiva (0–99), que suben con los resultados y el balance económico. Hay **primas por partido ganado o por objetivo**, que influyen en el rendimiento (`FUN_0049ecf0` las suma al rendimiento del jugador; `junta_directiva.htm`).
- **[O] Ingresos:** taquilla y recaudación del partido como local (`TAQUILLA`, `RECAUDACIÓN`), más catering y merchandising en día de partido.

---

## 6. Qué entradas usa el resultado (motor rápido, `FUN_00614d50`) [O]

Este motor se usa en el modo **Resultado** y en **todos los partidos CPU contra CPU**.

**Paso 1. Valor de cada titular de campo**, `a`. Para los huecos 2–11 con jugador:

```
a = 0,78 · media(Velocidad, Resistencia, Agresividad, Calidad) / (1 + penZona)
  + 0,10 · Moral(+0xFF)
  + 0,05 · Rendimiento(FUN_004af520)
si el equipo es CPU y hay un humano en el partido (con cierta opción global): a ·= 0,99
```

- `penZona` va de 0 a 3 y solo se aplica a equipos humanos (ver §4.3).
- `Rendimiento` (0–99) = media de dos campos del jugador que valen 99 al empezar la temporada (**[I]** forma y energía) − penalización por rol (0/24/40/70) − 15 si está fuera de la zona + bonus por primas (0–16) + 2 × un contador. A los equipos CPU se les aplica +18 en lugar de las correcciones.
- Los atributos técnicos (remate, pase, regate, tiro, entrada) **no intervienen** en este motor.

**Paso 2. Reparto por línea** (DEF/MED/DEL según la táctica):

| Línea | Defensa | Medio | Ataque |
|---|---|---|---|
| DEF | +2a | +a | +0,2a |
| MED | +0,5a | +2a | +0,5a |
| DEL | +0,2a | +a | +2a |

**Paso 3. El portero resta** de la defensa: `0,85·(99−Portero)·4 + 0,15·(198 − 2·mediaGenéricos) + 50·penZona`.

**Paso 4. Totales del equipo:** `D = Defensa + 0,5·Medio`, `A = Ataque + 0,5·Medio`, `Total = D + A`.

**Paso 5. Equipo desequilibrado:** si D o A es menor que el 30 % del Total en cualquiera de los dos equipos, se avisa al humano (mensajes 0x59C y 0x59D) y el resultado se resuelve casi al azar a favor del equipo equilibrado: el desequilibrado marca rand(0..1) y el otro le gana por 1–4, más rand(Total/250).

**Paso 6. Caso normal (equilibrado):**

| Si el más fuerte es… | P(gana el fuerte) | P(empate) | P(gana el débil) |
|---|---|---|---|
| **local** | 40 + Δ/10 (máx. 80) | (100 − P)/2 | (100 − P)/2 |
| **visitante** | 30 + Δ/10 (máx. 80) | (100 − P)/2 | (100 − P)/2 |

- Δ = diferencia de Total entre los equipos (`ftol`, **[I]** en valor absoluto).
- **Ventaja de campo: +10 puntos porcentuales** de victoria para el local.
- **Goles:**
  - el perdedor marca rand(0..2), o rand(0..1) si la diferencia es grande;
  - el ganador marca los del perdedor + 1 + rand(Δ/150);
  - en los empates: 0-0 (3/7), 1-1 (2/7), 2-2 (1/7) o 3-3 (1/7).
- **Goleada extra para el ganador:** +3 (3 %), +2 (6 %) o +1 (11 %).
- Los goles de cada equipo se reparten entre las dos partes con un porcentaje aleatorio.

**Paso 7. Goleadores** (`FUN_006126d0`): sorteo ponderado entre los huecos de campo disponibles (sin expulsados ni lesionados) con pesos por rol (tabla `0xA68300`):

| Rol | Peso |
|---|---|
| Delantero centro | 35 |
| Mediapuntas | 18 |
| Extremos | 15 |
| Interiores y centrocampistas | 10–12 |
| Defensas | 3 |
| Portero | 0 |

Los minutos de los goles se escalonan dentro de cada parte.

**Paso 8. Prórroga** (`param_2` = 3 y 4): goles = (media del atributo de partido de los 11 propios − la del rival)/6 + rand(0..2) − 1. Si sale negativo, se suma rand(media/20). Si hay ganador, se genera **un solo gol** en el minuto 1–15. **[I]** Es un gol de oro.

**Paso 9. Penaltis** (`param_2` = 5): cada equipo mete rand(0..5). Si empatan, se sigue con muerte súbita. Los lanzadores se eligen al azar entre los 11. **[I]** En el motor rápido no se usa la lista de "tiradores".

**Pesos aproximados (Inferido)** para valores típicos (media de genéricos 70, moral 70, rendimiento 80):
- ~83 % atributos genéricos;
- ~11 % moral;
- ~6 % forma, encaje y primas;
- multiplicadores: la penalización por salirse de la zona (/2 a /4) y el equilibrio de la táctica (regla del 30 %);
- localía: +10 puntos porcentuales;
- **azar alto**: hasta el 80 % de favoritismo como máximo, con empates aleatorios.

El árbitro, el clima y el público no intervienen en este motor.

---

## 7. Lagunas

- La fórmula del motor 2D/3D (`FUN_006141e0` → `FUN_006118d0` …) no se ha analizado. Solo se conoce el motor rápido.
- No se ha confirmado el límite de 3 cambios ni la tabla de velocidades del modo Resumen.
- Falta el efecto numérico de la rueda de prensa, del árbitro y del clima.
- La identificación de los campos del jugador `+0xFF`, `+0x10D` y `+0x10E` (moral, forma, energía) es Inferida.

---

## Especificación para nuestro juego (diseño propio, priorizada)

### P0: imprescindible para el primer jugable
1. **Selector de modo de partido** (por partido, con preferencia guardada):
   - **Resultado**: descanso y final;
   - **Directo 2D**: campo con fichas y dorsales, relato minuto a minuto y velocidad ajustable.
   - Los partidos de terceros siempre se resuelven en modo rápido.
2. **Pantalla previa** con escudos, competición y jornada, estadio y asistencia, clima y terreno, accesos a Alineación, Tácticas y Marcajes, y botón Jugar. La alineación se valida: bloquea lesionados, sancionados y convocados por su selección, y exige un once completo.
3. **Convocatoria**: 11 titulares + **banco de 5** (configurable) + no convocados. Alineación automática opcional, que sustituye a los bajas por el perfil más parecido.
4. **Editor de táctica**:
   - formaciones predefinidas (las 10 clásicas como datos JSON propios);
   - posición ofensiva y defensiva arrastrables por jugador;
   - rol de entre ~18 con % de rendimiento visible;
   - estilo de pase (corto / directo);
   - guardar y cargar tácticas.
   - Formato propio: `{slot, rol, atk:{x,y}, def:{x,y}, porZonaBalon?: [20×{x,y}]}`.
5. **Pantalla de partido en directo (2D)**:
   - reloj y marcador;
   - relato de eventos con nuestros propios textos y una variedad de plantillas por tipo de evento: disparo con desenlace (fuera, poste, parada), gol, gol en propia, falta, fuera de juego, córner, penalti, tarjetas, lesión, inicio, descanso y final;
   - posesión en %;
   - controles: **pausa, velocidad (×1/×2/×4/×8), saltar al descanso o al final**.
6. **Interacción en el partido**:
   - pausar en cualquier momento y abrir "Cambios y táctica";
   - **los cambios se aplican en la siguiente interrupción** y la táctica de forma inmediata;
   - límite de cambios configurable (3 por defecto; 5 como opción moderna);
   - no se puede sustituir a un expulsado.
   - A diferencia del original, **los cambios deben afectar a la simulación restante**: simular por tramos y recalcular.
7. **Motor determinista con semilla** (Web Worker o servidor) que produzca un **flujo de eventos**: el modo Resultado y el modo 2D consumen el mismo flujo. Entradas mínimas:
   - atributos (genéricos y técnicos, por línea);
   - encaje rol/zona;
   - moral y forma;
   - equilibrio de la táctica (penalizar líneas vacías, como la regla del 30 %);
   - localía (~+10 puntos porcentuales);
   - azar acotado (techo de favoritismo de ~80 %).
   - Goleadores ponderados por rol. Tarjetas y lesiones con tasas por parte.
8. **Post-partido**:
   - resultado, goleadores con minuto, tarjetas, lesiones, jugador del partido;
   - estadísticas de equipo (tiros, posesión, faltas, córners) y de jugador (minutos, goles, tiros, pases ok/ko, entradas ok/ko, paradas);
   - **nota por jugador**;
   - acceso a otros resultados de la jornada.
9. **Repercusión**:
   - moral por jugar o no jugar (titular +, suplente ±, no convocado −, lesionado o sancionado −) y por el resultado;
   - sanciones por acumulación y roja (reglas por competición, en datos);
   - lesiones en semanas;
   - taquilla como local.

### P1: profundidad del género
10. **Marcajes individuales** (emparejar propio ↔ rival) y líneas de marcaje.
11. **Lanzadores** ordenados (hasta 5) de penaltis, faltas y córners por lado, usados por el motor.
12. **Tácticas por zona del balón** (rejilla de 20 casillas) con vista previa al pulsar en el campo, y **jugadas ensayadas** simuladas de forma visual.
13. **Prórroga y penaltis** según el reglamento de la competición: penaltis con la lista de lanzadores y muerte súbita. Nada de gol de oro, salvo como opción histórica.
14. **"Ver rival"** condicionado a contratar a un observador: once probable, sistema y valoraciones.
15. **Día de partido**: precios de entrada por sector o tipo de asiento, con rangos y pasos, e impacto en asistencia y recaudación según la rivalidad y la clasificación.
16. **Tácticas rápidas**: hasta 4 tácticas preasignadas que se alternan durante el directo con un solo clic o tecla.
17. **Crónica y noticias** generadas por plantillas propias según el tipo de resultado (goleada, remontada, empate, final) y por incidencias (lesión grave, expulsión).

### P2: sabor y extras
18. **Rueda de prensa previa** con 3 tonos (provocador / prudente / sin comentarios) y efecto en la moral y en la presión.
19. **Primas** por victoria o por objetivo que sumen al rendimiento, y **valoración de directiva y afición** (0–99) en función de los resultados.
20. **Clima, terreno y árbitro** como variables del motor (por ejemplo, la lluvia aumenta los errores de pase y un árbitro estricto saca más tarjetas). El original no los usaba en el motor rápido; aquí es una mejora de diseño.
21. **Ver otros partidos** de la jornada en directo 2D (marcar con un clic) y **galería de jugadas o goles** (repetición del flujo de eventos).
22. **Modo online asíncrono**: ventanas de "tiempo para preparar o jugar el partido" y simulación por tramos en el servidor (equivalente a `CMODAJugarPartePartido`).
