# Referencia de género: estudio de PC Fútbol 2001

Este documento es una referencia de diseño para nuestro mánager web original. Describe conceptos, estructuras y mecánicas observadas en la copia del usuario de PC Fútbol 2001 (Dinamic Multimedia, 2000). No contiene código, textos, biografías ni datos del juego. No se debe copiar nada de eso al proyecto nuevo.

**Notación**
- **Observado**: comprobado en un archivo, offset o función concretos.
- **Inferido**: deducido de patrones, pendiente de confirmar.

Direcciones: VA = dirección virtual de `manager.exe`. Funciones con nombre de Ghidra (`FUN_xxxxxxxx`). Conversión de offset de archivo a VA: `.text` raw 0x1000 → VA 0x401000; `.rdata` raw 0x64B000 → VA 0xA4B000; `.data` raw 0x702000 → VA 0xB02000 (en `.data`, VA = offset + 0x400000).

Archivos analizados:
- `pcf2001_iso\DBDAT\*.FDI`, `*.DBC`
- `pcf2001_bin\manager.exe` (SHA-256 `e37079c4…6918cb`)
- `pcf2001_bin\DBASEWIN.EXE`
- Pseudocódigo exportado en `decomp\manager.c`

---

## 1. Base de datos

### 1.1 Contenedor FDI (Observado)
- Usado por jugadores (`JUG00022.FDI`), equipos (`EQ00022.FDI`), entrenadores (`ENT00022.FDI`) y estadios (`EST00022.FDI`).
- Firma `DMFIv1.0` (16 bytes con relleno), seguida de `u32` con el número de registros.
- Índice de entradas de 13 bytes: `u32 id`, `u8 flag`, `u32 offset`, `u32 tamaño`. Los registros son contiguos y de longitud variable.
- Tamaños observados:

  | Archivo | Registros | Tamaño |
  |---|---|---|
  | Jugadores | 34.629 | 53 B – 10 KB |
  | Equipos | 1.451 | ~2 KB |
  | Entrenadores | 1.466 | — |
  | Estadios | 1.445 | — |

- El juego elige el archivo con un patrón de nombre, `dbdat\jug00%03u.fdi`, usando el número de edición/temporada (0x16 = 22). Observado en `FUN_004b6320`, que llama a `sprintf(…, s_dbdat_jug00_03u_fdi_00b0d5d8, 0x16)`. Equipos y estadios siguen el mismo patrón (`FUN` en la línea ~91286 de `manager.c`).
- Hay ficheros de edición por registro (`dbdat\editor\j%05u.dbc`, `eq%04u.dbc`) que sobrescriben a la base (Observado: cadenas en .data 0xB0D4B4–0xB0D5C4). **Lección:** la base se pensó para poder parchearse registro a registro.

### 1.2 Codificación (Observado)
- Los textos se guardan como `u16 longitud` + bytes con XOR 0x61, en Windows-1252.
- Los números no están ofuscados.
- Los `.DBC` empiezan con una cabecera de texto plano de tipo "NOMBRE-Copyright…" y luego usan la misma ofuscación de textos.

### 1.3 Registro de jugador (Observado en `FUN_004ada00` → `FUN_004adac0`, contrastado con los bytes)
Orden de lectura:
1. `u16` tamaño, `u16` versión de formato (800 en esta edición) y `u8`.
2. `u16` id y `u8` **dorsal**.
3. Nombre corto (texto) y nombre completo (texto).
4. `u8` **demarcación principal**, más 1 byte reservado.
5. **Lista de hasta 6 demarcaciones jugables** (`u8` cada una; el código resta 1 y acepta 0–17, es decir, **18 demarcaciones**; fuera de rango = "ninguna").
6. `u8` **nacionalidad** (código de país) y tres `u8` más (+0x56..0x58, sin identificar).
7. Solo si la versión es ≥ 800, dos `u8` con rangos 1–5 y 1–4. Si valen 0xFF, el juego los **genera al azar**. Después, un `u8` bandera.
8. Nacimiento: `u8` día, `u8` mes, `u16` año. Si el año no está entre 1901 y 1987, se genera uno aleatorio.
9. `u8` altura (cm) y `u8` peso (kg). Si son inverosímiles (<150 cm o <50 kg), se generan valores aleatorios razonables.
10. En la base completa vienen 10 textos: lugar de nacimiento, procedencia, internacionalidades, un campo corto, características, palmarés, internacional, anecdotario, temporada anterior y trayectoria (CSV `temporada,club,división,partidos,goles`). En la base "ligera" de jugadores recién generados (ids ≥ ~45.000) estos textos vienen vacíos.
11. **10 atributos `u8` (0–99)**. Cada uno se copia a dos campos internos: valor base y valor actual.
12. Solo si la versión es ≥ 700, **6 `u8` adicionales**.

