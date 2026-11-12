// What the people of the club say: each inbox alert in first person by the right employee,
// and the "empleados animados" line of what everyone is doing today.

import type { Alert } from '../../engine/game/alerts';
import type { GameState } from '../../engine/game/game';
import { hash, isStaffRole, seeded, type PersonaRole } from './personas';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function usd(n: number): string {
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}US$ ${(a / 1e6).toFixed(1).replace('.', ',')} M`;
  if (a >= 1e3) return `${sign}US$ ${Math.round(a / 1e3)} mil`;
  return `${sign}US$ ${Math.round(a)}`;
}

/** First word of the manager's name, for a friendly "che, Carlos". */
export const managerFirst = (g: GameState) => {
  const name = (g.managerName || 'DT').trim();
  return /^(el|la|don|doña)\s/i.test(name) ? name : name.split(' ')[0];
};

export interface Voice {
  role: PersonaRole;
  text: string;
}

export function alertVoice(g: GameState, a: Alert): Voice {
  const p = a.playerId ? g.world.players.find((x) => x.id === a.playerId) : undefined;
  const c = p?.condition;
  const starter = !!p && (g.club.lineup?.starters ?? []).includes(p.id);
  const name = p?.name ?? '';
  const dt = managerFirst(g);

  if (a.id.startsWith('inj-')) {
    const days = c?.injuryDays ?? 0;
    return {
      role: 'medico',
      text: `Te paso el parte de la enfermería: ${name} tiene ${(c?.injury ?? 'una lesión').toLowerCase()} y va a estar ${days} ${plural(days, 'día', 'días')} afuera.${starter ? ' Y lo tenés en el once: sacalo, que así no puede jugar.' : ' Ya arrancamos con el tratamiento.'}`,
    };
  }
  if (a.id.startsWith('fit-')) {
    return { role: 'preparador-fisico', text: `${name} está fundido, ${dt}: llega al ${Math.round(c?.fitness ?? 0)} % del físico. Yo lo guardaría un partido, si no se nos rompe.` };
  }
  if (a.id.startsWith('sus-')) {
    const n = c?.suspensionMatches ?? 0;
    return { role: 'segundo-entrenador', text: `Ojo que ${name} no puede jugar: le ${plural(n, 'queda', 'quedan')} ${n} ${plural(n, 'fecha', 'fechas')} de suspensión.${starter ? ' Hay que buscarle reemplazo en el once.' : ''}` };
  }
  if (a.id.startsWith('yel-')) {
    return { role: 'segundo-entrenador', text: `${name} anda con cuatro amarillas. Una más y se pierde un partido; decile que no proteste.` };
  }
  switch (a.id) {
    case 'next-match':
      return { role: 'segundo-entrenador', text: `${a.title.startsWith('Hoy') ? a.title : `Se viene ${a.title.replace(/^Próximo partido: /, '')}`}. ${a.body.replace(/ \(\d{4}-\d{2}-\d{2}\)\./, '.')} Ya estoy armando el video del rival y la charla técnica.` };
    case 'board': {
      const conf = Math.round(g.club.board.confidence);
      return {
        role: 'presidente',
        text: `${dt}, te lo digo de frente: en la comisión directiva la confianza está en ${conf} %. ${g.mode === 'promanager' ? 'Si esto no cambia, no te puedo sostener mucho más.' : 'Hay que dar vuelta esto ya.'}`,
      };
    }
    case 'youth': {
      const n = g.world.players.filter((x) => x.clubId === g.userClubId && x.youth).length;
      return { role: 'entrenador-juveniles', text: `En la cantera tengo ${n} ${plural(n, 'pibe', 'pibes')}. El que más promete es ${name || 'uno de los nuevos'}; si le das minutos, en dos años lo vendés bien.` };
    }
    case 'contracts':
    {
      const n = parseInt(a.title, 10) || 1;
      return { role: 'secretario-tecnico', text: `Tengo sobre el escritorio ${n === 1 ? 'un contrato que vence' : `${n} contratos que vencen`} a fin de temporada: ${a.body.split('. Si')[0]}. Si no renovamos, se nos van gratis.` };
    }
    case 'offers': {
      const n = g.market.offers.filter((o) => o.toClubId === g.userClubId && o.status === 'pendiente').length;
      return { role: 'representante', text: `Hay ${n} ${plural(n, 'oferta', 'ofertas')} por tus jugadores arriba de la mesa. Escuchame, que la plata no espera: miralas en el Mercado.` };
    }
    case 'market':
      return { role: 'ojeador', text: `Encontré un jugador que te puede servir: ${name || a.title.replace(/^.*: /, '')}. ${a.body}` };
    case 'window':
      return { role: 'secretario-tecnico', text: `Se abrió el libro de pases. Tenemos ${usd(g.club.finances.transferBudget)} para fichajes; decime a quién salimos a buscar.` };
    case 'money':
      return { role: 'tesorero', text: `La caja está en rojo, ${dt}: ${usd(g.club.finances.balance)}. O vendemos a alguien o ajustamos gastos; los números no mienten.` };
  }
  return { role: 'secretario-tecnico', text: `${a.title}. ${a.body}` };
}

const ACTIVITY: Record<string, string[]> = {
  'segundo-entrenador': ['Está mirando videos del próximo rival', 'Prepara la pelota parada del fin de semana', 'Repasa el once con la pizarra'],
  'preparador-fisico': ['Está tomando tiempos en la pista', 'Arma la rutina de gimnasio', 'Controla las cargas de la semana'],
  medico: ['Está revisando a los lesionados', 'Hace los controles de rutina', 'Ordena las fichas médicas'],
  ojeador: ['Está buscando jugadores en el ascenso', 'Viajó a ver un partido al interior', 'Mira compactos de ligas del exterior'],
  'entrenador-juveniles': ['Está probando pibes en la cantera', 'Dirige el entrenamiento de las inferiores', 'Recorre los clubes de barrio'],
  'secretario-tecnico': ['Está revisando contratos', 'Habla con representantes', 'Ordena los biblioratos de la liga'],
};

/** What each employee is doing today (changes every day, deterministic). */
export function staffActivity(g: GameState): Voice[] {
  const roles = Object.keys(ACTIVITY) as PersonaRole[];
  return roles.filter(isStaffRole).map((role) => {
    const list = ACTIVITY[role];
    const rnd = seeded(hash(`${g.calendar.date}:${role}`));
    return { role, text: list[Math.floor(rnd() * list.length)] };
  });
}
