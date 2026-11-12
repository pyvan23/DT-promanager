// Newspaper-style items generated from the world and the last season summary.

import type { SeasonSummary } from '../engine/season';
import type { World } from '../engine/types';
import { clubMap } from './format';

export interface NewsItem {
  id: string;
  section: string;
  headline: string;
  deck: string;
  tone: 'up' | 'down' | 'neutral' | 'mine';
  clubId?: string;
}

const pick = <T,>(items: T[], seed: number) => items[seed % items.length];

export function buildNews(world: World, summary: SeasonSummary | null, clubId: string | null): NewsItem[] {
  const clubs = clubMap(world);
  const name = (id: string) => clubs.get(id)?.shortName ?? id;
  const divName = (id: string) => world.divisions.find((d) => d.id === id)?.name ?? id;
  const items: NewsItem[] = [];
  const mine = clubId ? clubs.get(clubId) : undefined;

  if (!summary) {
    if (mine) {
      const division = world.divisions.find((d) => d.clubIds.includes(mine.id));
      items.push({
        id: 'presentacion',
        section: 'Tu club',
        headline: `Nuevo DT en ${mine.shortName}`,
        deck: `La dirigencia confirmó al cuerpo técnico que encarará la temporada ${world.season} en ${division?.name ?? 'el torneo'}. La hinchada espera señales desde la primera fecha en ${mine.stadium}.`,
        tone: 'mine',
        clubId: mine.id,
      });
    }
    items.push({
      id: 'arranque',
      section: 'Fútbol argentino',
      headline: `Arranca la temporada ${world.season}`,
      deck: `${world.clubs.length} clubes en ${world.divisions.length} categorías buscan su objetivo: títulos arriba, ascensos en el ascenso y evitar los promedios en Primera.`,
      tone: 'neutral',
    });
    return items;
  }

  const ordered = [...summary.divisions].sort(
    (a, b) => (world.divisions.find((d) => d.id === a.divisionId)?.level ?? 9) - (world.divisions.find((d) => d.id === b.divisionId)?.level ?? 9),
  );

  if (clubId) {
    const d = summary.divisions.find((x) => x.ranking.includes(clubId));
    if (d) {
      const place = d.ranking.indexOf(clubId) + 1;
      const champion = d.result.champion === clubId;
      const up = d.promoted.includes(clubId);
      const down = d.relegated.includes(clubId);
      items.push({
        id: 'mine',
        section: 'Tu club',
        headline: champion
          ? `¡${name(clubId)} campeón!`
          : up
            ? `¡${name(clubId)} es de ${divName(d.divisionId) === 'Liga Profesional' ? 'Primera' : 'la categoría de arriba'}!`
            : down
              ? `Golpe duro: ${name(clubId)} pierde la categoría`
              : `${name(clubId)} cerró la temporada en el ${place}.º puesto`,
        deck: champion
          ? `Vuelta olímpica en ${clubs.get(clubId)?.stadium}. El plantel levantó el trofeo de ${divName(d.divisionId)} ante su gente.`
          : up
            ? `Ascenso conseguido en ${divName(d.divisionId)}. Caravana, banderazo y ahora a armar un plantel para la próxima.`
            : down
              ? `Se consumó el descenso en ${divName(d.divisionId)}. La comisión directiva pide calma y promete un proyecto para volver.`
              : `Campaña en ${divName(d.divisionId)} con ${place <= 4 ? 'aspiraciones cumplidas a medias' : 'más dudas que certezas'}. Se viene un mercado clave.`,
        tone: champion || up ? 'up' : down ? 'down' : 'mine',
        clubId,
      });
    }
  }

  ordered.forEach((d, i) => {
    const champ = d.result.champion;
    items.push({
      id: `champ-${d.divisionId}`,
      section: divName(d.divisionId),
      headline: pick(
        [`${name(champ)}, campeón de ${divName(d.divisionId)}`, `Festeja ${name(champ)}: es el campeón`, `${name(champ)} se quedó con el título`],
        i + summary.season,
      ),
      deck: d.promoted.length
        ? `Además de ${name(champ)}, también ascienden ${d.promoted.filter((id) => id !== champ).map(name).join(', ') || 'nadie más'}.`
        : `El campeón cerró una temporada en la que ${d.ranking.length} equipos pelearon cada punto.`,
      tone: 'up',
      clubId: champ,
    });
    if (d.relegated.length) {
      items.push({
        id: `down-${d.divisionId}`,
        section: divName(d.divisionId),
        headline: `Descienden ${d.relegated.map(name).join(' y ')}`,
        deck: d.averages
          ? `Los promedios no perdonaron. ${name(d.relegated[0])} terminó con ${d.averages.find((a) => a.clubId === d.relegated[0])?.average.toFixed(3) ?? '—'}.`
          : `Termina una temporada para el olvido en ${divName(d.divisionId)}.`,
        tone: 'down',
        clubId: d.relegated[0],
      });
    }
  });
  return items;
}