**Lecciones de diseño:**
- Versionado del formato, con valores por defecto aleatorios cuando falta un dato. Esto permite mezclar registros completos (con biografía) y ligeros (solo números).
- Base y valor actual separados, para modelar la forma o la evolución sin perder el valor original.

### 1.4 Registro de equipo (`EQ00022.FDI`)
- **Observado:** el registro empieza con la cadena de copyright en claro.
- **Observado:** después vienen la cabecera, nombre corto, nombre oficial, año de fundación (`u16`, coincide con clubes conocidos) y un campo numérico grande (probablemente socios o aforo, Inferido).
- **Observado:** a continuación, presidente, patrocinador y proveedor de ropa.
- **Inferido:** sigue un bloque largo de pares `u16` que parece describir la equipación o el escudo de forma vectorial (coordenadas). Son cientos de pares por equipo.
- **Observado:** al final está la **plantilla**, una lista de entradas de 5 bytes (`u8` estado + `u32` id de jugador) que remiten a `JUG00022.FDI`.
- **Observado:** los ids de equipo se agrupan **por país en bloques de 100**: 0–199 España, 200 Italia, 300 Inglaterra, 400 Alemania… 2600–3299 Sudamérica, 5000 México, **9000–9099 Argentina (60 clubes)**, 9900 selecciones y juveniles "comodín". Los primeros 100 ids de cada bloque corresponden a los clubes de mayor categoría.
- **Sin resolver:** presupuesto, estadio asociado, colores y valores de cantera dentro del registro. Habría que analizar el lector de equipos (`manager.c` ~línea 91286).

### 1.5 Otras tablas
- **Observado:** estadios con nombre, aforo, dimensiones y año de inauguración (etiquetas en `DBASEWIN.EXE`: AFORO, DIMENSIONES, INAUGURA. ESTADIO).
- **Observado:** entrenadores con nombre, sistemas tácticos habituales (texto) y trayectoria.
- **Observado:** árbitros (`AR022.DBC`) con nombre, origen, profesión y colegio arbitral.
- **Observado:** `C0…C7*.DBC` son **solo palmarés histórico**: liga, supercopas, Copa de Europa, Intercontinental, con alineaciones históricas de las finales. No definen reglas.
- **Observado:** `Q022.DBC` es un banco de preguntas de un minijuego de trivia ("FUTBOLQUIZ").
- **Observado:** `JORN*.DBC` contienen comentarios de jornadas.

---

## 2. Atributos del jugador

**Observado:** los nombres aparecen como etiquetas de UI en `manager.exe` (.data 0xB48B64–0xB4A8F8 y 0xB3A6DC–0xB3A944): Velocidad, Resistencia, Agresividad, Calidad, Remate, Regate, Pase, Tiro, Entrada, Portero; además Media, Moral y Estado de forma del jugador.

**Orden en disco** de los 10 atributos (Observado por la forma de los valores en jugadores conocidos: delanteros con Remate/Tiro altos, porteros con Portero alto y el resto bajo):

| # | Atributo | Grupo |
|---|---|---|
| 0 | Velocidad | físico/genérico |
| 1 | Resistencia | físico/genérico |
| 2 | Agresividad | físico/genérico |
| 3 | Calidad | físico/genérico |
| 4 | Remate | técnico |
| 5 | Regate | técnico |
| 6 | Pase | técnico |
| 7 | Tiro | técnico |
| 8 | Entrada | técnico |
| 9 | Portero | técnico |

- **Inferido:** la "Media" del jugador se calcula a partir de estos atributos según la demarcación. No se guarda.
- **Sin resolver:** los 6 bytes extra (versión ≥ 700). El primero es 0/1 (¿bandera, quizá pie dominante o comunitario?) y los otros 5 están en 0–99. En jugadores generados son aleatorios y en otros valen todos igual. Podrían ser habilidades de rol o táctica.
- **Sin resolver:** los dos campos 1–5 y 1–4 (¿carácter, ambición, proyección?).
- **Observado:** demarcaciones disponibles en el editor (`DBASEWIN.EXE` .data ~0xB4xxxx). Son 4 líneas generales (portero, defensa, medio, delantero) y unas 18 posiciones finas: lateral der./izq., central der./izq., líbero, volante der./izq., volante tapón, medio centro, interior der./izq., media punta der./izq./centro, extremo der./izq., delantero centro/ariete.
- **Observado:** el entrenamiento tiene sesiones con nombre (tiros a puerta, regate en zig-zag, penales, pases al área, faltas…). **Inferido:** suben atributos concretos.

---

## 3. Equipos y economía

