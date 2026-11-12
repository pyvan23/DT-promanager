# Pendientes de datos reales

## Antes de publicar
- Revisar condiciones de uso de Cancha Llena (La Nación) y ESPN, o rehacer con otra fuente los planteles de
  Primera Nacional tomados de ahí: Maipú, Gimnasia (J), Gimnasia y Tiro (S), Almirante Brown, Chaco For Ever,
  Defensores de Belgrano, Estudiantes (BA), Los Andes, Almagro, San Telmo, Colegiales, Mitre (SdE), Racing (C),
  Agropecuario, San Miguel, Chacarita Juniors (ver campo `sources` de cada archivo en src/data/real/squads).
- Decidir si la versión con anuncios sale con nombres reales de clubes y jugadores (derechos de marca e imagen)
  o con el mundo ficticio (`createWorld(seed, season, false)`). Nunca usar escudos reales.

## Calidad de datos
- Posiciones: Wikipedia solo da ARQ/DEF/MED/DEL → casi todos figuran como ARQ/DFC/MC/DC. Falta precisar
  laterales, cinco, enganche, extremos.
- Afiliación (directa/indirecta) estimada por ubicación en LPF/Nacional; Rosario Central y Newell's como directa.
- Colores y "stature" de los clubes: estimados por los agentes, revisar.
- Estudiantes (RC): Wikipedia lo da como ascendido y a la vez último en promedios 2026.
- Planteles con fuente vieja (marzo–agosto 2026): Nueva Chicago, Güemes, Colón, Deportivo Madryn, Central Norte.
- Algunas fechas de nacimiento de Wikipedia son de relleno (Tristán Suárez); el cargador descarta las inválidas.

## Planteles sin cargar (quedan con jugadores ficticios)
- B Metro, Federal A, Primera C (salvo Atlas y Cañuelas), Promocional y Regional: búsqueda cortada por el límite
  de uso; en Promocional y Regional casi no hay fuentes públicas.
- Pistas para reintentar: Ezeiza (Wikipedia plantel 2025), Luján (clublujan.com.ar), Racing (Olavarría),
  Ferro (General Pico), Ben Hur, Deportivo Norte, CAI, Huracán (Goya) tienen más prensa regional.
