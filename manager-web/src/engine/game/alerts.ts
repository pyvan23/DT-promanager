// Inbox of the main screen: things the manager should look at today (expiring contracts,
// injured or suspended starters, offers, market opportunities, the board…).

import { nextUserMatch } from '../calendar/calendar';
import { fairWage, isWindowOpen, playerValue, searchPlayers } from '../market';
import { overall } from '../squad';
import { POSITION_LINE, type Line, type Player } from '../types';
import { clubOf, type GameState } from './game';

export type AlertTone = 'urgente' | 'atencion' | 'info' | 'bueno';

export interface Alert {
  id: string;
  tone: AlertTone;
  title: string;
  body: string;
  /** Section the alert leads to. */
  view?: 'plantel' | 'tactica' | 'mercado' | 'directiva' | 'partido' | 'finanzas' | 'entrenamiento' | 'noticias';
  playerId?: string;
}

const isCoachOnly = (g: GameState) => g.scope === 'entrenador';

export function alerts(g: GameState): Alert[] {
  const out: Alert[] = [];
  const squad = g.world.players.filter((p) => p.clubId === g.userClubId && !p.youth);
  const lineup = new Set(g.club.lineup?.starters ?? []);
  const date = g.calendar.date;
  const season = g.world.season;

  // Next match.
  const next = nextUserMatch(g.calendar);
  if (next) {
    const rival = clubOf(g.world, next.homeId === g.userClubId ? next.awayId : next.homeId);
    const today = next.date === date;
    out.push({
      id: 'next-match',
      tone: today ? 'atencion' : 'info',
      title: today ? `Hoy jugás contra ${rival.shortName}` : `Próximo partido: ${rival.shortName}`,
      body: `${next.competitionId === 'amistoso' ? 'Amistoso' : (g.calendar.names[next.competitionId] ?? '')}, ${next.homeId === g.userClubId ? 'de local' : 'de visitante'} (${next.date}).`,
      view: 'partido',
    });
  }

  // Injured and suspended players, worst first for the starting eleven.
  for (const p of squad) {
    const c = p.condition;
    if (!c) continue;
    const starter = lineup.has(p.id);
    if (c.injuryDays > 0) {
      out.push({
        id: `inj-${p.id}`,
        tone: starter ? 'urgente' : 'atencion',
        title: `${p.name} está lesionado${starter ? ' y figura en tu once' : ''}`,
        body: `${c.injury ?? 'Lesión'}: ${c.injuryDays} día${c.injuryDays === 1 ? '' : 's'} de baja.`,
        view: starter ? 'tactica' : 'plantel',
        playerId: p.id,
      });
    }
    if (c.suspensionMatches > 0) {
      out.push({
        id: `sus-${p.id}`,
        tone: starter ? 'urgente' : 'atencion',
        title: `${p.name} está suspendido${starter ? ' y figura en tu once' : ''}`,
        body: `Le quedan ${c.suspensionMatches} partido${c.suspensionMatches === 1 ? '' : 's'} de sanción.`,
        view: starter ? 'tactica' : 'plantel',
        playerId: p.id,
      });
    } else if (c.yellowCards === 4) {
      out.push({ id: `yel-${p.id}`, tone: 'info', title: `${p.name} está al límite de amarillas`, body: 'Con una amarilla más se pierde un partido.', playerId: p.id, view: 'plantel' });
    }
    if (starter && c.fitness < 60 && c.injuryDays === 0) {
      out.push({ id: `fit-${p.id}`, tone: 'atencion', title: `${p.name} llega cansado`, body: `Está al ${Math.round(c.fitness)} % físico. Pensá en rotarlo.`, view: 'tactica', playerId: p.id });
    }
  }

  // Board confidence.
  if (g.club.board.confidence < 35) {
    out.push({
      id: 'board',
      tone: g.club.board.confidence < 25 ? 'urgente' : 'atencion',
      title: 'La directiva está preocupada',
      body: `La confianza en vos bajó al ${Math.round(g.club.board.confidence)} %. ${g.mode === 'promanager' ? 'Si sigue cayendo, te echan.' : ''}`,
      view: 'directiva',
    });
  }

  // Youth players ready.
  const youth = g.world.players.filter((p) => p.clubId === g.userClubId && p.youth);
  if (youth.length) {
    const best = youth.reduce((a, b) => (overall(b) > overall(a) ? b : a));
    out.push({ id: 'youth', tone: 'info', title: `Tenés ${youth.length} juvenil${youth.length > 1 ? 'es' : ''} en la cantera`, body: `El más prometedor: ${best.name} (${best.position}, media ${overall(best)}).`, view: 'plantel', playerId: best.id });
  }

  if (!isCoachOnly(g)) {
    // Contracts ending this season.
    const expiring = squad.filter((p) => p.contract && p.contract.untilSeason <= season);
    if (expiring.length) {
      const top = [...expiring].sort((a, b) => overall(b) - overall(a)).slice(0, 3);
      out.push({
        id: 'contracts',
        tone: expiring.some((p) => lineup.has(p.id)) ? 'urgente' : 'atencion',
        title: `${expiring.length} contrato${expiring.length > 1 ? 's vencen' : ' vence'} a fin de temporada`,
        body: `${top.map((p) => p.name).join(', ')}${expiring.length > 3 ? ' y otros' : ''}. Si no renovás, se van libres.`,
        view: 'plantel',
        playerId: top[0].id,
      });
    }

    // Offers received.
    const offers = g.market.offers.filter((o) => o.toClubId === g.userClubId && o.status === 'pendiente');
    if (offers.length) {
      out.push({ id: 'offers', tone: 'atencion', title: `Tenés ${offers.length} oferta${offers.length > 1 ? 's' : ''} por tus jugadores`, body: 'Revisalas en el Mercado: aceptá, rechazá o dejalas vencer.', view: 'mercado' });
    }

    // Market opportunity: an affordable upgrade for the weakest line of the eleven.
    if (isWindowOpen(g.market.windows, date)) {
      const club = clubOf(g.world, g.userClubId);
      const byLine = new Map<Line, Player[]>();
      for (const p of squad) (byLine.get(POSITION_LINE[p.position]) ?? byLine.set(POSITION_LINE[p.position], []).get(POSITION_LINE[p.position])!).push(p);
      const weakest = (['DEF', 'MED', 'DEL'] as Line[])
        .map((line) => ({ line, best: Math.max(0, ...(byLine.get(line) ?? []).map(overall)) }))
        .sort((a, b) => a.best - b.best)[0];
      const budget = g.club.finances.transferBudget;
      const found = searchPlayers(g.world, { line: weakest.line, minOverall: weakest.best + 3, maxValue: budget, excludeClubId: g.userClubId, pageSize: 3 });
      const target = found.results[0];
      if (target) {
        out.push({
          id: 'market',
          tone: 'bueno',
          title: `Oportunidad de mercado: ${target.player.name}`,
          body: `${target.player.position}, media ${target.overall}, ${target.club?.shortName ?? 'libre'}. Vale unos US$ ${Math.round(playerValue(target.player, target.club ?? null, season) / 1000)} mil y pediría unos US$ ${Math.round(fairWage(target.player, club, season) / 1000)} mil por mes.`,
          view: 'mercado',
          playerId: target.player.id,
        });
      }
      out.push({ id: 'window', tone: 'info', title: 'El mercado de pases está abierto', body: `Presupuesto de fichajes: US$ ${Math.round(budget / 1000)} mil.`, view: 'mercado' });
    }

    if (g.club.finances.balance < 0) {
      out.push({ id: 'money', tone: 'urgente', title: 'Estás en rojo', body: 'La caja del club tiene saldo negativo. Vendé o recortá gastos.', view: 'finanzas' });
    }
  }

  const order: Record<AlertTone, number> = { urgente: 0, atencion: 1, bueno: 2, info: 3 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]);
}