**Observado (etiquetas de UI):**
- Presupuesto, socios, taquilla, ingresos por televisión y patrocinio.
- Empleados contratados (ojeadores, juveniles…) y cantera ("juveniles", promoción de juveniles).
- Primas por ascenso o por ganar el campeonato.
- Contratos con cláusula de rescisión, cesiones, seguros de jugador y libertad por descenso.

**Observado:** el juego modela mensajes como `CMODA…`: más de 150 nombres como CMODAOfertaJugadorEquipo, CMODACesionesJugador, CMODASeguroJugador, CMODAEstadioEquipo, CMODAEmpleados, CMODAPromocionarJuvenilEquipo, CMODAChatMsg, CMODAUserConnect, CMODAServerData… **Inferido:** el mánager tiene una arquitectura cliente/servidor por mensajes, con modo en red y chat. Cada acción del jugador es un comando serializable. **Lección muy aplicable a web:** separar la lógica del juego (servidor o worker) de la interfaz, comunicándose mediante comandos.

---

## 4. Competiciones

### 4.1 Cómo están definidas
**Observado:** cada competición tiene una **etiqueta corta** que se escribe al guardar la partida, por ejemplo FIRSTDIVISION, SECONDDIVISION, THIRDDIVISION, PREMIERLEAGUE, SERIEA/B, BUNDES1/2/3A/3B, FRANCE1/2, HOLAND1/2, CLIGA, CEUROPA, CUEFA, CCCUP, CITOT, INTER, CLIBERTADORES y torneos de verano como GAMPER o BERNABEU. También hay un fichero de estado por competición (`c_actliga_%s%03u.CPT`).

**Observado:** **cada competición es una clase C++ propia**, con su propio constructor y su propia rutina de guardado:
- Copa Libertadores: constructor `FUN_0066e340` (vtable 0xA6950C), guardado `FUN_006705e0`.
- Intercontinental: guardado `FUN_00569070`.

No hay una tabla única de reglas. Ninguna función referencia más de 2 etiquetas a la vez (búsqueda en `manager.c`).

**Observado:** el guardado de la Libertadores escribe:
1. La etiqueta.
2. Una **fase** (7 estados, `switch` en `FUN_006705e0`).
3. Una lista de equipos (`u16` ids).
4. **5 listas de equipos** (Inferido: bombos o grupos).
5. Estructuras compartidas con otras competiciones (`FUN_00601ee0`, `FUN_006018b0`, `FUN_005ff6b0`; Inferido: calendario, clasificación y eliminatorias genéricas).

El constructor reserva 375 partidos y varias tablas de 5–6 entradas.

**Observado:** cada competición tiene en `.data` su juego propio de gráficos (trofeo pequeño, mediano y grande, calendario, pantalla de resultado, sorteo, fondo de campeón).

**Lección clave:** añadir una competición nueva (Copa Argentina o Sudamericana) en el original **requiere código nuevo**, no solo datos. Nuestro juego debe hacer lo contrario: **competiciones 100 % definidas por datos**.

### 4.2 Fútbol argentino en el original
- **Observado:** la liga argentina es **una sola temporada partida en dos mitades**. El código que pone el nombre a la jornada (bytes en VA 0x5F1C80) compara el número de jornada con la mitad del total (`shr eax,1; cmp; jge`): la primera mitad se llama APERTURA y la segunda CLAUSURA. Hay pantallas y textos de "campeón/subcampeón de Apertura/Clausura".
- **Observado:** existen las cadenas DESEMPATE_LIBERTADORES (referenciada desde la misma rutina, VA 0x5F1D8C), DESEMPATE_DESCENSO, DESEMPATE_ASCENSO y DESEMPATE_UEFA. **Inferido:** hay partidos de desempate cuando dos equipos empatan en puestos clave.
- **Observado:** el descenso se hace por **PROMEDIOS** (cadena en VA 0xB340E4, referenciada desde 0x96378F).
- **Observado:** la "Primera Nacional B" tiene FASE_ASCENSO y TORNEO_REDUCIDO_1ER_ASCENSO (referencias en 0x66DDED y 0x66DEBF), además de PROMOCION y LIGUILLA (referenciadas en varias clases).
- **Observado:** en la Libertadores hay **ida y vuelta** (textos "Semifinales - I./V."), tanda de penales y rondas de octavos, cuartos, semifinal y final.
- **Observado:** los textos están localizados a español rioplatense en esta edición: "arqueros", "penales", "computadora".
- **Sin resolver:**
  - Formato exacto de grupos de la Libertadores (número de grupos y clasificados).
  - Criterio de clasificación argentina a la Libertadores.
  - Cálculo concreto de los promedios (cuántas temporadas).

  Están en el código de `FUN_0066e340` y vecinas, y en las funciones ≥ 0x95D000 que el export no había cubierto al redactar esto.

