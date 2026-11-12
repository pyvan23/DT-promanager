// Commentary in rioplatense Spanish. Placeholders: {p} player, {o} other player (assist,
// keeper, incoming sub), {t} team, {r} rival team, {s} score, {d} detail (e.g. injury).

import type { Rng } from '../rng';

export type PhraseKind =
  | 'kickoff'
  | 'goal'
  | 'goal-assist'
  | 'goal-header'
  | 'own-goal'
  | 'penalty-awarded'
  | 'penalty-goal'
  | 'penalty-saved'
  | 'penalty-wide'
  | 'chance'
  | 'save'
  | 'yellow'
  | 'second-yellow'
  | 'red'
  | 'injury'
  | 'substitution'
  | 'half-time'
  | 'full-time'
  | 'extra-time'
  | 'extra-half'
  | 'shootout-goal'
  | 'shootout-miss'
  | 'shootout-end';

const PHRASES: Record<PhraseKind, string[]> = {
  kickoff: [
    '¡Rueda la pelota! Arranca el partido entre {t} y {r}.',
    'Pitazo inicial. {t} mueve del medio y ya se juega.',
    '¡Empezó! Cancha llena, ambiente caliente y la pelota en movimiento.',
  ],
  goal: [
    '¡GOOOL de {t}! {p} la clavó contra el palo. {s}.',
    '¡GOLAZO! {p} sacó un remate infernal y la mandó a guardar. {s}.',
    '¡Adentro! {p} definió con frialdad ante la salida del arquero. {s}.',
    '¡Gol, gol, gol! {p} apareció solo y no perdonó. {s}.',
    '¡Grito sagrado para {t}! {p} la empujó en el área chica. {s}.',
    '¡La puso donde no llega nadie! Golazo de {p}. {s}.',
  ],
  'goal-assist': [
    '¡GOOOL de {t}! Pase precioso de {o} y {p} la mandó a la red. {s}.',
    '¡Adentro! {o} lo vio solo a {p}, que definió cruzado. {s}.',
    '¡Gol! Jugada colectiva, {o} tocó al medio y {p} la empujó. {s}.',
    '¡Qué asistencia de {o}! {p} solo tuvo que tocarla. {s}.',
    '¡GOOOL! Centro de {o} y {p} le rompió el arco. {s}.',
  ],
  'goal-header': [
    '¡GOOOL de cabeza! {p} se levantó más que todos y la clavó en el ángulo. {s}.',
    '¡Cabezazo letal de {p}! Imposible para el arquero. {s}.',
    '¡Gol de {t}! {p} ganó en el aire y la metió de palomita. {s}.',
  ],
  'own-goal': [
    '¡En contra! {p} quiso despejar y la metió en su propio arco. {s}.',
    '¡Qué desgracia para {p}! Desvío involuntario y gol en contra. {s}.',
    '¡Autogol! {p} la peinó hacia atrás y descolocó a su arquero. {s}.',
  ],
  'penalty-awarded': [
    '¡Penal para {t}! {o} lo bajó adentro del área y el árbitro no dudó.',
    '¡El juez señala el punto penal! Falta de {o} en el área.',
    '¡Penal! {o} llegó tarde y se lo cobraron. Protestas de {r}.',
  ],
  'penalty-goal': [
    '¡Gol de penal! {p} cambió el penal por gol, arquero para un lado y pelota para el otro. {s}.',
    '¡Adentro! {p} la picó con una tranquilidad pasmosa. {s}.',
    '¡Gol! {p} le pegó fuerte al medio y no hubo nada que hacer. {s}.',
  ],
  'penalty-saved': [
    '¡Lo atajó! {o} adivinó la intención de {p} y se quedó con el penal.',
    '¡Qué atajada de {o}! Le contuvo el penal a {p}.',
  ],
  'penalty-wide': [
    '¡Afuera! {p} le pegó mal y el penal se fue por arriba del travesaño.',
    '¡Increíble! {p} la tiró afuera y desperdició el penal.',
    '¡Al palo! El penal de {p} pegó en el poste y salió.',
  ],
  chance: [
    '¡Uh! {p} sacó un remate que pasó cerca del palo.',
    'Se la perdió {p}: quedó mano a mano y la tiró afuera.',
    '¡Casi! {p} probó desde afuera y la pelota se fue apenas desviada.',
    'Llega {t}: {p} cabeceó por arriba del travesaño.',
    '¡Uff! {p} la tuvo y la mandó a la tribuna.',
    'Tiro libre de {t}, le pegó {p} y se fue por encima.',
  ],
  save: [
    '¡Atajadón de {o}! Le sacó el gol a {p} sobre la línea.',
    '{p} remató al arco y {o} contuvo sin problemas.',
    '¡Qué manos! {o} voló y la mandó al córner tras el remate de {p}.',
    'Disparo de {p}, respondió bien {o}.',
    '¡Se la tapó! {o} achicó y le ganó el mano a mano a {p}.',
  ],
  yellow: [
    'Amarilla para {p} por una falta fuerte.',
    'El árbitro le muestra la amarilla a {p}, que protesta.',
    '{p} cortó una contra con falta y vio la amarilla.',
    'Tarjeta amarilla para {p} por una entrada a destiempo.',
    'Amonestado {p} por demorar la reanudación.',
  ],
  'second-yellow': [
    '¡Segunda amarilla para {p}! Se va a las duchas y {t} se queda con uno menos.',
    '¡Expulsado {p}! Doble amarilla y {t} sufre.',
    '¡A la calle! {p} se hizo echar por doble amonestación.',
  ],
  red: [
    '¡ROJA DIRECTA para {p}! Entrada criminal y {t} se queda con diez.',
    '¡Expulsión! {p} se fue con los tapones de punta y el árbitro no dudó.',
    '¡Roja! {p} perdió la cabeza y dejó a {t} con uno menos.',
  ],
  injury: [
    '{p} se toma la pierna y pide el cambio. Parece {d}.',
    'Preocupación en {t}: {p} se tira al piso dolorido ({d}).',
    'Entra el médico: {p} no puede seguir. Pinta a {d}.',
  ],
  substitution: [
    'Cambio en {t}: sale {p} y entra {o}.',
    'Movida del técnico de {t}: {o} por {p}.',
    'Se va {p}, aplaudido, y en su lugar ingresa {o}.',
    '{t} refresca el equipo: entra {o}, sale {p}.',
  ],
  'half-time': [
    'Final del primer tiempo. {s}.',
    'Se van al descanso. {s}.',
    'Termina la primera parte. {s}, todo por definirse.',
  ],
  'full-time': [
    '¡Final del partido! {s}.',
    'Pitazo final. {s}.',
    '¡Se terminó! {s}.',
  ],
  'extra-time': [
    'Igualdad en los 90. ¡Vamos al alargue! {s}.',
    'No se sacaron diferencias: hay tiempo suplementario. {s}.',
  ],
  'extra-half': ['Termina el primer tiempo del alargue. {s}.', 'Cambio de lado en el suplementario. {s}.'],
  'shootout-goal': ['{p} patea… ¡gol!', '{p} la clavó en el ángulo. Adentro.', 'No falla {p}: gol.'],
  'shootout-miss': ['{p} patea… ¡lo atajó {o}!', '¡Afuera! {p} erró su remate.', '¡Al travesaño! {p} no pudo convertir.'],
  'shootout-end': ['¡{t} gana por penales {s}!', '¡Se terminó! {t} se queda con la tanda: {s}.'],
};

export function say(kind: PhraseKind, rng: Rng, vars: Partial<Record<'p' | 'o' | 't' | 'r' | 's' | 'd', string>>): string {
  const list = PHRASES[kind];
  const text = list[Math.floor(rng.next() * list.length)];
  return text.replace(/\{([portsd])\}/g, (_, k: string) => vars[k as keyof typeof vars] ?? '');
}

/** "Platense 2 - 1 Tigre" */
export function scoreLine(homeName: string, h: number, a: number, awayName: string): string {
  return `${homeName} ${h} - ${a} ${awayName}`;
}