### 4.3 Formatos genéricos observados
Aparecen ligas a doble vuelta, copas por eliminatorias, liguillas de ascenso y descenso, promoción, torneos de pretemporada de un solo partido, supercopas a doble partido y la Intercontinental a partido único (Observado: cadenas y gráficos por competición).

---

## 5. Simulación de partido

- **Observado (etiquetas y estadísticas):** moral del jugador, estado de forma, media, lesiones durante el partido, sanciones (doble amarilla, roja, acumulación de tarjetas), fuera de juego, entradas buenas/malas, pases buenos/malos, tiros atajados, contraataque, marcajes y "zona tranquila".
- **Observado:** hay mensajes de táctica de ataque y defensa por equipo (CMODATacticasAttackDefendEquipo, CMODATacticasEquipo), tácticas predefinidas (`Root\Tactics\predef.001…010`) y la opción de jugar parte del partido (CMODAJugarPartePartido).
- **Inferido:** las entradas de la simulación son los 10 atributos (valor actual), la demarcación y su encaje con el puesto táctico, la moral y la forma, la táctica (sistema más parámetros de ataque y defensa) y la condición de local (taquilla y textos de local/visitante).
- **Observado:** el resultado se presenta de dos formas: resultado rápido (simulación) y partido en 3D (`PLAY3D`, `3DDXF`, `CAMPO`).
- **Sin resolver:** la fórmula de la simulación, que requiere localizar el bucle de partido en `manager.c`.

---

## 6. Lecciones para nuestro juego (mánager web: Liga Profesional, Copa Argentina, Libertadores, Sudamericana)

1. **Competiciones definidas por datos.** Un JSON o YAML por competición con fases, y cada fase con su tipo:
   - liga (una o dos vueltas);
   - grupos (n grupos, clasificados por grupo);
   - eliminatoria (partido único o ida y vuelta; desempate por penales o prórroga);
   - reglas de clasificación entre competiciones (por ejemplo, del puesto X de la liga a la fase Y de la Libertadores).

   Así, la Copa Argentina (eliminación directa a partido único en sede neutral, con equipos de varias categorías) y la Sudamericana (fase previa, grupos y eliminatorias) son solo configuración. **Esto es lo contrario que en el original**, donde cada torneo es una clase de código.
2. **Descenso por promedios** como regla configurable: puntos por partido de las últimas N temporadas. **Torneos partidos** (Apertura/Clausura o fases) como "una liga con cortes de nombre", igual que hace el original, pero declarado en datos.
3. **Desempates explícitos** por competición: diferencia de gol, goles, enfrentamiento directo, partido extra.
4. **Modelo de jugador compacto:**
   - 10 atributos 0–99 en cuatro genéricos y seis técnicos (los nombres y la distribución pueden ser nuestros);
   - posición principal más hasta 5 secundarias;
   - nacionalidad, fecha de nacimiento, altura, peso;
   - **valor base y valor actual** separados para la forma.

   Los textos biográficos, opcionales y fuera del núcleo.
5. **Formato de datos versionado con valores por defecto** (y generación aleatoria de lo que falte). Esto permite importar bases parciales hechas por la comunidad, la vía legal para "jugadores de hoy": nombres ficticios por defecto más un importador.
6. **Bloques de id por país** ayudan, pero mejor ids opacos con un campo `pais` y `division`.
7. **Arquitectura por comandos** (como los mensajes CMODA): la UI envía comandos (fichar, alinear, táctica) a un motor determinista que corre en un Web Worker o en el servidor. Facilita guardar partidas, el multijugador y las pruebas.
8. **Parches por registro:** permitir sobrescribir equipos o jugadores con archivos sueltos, como el original con `dbdat\editor\*.dbc`.
9. **Gráficos por competición** referenciados desde los datos (trofeo, colores), no fijados en el código.

---

## 7. Pendiente
- Campos del registro de equipo: presupuesto, estadio y significado del bloque de pares `u16`.
- Significado de los 6 bytes extra del jugador, los campos 1–5 y 1–4 y los `u8` +0x56..0x58.
- Formato completo de la Libertadores, la clasificación argentina a torneos CONMEBOL y la ventana de promedios. Hay que revisar `FUN_0066e340` y vecinas. El export completo terminó (44.973 funciones, 6 fallidas), pero las referencias en 0x95D21F y 0x96378F (Nacional B, PROMEDIOS) caen en código que Ghidra no delimitó como función. Probablemente es la construcción de pantallas; hay que crear la función manualmente en Ghidra o leer el ensamblado.
- Fórmula de la simulación de partido.
